import { test, expect, type Page } from "@playwright/test";
const customer = {
  name: "Pelanggan Uji Integrasi",
  email: "uji@example.com",
  phone: "081299998888",
  address: "Jl. Pengujian Integrasi No. 20, Bandung",
};
async function addCustomer(page: Page) {
  await page.goto("customers/");
  await page
    .getByRole("button", { name: "Tambah pelanggan", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nama lengkap / perusahaan").fill(customer.name);
  await dialog.getByLabel("Email", { exact: true }).fill(customer.email);
  await dialog.getByLabel("Nomor telepon").fill(customer.phone);
  await dialog.getByLabel("Alamat pelanggan").fill(customer.address);
  await dialog
    .getByRole("button", { name: "Tambah pelanggan", exact: true })
    .click();
  await expect(dialog).toBeHidden();
}
test("customer creation, editing, search and reload persistence", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await addCustomer(page);
  await page
    .getByLabel("Cari nama, nomor, email, atau telepon…")
    .fill(customer.name);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page
    .getByRole("button", { name: `Edit ${customer.name}`, exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Nama lengkap / perusahaan")
    .fill("Pelanggan Uji Diperbarui");
  await page
    .getByRole("button", { name: "Simpan perubahan", exact: true })
    .click();
  await page
    .getByLabel("Cari nama, nomor, email, atau telepon…")
    .fill("Diperbarui");
  await expect(page.locator("tbody")).toContainText("Pelanggan Uji Diperbarui");
  await page.reload();
  await expect(page.locator("tbody")).toContainText("Pelanggan Uji Diperbarui");
  await page
    .getByLabel("Cari nama, nomor, email, atau telepon…")
    .fill("Tidak ada pelanggan ini");
  await expect(page.getByText("Belum ada data", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test("subscription -> failed delivery -> retry -> paid -> fulfilled -> active", async ({
  page,
}) => {
  await addCustomer(page);
  await page.goto("subscriptions/");
  await page
    .getByRole("button", { name: "Langganan baru", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Pelanggan", { exact: true })
    .selectOption({ label: `${customer.name} · CST-0013` });
  await dialog
    .getByLabel("Paket layanan", { exact: true })
    .selectOption("pkg-1");
  await dialog
    .getByRole("button", { name: "Buat langganan", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(
    page.locator("tr").filter({ hasText: "SUB-0010" }),
  ).toContainText("Menunggu");
  await page.goto("integrations/");
  const finance = page
    .locator(".integration-card")
    .filter({
      has: page.getByRole("heading", { name: "Modul Keuangan", exact: true }),
    });
  await finance.getByRole("button", { name: "Simulasikan offline" }).click();
  let row = page.locator("tbody tr").filter({ hasText: "INV-2026-0010" });
  await row.getByRole("button", { name: "Kirim invoice" }).click();
  await page.getByRole("button", { name: "Antrean & log event" }).click();
  await expect(
    page.locator("tbody tr").filter({ hasText: "invoice.create" }).first(),
  ).toContainText("Gagal");
  await finance.getByRole("button", { name: "Aktifkan simulator" }).click();
  await page
    .locator("tbody tr")
    .filter({ hasText: "invoice.create" })
    .first()
    .getByRole("button", { name: "Coba ulang" })
    .click();
  await page.getByRole("button", { name: "Invoice & pembayaran" }).click();
  row = page.locator("tbody tr").filter({ hasText: "INV-2026-0010" });
  await row.getByRole("button", { name: "Simulasikan lunas" }).click();
  await expect(row).toContainText("Lunas");
  await page.getByRole("button", { name: "Pemenuhan perangkat" }).click();
  const device = page.locator("tbody tr").filter({ hasText: "SUB-0010" });
  await device.getByRole("button", { name: "Kirim permintaan" }).click();
  await device.getByRole("button", { name: "Simulasikan terpenuhi" }).click();
  await expect(device).toContainText("Terpenuhi");
  await page.goto("subscriptions/");
  await expect(
    page.locator("tbody tr").filter({ hasText: "SUB-0010" }),
  ).toContainText("Aktif");
  await page.reload();
  await expect(
    page.locator("tbody tr").filter({ hasText: "SUB-0010" }),
  ).toContainText("Aktif");
});
test("ticket requires a resolution note and can be closed after handling", async ({
  page,
}) => {
  await page.goto("tickets/");
  await page.getByRole("button", { name: "Buat tiket", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Subjek keluhan").fill("Keluhan jaringan pengujian");
  await dialog
    .getByLabel("Deskripsi keluhan")
    .fill("Internet sering terputus dan perlu pemeriksaan perangkat.");
  await dialog
    .getByLabel("Teknisi penanggung jawab")
    .selectOption("Raka Wijaya");
  await dialog.getByRole("button", { name: "Buat tiket", exact: true }).click();
  await expect(dialog).toBeHidden();
  await page
    .getByRole("button", { name: "Detail TKT-0019", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Mulai tangani" }).click();
  await dialog.getByRole("button", { name: "Selesaikan tiket" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Tambahkan catatan" }),
  ).toContainText("Tambahkan catatan");
  await dialog
    .getByLabel("Catatan penanganan", { exact: true })
    .fill("Router telah diperiksa. Koneksi kembali stabil.");
  await dialog.getByRole("button", { name: "Kirim catatan" }).click();
  await dialog.getByRole("button", { name: "Selesaikan tiket" }).click();
  await dialog
    .getByRole("button", { name: "Tutup tiket", exact: true })
    .click();
  await expect(dialog.locator(".ticket-meta")).toContainText("Ditutup");
  await expect(
    dialog.getByLabel("Catatan penanganan", { exact: true }),
  ).toHaveCount(0);
});
test("package changes preserve existing contract prices and preselect the chosen package", async ({
  page,
}) => {
  await page.goto("packages/");
  const card = page
    .locator(".package-card")
    .filter({
      has: page.getByRole("heading", {
        name: "Nusa Home Essential",
        exact: true,
      }),
    });
  await card.getByRole("button", { name: "Edit paket" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Harga bulanan (Rp)").fill("299000");
  await dialog.getByRole("button", { name: "Simpan perubahan" }).click();
  await card.getByRole("button", { name: "Buat langganan" }).click();
  await expect(
    page.getByRole("dialog").getByLabel("Paket layanan", { exact: true }),
  ).toHaveValue("pkg-1");
  await page.keyboard.press("Escape");
  await page.goto("subscriptions/");
  await expect(
    page.locator("tbody tr").filter({ hasText: "SUB-0001" }),
  ).toContainText("249.000");
});
test("manager mode is read-only, reports download and reset has confirmation", async ({
  page,
}) => {
  await page.goto("settings/");
  await page.getByLabel("Peran aktif").selectOption("MANAGER");
  await page.goto("customers/");
  await expect(
    page.getByRole("button", { name: "Tambah pelanggan", exact: true }),
  ).toBeDisabled();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Ekspor CSV" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    "nusa-pelanggan.csv",
  );
  await page.goto("integrations/");
  await expect(
    page.getByRole("button", { name: "Simulasikan offline" }).first(),
  ).toBeDisabled();
  await page.goto("settings/");
  await page.getByLabel("Peran aktif").selectOption("ADMIN");
  await page.getByRole("button", { name: "Reset data demo" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Reset seluruh data demo?",
  );
  await page.getByRole("dialog").getByRole("button", { name: "Batal" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});
test("all pages fit mobile width and keyboard can close a form", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("dashboard/");
  await page.getByRole("button", { name: "Buka menu", exact: true }).click();
  await expect(page.getByRole("navigation")).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Pelanggan", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Tambah pelanggan", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  for (const route of [
    "dashboard",
    "customers",
    "packages",
    "subscriptions",
    "tickets",
    "integrations",
    "reports",
    "settings",
  ]) {
    await page.goto(`${route}/`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewport: innerWidth,
      body: document.documentElement.scrollWidth,
    }));
    expect(dimensions.body, route).toBeLessThanOrEqual(dimensions.viewport);
  }
});

test('backup restore validates input and restores a saved workspace',async({page})=>{
 await addCustomer(page);await page.goto('settings/');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Ekspor backup JSON'}).click();const saved=await download;const path=await saved.path();expect(path).toBeTruthy();
 await page.getByRole('button',{name:'Reset data demo'}).click();await page.getByRole('button',{name:'Ya, reset data'}).click();
 await page.getByLabel('Pilih file backup JSON').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"version":2}')});await page.getByRole('button',{name:'Pulihkan data',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Format backup tidak valid'})).toBeVisible();
 await page.getByLabel('Pilih file backup JSON').setInputFiles(path!);await page.getByRole('button',{name:'Pulihkan data',exact:true}).click();await page.goto('customers/');await page.getByLabel('Cari nama, nomor, email, atau telepon…').fill(customer.name);await expect(page.locator('tbody tr')).toHaveCount(1);
});
