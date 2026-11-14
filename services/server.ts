import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { PrismaClient, Prisma } from "./generated/client";
import { secret, equalSecret, endpoint, signature } from "./protocol";
const kind = process.env.SERVICE_KIND;
if (kind !== "finance" && kind !== "scm")
  throw new Error("SERVICE_KIND must be finance or scm");
const serviceKind: "finance" | "scm" = kind;
const prefix = serviceKind === "finance" ? "FINANCE" : "SCM";
const bearer = secret(prefix + "_SERVICE_TOKEN"),
  hookSecret = secret(prefix + "_WEBHOOK_SECRET");
const callbackUrl =
  endpoint("CRM_CALLBACK_BASE_URL") +
  `/api/v1/integrations/${serviceKind}/events`;
const prisma = new PrismaClient();
class ServiceError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function txWork<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
  for (let i = 0; i < 5; i++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 20000,
        maxWait: 10000,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2034" &&
        i < 4
      )
        continue;
      throw e;
    }
  }
  throw new Error("Transaction retry exhausted");
}
async function idem<T>(
  key: string,
  payload: unknown,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  const hash = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
  return txWork(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
    const previous = await tx.idempotencyRequest.findUnique({ where: { key } });
    if (previous) {
      if (previous.hash !== hash)
        throw new ServiceError(
          409,
          "Idempotency key dipakai untuk payload berbeda.",
        );
      return previous.response;
    }
    const response = JSON.parse(
      JSON.stringify(await work(tx)),
    ) as Prisma.InputJsonValue;
    await tx.idempotencyRequest.create({ data: { key, hash, response } });
    return response;
  });
}
async function enqueue(
  tx: Prisma.TransactionClient,
  type: string,
  payload: Record<string, unknown>,
) {
  const eventId = randomUUID();
  await tx.callback.create({
    data: {
      id: eventId,
      payload: JSON.parse(JSON.stringify({ eventId, type, ...payload })),
    },
  });
}
function invoicePayload(
  invoice: {
    id: string;
    crmResourceId: string;
    version: number;
    amount: Prisma.Decimal;
    status: string;
  },
  paidAt?: Date,
) {
  return {
    resourceId: invoice.crmResourceId,
    externalId: invoice.id,
    version: invoice.version,
    amount: Number(invoice.amount),
    currency: "IDR",
    status: invoice.status,
    ...(paidAt ? { paidAt: paidAt.toISOString() } : {}),
  };
}
function stockPayload(f: {
  id: string;
  crmResourceId: string;
  version: number;
  status: string;
}) {
  return {
    resourceId: f.crmResourceId,
    externalId: f.id,
    version: f.version,
    status: f.status,
  };
}
async function reserveWaiting(tx: Prisma.TransactionClient, sku: string) {
  const stock = await tx.stockItem.findUniqueOrThrow({ where: { sku } });
  let available = stock.onHand - stock.reserved;
  for (const request of await tx.fulfillmentRequest.findMany({
    where: { sku, status: "WAITING_STOCK" },
    orderBy: { createdAt: "asc" },
  })) {
    if (available < request.quantity) continue;
    available -= request.quantity;
    await tx.stockItem.update({
      where: { sku },
      data: { reserved: { increment: request.quantity } },
    });
    const updated = await tx.fulfillmentRequest.update({
      where: { id: request.id },
      data: { status: "RESERVED", version: { increment: 1 } },
    });
    await enqueue(tx, "fulfillment.reserved", stockPayload(updated));
  }
}
const invoiceInput = z
  .object({
    crmResourceId: z.uuid(),
    subscriptionNumber: z.string().min(1).max(50),
    customerName: z.string().min(3).max(100),
    amount: z.number().int().min(10000).max(100000000),
    currency: z.literal("IDR"),
  })
  .strict();
const requestInput = z
  .object({
    crmResourceId: z.uuid(),
    subscriptionNumber: z.string().max(50),
    customerName: z.string().max(100),
    address: z.string().min(8).max(500),
    sku: z.literal("ONT-ROUTER"),
    quantity: z.number().int().min(1).max(10),
  })
  .strict();
