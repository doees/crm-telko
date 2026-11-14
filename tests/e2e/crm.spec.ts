import { test, expect, type Page } from "@playwright/test";
import { randomInt, randomUUID } from "node:crypto";
const base = process.env.E2E_BASE_URL ?? process.env.APP_ORIGIN;
if (
  !base ||
  !new URL(process.env.DATABASE_URL ?? "postgres://invalid/").pathname.endsWith(
    "_test",
  )
)
  throw new Error(
    "Run browser tests through npm run test:server with isolated *_test databases.",
  );
const email = process.env.BOOTSTRAP_ADMIN_EMAIL!,
  password = process.env.BOOTSTRAP_ADMIN_PASSWORD!;
async function login(page: Page, account = email, secret = password) {
  await page.goto("login/");
  await page.getByLabel("Email perusahaan").fill(account);
  await page.getByLabel("Password", { exact: true }).fill(secret);
  await page.getByRole("button", { name: "Masuk ke workspace" }).click();
  await expect(page.locator("#main-content")).toBeVisible();
}
async function createCustomer(page: Page) {
  const name = "Browser Customer " + randomInt(10000, 99999);
  await page.goto("customers/");
  await page
    .getByRole("button", { name: "Tambah pelanggan", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Nama lengkap / perusahaan").fill(name);
  await d.getByLabel("Email", { exact: true }).fill("browser@example.test");
  await d
    .getByLabel("Nomor telepon")
    .fill("0812" + randomInt(100000000, 999999999));
  await d
    .getByLabel("Alamat pelanggan")
    .fill("Jl. Pengujian Browser No. 20, Bandung");
  await d
    .getByRole("button", { name: "Tambah pelanggan", exact: true })
    .click();
  await expect(d).toBeHidden();
  return name;
}
async function snapshot(page: Page) {
  const r = await page.request.get("/api/v1/state");
  expect(r.ok()).toBeTruthy();
  return (await r.json()).data;
}
async function api(page: Page, path: string, payload: unknown) {
  const session = await page.request.get("/api/v1/auth/session");
  const { data } = await session.json();
  return page.request.post("/api/v1/" + path, {
    headers: {
      Origin: base!,
      "X-CSRF-Token": data.csrf,
      "Idempotency-Key": randomUUID(),
    },
    data: payload,
  });
}
test("login, database persistence across browsers, and logout", async ({
  page,
  browser,
}) => {
  await page.goto("customers/");
  await expect(
    page.getByRole("heading", { name: "Selamat datang kembali" }),
  ).toBeVisible();
  await login(page);
  const name = await createCustomer(page);
  await page.getByLabel("Cari nama, nomor, email, atau telepon…").fill(name);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("#main-content")).toBeVisible();
  await page.getByLabel("Cari nama, nomor, email, atau telepon…").fill(name);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  const context = await browser.newContext();
  const other = await context.newPage();
  await login(other);
  await other.goto("customers/");
  await other.getByLabel("Cari nama, nomor, email, atau telepon…").fill(name);
  await expect(other.locator("tbody tr")).toHaveCount(1);
  await context.close();
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === "nusa_session")?.httpOnly).toBe(true);
  await page.goto("settings/");
  await page.getByRole("button", { name: "Keluar dari akun" }).click();
  await expect(
    page.getByRole("heading", { name: "Selamat datang kembali" }),
  ).toBeVisible();
});
test("real stock receipt, invoice payment and handover activate a subscription", async ({
  page,
}) => {
  await login(page);
  await page.goto("integrations/");
  await page.getByRole("button", { name: "Persediaan & perangkat" }).click();
  await page.getByRole("button", { name: "Catat penerimaan stok" }).click();
  let d = page.getByRole("dialog");
  await d.getByLabel("Jumlah perangkat diterima").fill("3");
  await d
    .getByLabel("Referensi dokumen penerimaan")
    .fill("GRN-BROWSER-" + randomUUID());
  await d.getByRole("checkbox").check();
  await d.getByRole("button", { name: "Simpan pencatatan" }).click();
  await expect(d).toBeHidden();
  const name = await createCustomer(page);
  let state = await snapshot(page);
  const customer = state.customers.find(
    (c: { name: string }) => c.name === name,
  );
  await page.goto("subscriptions/");
  await page
    .getByRole("button", { name: "Langganan baru", exact: true })
    .click();
  d = page.getByRole("dialog");
  await d.getByLabel("Pelanggan", { exact: true }).selectOption(customer.id);
  await d.getByRole("button", { name: "Buat langganan", exact: true }).click();
  await expect(d).toBeHidden();
  state = await snapshot(page);
  const sub = state.subscriptions.find(
      (s: { customerId: string }) => s.customerId === customer.id,
    ),
    invoice = state.invoices.find(
      (i: { subscriptionId: string }) => i.subscriptionId === sub.id,
    );
  await page.goto("integrations/");
  const row = page.locator("tbody tr").filter({ hasText: invoice.number });
  await row.getByRole("button", { name: "Catat pembayaran" }).click();
  d = page.getByRole("dialog");
  const now = await page.evaluate(() => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  });
  await d.getByLabel("Waktu dana diterima").fill(now);
  await d
    .getByLabel("Referensi bukti pembayaran")
    .fill("BANK-BROWSER-" + randomUUID());
  await d.getByRole("checkbox").check();
  await d.getByRole("button", { name: "Simpan pencatatan" }).click();
  await expect(d).toBeHidden();
  await expect(row).toContainText("Lunas");
  await page.getByRole("button", { name: "Persediaan & perangkat" }).click();
  const device = page.locator("tbody tr").filter({ hasText: sub.number });
  await device.getByRole("button", { name: "Catat serah-terima" }).click();
  d = page.getByRole("dialog");
  await d.getByLabel("Nama penerima").fill("Pelanggan Browser");
  await d
    .getByLabel("Nomor dokumen serah-terima")
    .fill("HANDOVER-BROWSER-" + randomUUID());
  await d.getByRole("checkbox").check();
  await d.getByRole("button", { name: "Simpan pencatatan" }).click();
  await expect(d).toBeHidden();
  await expect(device).toContainText("Terpenuhi");
  await page.goto("subscriptions/");
  await expect(
    page.locator("tbody tr").filter({ hasText: sub.number }),
  ).toContainText("Aktif");
});
test("staff management and server-side manager permissions", async ({
  page,
  browser,
}) => {
  await login(page);
  await page.goto("settings/");
  await page.getByRole("button", { name: "Tambah akun", exact: true }).click();
  const d = page.getByRole("dialog");
  const staff = "Browser Manager " + randomInt(1000, 9999),
    staffEmail = "manager-" + randomUUID() + "@qa.test",
    staffPassword = "Account-" + randomUUID();
  await d.getByLabel("Nama staf").fill(staff);
  await d.getByLabel("Email staf").fill(staffEmail);
  await d.getByLabel("Peran staf").selectOption("MANAGER");
  await d.getByLabel("Password awal").fill(staffPassword);
  await d.getByRole("button", { name: "Simpan akun" }).click();
  await expect(d).toBeHidden();
  await expect(
    page.locator(".account-row").filter({ hasText: staff }),
  ).toBeVisible();
  const context = await browser.newContext();
  const manager = await context.newPage();
  await login(manager, staffEmail, staffPassword);
  await manager.goto("customers/");
  await expect(
    manager.getByRole("button", { name: "Tambah pelanggan", exact: true }),
  ).toBeDisabled();
  const denied = await api(manager, "commands", {
    type: "SAVE_PACKAGE",
    data: {
      name: "Denied package",
      speed: 100,
      price: 349000,
      category: "HOME",
      device: true,
    },
  });
  expect(denied.status()).toBe(403);
  await context.close();
});
test("ticket handling, CSV export, and mobile viewport", async ({ page }) => {
  await login(page);
  await page.goto("tickets/");
  await page.getByRole("button", { name: "Buat tiket", exact: true }).click();
  let d = page.getByRole("dialog");
  await d
    .getByLabel("Subjek keluhan")
    .fill("Browser ticket " + randomInt(1000, 9999));
  await d
    .getByLabel("Deskripsi keluhan")
    .fill("Permintaan pemeriksaan koneksi yang dicatat melalui browser.");
  await d
    .getByLabel("Teknisi penanggung jawab")
    .selectOption({ label: "QA Technician" });
  await d.getByRole("button", { name: "Buat tiket", exact: true }).click();
  await expect(d).toBeHidden();
  const state = await snapshot(page);
  const ticket = state.tickets.find((t: { subject: string }) =>
    t.subject.startsWith("Browser ticket"),
  );
  await page
    .getByRole("button", { name: "Detail " + ticket.number, exact: true })
    .click();
  d = page.getByRole("dialog");
  await d.getByRole("button", { name: "Mulai tangani" }).click();
  await expect(d.locator(".ticket-meta")).toContainText("Ditangani");
  await d
    .getByLabel("Catatan penanganan", { exact: true })
    .fill("Koneksi telah diperiksa dan kondisi layanan normal.");
  await d.getByRole("button", { name: "Kirim catatan" }).click();
  await expect(d.locator(".comment-list")).toContainText(
    "Koneksi telah diperiksa dan kondisi layanan normal.",
  );
  await d.getByRole("button", { name: "Selesaikan tiket" }).click();
  await expect(d.locator(".ticket-meta")).toContainText("Terselesaikan");
  await d.getByRole("button", { name: "Tutup tiket", exact: true }).click();
  await expect(d.locator(".ticket-meta")).toContainText("Ditutup");
  await page.keyboard.press("Escape");
  await page.goto("reports/");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh laporan CSV" }).click();
  expect((await download).suggestedFilename()).toBe(
    "nusa-laporan-langganan.csv",
  );
  if (process.env.CAPTURE_DOCS === "1") {
    await page.goto("dashboard/");
    await expect(page.locator("#main-content")).toBeVisible();
    await page.screenshot({
      path: "docs/images/dashboard-server.png",
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [
    "dashboard",
    "customers",
    "packages",
    "subscriptions",
    "tickets",
    "integrations",
    "reports",
    "settings",
  ]) {
    await page.goto(path + "/");
    await expect(page.locator("#main-content")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      path,
    ).toBeLessThanOrEqual(390);
  }
  await page.getByRole("button", { name: "Buka menu", exact: true }).click();
  await expect(page.getByRole("navigation")).toBeVisible();
  await page.keyboard.press("Escape");
});
