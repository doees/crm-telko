import { z } from "zod";
import { db, locked, type Tx } from "./db";
import { HttpError, rawBody } from "./http";
import type { Actor } from "./auth";
import { secret, endpoint, validSignature } from "../../services/protocol";
export type Destination = "FINANCE" | "SCM";
export async function serviceCall(
  destination: Destination,
  path: string,
  method = "GET",
  payload?: unknown,
  key = crypto.randomUUID(),
): Promise<Record<string, unknown>> {
  const url = endpoint(destination + "_API_URL") + path;
  const response = await fetch(url, {
    method,
    cache: "no-store",
    headers: {
      Authorization: "Bearer " + secret(destination + "_SERVICE_TOKEN"),
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    signal: AbortSignal.timeout(8000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok)
    throw new HttpError(
      response.status >= 500 || [401, 403].includes(response.status)
        ? 502
        : response.status,
      result?.error?.message?.slice(0, 300) ??
        `Layanan ${destination} merespons HTTP ${response.status}.`,
      "INTEGRATION_ERROR",
    );
  if (!result || !("data" in result))
    throw new HttpError(502, "Respons layanan tidak valid.");
  return result.data;
}
const remoteInput = z
  .object({
    eventId: z.string().min(8).max(160),
    type: z.string().min(3).max(80),
    resourceId: z.uuid(),
    externalId: z.uuid(),
    version: z.number().int().positive(),
    status: z.string(),
    amount: z.number().int().nonnegative().optional(),
    currency: z.literal("IDR").optional(),
    paidAt: z.iso.datetime().optional(),
  })
  .strict();
export async function ensureCancellation(tx: Tx, subscriptionId: string) {
  const sub = await tx.subscription.findUniqueOrThrow({
    where: { id: subscriptionId },
    include: { invoice: true, fulfillment: true },
  });
  if (sub.status !== "CANCELLED") return;
  const invoice = sub.invoice;
  if (invoice && invoice.status !== "PAID" && invoice.status !== "VOID") {
    if (invoice.externalId)
      await tx.outboxEvent.upsert({
        where: { dedupeKey: "invoice.void:" + invoice.id },
        create: {
          dedupeKey: "invoice.void:" + invoice.id,
          destination: "FINANCE",
          resourceId: invoice.id,
          type: "invoice.void",
          payload: { externalId: invoice.externalId },
        },
        update: {},
      });
    else {
      const event = await tx.outboxEvent.findUnique({
        where: { dedupeKey: "invoice.create:" + invoice.id },
      });
      if (event?.attempts === 0) {
        await tx.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: "SUCCEEDED",
            nextAttemptAt: null,
            error: "Cancelled before dispatch",
          },
        });
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: "VOID" },
        });
      }
    }
  }
  const f = sub.fulfillment;
  if (f && !["FULFILLED", "CANCELLED"].includes(f.status)) {
    if (f.externalId)
      await tx.outboxEvent.upsert({
        where: { dedupeKey: "fulfillment.cancel:" + f.id },
        create: {
          dedupeKey: "fulfillment.cancel:" + f.id,
          destination: "SCM",
          resourceId: f.id,
          type: "fulfillment.cancel",
          payload: { externalId: f.externalId },
        },
        update: {},
      });
    else {
      const event = await tx.outboxEvent.findUnique({
        where: { dedupeKey: "fulfillment.request:" + f.id },
      });
      if (event?.attempts === 0) {
        await tx.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: "SUCCEEDED",
            nextAttemptAt: null,
            error: "Cancelled before dispatch",
          },
        });
        await tx.fulfillment.update({
          where: { id: f.id },
          data: { status: "CANCELLED" },
        });
      }
    }
  }
}
async function activate(tx: Tx, id: string) {
  const sub = await tx.subscription.findUniqueOrThrow({
    where: { id },
    include: { invoice: true, fulfillment: true },
  });
  if (
    sub.status === "PENDING" &&
    sub.invoice?.status === "PAID" &&
    (!sub.device || sub.fulfillment?.status === "FULFILLED")
  ) {
    await tx.subscription.update({
      where: { id },
      data: { status: "ACTIVE", activatedAt: new Date() },
    });
    await tx.activity.create({
      data: {
        text: `${sub.number} aktif setelah pembayaran dan pemenuhan terkonfirmasi`,
        category: "subscription",
      },
    });
    await tx.auditLog.create({
      data: { action: "SUBSCRIPTION_ACTIVATED", data: { subscriptionId: id } },
    });
  }
}
export async function applyRemote(tx: Tx, source: Destination, input: unknown) {
  const event = remoteInput.parse(input);
  if (
    await tx.inboxEvent.findUnique({
      where: {
        source_externalEventId: { source, externalEventId: event.eventId },
      },
    })
  )
    return { duplicate: true };
  let subscriptionId: string;
  if (source === "FINANCE") {
    const data = z
      .object({
        status: z.enum(["ISSUED", "PAID", "VOID"]),
        amount: z.number().int().positive(),
        currency: z.literal("IDR"),
        paidAt: z.iso.datetime().optional(),
      })
      .parse(event);
    const invoice = await tx.invoice.findUnique({
      where: { id: event.resourceId },
    });
    if (!invoice)
      throw new HttpError(404, "Referensi invoice tidak ditemukan.");
    if (
      Number(invoice.amount) !== data.amount ||
      (invoice.externalId && invoice.externalId !== event.externalId)
    )
      throw new HttpError(
        409,
        "Identitas atau nominal invoice tidak konsisten.",
      );
    subscriptionId = invoice.subscriptionId;
    if (event.version > invoice.externalVersion) {
      if (
        ["PAID", "VOID"].includes(invoice.status) &&
        invoice.status !== data.status
      )
        throw new HttpError(409, "Status final invoice tidak boleh ditimpa.");
      if (data.status === "PAID" && !data.paidAt)
        throw new HttpError(422, "Waktu pembayaran wajib disertakan.");
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: data.status,
          externalId: event.externalId,
          externalVersion: event.version,
          paidAt: data.paidAt ? new Date(data.paidAt) : undefined,
        },
      });
      await tx.activity.create({
        data: {
          text: `${invoice.number}: status ${data.status} diterima dari Keuangan`,
          category: "integration",
        },
      });
    }
  } else {
    const status = z
      .enum(["WAITING_STOCK", "RESERVED", "DELIVERED", "CANCELLED"])
      .parse(event.status);
    const f = await tx.fulfillment.findUnique({
      where: { id: event.resourceId },
    });
    if (!f) throw new HttpError(404, "Referensi pemenuhan tidak ditemukan.");
    if (f.externalId && f.externalId !== event.externalId)
      throw new HttpError(409, "Identitas pemenuhan tidak konsisten.");
    subscriptionId = f.subscriptionId;
    if (event.version > f.externalVersion) {
      const mapped =
        status === "DELIVERED"
          ? "FULFILLED"
          : status === "CANCELLED"
            ? "CANCELLED"
            : "PROCESSING";
      if (["FULFILLED", "CANCELLED"].includes(f.status) && mapped !== f.status)
        throw new HttpError(409, "Status final perangkat tidak boleh ditimpa.");
      await tx.fulfillment.update({
        where: { id: f.id },
        data: {
          status: mapped,
          externalId: event.externalId,
          externalStatus: status,
          externalVersion: event.version,
        },
      });
      await tx.activity.create({
        data: {
          text: `Pemenuhan perangkat: status ${status} diterima dari SCM`,
          category: "integration",
        },
      });
    }
  }
  await tx.inboxEvent.create({
    data: {
      source,
      externalEventId: event.eventId,
      resourceId: event.resourceId,
      version: event.version,
    },
  });
  await activate(tx, subscriptionId);
  await ensureCancellation(tx, subscriptionId);
  await tx.workspace.update({
    where: { id: "default" },
    data: { revision: { increment: 1 } },
  });
  return { received: true };
}
export async function webhook(request: Request, source: Destination) {
  const raw = await rawBody(request);
  if (
    !validSignature(
      secret(source + "_WEBHOOK_SECRET"),
      request.headers.get("x-hook-timestamp"),
      request.headers.get("x-hook-signature"),
      raw,
    )
  )
    throw new HttpError(
      401,
      "Tanda tangan callback tidak valid.",
      "INVALID_SIGNATURE",
    );
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new HttpError(400, "JSON tidak valid.");
  }
  return locked((tx) => applyRemote(tx, source, payload));
}
export async function gateway(
  actor: Actor,
  kind: "payment" | "delivery" | "receipt" | "retry-finance" | "retry-scm",
  id: string,
  input: unknown,
  key: string,
) {
  if (actor.role !== "ADMIN")
    throw new HttpError(
      403,
      "Hanya administrator dapat mencatat operasi Keuangan/SCM.",
      "FORBIDDEN",
    );
  let result: unknown;
  if (kind === "payment") {
    const data = z
      .object({
        amount: z.number().int().positive().max(100000000),
        reference: z.string().trim().min(6).max(100),
        paidAt: z.iso.datetime(),
        verified: z.literal(true),
      })
      .strict()
      .parse(input);
    const invoice = await db().invoice.findUnique({
      where: { id },
      include: { subscription: true },
    });
    if (!invoice?.externalId)
      throw new HttpError(409, "Invoice belum diterbitkan Keuangan.");
    if (invoice.subscription.status === "CANCELLED")
      throw new HttpError(
        409,
        "Langganan dibatalkan; rekonsiliasi pembayaran dilakukan di Keuangan.",
      );
    result = await serviceCall(
      "FINANCE",
      `/v1/invoices/${invoice.externalId}/payments`,
      "POST",
      {
        amount: data.amount,
        reference: data.reference,
        paidAt: data.paidAt,
        actorId: actor.id,
      },
      key,
    );
  } else if (kind === "delivery") {
    const data = z
      .object({
        reference: z.string().trim().min(6).max(100),
        recipient: z.string().trim().min(3).max(100),
      })
      .strict()
      .parse(input);
    const f = await db().fulfillment.findUnique({
      where: { id },
      include: { subscription: true },
    });
    if (!f?.externalId)
      throw new HttpError(409, "Permintaan belum diterima SCM.");
    if (f.subscription.status === "CANCELLED")
      throw new HttpError(409, "Langganan sudah dibatalkan.");
    result = await serviceCall(
      "SCM",
      `/v1/requests/${f.externalId}/deliver`,
      "POST",
      { ...data, actorId: actor.id },
      key,
    );
  } else if (kind === "receipt") {
    const data = z
      .object({
        quantity: z.number().int().positive().max(10000),
        reference: z.string().trim().min(6).max(100),
      })
      .strict()
      .parse(input);
    result = await serviceCall(
      "SCM",
      "/v1/inventory/receipts",
      "POST",
      { ...data, sku: "ONT-ROUTER", actorId: actor.id },
      key,
    );
  } else
    result = await serviceCall(
      kind === "retry-finance" ? "FINANCE" : "SCM",
      "/v1/callbacks/retry",
      "POST",
      {},
      key,
    );
  await db().auditLog.create({
    data: {
      actorId: actor.id,
      action: "SERVICE_" + kind.toUpperCase(),
      data: { resourceId: id, requestId: key },
    },
  });
  return result;
}
export async function syncResponse(
  tx: Tx,
  destination: Destination,
  resourceId: string,
  response: Record<string, unknown>,
) {
  const common = {
    eventId: `response-${destination}-${response.id}-${response.version}`,
    type: "response.sync",
    resourceId,
    externalId: response.id,
    version: response.version,
    status: response.status,
  };
  const payload =
    destination === "FINANCE"
      ? {
          ...common,
          amount: Number(response.amount),
          currency: response.currency,
          ...((response.payment as { paidAt?: string } | undefined)?.paidAt
            ? { paidAt: (response.payment as { paidAt: string }).paidAt }
            : {}),
        }
      : common;
  return applyRemote(tx, destination, payload);
}
