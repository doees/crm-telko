import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient as ServiceClient } from "../../services/generated/client";
import { signature } from "../../services/protocol";
const origin = process.env.APP_ORIGIN!;
type Client = { cookie: string; csrf: string };
async function call(
  path: string,
  method = "GET",
  payload?: unknown,
  client?: Client,
  extra: Record<string, string> = {},
) {
  const response = await fetch(origin + "/api/v1/" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(client ? { Cookie: client.cookie, "X-CSRF-Token": client.csrf } : {}),
      ...extra,
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
  const data = await response.json();
  return { response, data };
}
async function login(email: string, password: string) {
  const r = await call("auth/login", "POST", { email, password });
  assert.equal(r.response.status, 200);
  assert.match(r.response.headers.get("set-cookie")!, /HttpOnly/i);
  return {
    cookie: r.response.headers.get("set-cookie")!.split(";")[0],
    csrf: r.data.data.csrf,
  };
}
async function waitFor<T>(
  read: () => Promise<T>,
  condition: (value: T) => boolean,
  timeout = 20000,
) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await read();
    if (condition(value)) return value;
    await new Promise((r) => setTimeout(r, 500));
  }
  const last = (await read()) as Record<string, unknown>;
  console.error(
    "Integration diagnostic",
    JSON.stringify({
      events: last.events,
      invoices: last.invoices,
      fulfillments: last.fulfillments,
    }),
  );
  throw new Error("Timed out waiting for durable integration state");
}
const state = (client: Client) =>
  call("state", "GET", undefined, client).then((r) => r.data.data);
