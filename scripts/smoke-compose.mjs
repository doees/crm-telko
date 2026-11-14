import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
const origin = process.env.APP_ORIGIN;
if (origin !== "http://localhost:3200")
  throw new Error("Image smoke test requires isolated .env.test on port 3200.");
const compose = [
  "--host=unix:///var/run/docker.sock",
  "compose",
  "--env-file",
  ".env.test",
  "-p",
  "nusa-crm-image-qa",
  "-f",
  "compose.yml",
  "-f",
  "ops/compose.qa.yml",
];
let cookie = "",
  csrf = "";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function ready() {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(origin + "/api/v1/health");
      if (r.ok) return;
    } catch {}
    await sleep(1000);
  }
  throw new Error("Docker CRM did not become ready");
}
async function api(path, method = "GET", payload) {
  const response = await fetch(origin + "/api/v1/" + path, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      Cookie: cookie,
      "X-CSRF-Token": csrf,
      "Idempotency-Key": randomUUID(),
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
  const result = await response.json();
  assert.ok(
    response.ok,
    `${path}: HTTP ${response.status} ${result.error?.message ?? ""}`,
  );
  return { response, data: result.data };
}
async function login() {
  const { response, data } = await api("auth/login", "POST", {
    email: process.env.BOOTSTRAP_ADMIN_EMAIL,
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
  });
  cookie = response.headers.get("set-cookie").split(";")[0];
  csrf = data.csrf;
}
async function waitFor(check) {
  for (let i = 0; i < 60; i++) {
    const { data } = await api("state");
    if (check(data)) return data;
    await sleep(1000);
  }
  throw new Error("Docker service state did not converge");
}
await ready();
await login();
let { data } = await api("commands", "POST", {
  type: "SAVE_CUSTOMER",
  data: {
    name: "Docker Persistence Customer",
    email: "docker@qa.test",
    phone: "081234567891",
    address: "Jalan Docker Pengujian No. 10, Bandung",
  },
});
const customer = data.customers.find(
  (c) => c.name === "Docker Persistence Customer",
);
({ data } = await api("commands", "POST", {
  type: "SAVE_PACKAGE",
  data: {
    name: "Docker Fiber 100",
    speed: 100,
    price: 349000,
    category: "HOME",
    device: true,
  },
}));
const pkg = data.packages.find((p) => p.name === "Docker Fiber 100");
({ data } = await api("commands", "POST", {
  type: "CREATE_SUBSCRIPTION",
  customerId: customer.id,
  packageId: pkg.id,
  address: customer.address,
}));
const sub = data.subscriptions.find((s) => s.customerId === customer.id);
data = await waitFor(
  (s) =>
    s.invoices.find((i) => i.subscriptionId === sub.id)?.status === "ISSUED" &&
    s.fulfillments.find((f) => f.subscriptionId === sub.id)?.externalId,
);
const invoice = data.invoices.find((i) => i.subscriptionId === sub.id),
  device = data.fulfillments.find((f) => f.subscriptionId === sub.id);
await api("integrations/inventory/receipts", "POST", {
  quantity: 2,
  reference: "DOCKER-GRN-" + randomUUID(),
});
await api(`integrations/finance/invoices/${invoice.id}/payments`, "POST", {
  amount: 349000,
  reference: "DOCKER-BANK-" + randomUUID(),
  paidAt: new Date().toISOString(),
  verified: true,
});
await waitFor(
  (s) =>
    s.fulfillments.find((f) => f.id === device.id)?.externalStatus ===
    "RESERVED",
);
await api(`integrations/scm/fulfillments/${device.id}/deliver`, "POST", {
  reference: "DOCKER-HANDOVER-" + randomUUID(),
  recipient: "Pelanggan Docker",
});
await waitFor(
  (s) => s.subscriptions.find((s) => s.id === sub.id)?.status === "ACTIVE",
);
const restart = spawnSync("docker", [...compose, "restart", "crm"], {
  stdio: "inherit",
});
assert.equal(restart.status, 0);
await ready();
({ data } = await api("state"));
assert.ok(data.customers.some((c) => c.id === customer.id));
assert.equal(data.subscriptions.find((s) => s.id === sub.id)?.status, "ACTIVE");
console.log(
  "Docker image + Compose migrations + real Finance/SCM + restart persistence passed.",
);
