import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import type { Tx } from "./db";
import { db, locked } from "./db";
import type { Actor } from "./auth";
import { HttpError } from "./http";
import { ensureCancellation } from "./integration";
import { applyCommand } from "@/modules/crm/domain";
import type { Command, CrmState } from "@/modules/crm/types";
import { z } from "zod";
import { customerInput, packageInput, ticketInput } from "@/modules/crm/types";
const uuid = z.uuid();
export const commandInput = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("SAVE_CUSTOMER"),
      id: uuid.optional(),
      data: customerInput.strict(),
    })
    .strict(),
  z.object({ type: z.literal("TOGGLE_CUSTOMER"), id: uuid }).strict(),
  z
    .object({
      type: z.literal("SAVE_PACKAGE"),
      id: uuid.optional(),
      data: packageInput.strict(),
    })
    .strict(),
  z.object({ type: z.literal("TOGGLE_PACKAGE"), id: uuid }).strict(),
  z
    .object({
      type: z.literal("CREATE_SUBSCRIPTION"),
      customerId: uuid,
      packageId: uuid,
      address: z.string().trim().min(8).max(500),
    })
    .strict(),
  z
    .object({
      type: z.literal("SUBSCRIPTION_STATUS"),
      id: uuid,
      status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "CANCELLED"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("SAVE_TICKET"),
      id: uuid.optional(),
      data: ticketInput.strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("TICKET_STATUS"),
      id: uuid,
      status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("TICKET_ASSIGN"),
      id: uuid,
      assignee: z.string().min(1).max(100),
    })
    .strict(),
  z
    .object({
      type: z.literal("TICKET_COMMENT"),
      id: uuid,
      text: z.string().trim().min(3).max(2000),
    })
    .strict(),
  z.object({ type: z.literal("DISPATCH"), id: uuid }).strict(),
]);
export async function readState(
  tx: Tx,
  actor: Actor,
  scope = true,
): Promise<CrmState> {
  const [
    customers,
    packages,
    subscriptions,
    tickets,
    invoices,
    fulfillments,
    events,
    activity,
    health,
    workspace,
    team,
  ] = await Promise.all([
    tx.customer.findMany({ orderBy: { createdAt: "desc" } }),
    tx.servicePackage.findMany({ orderBy: { name: "asc" } }),
    tx.subscription.findMany({ orderBy: { createdAt: "desc" } }),
    tx.ticket.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        comments: {
          include: { author: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    tx.invoice.findMany({ orderBy: { createdAt: "desc" } }),
    tx.fulfillment.findMany(),
    tx.outboxEvent.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
    tx.activity.findMany({ orderBy: { at: "desc" }, take: 200 }),
    tx.integrationHealth.findMany(),
    tx.workspace.findUnique({ where: { id: "default" } }),
    tx.user.findMany({
      select: { id: true, name: true, role: true, isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const state: CrmState = {
    version: 2,
    revision: workspace?.revision ?? 0,
    role: actor.role,
    team,
    customers: customers.map((c) => ({
      id: c.id,
      number: c.customerNumber,
      name: c.name,
      email: c.email ?? "",
      phone: c.phone,
      address: c.address,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
    })),
    packages: packages.map((p) => ({
      ...p,
      category: p.category as "HOME" | "BUSINESS",
      price: Number(p.price),
    })),
    subscriptions: subscriptions.map((s) => ({
      ...s,
      price: Number(s.price),
      createdAt: s.createdAt.toISOString(),
      activatedAt: s.activatedAt?.toISOString(),
    })),
    tickets: tickets.map((t) => ({
      id: t.id,
      number: t.number,
      customerId: t.customerId,
      subscriptionId: t.subscriptionId ?? "",
      subject: t.subject,
      description: t.description,
      priority: t.priority,
      status: t.status,
      assignee: t.assigneeId ?? "Belum ditugaskan",
      createdAt: t.createdAt.toISOString(),
      comments: t.comments.map((c) => ({
        id: c.id,
        author: c.author.name,
        text: c.text,
        at: c.createdAt.toISOString(),
      })),
    })),
    invoices: invoices.map((i) => ({
      id: i.id,
      number: i.number,
      subscriptionId: i.subscriptionId,
      amount: Number(i.amount),
      status: i.status,
      externalId: i.externalId ?? undefined,
      createdAt: i.createdAt.toISOString(),
      paidAt: i.paidAt?.toISOString(),
    })),
    fulfillments: fulfillments.map((f) => ({
      id: f.id,
      subscriptionId: f.subscriptionId,
      status: f.status,
      externalId: f.externalId ?? undefined,
      externalStatus: f.externalStatus ?? undefined,
    })),
    events: events.map((e) => ({
      id: e.id,
      destination: e.destination as "FINANCE" | "SCM",
      resourceId: e.resourceId,
      type: e.type,
      status: e.status,
      attempts: e.attempts,
      createdAt: e.createdAt.toISOString(),
      error: e.error ?? undefined,
    })),
    activity: activity.map((a) => ({
      id: a.id,
      text: a.text,
      at: a.at.toISOString(),
      category: a.category as CrmState["activity"][number]["category"],
    })),
    connections: {
      FINANCE: health.some((h) => h.destination === "FINANCE" && h.healthy),
      SCM: health.some((h) => h.destination === "SCM" && h.healthy),
    },
    processedCallbacks: [],
  };
  if (scope && actor.role === "TECHNICIAN") {
    state.tickets = state.tickets.filter((t) => t.assignee === actor.id);
    const ids = new Set(state.tickets.map((t) => t.customerId));
    state.customers = state.customers.filter((c) => ids.has(c.id));
    state.subscriptions = state.subscriptions.filter((s) =>
      ids.has(s.customerId),
    );
    state.invoices = [];
    state.fulfillments = [];
    state.events = [];
    state.activity = [];
  }
  return state;
}
const changed = <T extends { id: string }>(old: T[], next: T[]) =>
  next.filter(
    (n) => JSON.stringify(n) !== JSON.stringify(old.find((o) => o.id === n.id)),
  );
async function persist(tx: Tx, old: CrmState, next: CrmState, actor: Actor) {
  for (const c of changed(old.customers, next.customers)) {
    const data = {
      customerNumber: c.number,
      name: c.name,
      email: c.email || null,
      phone: c.phone,
      phoneNormalized: c.phone.replace(/[^0-9]/g, ""),
      address: c.address,
      status: c.status,
      createdAt: new Date(c.createdAt),
    };
    await tx.customer.upsert({
      where: { id: c.id },
      create: { id: c.id, ...data },
      update: data,
    });
  }
  for (const p of changed(old.packages, next.packages)) {
    const { id, ...data } = p;
    await tx.servicePackage.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
  }
  for (const s of changed(old.subscriptions, next.subscriptions)) {
    const data = {
      number: s.number,
      customerId: s.customerId,
      packageId: s.packageId,
      price: s.price,
      device: s.device,
      address: s.address,
      status: s.status,
      createdAt: new Date(s.createdAt),
      activatedAt: s.activatedAt ? new Date(s.activatedAt) : null,
    };
    await tx.subscription.upsert({
      where: { id: s.id },
      create: { id: s.id, ...data },
      update: data,
    });
  }
  for (const t of changed(old.tickets, next.tickets)) {
    const data = {
      number: t.number,
      customerId: t.customerId,
      subscriptionId: t.subscriptionId || null,
      subject: t.subject,
      description: t.description,
      priority: t.priority,
      status: t.status,
      assigneeId: t.assignee === "Belum ditugaskan" ? null : t.assignee,
      createdAt: new Date(t.createdAt),
    };
    await tx.ticket.upsert({
      where: { id: t.id },
      create: { id: t.id, ...data },
      update: data,
    });
    for (const c of t.comments.filter(
      (c) =>
        !old.tickets
          .find((o) => o.id === t.id)
          ?.comments.some((o) => o.id === c.id),
    ))
      await tx.ticketComment.create({
        data: {
          id: c.id,
          ticketId: t.id,
          authorId: actor.id,
          text: c.text,
          createdAt: new Date(c.at),
        },
      });
  }
  for (const i of changed(old.invoices, next.invoices)) {
    const data = {
      number: i.number,
      subscriptionId: i.subscriptionId,
      amount: i.amount,
      status: i.status,
      createdAt: new Date(i.createdAt),
      externalId: i.externalId,
      paidAt: i.paidAt ? new Date(i.paidAt) : null,
    };
    await tx.invoice.upsert({
      where: { id: i.id },
      create: { id: i.id, ...data },
      update: data,
    });
  }
  for (const f of changed(old.fulfillments, next.fulfillments)) {
    const data = {
      subscriptionId: f.subscriptionId,
      status: f.status,
      externalId: f.externalId,
      externalStatus: f.externalStatus,
    };
    await tx.fulfillment.upsert({
      where: { id: f.id },
      create: { id: f.id, ...data },
      update: data,
    });
  }
  for (const event of next.events.filter(
    (e) => !old.events.some((o) => o.id === e.id),
  )) {
    const invoice = next.invoices.find((i) => i.id === event.resourceId);
    const fulfillment = next.fulfillments.find(
      (f) => f.id === event.resourceId,
    );
    const sub = next.subscriptions.find(
      (s) => s.id === (invoice?.subscriptionId ?? fulfillment?.subscriptionId),
    );
    const customer = next.customers.find((c) => c.id === sub?.customerId);
    if (!sub || !customer) throw new Error("Outbox relation invalid");
    const payload =
      event.destination === "FINANCE"
        ? {
            crmResourceId: invoice!.id,
            subscriptionNumber: sub.number,
            customerName: customer.name,
            amount: invoice!.amount,
            currency: "IDR",
          }
        : {
            crmResourceId: fulfillment!.id,
            subscriptionNumber: sub.number,
            customerName: customer.name,
            address: sub.address,
            sku: "ONT-ROUTER",
            quantity: 1,
          };
    await tx.outboxEvent.create({
      data: {
        id: event.id,
        dedupeKey: event.type + ":" + event.resourceId,
        destination: event.destination,
        resourceId: event.resourceId,
        type: event.type,
        payload,
      },
    });
  }
  for (const activity of next.activity.filter(
    (a) => !old.activity.some((o) => o.id === a.id),
  ))
    await tx.activity.create({
      data: {
        id: activity.id,
        text: activity.text,
        category: activity.category,
        at: new Date(activity.at),
      },
    });
  await tx.workspace.update({
    where: { id: "default" },
    data: { revision: { increment: 1 } },
  });
}
export async function execute(
  actor: Actor,
  input: unknown,
  requestId = crypto.randomUUID(),
) {
  const command = commandInput.parse(input) as Command;
  if (requestId.length < 8 || requestId.length > 120)
    throw new HttpError(400, "Idempotency-Key harus berisi 8–120 karakter.");
  const receiptId = createHash("sha256")
      .update(actor.id + ":" + requestId)
      .digest("hex"),
    receiptHash = createHash("sha256")
      .update(JSON.stringify(command))
      .digest("hex");
  if (actor.role === "MANAGER")
    throw new HttpError(
      403,
      "Akun manajer hanya dapat membaca data.",
      "FORBIDDEN",
    );
  if (
    actor.role === "TECHNICIAN" &&
    !["TICKET_STATUS", "TICKET_COMMENT"].includes(command.type)
  )
    throw new HttpError(
      403,
      "Teknisi hanya dapat menangani tiket yang ditugaskan.",
      "FORBIDDEN",
    );
  return locked(async (tx) => {
    const current = await tx.user.findUnique({ where: { id: actor.id } });
    if (!current?.isActive || current.role !== actor.role)
      throw new HttpError(403, "Izin akun berubah. Muat ulang sesi.");
    const receipt = await tx.commandReceipt.findUnique({
      where: { id: receiptId },
    });
    if (receipt) {
      if (receipt.hash !== receiptHash)
        throw new HttpError(
          409,
          "Idempotency-Key digunakan untuk perubahan berbeda.",
        );
      return readState(tx, actor);
    }
    const old = await readState(tx, actor, false);
    if (command.type === "DISPATCH") {
      if (actor.role !== "ADMIN")
        throw new HttpError(
          403,
          "Hanya administrator dapat mencoba ulang integrasi.",
        );
      const event = await tx.outboxEvent.findUnique({
        where: { id: command.id },
      });
      if (!event) throw new HttpError(404, "Event tidak ditemukan.");
      if (event.status === "SUCCEEDED" || event.status === "PROCESSING")
        throw new HttpError(409, "Event sudah berhasil atau masih diproses.");
      await tx.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: "PENDING",
          nextAttemptAt: new Date(),
          maxAttempts: event.attempts + 5,
          error: null,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "INTEGRATION_REQUEUED",
          data: { eventId: event.id },
        },
      });
      await tx.commandReceipt.create({
        data: { id: receiptId, actorId: actor.id, hash: receiptHash },
      });
      await tx.workspace.update({
        where: { id: "default" },
        data: { revision: { increment: 1 } },
      });
      return readState(tx, actor);
    }
    const assignee =
      command.type === "SAVE_TICKET"
        ? command.data.assignee
        : command.type === "TICKET_ASSIGN"
          ? command.assignee
          : undefined;
    if (
      assignee &&
      assignee !== "Belum ditugaskan" &&
      !old.team?.some(
        (u) => u.id === assignee && u.role === "TECHNICIAN" && u.isActive,
      )
    )
      throw new HttpError(422, "Pilih akun teknisi aktif.");
    let next: CrmState;
    try {
      next = applyCommand(
        old,
        command,
        new Date().toISOString(),
        () => crypto.randomUUID(),
        actor,
      );
    } catch (error) {
      if (error instanceof z.ZodError) throw error;
      throw new HttpError(
        409,
        error instanceof Error ? error.message : "Perubahan tidak diizinkan.",
      );
    }
    await persist(tx, old, next, actor);
    if (
      command.type === "SUBSCRIPTION_STATUS" &&
      command.status === "CANCELLED"
    )
      await ensureCancellation(tx, command.id);
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: command.type,
        data: JSON.parse(JSON.stringify(command)) as Prisma.InputJsonValue,
      },
    });
    await tx.commandReceipt.create({
      data: { id: receiptId, actorId: actor.id, hash: receiptHash },
    });
    return readState(tx, actor);
  });
}
export function snapshot(actor: Actor) {
  return db().$transaction((tx) => readState(tx, actor), {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  });
}