test(
  "real PostgreSQL services enforce authentication, roles, idempotency, retries, stock and signed callbacks",
  { timeout: 90000 },
  async () => {
    assert.equal((await call("state")).response.status, 401);
    assert.equal(
      (
        await call("auth/login", "POST", {
          email: process.env.BOOTSTRAP_ADMIN_EMAIL,
          password: "Wrong-password-2026",
        })
      ).response.status,
      401,
    );
    assert.equal(
      (
        await call("auth/login", "POST", {
          email: "x".repeat(5000),
          password: "irrelevant",
        })
      ).response.status,
      413,
    );
    const admin = await login(
      process.env.BOOTSTRAP_ADMIN_EMAIL!,
      process.env.BOOTSTRAP_ADMIN_PASSWORD!,
    );
    const badCsrf = await call(
      "commands",
      "POST",
      { type: "TOGGLE_CUSTOMER", id: randomUUID() },
      { ...admin, csrf: "invalid" },
    );
    assert.equal(badCsrf.response.status, 403);
    assert.equal(
      (await call("commands", "POST", { type: "ROLE", role: "ADMIN" }, admin))
        .response.status,
      422,
    );
    const password = "QA-" + randomUUID();
    const techResult = await call(
      "users",
      "POST",
      {
        name: "QA Technician",
        email: "technician@qa.test",
        role: "TECHNICIAN",
        password,
      },
      admin,
    );
    assert.equal(techResult.response.status, 201);
    const techId = techResult.data.data.id;
    await call(
      "users",
      "POST",
      {
        name: "QA Manager",
        email: "manager@qa.test",
        role: "MANAGER",
        password,
      },
      admin,
    );
    const manager = await login("manager@qa.test", password);
    assert.equal(
      (
        await call(
          "commands",
          "POST",
          {
            type: "SAVE_CUSTOMER",
            data: {
              name: "Forbidden",
              email: "",
              phone: "081234987655",
              address: "Jalan tidak boleh ditulis",
            },
          },
          manager,
        )
      ).response.status,
      403,
    );
    const input = {
      name: "QA Persistent Customer",
      email: "customer@qa.test",
      phone: "081299998877",
      address: "Jalan Pengujian Integrasi No. 20, Bandung",
    };
    const key = randomUUID();
    const customerResult = await call(
      "commands",
      "POST",
      { type: "SAVE_CUSTOMER", data: input },
      admin,
      { "Idempotency-Key": key },
    );
    assert.equal(customerResult.response.status, 200);
    const customer = customerResult.data.data.customers[0];
    const duplicate = await call(
      "commands",
      "POST",
      { type: "SAVE_CUSTOMER", data: input },
      admin,
      { "Idempotency-Key": key },
    );
    assert.equal(duplicate.response.status, 200);
    assert.equal(duplicate.data.data.customers.length, 1);
    assert.equal(
      (
        await call(
          "commands",
          "POST",
          { type: "SAVE_CUSTOMER", data: { ...input, name: "Different" } },
          admin,
          { "Idempotency-Key": key },
        )
      ).response.status,
      409,
    );
    const otherSession = await login(
      process.env.BOOTSTRAP_ADMIN_EMAIL!,
      process.env.BOOTSTRAP_ADMIN_PASSWORD!,
    );
    assert.equal((await state(otherSession)).customers[0].id, customer.id);
    const packageResult = await call(
      "commands",
      "POST",
      {
        type: "SAVE_PACKAGE",
        data: {
          name: "QA Fiber 100",
          speed: 100,
          price: 349000,
          category: "HOME",
          device: true,
        },
      },
      admin,
    );
    const pkg = packageResult.data.data.packages[0];
    // Stop the actual Finance process: no simulation switch or production backdoor.
    const financePid = Number(process.env.QA_FINANCE_PID);
    assert.ok(financePid > 0);
    process.kill(financePid, "SIGSTOP");
    let subscriptionId = "",
      invoiceId = "",
      fulfillmentId = "";
    try {
      const created = await call(
        "commands",
        "POST",
        {
          type: "CREATE_SUBSCRIPTION",
          customerId: customer.id,
          packageId: pkg.id,
          address: input.address,
        },
        admin,
      );
      assert.equal(created.response.status, 200);
      subscriptionId = created.data.data.subscriptions[0].id;
      invoiceId = created.data.data.invoices[0].id;
      fulfillmentId = created.data.data.fulfillments[0].id;
      const failed = await waitFor(
        () => state(admin),
        (s) =>
          s.events.some(
            (e: { destination: string; status: string }) =>
              e.destination === "FINANCE" && e.status === "FAILED",
          ),
        25000,
      );
      assert.ok(
        failed.events.find(
          (e: { destination: string }) => e.destination === "FINANCE",
        ).attempts >= 1,
      );
    } finally {
      process.kill(financePid, "SIGCONT");
    }
    let snapshot = await waitFor(
      () => state(admin),
      (s) =>
        s.events.some(
          (e: { destination: string; status: string }) =>
            e.destination === "FINANCE" && e.status === "FAILED",
        ),
    );
    const event = snapshot.events.find(
      (e: { destination: string }) => e.destination === "FINANCE",
    );
    await call("commands", "POST", { type: "DISPATCH", id: event.id }, admin);
    snapshot = await waitFor(
      () => state(admin),
      (s) =>
        s.invoices[0].status === "ISSUED" &&
        s.fulfillments[0].externalStatus === "WAITING_STOCK",
    );
    assert.equal(snapshot.invoices.length, 1);
    assert.equal(snapshot.subscriptions[0].status, "PENDING");
    const paymentKey = randomUUID();
    const paid = await call(
      `integrations/finance/invoices/${invoiceId}/payments`,
      "POST",
      {
        amount: 349000,
        reference: "BANK-QA-0001",
        paidAt: new Date().toISOString(),
        verified: true,
      },
      admin,
      { "Idempotency-Key": paymentKey },
    );
    assert.equal(paid.response.status, 200);
    snapshot = await waitFor(
      () => state(admin),
      (s) => s.invoices[0].status === "PAID",
    );
    assert.equal(snapshot.subscriptions[0].status, "PENDING");
    const receipt = await call(
      "integrations/inventory/receipts",
      "POST",
      { quantity: 2, reference: "GRN-QA-0001" },
      admin,
    );
    assert.equal(receipt.response.status, 201);
    await waitFor(
      () => state(admin),
      (s) => s.fulfillments[0].externalStatus === "RESERVED",
    );
    const delivered = await call(
      `integrations/scm/fulfillments/${fulfillmentId}/deliver`,
      "POST",
      { reference: "HANDOVER-QA-0001", recipient: "Pelanggan Pengujian" },
      admin,
    );
    assert.equal(delivered.response.status, 200);
    snapshot = await waitFor(
      () => state(admin),
      (s) => s.subscriptions[0].status === "ACTIVE",
    );
    assert.equal(snapshot.subscriptions[0].id, subscriptionId);
    const inventory = await call(
      "integrations/inventory",
      "GET",
      undefined,
      admin,
    );
    assert.equal(inventory.data.data[0].onHand, 1);
    assert.equal(inventory.data.data[0].reserved, 0);
    const finance = new ServiceClient({
      datasourceUrl: process.env.FINANCE_DATABASE_URL,
    });
    try {
      const external = await finance.serviceInvoice.findUniqueOrThrow({
        where: { crmResourceId: invoiceId },
        include: { payment: true },
      });
      assert.equal(external.payment?.reference, "BANK-QA-0001");
      assert.equal(await finance.payment.count(), 1);
      const reusedKey = await fetch(
        process.env.FINANCE_API_URL +
          "/v1/invoices/" +
          randomUUID() +
          "/payments",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + process.env.FINANCE_SERVICE_TOKEN,
            "Idempotency-Key": paymentKey,
          },
          body: JSON.stringify({
            amount: 349000,
            reference: "BANK-QA-0001",
            paidAt: external.payment!.paidAt.toISOString(),
            actorId: external.payment!.actorId,
          }),
        },
      );
      assert.equal(
        reusedKey.status,
        409,
        "Payment key must also bind the target invoice",
      );
      const callback = await finance.callback.findFirstOrThrow({
        where: { payload: { path: ["type"], equals: "invoice.paid" } },
      });
      const raw = JSON.stringify(callback.payload),
        timestamp = String(Date.now());
      const response = await fetch(
        origin + "/api/v1/integrations/finance/events",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Hook-Timestamp": timestamp,
            "X-Hook-Signature": signature(
              process.env.FINANCE_WEBHOOK_SECRET!,
              timestamp,
              raw,
            ),
          },
          body: raw,
        },
      );
      assert.equal(response.status, 200);
      assert.equal((await state(admin)).invoices.length, 1);
      const tampered = await fetch(
        origin + "/api/v1/integrations/finance/events",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Hook-Timestamp": timestamp,
            "X-Hook-Signature": "invalid",
          },
          body: raw,
        },
      );
      assert.equal(tampered.status, 401);
    } finally {
      await finance.$disconnect();
    }
    const ticketResult = await call(
      "commands",
      "POST",
      {
        type: "SAVE_TICKET",
        data: {
          customerId: customer.id,
          subscriptionId,
          subject: "QA Ticket Persistence",
          description: "Pemeriksaan koneksi pelanggan untuk pengujian.",
          priority: "HIGH",
          assignee: techId,
        },
      },
      admin,
    );
    assert.equal(ticketResult.response.status, 200);
    const ticket = ticketResult.data.data.tickets[0];
    const technician = await login("technician@qa.test", password);
    assert.equal((await state(technician)).tickets.length, 1);
    assert.equal(
      (await call("users", "GET", undefined, technician)).response.status,
      403,
    );
    assert.equal(
      (
        await call(
          "commands",
          "POST",
          { type: "TICKET_STATUS", id: ticket.id, status: "IN_PROGRESS" },
          technician,
        )
      ).response.status,
      200,
    );
    assert.equal(
      (
        await call(
          "commands",
          "POST",
          { type: "TICKET_STATUS", id: ticket.id, status: "RESOLVED" },
          technician,
        )
      ).response.status,
      409,
    );
    await call(
      "commands",
      "POST",
      {
        type: "TICKET_COMMENT",
        id: ticket.id,
        text: "Jaringan telah diperiksa dan kembali stabil.",
      },
      technician,
    );
    await call(
      "commands",
      "POST",
      { type: "TICKET_STATUS", id: ticket.id, status: "RESOLVED" },
      technician,
    );
    assert.equal(
      (
        await call(
          "commands",
          "POST",
          { type: "TICKET_STATUS", id: ticket.id, status: "CLOSED" },
          technician,
        )
      ).response.status,
      409,
    );
    assert.equal(
      (
        await call(
          "commands",
          "POST",
          { type: "TICKET_STATUS", id: ticket.id, status: "CLOSED" },
          admin,
        )
      ).response.status,
      200,
    );
    assert.equal(
      (
        await call(
          `customers/${customer.id}/subscriptions`,
          "GET",
          undefined,
          admin,
        )
      ).data.data.length,
      1,
    );
    assert.equal(
      (await call(`tickets/${ticket.id}/comments`, "GET", undefined, admin))
        .data.data.length,
      1,
    );
    assert.equal(
      (await call(`customers/${customer.id}/unknown`, "GET", undefined, admin))
        .response.status,
      404,
    );
    assert.equal(
      (await call("auth/logout", "POST", {}, technician)).response.status,
      200,
    );
    assert.equal(
      (await call("state", "GET", undefined, technician)).response.status,
      401,
    );
  },
);