async function handle(
  method: string,
  path: string,
  input: unknown,
  key: string,
) {
  if (method === "GET" && path === "/v1/callbacks")
    return prisma.callback.findMany({
      select: {
        id: true,
        status: true,
        attempts: true,
        lastError: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  if (method === "POST" && path === "/v1/callbacks/retry")
    return prisma.callback.updateMany({
      where: { status: "FAILED" },
      data: {
        status: "PENDING",
        attempts: 0,
        nextAttemptAt: new Date(),
        lastError: null,
      },
    });
  if (serviceKind === "finance") {
    if (method === "GET" && path === "/v1/invoices")
      return prisma.serviceInvoice.findMany({
        include: { payment: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      });
    const match = path.match(
      /^\/v1\/invoices\/([0-9a-f-]+)(?:\/(payments|void))?$/i,
    );
    if (method === "GET" && match)
      return prisma.serviceInvoice.findUniqueOrThrow({
        where: { id: z.uuid().parse(match[1]) },
        include: { payment: true },
      });
    if (method === "POST" && path === "/v1/invoices") {
      const data = invoiceInput.parse(input);
      return idem("invoice:" + key, data, async (tx) => {
        const previous = await tx.serviceInvoice.findUnique({
          where: { crmResourceId: data.crmResourceId },
        });
        if (previous) {
          if (Number(previous.amount) !== data.amount)
            throw new ServiceError(409, "Nominal invoice tidak konsisten.");
          return tx.serviceInvoice.findUniqueOrThrow({
            where: { id: previous.id },
            include: { payment: true },
          });
        }
        const invoice = await tx.serviceInvoice.create({ data });
        await enqueue(tx, "invoice.issued", invoicePayload(invoice));
        return invoice;
      });
    }
    if (method === "POST" && match?.[2] === "payments") {
      const id = z.uuid().parse(match[1]);
      const data = z
        .object({
          amount: z.number().int().positive().max(100000000),
          reference: z.string().trim().min(6).max(100),
          paidAt: z.iso.datetime(),
          actorId: z.uuid(),
        })
        .strict()
        .parse(input);
      if (new Date(data.paidAt).getTime() > Date.now() + 60000)
        throw new ServiceError(
          422,
          "Tanggal pembayaran tidak boleh di masa depan.",
        );
      return idem("payment:" + key, { id, ...data }, async (tx) => {
        await tx.$queryRaw`SELECT id FROM "ServiceInvoice" WHERE id=${id}::uuid FOR UPDATE`;
        const invoice = await tx.serviceInvoice.findUniqueOrThrow({
          where: { id },
          include: { payment: true },
        });
        if (invoice.status === "PAID") {
          if (
            invoice.payment?.reference === data.reference &&
            Number(invoice.payment.amount) === data.amount
          )
            return invoice;
          throw new ServiceError(409, "Invoice sudah lunas.");
        }
        if (invoice.status !== "ISSUED")
          throw new ServiceError(409, "Invoice tidak dapat dibayar.");
        if (Number(invoice.amount) !== data.amount)
          throw new ServiceError(422, "Nominal harus sama dengan tagihan.");
        const payment = await tx.payment.create({
          data: {
            invoiceId: id,
            amount: data.amount,
            reference: data.reference,
            paidAt: new Date(data.paidAt),
            actorId: data.actorId,
          },
        });
        const updated = await tx.serviceInvoice.update({
          where: { id },
          data: { status: "PAID", version: { increment: 1 } },
          include: { payment: true },
        });
        await enqueue(
          tx,
          "invoice.paid",
          invoicePayload(updated, payment.paidAt),
        );
        return updated;
      });
    }
    if (method === "POST" && match?.[2] === "void")
      return idem("void:" + key, { id: match[1] }, async (tx) => {
        const id = z.uuid().parse(match[1]);
        await tx.$queryRaw`SELECT id FROM "ServiceInvoice" WHERE id=${id}::uuid FOR UPDATE`;
        const invoice = await tx.serviceInvoice.findUniqueOrThrow({
          where: { id },
        });
        if (invoice.status === "PAID")
          throw new ServiceError(
            409,
            "Invoice lunas memerlukan proses refund terpisah.",
          );
        if (invoice.status === "VOID") return invoice;
        const updated = await tx.serviceInvoice.update({
          where: { id },
          data: { status: "VOID", version: { increment: 1 } },
        });
        await enqueue(tx, "invoice.voided", invoicePayload(updated));
        return updated;
      });
  } else {
    if (method === "GET" && path === "/v1/inventory")
      return prisma.stockItem.findMany({
        include: { movements: { orderBy: { at: "desc" }, take: 20 } },
      });
    if (method === "GET" && path === "/v1/requests")
      return prisma.fulfillmentRequest.findMany({
        orderBy: { createdAt: "desc" },
        take: 500,
      });
    if (method === "POST" && path === "/v1/inventory/receipts") {
      const data = z
        .object({
          sku: z.literal("ONT-ROUTER"),
          quantity: z.number().int().positive().max(10000),
          reference: z.string().trim().min(6).max(100),
          actorId: z.uuid(),
        })
        .strict()
        .parse(input);
      return idem("receipt:" + key, data, async (tx) => {
        await tx.stockItem.upsert({
          where: { sku: data.sku },
          create: { sku: data.sku, name: "Router / ONT" },
          update: {},
        });
        await tx.$queryRaw`SELECT sku FROM "StockItem" WHERE sku=${data.sku} FOR UPDATE`;
        await tx.stockMovement.create({ data: { ...data, type: "RECEIPT" } });
        await tx.stockItem.update({
          where: { sku: data.sku },
          data: { onHand: { increment: data.quantity } },
        });
        await reserveWaiting(tx, data.sku);
        return tx.stockItem.findUniqueOrThrow({ where: { sku: data.sku } });
      });
    }
    if (method === "POST" && path === "/v1/requests") {
      const data = requestInput.parse(input);
      return idem("request:" + key, data, async (tx) => {
        const previous = await tx.fulfillmentRequest.findUnique({
          where: { crmResourceId: data.crmResourceId },
        });
        if (previous) return previous;
        await tx.stockItem.upsert({
          where: { sku: data.sku },
          create: { sku: data.sku, name: "Router / ONT" },
          update: {},
        });
        await tx.$queryRaw`SELECT sku FROM "StockItem" WHERE sku=${data.sku} FOR UPDATE`;
        const stock = await tx.stockItem.findUniqueOrThrow({
          where: { sku: data.sku },
        });
        const canReserve = stock.onHand - stock.reserved >= data.quantity;
        if (canReserve)
          await tx.stockItem.update({
            where: { sku: data.sku },
            data: { reserved: { increment: data.quantity } },
          });
        const f = await tx.fulfillmentRequest.create({
          data: { ...data, status: canReserve ? "RESERVED" : "WAITING_STOCK" },
        });
        await enqueue(
          tx,
          canReserve ? "fulfillment.reserved" : "fulfillment.requested",
          stockPayload(f),
        );
        return f;
      });
    }
    const match = path.match(
      /^\/v1\/requests\/([0-9a-f-]+)(?:\/(deliver|cancel))?$/i,
    );
    if (method === "GET" && match)
      return prisma.fulfillmentRequest.findUniqueOrThrow({
        where: { id: z.uuid().parse(match[1]) },
      });
    if (method === "POST" && match?.[2]) {
      const id = z.uuid().parse(match[1]);
      const data =
        match[2] === "deliver"
          ? z
              .object({
                reference: z.string().trim().min(6).max(100),
                recipient: z.string().trim().min(3).max(100),
                actorId: z.uuid(),
              })
              .strict()
              .parse(input)
          : {};
      return idem(match[2] + ":" + key, { id, ...data }, async (tx) => {
        const initial = await tx.fulfillmentRequest.findUniqueOrThrow({
          where: { id },
        });
        await tx.$queryRaw`SELECT sku FROM "StockItem" WHERE sku=${initial.sku} FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "FulfillmentRequest" WHERE id=${id}::uuid FOR UPDATE`;
        const f = await tx.fulfillmentRequest.findUniqueOrThrow({
          where: { id },
        });
        if (match[2] === "cancel") {
          if (f.status === "DELIVERED")
            throw new ServiceError(
              409,
              "Perangkat terkirim membutuhkan proses pengembalian.",
            );
          if (f.status === "CANCELLED") return f;
          if (f.status === "RESERVED")
            await tx.stockItem.update({
              where: { sku: f.sku },
              data: { reserved: { decrement: f.quantity } },
            });
          const updated = await tx.fulfillmentRequest.update({
            where: { id },
            data: { status: "CANCELLED", version: { increment: 1 } },
          });
          await enqueue(tx, "fulfillment.cancelled", stockPayload(updated));
          await reserveWaiting(tx, f.sku);
          return updated;
        }
        const delivery = data as {
          reference: string;
          recipient: string;
          actorId: string;
        };
        if (
          f.status === "DELIVERED" &&
          f.deliveryReference === delivery.reference
        )
          return f;
        if (f.status !== "RESERVED")
          throw new ServiceError(
            409,
            "Perangkat harus memiliki reservasi stok sebelum diserahkan.",
          );
        const stock = await tx.stockItem.findUniqueOrThrow({
          where: { sku: f.sku },
        });
        if (stock.onHand < f.quantity || stock.reserved < f.quantity)
          throw new ServiceError(409, "Stok tidak mencukupi.");
        await tx.stockItem.update({
          where: { sku: f.sku },
          data: {
            onHand: { decrement: f.quantity },
            reserved: { decrement: f.quantity },
          },
        });
        await tx.stockMovement.create({
          data: {
            sku: f.sku,
            quantity: -f.quantity,
            reference: delivery.reference,
            actorId: delivery.actorId,
            type: "DELIVERY",
          },
        });
        const updated = await tx.fulfillmentRequest.update({
          where: { id },
          data: {
            status: "DELIVERED",
            version: { increment: 1 },
            deliveryReference: delivery.reference,
            recipient: delivery.recipient,
            deliveredAt: new Date(),
          },
        });
        await enqueue(tx, "fulfillment.delivered", stockPayload(updated));
        return updated;
      });
    }
  }
  throw new ServiceError(404, "Endpoint tidak ditemukan.");
}
async function readBody(req: IncomingMessage) {
  let text = "";
  for await (const chunk of req) {
    text += chunk;
    if (Buffer.byteLength(text) > 32768)
      throw new ServiceError(413, "Payload terlalu besar.");
  }
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new ServiceError(400, "JSON tidak valid.");
  }
}
function respond(res: ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url ?? "/", "http://internal").pathname;
    if (req.method === "GET" && path === "/health") {
      await prisma.$queryRaw`SELECT 1`;
      respond(res, 200, { data: { status: "ready" } });
      return;
    }
    if (!equalSecret(req.headers.authorization ?? "", "Bearer " + bearer))
      throw new ServiceError(401, "Service credential tidak valid.");
    const key = String(req.headers["idempotency-key"] ?? "");
    if (req.method === "POST" && (key.length < 8 || key.length > 200))
      throw new ServiceError(
        400,
        "Idempotency-Key wajib diisi (8–200 karakter).",
      );
    respond(res, 200, {
      data: await handle(req.method ?? "GET", path, await readBody(req), key),
    });
  } catch (error) {
    console.error("Service request failed", {
      name: error instanceof Error ? error.name : "Unknown",
      code:
        error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "",
    });
    const status =
      error instanceof ServiceError
        ? error.status
        : error instanceof z.ZodError
          ? 422
          : error instanceof Prisma.PrismaClientKnownRequestError
            ? error.code === "P2002"
              ? 409
              : error.code === "P2025"
                ? 404
                : 500
            : 500;
    respond(res, status, {
      error: {
        message:
          error instanceof ServiceError
            ? error.message
            : error instanceof z.ZodError
              ? error.issues[0].message
              : status === 409
                ? "Referensi sudah digunakan."
                : status === 404
                  ? "Data tidak ditemukan."
                  : "Layanan tidak tersedia.",
      },
    });
  }
});
let stopping = false;
async function callbackTick() {
  await prisma.$executeRaw`UPDATE "Callback" SET status='FAILED',"leaseToken"=NULL,"lockedUntil"=NULL,"nextAttemptAt"=NULL,"lastError"='Callback lease expired; retry budget exhausted' WHERE status='PROCESSING' AND "lockedUntil"<NOW() AND attempts>=20`;
  const lease = randomUUID();
  const rows = await prisma.$queryRaw<
    { id: string; payload: Prisma.JsonValue; attempts: number }[]
  >`UPDATE "Callback" SET status='PROCESSING', attempts=attempts+1, "leaseToken"=${lease},"lockedUntil"=NOW()+INTERVAL '30 seconds' WHERE id=(SELECT id FROM "Callback" WHERE ((status IN ('PENDING','FAILED') AND "nextAttemptAt"<=NOW() AND attempts<20) OR (status='PROCESSING' AND "lockedUntil"<NOW() AND attempts<20)) ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id,payload,attempts`;
  const row = rows[0];
  if (!row) return;
  try {
    const timestamp = String(Date.now()),
      raw = JSON.stringify(row.payload);
    const response = await fetch(callbackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hook-Timestamp": timestamp,
        "X-Hook-Signature": signature(hookSecret, timestamp, raw),
      },
      body: raw,
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`CRM callback HTTP ${response.status}`);
    await prisma.callback.updateMany({
      where: { id: row.id, leaseToken: lease },
      data: {
        status: "SUCCEEDED",
        lockedUntil: null,
        leaseToken: null,
        lastError: null,
        nextAttemptAt: null,
      },
    });
  } catch (error) {
    await prisma.callback.updateMany({
      where: { id: row.id, leaseToken: lease },
      data: {
        status: "FAILED",
        lockedUntil: null,
        leaseToken: null,
        lastError: error instanceof Error ? error.message : "Delivery failed",
        nextAttemptAt:
          row.attempts >= 20
            ? null
            : new Date(Date.now() + Math.min(300000, 2 ** row.attempts * 1000)),
      },
    });
  }
}
async function loop() {
  while (!stopping) {
    try {
      await callbackTick();
    } catch {
      console.error(prefix + " callback worker unavailable");
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
server.listen(
  Number(process.env.PORT ?? (serviceKind === "finance" ? 4101 : 4102)),
  () => console.log(prefix + " API ready"),
);
void loop();
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    stopping = true;
    server.close(() => {
      void prisma.$disconnect();
    });
  });
