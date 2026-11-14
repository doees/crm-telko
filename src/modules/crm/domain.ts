import {
  customerInput,
  packageInput,
  ticketInput,
  type CrmState,
  type Command,
  type Activity,
  type Subscription,
  type Role,
} from "./types";
export const money = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
export const shortMoney = (value: number) =>
  value >= 1000000
    ? `Rp ${(value / 1000000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`
    : money(value);
export const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
export const statusLabels: Record<string, string> = {
  ACTIVE: "Aktif",
  INACTIVE: "Nonaktif",
  PENDING: "Menunggu",
  SUSPENDED: "Ditangguhkan",
  CANCELLED: "Dibatalkan",
  OPEN: "Terbuka",
  IN_PROGRESS: "Ditangani",
  RESOLVED: "Terselesaikan",
  CLOSED: "Ditutup",
  PAID: "Lunas",
  VOID: "Dibatalkan",
  ISSUED: "Belum dibayar",
  PROCESSING: "Diproses",
  FULFILLED: "Terpenuhi",
  SUCCEEDED: "Berhasil",
  FAILED: "Gagal",
  HIGH: "Tinggi",
  MEDIUM: "Sedang",
  LOW: "Rendah",
};
export function canWrite(
  role: Role,
  area: "master" | "operations" | "ticket" | "integration",
) {
  return (
    role === "ADMIN" ||
    (role === "CS" &&
      (area === "operations" || area === "ticket" || area === "master")) ||
    (role === "TECHNICIAN" && area === "ticket")
  );
}
function requireThat(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function nextNumber(items: { number: string }[], prefix: string) {
  const max = Math.max(
    0,
    ...items.map((x) => Number(x.number.split("-").at(-1)) || 0),
  );
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}
export function applyCommand(
  source: CrmState,
  command: Command,
  now = new Date().toISOString(),
  id = () => crypto.randomUUID(),
  actor?: { id: string; name: string },
): CrmState {
  const state = structuredClone(source);
  const record = (text: string, category: Activity["category"]) =>
    state.activity.unshift({ id: id(), text, at: now, category });
  const role = state.role;
  const area = command.type.includes("TICKET")
    ? "ticket"
    : command.type.includes("SUBSCRIPTION")
      ? "operations"
      : ["DISPATCH"].includes(command.type)
        ? "integration"
        : "master";
  requireThat(
    canWrite(role, area),
    "Akun Anda tidak memiliki akses untuk tindakan ini.",
  );
  const autoActivate = (subscriptionId: string) => {
    const sub = state.subscriptions.find((s) => s.id === subscriptionId);
    if (
      sub?.status === "PENDING" &&
      state.invoices.some(
        (i) => i.subscriptionId === sub.id && i.status === "PAID",
      ) &&
      (!sub.device ||
        state.fulfillments.some(
          (f) => f.subscriptionId === sub.id && f.status === "FULFILLED",
        ))
    ) {
      sub.status = "ACTIVE";
      sub.activatedAt = now;
      record(
        `${sub.number} aktif setelah pembayaran dan pemenuhan selesai`,
        "subscription",
      );
    }
  };
  switch (command.type) {
    case "SAVE_CUSTOMER": {
      const data = customerInput.parse(command.data);
      requireThat(
        !state.customers.some(
          (c) =>
            c.id !== command.id &&
            c.phone.replace(/[^0-9]/g, "") ===
              data.phone.replace(/[^0-9]/g, ""),
        ),
        "Nomor telepon sudah terdaftar.",
      );
      if (command.id) {
        const c = state.customers.find((c) => c.id === command.id);
        requireThat(c, "Pelanggan tidak ditemukan.");
        Object.assign(c, data);
        record(`${c.name}: profil diperbarui`, "customer");
      } else {
        const c = {
          ...data,
          id: id(),
          number: nextNumber(state.customers, "CST"),
          status: "ACTIVE" as const,
          createdAt: now,
        };
        state.customers.unshift(c);
        record(`${c.name} bergabung sebagai pelanggan baru`, "customer");
      }
      break;
    }
    case "TOGGLE_CUSTOMER": {
      const c = state.customers.find((c) => c.id === command.id);
      requireThat(c, "Pelanggan tidak ditemukan.");
      requireThat(
        c.status === "INACTIVE" ||
          !state.subscriptions.some(
            (s) => s.customerId === c.id && s.status !== "CANCELLED",
          ),
        "Batalkan seluruh langganan pelanggan sebelum menonaktifkan.",
      );
      c.status = c.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      record(
        `${c.name}: status ${statusLabels[c.status].toLowerCase()}`,
        "customer",
      );
      break;
    }
    case "SAVE_PACKAGE": {
      requireThat(
        role === "ADMIN",
        "Hanya administrator dapat mengubah paket.",
      );
      const data = packageInput.parse(command.data);
      requireThat(
        !state.packages.some(
          (p) =>
            p.id !== command.id &&
            p.name.toLowerCase() === data.name.toLowerCase(),
        ),
        "Nama paket sudah digunakan.",
      );
      if (command.id) {
        const p = state.packages.find((p) => p.id === command.id);
        requireThat(p, "Paket tidak ditemukan.");
        Object.assign(p, data);
      } else state.packages.push({ ...data, id: id(), status: "ACTIVE" });
      record(`${data.name}: katalog paket diperbarui`, "package");
      break;
    }
    case "TOGGLE_PACKAGE": {
      requireThat(
        role === "ADMIN",
        "Hanya administrator dapat mengubah paket.",
      );
      const p = state.packages.find((p) => p.id === command.id);
      requireThat(p, "Paket tidak ditemukan.");
      p.status = p.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      record(`${p.name}: ${statusLabels[p.status].toLowerCase()}`, "package");
      break;
    }
    case "CREATE_SUBSCRIPTION": {
      const c = state.customers.find((c) => c.id === command.customerId);
      const p = state.packages.find((p) => p.id === command.packageId);
      requireThat(c?.status === "ACTIVE", "Pilih pelanggan yang aktif.");
      requireThat(p?.status === "ACTIVE", "Pilih paket yang aktif.");
      requireThat(
        command.address.trim().length >= 8,
        "Alamat instalasi minimal 8 karakter.",
      );
      const sub: Subscription = {
        id: id(),
        number: nextNumber(state.subscriptions, "SUB"),
        customerId: c.id,
        packageId: p.id,
        price: p.price,
        device: p.device,
        address: command.address.trim(),
        status: "PENDING",
        createdAt: now,
      };
      state.subscriptions.unshift(sub);
      const invoice = {
        id: id(),
        number: nextNumber(
          state.invoices,
          `INV-${new Date(now).getUTCFullYear()}`,
        ),
        subscriptionId: sub.id,
        amount: p.price,
        status: "PENDING" as const,
        createdAt: now,
      };
      state.invoices.unshift(invoice);
      state.events.unshift({
        id: id(),
        destination: "FINANCE",
        resourceId: invoice.id,
        type: "invoice.create",
        status: "PENDING",
        attempts: 0,
        createdAt: now,
      });
      if (sub.device) {
        const f = {
          id: id(),
          subscriptionId: sub.id,
          status: "PENDING" as const,
        };
        state.fulfillments.unshift(f);
        state.events.unshift({
          id: id(),
          destination: "SCM",
          resourceId: f.id,
          type: "fulfillment.request",
          status: "PENDING",
          attempts: 0,
          createdAt: now,
        });
      }
      record(
        `${sub.number} dibuat untuk ${c.name}; permintaan integrasi masuk antrean`,
        "subscription",
      );
      break;
    }
    case "SUBSCRIPTION_STATUS": {
      const sub = state.subscriptions.find((s) => s.id === command.id);
      requireThat(sub, "Langganan tidak ditemukan.");
      const transitions: Record<
        Subscription["status"],
        Subscription["status"][]
      > = {
        PENDING: ["ACTIVE", "CANCELLED"],
        ACTIVE: ["SUSPENDED", "CANCELLED"],
        SUSPENDED: ["ACTIVE", "CANCELLED"],
        CANCELLED: [],
      };
      requireThat(
        transitions[sub.status].includes(command.status),
        "Perubahan status langganan tidak diperbolehkan.",
      );
      if (command.status === "ACTIVE" && sub.status === "PENDING") {
        autoActivate(sub.id);
        requireThat(
          state.subscriptions.some(
            (item) => item.id === sub.id && item.status === "ACTIVE",
          ),
          "Aktivasi membutuhkan invoice lunas dan perangkat terpenuhi.",
        );
      } else sub.status = command.status;
      record(
        `${sub.number}: status ${statusLabels[sub.status].toLowerCase()}`,
        "subscription",
      );
      break;
    }
    case "SAVE_TICKET": {
      const data = ticketInput.parse(command.data);
      requireThat(
        state.customers.some((c) => c.id === data.customerId),
        "Pelanggan tidak ditemukan.",
      );
      requireThat(
        !data.subscriptionId ||
          state.subscriptions.some(
            (s) =>
              s.id === data.subscriptionId && s.customerId === data.customerId,
          ),
        "Langganan harus milik pelanggan yang dipilih.",
      );
      requireThat(
        role !== "TECHNICIAN",
        "Teknisi memperbarui tiket melalui detail penanganan.",
      );
      if (command.id) {
        const t = state.tickets.find((t) => t.id === command.id);
        requireThat(t, "Tiket tidak ditemukan.");
        requireThat(
          !["RESOLVED", "CLOSED"].includes(t.status),
          "Informasi tiket yang selesai tidak dapat diubah.",
        );
        Object.assign(t, data);
      } else
        state.tickets.unshift({
          ...data,
          id: id(),
          number: nextNumber(state.tickets, "TKT"),
          status: "OPEN",
          createdAt: now,
          comments: [],
        });
      record(`Tiket ${data.subject}: informasi tersimpan`, "ticket");
      break;
    }
    case "TICKET_STATUS": {
      const t = state.tickets.find((t) => t.id === command.id);
      requireThat(t, "Tiket tidak ditemukan.");
      requireThat(
        role !== "TECHNICIAN" || t.assignee === (actor?.id ?? ""),
        "Teknisi hanya dapat menangani tiket yang ditugaskan kepadanya.",
      );
      const allowed = {
        OPEN: ["IN_PROGRESS"],
        IN_PROGRESS: ["RESOLVED"],
        RESOLVED: ["CLOSED", "IN_PROGRESS"],
        CLOSED: [],
      };
      requireThat(
        (allowed[t.status] as string[]).includes(command.status),
        "Transisi status tiket tidak diperbolehkan.",
      );
      requireThat(
        command.status !== "IN_PROGRESS" || t.assignee !== "Belum ditugaskan",
        "Tugaskan teknisi sebelum memulai penanganan.",
      );
      requireThat(
        command.status !== "RESOLVED" || t.comments.length > 0,
        "Tambahkan catatan penanganan sebelum menyelesaikan tiket.",
      );
      requireThat(
        role !== "TECHNICIAN" || command.status !== "CLOSED",
        "Penutupan tiket dilakukan administrator atau customer service.",
      );
      t.status = command.status;
      record(`${t.number}: ${statusLabels[t.status].toLowerCase()}`, "ticket");
      break;
    }
    case "TICKET_ASSIGN": {
      requireThat(
        role !== "TECHNICIAN",
        "Penugasan dilakukan administrator atau customer service.",
      );
      const t = state.tickets.find((t) => t.id === command.id);
      requireThat(t, "Tiket tidak ditemukan.");
      requireThat(
        t.status !== "CLOSED",
        "Tiket tertutup tidak dapat ditugaskan ulang.",
      );
      t.assignee = command.assignee;
      record(`${t.number} ditugaskan ke ${t.assignee}`, "ticket");
      break;
    }
    case "TICKET_COMMENT": {
      const t = state.tickets.find((t) => t.id === command.id);
      requireThat(t, "Tiket tidak ditemukan.");
      requireThat(
        role !== "TECHNICIAN" || t.assignee === (actor?.id ?? ""),
        "Teknisi hanya dapat mengomentari tiketnya sendiri.",
      );
      requireThat(
        t.status !== "CLOSED",
        "Tiket tertutup tidak dapat dikomentari.",
      );
      requireThat(
        command.text.trim().length >= 3 && command.text.length <= 2000,
        "Catatan harus berisi 3–2000 karakter.",
      );
      t.comments.push({
        id: id(),
        author: actor?.name ?? "Sistem",
        text: command.text.trim(),
        at: now,
      });
      record(`Catatan penanganan ditambahkan pada ${t.number}`, "ticket");
      break;
    }
    case "DISPATCH":
      throw new Error("Pengiriman event diproses worker server.");
  }
  state.activity = state.activity.slice(0, 200);
  state.revision++;
  return state;
}
