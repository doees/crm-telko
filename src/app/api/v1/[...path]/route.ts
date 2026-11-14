import { z } from "zod";
import {
  authorize,
  session,
  login,
  logout,
  changePassword,
  createUser,
  updateUser,
} from "@/server/auth";
import { json, body, errorResponse, HttpError } from "@/server/http";
import { db } from "@/server/db";
import { snapshot, execute } from "@/server/state";
import { gateway, webhook, serviceCall } from "@/server/integration";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
async function route(request: Request, context: Context) {
  try {
    const parts = (await context.params).path;
    const path = parts.join("/"),
      method = request.method;
    if (method === "GET" && path === "health") {
      await db().$queryRaw`SELECT 1`;
      return json({ status: "ready" });
    }
    if (method === "POST" && path === "auth/login")
      return await login(request, await body(request, 4096));
    if (method === "GET" && path === "auth/session") {
      const current = await session(request);
      return json({ user: current.user, csrf: current.csrf });
    }
    if (method === "POST" && path === "auth/logout")
      return await logout(request);
    if (method === "POST" && path === "auth/password")
      return await changePassword(request, await body(request, 4096));
    if (
      method === "POST" &&
      (path === "integrations/finance/events" ||
        path === "integrations/scm/events")
    )
      return json(
        await webhook(request, parts[1] === "finance" ? "FINANCE" : "SCM"),
      );
    const auth = await authorize(request, undefined, method !== "GET");
    const actor = auth.user;
    const executeRequest = (user: typeof actor, command: unknown) =>
      execute(
        user,
        command,
        request.headers.get("idempotency-key") ?? crypto.randomUUID(),
      );
    if (method === "GET" && path === "state")
      return json(await snapshot(actor));
    if (method === "POST" && path === "commands")
      return json(
        await execute(
          actor,
          await body(request),
          request.headers.get("idempotency-key") ?? crypto.randomUUID(),
        ),
      );
    if (path === "users" && method === "GET") {
      if (actor.role !== "ADMIN") throw new HttpError(403, "Akses ditolak.");
      return json(
        await db().user.findMany({
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
          orderBy: { name: "asc" },
        }),
      );
    }
    if (path === "users" && method === "POST")
      return json(await createUser(actor, await body(request)), 201);
    if (parts[0] === "users" && parts.length === 2 && method === "PATCH")
      return json(
        await updateUser(actor, z.uuid().parse(parts[1]), await body(request)),
      );
    if (path === "audit" && method === "GET") {
      if (actor.role !== "ADMIN") throw new HttpError(403, "Akses ditolak.");
      return json(
        await db().auditLog.findMany({
          orderBy: { at: "desc" },
          take: 200,
          include: { actor: { select: { name: true } } },
        }),
      );
    }
    if (path === "integrations/inventory" && method === "GET") {
      if (actor.role !== "ADMIN") throw new HttpError(403, "Akses ditolak.");
      return json(await serviceCall("SCM", "/v1/inventory"));
    }
    if (path === "integrations/inventory/receipts" && method === "POST")
      return json(
        await gateway(
          actor,
          "receipt",
          "ONT-ROUTER",
          await body(request),
          request.headers.get("idempotency-key") ?? crypto.randomUUID(),
        ),
        201,
      );
    if (
      parts[0] === "integrations" &&
      parts[1] === "finance" &&
      parts[2] === "invoices" &&
      parts[4] === "payments" &&
      parts.length === 5 &&
      method === "POST"
    )
      return json(
        await gateway(
          actor,
          "payment",
          z.uuid().parse(parts[3]),
          await body(request),
          request.headers.get("idempotency-key") ?? crypto.randomUUID(),
        ),
      );
    if (
      parts[0] === "integrations" &&
      parts[1] === "scm" &&
      parts[2] === "fulfillments" &&
      parts[4] === "deliver" &&
      parts.length === 5 &&
      method === "POST"
    )
      return json(
        await gateway(
          actor,
          "delivery",
          z.uuid().parse(parts[3]),
          await body(request),
          request.headers.get("idempotency-key") ?? crypto.randomUUID(),
        ),
      );
    if (
      parts[0] === "integrations" &&
      ["finance", "scm"].includes(parts[1]) &&
      parts[2] === "callbacks" &&
      parts[3] === "retry" &&
      parts.length === 4 &&
      method === "POST"
    )
      return json(
        await gateway(
          actor,
          parts[1] === "finance" ? "retry-finance" : "retry-scm",
          "callbacks",
          {},
          request.headers.get("idempotency-key") ?? crypto.randomUUID(),
        ),
      );
    if (path === "dashboard/summary" && method === "GET") {
      const state = await snapshot(actor);
      return json({
        customers: state.customers.length,
        activeCustomers: state.customers.filter((c) => c.status === "ACTIVE")
          .length,
        activeSubscriptions: state.subscriptions.filter(
          (s) => s.status === "ACTIVE",
        ).length,
        openTickets: state.tickets.filter((t) =>
          ["OPEN", "IN_PROGRESS"].includes(t.status),
        ).length,
        monthlyContractValue: state.subscriptions
          .filter((s) => s.status === "ACTIVE")
          .reduce((a, s) => a + s.price, 0),
      });
    }
    const resources = [
      "customers",
      "packages",
      "subscriptions",
      "tickets",
      "invoices",
      "fulfillments",
      "events",
    ] as const;
    const resource = resources.find((r) => r === parts[0]);
    if (resource) {
      const state = await snapshot(actor);
      const rows = state[resource];
      if (method === "GET") {
        if (parts.length === 2) {
          const found = rows.find((r) => r.id === parts[1]);
          if (!found) throw new HttpError(404, "Data tidak ditemukan.");
          return json(found);
        }
        if (parts.length === 1) {
          const url = new URL(request.url);
          const page = Math.max(1, Number(url.searchParams.get("page")) || 1),
            size = Math.min(
              100,
              Math.max(1, Number(url.searchParams.get("pageSize")) || 20),
            );
          const search = url.searchParams.get("search")?.toLowerCase() ?? "";
          const status = url.searchParams.get("status");
          const filtered = rows.filter(
            (r) =>
              (!search || JSON.stringify(r).toLowerCase().includes(search)) &&
              (!status || ("status" in r && r.status === status)),
          );
          return json({
            items: filtered.slice((page - 1) * size, page * size),
            meta: { page, pageSize: size, total: filtered.length },
          });
        }
      }
      if (method === "GET") {
        if (
          parts.length === 3 &&
          resource === "customers" &&
          ["subscriptions", "tickets"].includes(parts[2])
        ) {
          if (!state.customers.some((c) => c.id === parts[1]))
            throw new HttpError(404, "Pelanggan tidak ditemukan.");
          return json(
            parts[2] === "subscriptions"
              ? state.subscriptions.filter((s) => s.customerId === parts[1])
              : state.tickets.filter((t) => t.customerId === parts[1]),
          );
        }
        if (
          parts.length === 3 &&
          resource === "tickets" &&
          parts[2] === "comments"
        ) {
          const ticket = state.tickets.find((t) => t.id === parts[1]);
          if (!ticket) throw new HttpError(404, "Tiket tidak ditemukan.");
          return json(ticket.comments);
        }
        throw new HttpError(404, "Endpoint tidak ditemukan.");
      }
      const input = await body(request);
      if (method === "POST" && parts.length === 1) {
        if (resource === "customers")
          return json(
            await executeRequest(actor, { type: "SAVE_CUSTOMER", data: input }),
            201,
          );
        if (resource === "packages")
          return json(
            await executeRequest(actor, { type: "SAVE_PACKAGE", data: input }),
            201,
          );
        if (resource === "tickets")
          return json(
            await executeRequest(actor, { type: "SAVE_TICKET", data: input }),
            201,
          );
        if (resource === "subscriptions")
          return json(
            await executeRequest(actor, {
              type: "CREATE_SUBSCRIPTION",
              ...z
                .object({
                  customerId: z.uuid(),
                  packageId: z.uuid(),
                  address: z.string(),
                })
                .strict()
                .parse(input),
            }),
            201,
          );
      }
      const id = z.uuid().parse(parts[1]);
      if (
        method === "PATCH" &&
        parts.length === 2 &&
        ["customers", "packages", "tickets"].includes(resource)
      ) {
        const current = rows.find((r) => r.id === id);
        if (!current) throw new HttpError(404, "Data tidak ditemukan.");
        const values = z.record(z.string(), z.unknown()).parse(input);
        const fields =
          resource === "customers"
            ? ["name", "email", "phone", "address"]
            : resource === "packages"
              ? ["name", "price", "speed", "category", "device"]
              : [
                  "customerId",
                  "subscriptionId",
                  "subject",
                  "description",
                  "priority",
                  "assignee",
                ];
        if (Object.keys(values).some((k) => !fields.includes(k)))
          throw new HttpError(422, "Field perubahan tidak diizinkan.");
        const data = Object.fromEntries(
          fields.map((k) => [
            k,
            k in values
              ? values[k]
              : (current as unknown as Record<string, unknown>)[k],
          ]),
        );
        return json(
          await executeRequest(actor, {
            type:
              resource === "customers"
                ? "SAVE_CUSTOMER"
                : resource === "packages"
                  ? "SAVE_PACKAGE"
                  : "SAVE_TICKET",
            id,
            data,
          }),
        );
      }
      if (
        resource === "subscriptions" &&
        parts.length === 3 &&
        parts[2] === "status" &&
        method === "PATCH"
      )
        return json(
          await executeRequest(actor, {
            type: "SUBSCRIPTION_STATUS",
            id,
            ...z
              .object({
                status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "CANCELLED"]),
              })
              .strict()
              .parse(input),
          }),
        );
      if (
        resource === "tickets" &&
        parts.length === 3 &&
        parts[2] === "status" &&
        method === "PATCH"
      )
        return json(
          await executeRequest(actor, {
            type: "TICKET_STATUS",
            id,
            ...z
              .object({
                status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
              })
              .strict()
              .parse(input),
          }),
        );
      if (
        resource === "tickets" &&
        parts.length === 3 &&
        parts[2] === "comments" &&
        method === "POST"
      )
        return json(
          await executeRequest(actor, {
            type: "TICKET_COMMENT",
            id,
            ...z.object({ text: z.string() }).strict().parse(input),
          }),
          201,
        );
      if (
        resource === "tickets" &&
        parts.length === 3 &&
        parts[2] === "assignment" &&
        method === "PATCH"
      )
        return json(
          await executeRequest(actor, {
            type: "TICKET_ASSIGN",
            id,
            ...z.object({ assignee: z.string() }).strict().parse(input),
          }),
        );
      if (
        ["customers", "packages"].includes(resource) &&
        parts.length === 3 &&
        parts[2] === "status" &&
        method === "PATCH"
      ) {
        const desired = z
          .object({ status: z.enum(["ACTIVE", "INACTIVE"]) })
          .strict()
          .parse(input);
        const current = rows.find((r) => r.id === id);
        if (!current) throw new HttpError(404, "Data tidak ditemukan.");
        if ("status" in current && current.status === desired.status)
          return json(state);
        return json(
          await executeRequest(actor, {
            type:
              resource === "customers" ? "TOGGLE_CUSTOMER" : "TOGGLE_PACKAGE",
            id,
          }),
        );
      }
    }
    throw new HttpError(404, "Endpoint tidak ditemukan.", "NOT_FOUND");
  } catch (error) {
    return errorResponse(error);
  }
}
export { route as GET, route as POST, route as PATCH };
