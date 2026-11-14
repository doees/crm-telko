import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db, locked } from "./db";
import { serviceCall, syncResponse, type Destination } from "./integration";
let stopping = false,
  lastProbe = 0;
async function probe() {
  for (const destination of ["FINANCE", "SCM"] as const) {
    let healthy = false;
    try {
      healthy = (await serviceCall(destination, "/health")).status === "ready";
    } catch {}
    await db().integrationHealth.upsert({
      where: { destination },
      create: { destination, healthy, checkedAt: new Date() },
      update: { healthy, checkedAt: new Date() },
    });
  }
}
export async function tick() {
  if (Date.now() - lastProbe > 30000) {
    lastProbe = Date.now();
    await probe();
  }
  await db()
    .$executeRaw`UPDATE "OutboxEvent" SET status='FAILED',"leaseToken"=NULL,"lockedUntil"=NULL,"nextAttemptAt"=NULL,error='Worker lease expired; retry budget exhausted' WHERE status='PROCESSING' AND "lockedUntil"<NOW() AND attempts>="maxAttempts"`;
  const lease = randomUUID();
  const rows = await db().$queryRaw<
    {
      id: string;
      destination: Destination;
      resourceId: string;
      type: string;
      payload: Prisma.JsonValue;
      attempts: number;
      maxAttempts: number;
    }[]
  >`UPDATE "OutboxEvent" SET status='PROCESSING',attempts=attempts+1,"leaseToken"=${lease},"lockedUntil"=NOW()+INTERVAL '30 seconds' WHERE id=(SELECT id FROM "OutboxEvent" WHERE ((status IN ('PENDING','FAILED') AND "nextAttemptAt"<=NOW() AND attempts<"maxAttempts") OR (status='PROCESSING' AND "lockedUntil"<NOW() AND attempts<"maxAttempts")) ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id,destination,"resourceId",type,payload,attempts,"maxAttempts"`;
  const e = rows[0];
  if (!e) return;
  try {
    const p = e.payload as Record<string, unknown>;
    const path =
      e.type === "invoice.create"
        ? "/v1/invoices"
        : e.type === "fulfillment.request"
          ? "/v1/requests"
          : e.type === "invoice.void"
            ? `/v1/invoices/${p.externalId}/void`
            : `/v1/requests/${p.externalId}/cancel`;
    const response = await serviceCall(
      e.destination,
      path,
      "POST",
      e.type === "invoice.create" || e.type === "fulfillment.request" ? p : {},
      e.id,
    );
    await locked(async (tx) => {
      await syncResponse(tx, e.destination, e.resourceId, response);
      await tx.outboxEvent.updateMany({
        where: { id: e.id, leaseToken: lease },
        data: {
          status: "SUCCEEDED",
          leaseToken: null,
          lockedUntil: null,
          nextAttemptAt: null,
          error: null,
        },
      });
      await tx.integrationAttempt.create({
        data: { eventId: e.id, success: true, responseStatus: 200 },
      });
    });
  } catch (error) {
    await db().outboxEvent.updateMany({
      where: { id: e.id, leaseToken: lease },
      data: {
        status: "FAILED",
        leaseToken: null,
        lockedUntil: null,
        error:
          error instanceof Error
            ? error.message.slice(0, 300)
            : "Pengiriman gagal.",
        nextAttemptAt:
          e.attempts >= e.maxAttempts
            ? null
            : new Date(Date.now() + Math.min(300000, 2 ** e.attempts * 1000)),
      },
    });
    await db().integrationAttempt.create({
      data: {
        eventId: e.id,
        success: false,
        error:
          error instanceof Error
            ? error.message.slice(0, 300)
            : "Pengiriman gagal.",
      },
    });
  }
}
async function main() {
  console.log("CRM outbox worker ready");
  while (!stopping) {
    try {
      await tick();
    } catch {
      console.error("CRM worker database/service unavailable");
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  await db().$disconnect();
}
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    stopping = true;
  });
void main();
