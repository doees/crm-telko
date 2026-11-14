import { test } from "node:test";
import assert from "node:assert/strict";
import { applyCommand } from "../../src/modules/crm/domain";
import { freshState } from "../fixtures/crm";
import type { Command, CrmState } from "../../src/modules/crm/types";
let seq = 0;
const run = (state: CrmState, command: Command) =>
  applyCommand(
    state,
    command,
    "2026-11-14T04:00:00.000Z",
    () => `unit-${++seq}`,
    { id: "Raka Wijaya", name: "Teknisi pengujian" },
  );
test("contract and initial invoice/device requests are created atomically", () => {
  const old = freshState();
  const next = run(old, {
    type: "CREATE_SUBSCRIPTION",
    customerId: "cus-10",
    packageId: "pkg-1",
    address: "Jl. Pengujian No. 10, Jakarta",
  });
  assert.equal(old.subscriptions.length, 9);
  assert.equal(next.subscriptions.length, 10);
  assert.equal(next.invoices[0].subscriptionId, next.subscriptions[0].id);
  assert.equal(next.fulfillments[0].subscriptionId, next.subscriptions[0].id);
  assert.equal(next.events.length, old.events.length + 2);
  const edited = run(next, {
    type: "SAVE_PACKAGE",
    id: "pkg-1",
    data: { ...next.packages[0], price: 399000 },
  });
  assert.equal(edited.subscriptions[0].price, 249000);
});
test("activation requires confirmed payment and fulfilled device", () => {
  const state = freshState();
  assert.throws(
    () =>
      run(state, {
        type: "SUBSCRIPTION_STATUS",
        id: "sub-2",
        status: "ACTIVE",
      }),
    /invoice lunas/,
  );
  state.invoices[1].status = "PAID";
  assert.throws(
    () =>
      run(state, {
        type: "SUBSCRIPTION_STATUS",
        id: "sub-2",
        status: "ACTIVE",
      }),
    /invoice lunas/,
  );
  state.fulfillments[1].status = "FULFILLED";
  assert.equal(
    run(state, { type: "SUBSCRIPTION_STATUS", id: "sub-2", status: "ACTIVE" })
      .subscriptions[1].status,
    "ACTIVE",
  );
});
test("cancelled contracts cannot resume", () => {
  const state = run(freshState(), {
    type: "SUBSCRIPTION_STATUS",
    id: "sub-1",
    status: "CANCELLED",
  });
  assert.throws(
    () =>
      run(state, {
        type: "SUBSCRIPTION_STATUS",
        id: "sub-1",
        status: "ACTIVE",
      }),
    /tidak diperbolehkan/,
  );
});
test("ticket ownership, notes and transitions are enforced", () => {
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
    text: "Perangkat telah diperiksa dan koneksi stabil.",
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
  assert.equal(
    run(state, { type: "TICKET_STATUS", id: "tkt-1", status: "CLOSED" })
      .tickets[0].status,
    "CLOSED",
  );
});
test("customer data, relationships and server domain roles reject invalid changes", () => {
  const state = freshState();
  assert.throws(
    () =>
      run(state, {
        type: "SAVE_CUSTOMER",
        data: {
          name: "Pengujian",
          email: "valid@example.com",
          phone: state.customers[0].phone,
          address: "Jalan pengujian nomor 20",
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
});
