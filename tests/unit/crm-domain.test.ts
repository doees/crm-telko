import { test } from "node:test";
import assert from "node:assert/strict";
import { applyCommand } from "../../src/modules/crm/domain";
import { freshState } from "../../src/modules/crm/seed";
import type { Command, CrmState } from "../../src/modules/crm/types";
let sequence = 0;
const run = (state: CrmState, command: Command) =>
  applyCommand(
    state,
    command,
    "2026-11-14T04:00:00.000Z",
    () => `test-${++sequence}`,
  );
function withSubscription() {
  return run(freshState(), {
    type: "CREATE_SUBSCRIPTION",
    customerId: "cus-10",
    packageId: "pkg-1",
    address: "Jl. Pengujian No. 10, Jakarta",
  });
}
test("subscription creates invoice and device events atomically and snapshots contract price", () => {
  const original = freshState();
  const next = run(original, {
    type: "CREATE_SUBSCRIPTION",
    customerId: "cus-10",
    packageId: "pkg-1",
    address: "Jl. Pengujian No. 10, Jakarta",
  });
  const sub = next.subscriptions[0];
  assert.equal(original.subscriptions.length, 9);
  assert.equal(next.subscriptions.length, 10);
  assert.equal(sub.status, "PENDING");
  assert.equal(next.invoices[0].subscriptionId, sub.id);
  assert.equal(next.fulfillments[0].subscriptionId, sub.id);
  assert.equal(
    next.events.filter((e) =>
      [next.invoices[0].id, next.fulfillments[0].id].includes(e.resourceId),
    ).length,
    2,
  );
  const edited = run(next, {
    type: "SAVE_PACKAGE",
    id: "pkg-1",
    data: { ...next.packages[0], price: 399000 },
  });
  assert.equal(edited.subscriptions[0].price, 249000);
});
test("activation requires payment AND fulfillment, callbacks are idempotent", () => {
  let state = withSubscription();
  const sub = state.subscriptions[0],
    invoice = state.invoices[0],
    ful = state.fulfillments[0];
  assert.throws(
    () =>
      run(state, { type: "SUBSCRIPTION_STATUS", id: sub.id, status: "ACTIVE" }),
    /invoice lunas/,
  );
  for (const event of state.events.filter((e) =>
    [invoice.id, ful.id].includes(e.resourceId),
  ))
    state = run(state, { type: "DISPATCH", id: event.id });
  state = run(state, {
    type: "PAY_INVOICE",
    id: invoice.id,
    callbackId: "payment-test",
  });
  assert.equal(state.subscriptions[0].status, "PENDING");
  state = run(state, {
    type: "FULFILL",
    id: ful.id,
    callbackId: "device-test",
  });
  assert.equal(state.subscriptions[0].status, "ACTIVE");
  const repeat = run(state, {
    type: "PAY_INVOICE",
    id: invoice.id,
    callbackId: "payment-test",
  });
  assert.equal(repeat, state);
  assert.equal(repeat.processedCallbacks.length, 2);
});
test("offline event retains its ID for retry and no duplicate invoices are created", () => {
  let state = withSubscription();
  const event = state.events.find(
    (e) => e.destination === "FINANCE" && e.status === "PENDING",
  )!;
  state = run(state, {
    type: "CONNECTION",
    destination: "FINANCE",
    connected: false,
  });
  state = run(state, { type: "DISPATCH", id: event.id });
  assert.equal(state.events.find((e) => e.id === event.id)?.status, "FAILED");
  const count = state.invoices.length;
  state = run(state, {
    type: "CONNECTION",
    destination: "FINANCE",
    connected: true,
  });
  state = run(state, { type: "DISPATCH", id: event.id });
  assert.equal(state.events.find((e) => e.id === event.id)?.attempts, 2);
  assert.equal(state.invoices.length, count);
  assert.throws(
    () => run(state, { type: "DISPATCH", id: event.id }),
    /sudah berhasil/,
  );
});
test("cancelled subscriptions cannot resume or dispatch pending events", () => {
  let state = withSubscription();
  const sub = state.subscriptions[0],
    event = state.events[0];
  state = run(state, {
    type: "SUBSCRIPTION_STATUS",
    id: sub.id,
    status: "CANCELLED",
  });
  assert.throws(
    () =>
      run(state, { type: "SUBSCRIPTION_STATUS", id: sub.id, status: "ACTIVE" }),
    /tidak diperbolehkan/,
  );
  assert.throws(
    () => run(state, { type: "DISPATCH", id: event.id }),
    /dibatalkan/,
  );
});
test("ticket ownership, assignment, notes and transitions are enforced", () => {
  let state = freshState();
  state.role = "TECHNICIAN";
  assert.throws(
    () =>
      run(state, {
        type: "TICKET_COMMENT",
        id: "tkt-2",
        text: "Memperbaiki jaringan",
      }),
    /tiketnya sendiri/,
  );
  state = run(state, {
    type: "TICKET_STATUS",
    id: "tkt-1",
    status: "IN_PROGRESS",
  });
  assert.throws(
    () =>
      run(state, { type: "TICKET_STATUS", id: "tkt-1", status: "RESOLVED" }),
    /catatan/,
  );
  state = run(state, {
    type: "TICKET_COMMENT",
    id: "tkt-1",
    text: "Perangkat telah diperiksa dan koneksi kembali normal.",
  });
  state = run(state, {
    type: "TICKET_STATUS",
    id: "tkt-1",
    status: "RESOLVED",
  });
  assert.throws(
    () => run(state, { type: "TICKET_STATUS", id: "tkt-1", status: "CLOSED" }),
    /Penutupan/,
  );
  state.role = "CS";
  state = run(state, { type: "TICKET_STATUS", id: "tkt-1", status: "CLOSED" });
  assert.equal(state.tickets[0].status, "CLOSED");
  assert.throws(
    () =>
      run(state, { type: "TICKET_COMMENT", id: "tkt-1", text: "catatan baru" }),
    /tertutup/,
  );
});
test("customer and relation validation rejects duplicates and cross-customer tickets", () => {
  const state = freshState();
  assert.throws(
    () =>
      run(state, {
        type: "SAVE_CUSTOMER",
        data: {
          name: "Pelanggan Baru",
          email: "baru@example.com",
          phone: state.customers[0].phone,
          address: "Jl. Pelanggan Baru 123",
        },
      }),
    /sudah terdaftar/,
  );
  assert.throws(
    () => run(state, { type: "TOGGLE_CUSTOMER", id: "cus-1" }),
    /Batalkan/,
  );
  assert.throws(
    () =>
      run(state, {
        type: "SAVE_TICKET",
        data: {
          ...state.tickets[0],
          customerId: "cus-2",
          subscriptionId: "sub-1",
        },
      }),
    /milik pelanggan/,
  );
  assert.throws(
    () =>
      run(state, {
        type: "CREATE_SUBSCRIPTION",
        customerId: "cus-11",
        packageId: "pkg-1",
        address: "Alamat pengujian 123",
      }),
    /pelanggan yang aktif/,
  );
});
test("manager is read-only and CS cannot change product catalog or integrations", () => {
  const state = freshState();
  state.role = "MANAGER";
  assert.throws(
    () => run(state, { type: "TOGGLE_CUSTOMER", id: "cus-12" }),
    /akses/,
  );
  state.role = "CS";
  assert.throws(
    () => run(state, { type: "TOGGLE_PACKAGE", id: "pkg-1" }),
    /administrator/,
  );
  assert.throws(
    () =>
      run(state, {
        type: "PAY_INVOICE",
        id: "inv-2",
        callbackId: "payment-test",
      }),
    /akses/,
  );
});
