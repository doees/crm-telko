"use client";
import { z } from "zod";
import { seedState, freshState } from "./seed";
import { applyCommand } from "./domain";
import {
  customerInput,
  packageInput,
  ticketInput,
  type CrmState,
  type Command,
} from "./types";
const customer = customerInput.extend({
  id: z.string(),
  number: z.string(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  createdAt: z.iso.datetime(),
});
const pkg = packageInput.extend({
  id: z.string(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});
const stateSchema = z.object({
  version: z.literal(2),
  revision: z.number().int(),
  role: z.enum(["ADMIN", "CS", "TECHNICIAN", "MANAGER"]),
  customers: z.array(customer),
  packages: z.array(pkg),
  subscriptions: z.array(
    z.object({
      id: z.string(),
      number: z.string(),
      customerId: z.string(),
      packageId: z.string(),
      price: z.number(),
      device: z.boolean(),
      address: z.string(),
      status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "CANCELLED"]),
      createdAt: z.iso.datetime(),
      activatedAt: z.iso.datetime().optional(),
    }),
  ),
  tickets: z.array(
    ticketInput.extend({
      id: z.string(),
      number: z.string(),
      status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
      createdAt: z.iso.datetime(),
      comments: z.array(
        z.object({
          id: z.string(),
          author: z.string(),
          text: z.string(),
          at: z.iso.datetime(),
        }),
      ),
    }),
  ),
  invoices: z.array(
    z.object({
      id: z.string(),
      number: z.string(),
      subscriptionId: z.string(),
      amount: z.number(),
      status: z.enum(["PENDING", "ISSUED", "PAID"]),
      createdAt: z.iso.datetime(),
      externalId: z.string().optional(),
      paidAt: z.iso.datetime().optional(),
    }),
  ),
  fulfillments: z.array(
    z.object({
      id: z.string(),
      subscriptionId: z.string(),
      status: z.enum(["PENDING", "PROCESSING", "FULFILLED"]),
      externalId: z.string().optional(),
    }),
  ),
  events: z.array(
    z.object({
      id: z.string(),
      destination: z.enum(["FINANCE", "SCM"]),
      resourceId: z.string(),
      type: z.string(),
      status: z.enum(["PENDING", "FAILED", "SUCCEEDED"]),
      attempts: z.number(),
      createdAt: z.iso.datetime(),
      error: z.string().optional(),
    }),
  ),
  processedCallbacks: z.array(z.string()),
  connections: z.object({ FINANCE: z.boolean(), SCM: z.boolean() }),
  activity: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      at: z.iso.datetime(),
      category: z.enum([
        "customer",
        "subscription",
        "ticket",
        "integration",
        "package",
      ]),
    }),
  ),
});
export const STORAGE_KEY = "nusa-crm-demo-v2";
let state: CrmState = seedState;
let initialized = false;
let warning = "";
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
function readSaved(): CrmState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = stateSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
    warning =
      "Data tersimpan tidak valid. Data contoh dimuat; gunakan reset di Pengaturan untuk menggantinya.";
  } catch {
    warning =
      "Penyimpanan browser tidak tersedia atau data tidak terbaca. Ekspor data Anda sebelum menutup halaman.";
  }
  return null;
}
export function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!initialized) {
    initialized = true;
    const saved = readSaved();
    if (saved) state = saved;
    else if (warning) state = freshState();
    queueMicrotask(notify);
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      state = readSaved() ?? freshState();
      notify();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
export const getSnapshot = () => state;
export const getServerSnapshot = () => seedState;
export const storageWarning = () => warning;
function persist(next: CrmState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    throw new Error(
      "Penyimpanan browser penuh atau diblokir. Perubahan belum disimpan; ekspor data dan periksa pengaturan browser.",
    );
  }
  state = next;
  warning = "";
  notify();
}
export function dispatch(command: Command) {
  persist(applyCommand(state, command));
}
export function resetDemo() {
  if (state.role !== "ADMIN")
    throw new Error("Reset hanya tersedia bagi administrator simulasi.");
  persist(freshState());
}
export function exportCsv(filename: string, rows: (string | number)[][]) {
  // Prefix formula-like content to keep exported user input safe in spreadsheets.
  const escape = (value: string | number) => {
    let text = String(value);
    if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  downloadFile(
    filename,
    "\uFEFF" + rows.map((row) => row.map(escape).join(",")).join("\r\n"),
    "text/csv;charset=utf-8",
  );
}
export function downloadFile(
  filename: string,
  content: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function restoreDemo(raw: string) {
  if (state.role !== "ADMIN")
    throw new Error("Import hanya tersedia bagi administrator simulasi.");
  const parsed = stateSchema.safeParse(JSON.parse(raw));
  if (!parsed.success)
    throw new Error(
      "Format backup tidak valid atau versinya tidak didukung. Data saat ini tetap dipertahankan.",
    );
  const next = parsed.data;
  const unique = (items: { id: string }[]) =>
    new Set(items.map((item) => item.id)).size === items.length;
  const hasCustomer = (id: string) => next.customers.some((c) => c.id === id);
  const hasSub = (id: string) => next.subscriptions.some((s) => s.id === id);
  const valid =
    [
      next.customers,
      next.packages,
      next.subscriptions,
      next.tickets,
      next.invoices,
      next.fulfillments,
      next.events,
    ].every(unique) &&
    next.subscriptions.every(
      (s) =>
        hasCustomer(s.customerId) &&
        next.packages.some((p) => p.id === s.packageId) &&
        s.price >= 0,
    ) &&
    next.tickets.every(
      (t) =>
        hasCustomer(t.customerId) &&
        (!t.subscriptionId ||
          next.subscriptions.some(
            (s) => s.id === t.subscriptionId && s.customerId === t.customerId,
          )),
    ) &&
    next.invoices.every((i) => hasSub(i.subscriptionId) && i.amount >= 0) &&
    next.fulfillments.every((f) => hasSub(f.subscriptionId)) &&
    next.events.every((e) =>
      e.destination === "FINANCE"
        ? next.invoices.some((i) => i.id === e.resourceId)
        : next.fulfillments.some((f) => f.id === e.resourceId),
    );
  if (!valid)
    throw new Error(
      "Relasi data backup tidak valid. Import dibatalkan tanpa mengubah data.",
    );
  persist(next);
}
