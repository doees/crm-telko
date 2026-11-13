"use client";
import Link from "next/link";
import {
  useCallback,
  useState,
  useId,
  cloneElement,
  type ReactElement,
} from "react";
import {
  ArrowRight,
  MapPin,
  Phone,
  Mail,
  Wifi,
  CreditCard,
  PackageCheck,
  CircleCheck,
  AlertTriangle,
  MessageSquare,
  Send,
} from "lucide-react";
import { useCrm } from "@/modules/crm/context";
import { money, dateLabel, canWrite } from "@/modules/crm/domain";
import {
  technicians,
  type TicketInput,
  type CustomerInput,
  type PackageInput,
} from "@/modules/crm/types";
import { Badge, Dialog, Avatar } from "./ui";
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children as ReactElement<{ id?: string }>, { id })}
    </div>
  );
}
function FormFooter({
  onClose,
  label = "Simpan perubahan",
}: {
  onClose: () => void;
  label?: string;
}) {
  return (
    <div className="dialog-footer">
      <button type="button" className="btn btn-secondary" onClick={onClose}>
        Batal
      </button>
      <button className="btn btn-primary" type="submit">
        {label}
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
function CustomerForm({ id, close }: { id?: string; close: () => void }) {
  const { state, run } = useCrm();
  const data = state.customers.find((c) => c.id === id);
  return (
    <Dialog
      title={id ? "Edit pelanggan" : "Tambah pelanggan"}
      subtitle="Mulai hubungan yang lebih baik dengan pelanggan Anda."
      onClose={close}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const data = Object.fromEntries(form) as CustomerInput;
          if (
            run(
              { type: "SAVE_CUSTOMER", id, data },
              "Data pelanggan berhasil disimpan.",
            )
          )
            close();
        }}
      >
        <div className="form-body">
          <Field label="Nama lengkap / perusahaan">
            <input
              name="name"
              required
              minLength={3}
              maxLength={100}
              defaultValue={data?.name}
              placeholder="Contoh: Aditya Pratama"
              autoComplete="name"
            />
          </Field>
          <div className="form-grid">
            <Field label="Email">
              <input
                name="email"
                type="email"
                defaultValue={data?.email}
                placeholder="nama@example.com"
                autoComplete="email"
              />
            </Field>
            <Field label="Nomor telepon">
              <input
                name="phone"
                type="tel"
                required
                minLength={8}
                maxLength={20}
                defaultValue={data?.phone}
                placeholder="081234567890"
                autoComplete="tel"
              />
            </Field>
          </div>
          <Field label="Alamat pelanggan">
            <textarea
              name="address"
              required
              minLength={8}
              maxLength={500}
              rows={3}
              defaultValue={data?.address}
              placeholder="Jalan, nomor, kecamatan, dan kota"
            />
          </Field>
          <div className="info-note">
            <CircleCheck size={17} />
            <span>
              Gunakan identitas fiktif. Data demo disimpan pada browser ini.
            </span>
          </div>
        </div>
        <FormFooter
          onClose={close}
          label={id ? "Simpan perubahan" : "Tambah pelanggan"}
        />
      </form>
    </Dialog>
  );
}
function PackageForm({ id, close }: { id?: string; close: () => void }) {
  const { state, run } = useCrm();
  const data = state.packages.find((p) => p.id === id);
  return (
    <Dialog
      title={id ? "Edit paket layanan" : "Paket layanan baru"}
      subtitle="Rancang penawaran internet untuk setiap kebutuhan."
      onClose={close}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const data = {
            name: String(form.get("name")),
            speed: Number(form.get("speed")),
            price: Number(form.get("price")),
            category: form.get("category") as PackageInput["category"],
            device: form.get("device") === "on",
          };
          if (
            run(
              { type: "SAVE_PACKAGE", id, data },
              "Katalog paket berhasil diperbarui.",
            )
          )
            close();
        }}
      >
        <div className="form-body">
          <Field label="Nama paket">
            <input
              required
              name="name"
              minLength={3}
              maxLength={80}
              defaultValue={data?.name}
              placeholder="Nusa Home Premium"
            />
          </Field>
          <div className="form-grid">
            <Field label="Kecepatan (Mbps)">
              <input
                required
                type="number"
                name="speed"
                min={10}
                max={10000}
                defaultValue={data?.speed ?? 100}
              />
            </Field>
            <Field label="Harga bulanan (Rp)">
              <input
                required
                type="number"
                name="price"
                min={10000}
                max={100000000}
                step={1000}
                defaultValue={data?.price ?? 349000}
              />
            </Field>
          </div>
          <Field label="Segmen layanan">
            <select name="category" defaultValue={data?.category ?? "HOME"}>
              <option value="HOME">Internet rumah</option>
              <option value="BUSINESS">Internet bisnis</option>
            </select>
          </Field>
          <label className="checkbox-field">
            <input
              type="checkbox"
              name="device"
              defaultChecked={data?.device ?? true}
            />
            <span>Membutuhkan perangkat dan pemenuhan SCM</span>
          </label>
          <div className="info-note">
            <Wifi size={17} />
            <span>
              Perubahan harga hanya berlaku untuk langganan baru. Harga
              langganan lama tetap.
            </span>
          </div>
        </div>
        <FormFooter onClose={close} />
      </form>
    </Dialog>
  );
}
function SubscriptionForm({
  customerId,
  packageId,
  close,
}: {
  customerId?: string;
  packageId?: string;
  close: () => void;
}) {
  const { state, run } = useCrm();
  const [selectedCustomer, setSelectedCustomer] = useState(
    customerId ?? state.customers.find((c) => c.status === "ACTIVE")?.id ?? "",
  );
  const [selectedPackage, setSelectedPackage] = useState(
    packageId ?? state.packages.find((p) => p.status === "ACTIVE")?.id ?? "",
  );
  const c = state.customers.find((c) => c.id === selectedCustomer);
  const p = state.packages.find((p) => p.id === selectedPackage);
  return (
    <Dialog
      title="Langganan baru"
      subtitle="Hubungkan pelanggan dengan layanan yang tepat."
      onClose={close}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          if (
            run(
              {
                type: "CREATE_SUBSCRIPTION",
                customerId: selectedCustomer,
                packageId: selectedPackage,
                address: String(form.get("address")),
              },
              "Langganan dibuat. Lanjutkan invoice dan perangkat di Pusat integrasi.",
            )
          )
            close();
        }}
      >
        <div className="form-body">
          <Field label="Pelanggan">
            <select
              required
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
            >
              <option value="" disabled>
                Pilih pelanggan aktif
              </option>
              {state.customers
                .filter((c) => c.status === "ACTIVE")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.number}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Paket layanan">
            <select
              required
              value={selectedPackage}
              onChange={(e) => setSelectedPackage(e.target.value)}
            >
              <option value="" disabled>
                Pilih paket aktif
              </option>
              {state.packages
                .filter((p) => p.status === "ACTIVE")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.speed} Mbps
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Alamat instalasi">
            <textarea
              key={selectedCustomer}
              name="address"
              required
              minLength={8}
              maxLength={500}
              rows={3}
              defaultValue={c?.address}
              placeholder="Alamat pemasangan layanan"
            />
          </Field>
          {p && (
            <div className="order-summary">
              <div>
                <span>Biaya langganan bulanan</span>
                <strong>{money(p.price)}</strong>
              </div>
              <p>
                {p.device
                  ? "Termasuk permintaan perangkat melalui SCM."
                  : "Paket tanpa kebutuhan perangkat."}{" "}
                Invoice awal dibuat otomatis dan menunggu pemrosesan di Pusat
                integrasi.
              </p>
            </div>
          )}
        </div>
        <FormFooter onClose={close} label="Buat langganan" />
      </form>
    </Dialog>
  );
}
function TicketForm({ id, close }: { id?: string; close: () => void }) {
  const { state, run } = useCrm();
  const data = state.tickets.find((t) => t.id === id);
  const [customer, setCustomer] = useState(
    data?.customerId ?? state.customers[0]?.id ?? "",
  );
  const [sub, setSub] = useState(data?.subscriptionId ?? "");
  return (
    <Dialog
      title={id ? "Edit tiket bantuan" : "Buat tiket bantuan"}
      subtitle="Setiap keluhan adalah kesempatan memberi layanan lebih baik."
      onClose={close}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const input = {
            customerId: customer,
            subscriptionId: sub,
            subject: String(form.get("subject")),
            description: String(form.get("description")),
            priority: form.get("priority") as TicketInput["priority"],
            assignee: form.get("assignee") as TicketInput["assignee"],
          };
          if (
            run(
              { type: "SAVE_TICKET", id, data: input },
              "Tiket bantuan berhasil disimpan.",
            )
          )
            close();
        }}
      >
        <div className="form-body">
          <div className="form-grid">
            <Field label="Pelanggan">
              <select
                required
                value={customer}
                onChange={(e) => {
                  setCustomer(e.target.value);
                  setSub("");
                }}
              >
                {state.customers.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Langganan terkait">
              <select value={sub} onChange={(e) => setSub(e.target.value)}>
                <option value="">Keluhan umum</option>
                {state.subscriptions
                  .filter((s) => s.customerId === customer)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.number}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
          <Field label="Subjek keluhan">
            <input
              name="subject"
              required
              minLength={5}
              maxLength={150}
              defaultValue={data?.subject}
              placeholder="Contoh: Koneksi internet tidak stabil"
            />
          </Field>
          <Field label="Deskripsi keluhan">
            <textarea
              name="description"
              required
              minLength={10}
              maxLength={3000}
              rows={4}
              defaultValue={data?.description}
              placeholder="Jelaskan kendala yang dialami pelanggan…"
            />
          </Field>
          <div className="form-grid">
            <Field label="Prioritas">
              <select name="priority" defaultValue={data?.priority ?? "MEDIUM"}>
                <option value="LOW">Rendah</option>
                <option value="MEDIUM">Sedang</option>
                <option value="HIGH">Tinggi</option>
              </select>
            </Field>
            <Field label="Teknisi penanggung jawab">
              <select
                name="assignee"
                defaultValue={data?.assignee ?? "Belum ditugaskan"}
              >
                {technicians.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>
        <FormFooter
          onClose={close}
          label={id ? "Simpan perubahan" : "Buat tiket"}
        />
      </form>
    </Dialog>
  );
}
function CustomerDetail({ id, close }: { id: string; close: () => void }) {
  const { state, open } = useCrm();
  const c = state.customers.find((c) => c.id === id);
  if (!c) return null;
  const subs = state.subscriptions.filter((s) => s.customerId === id);
  const tickets = state.tickets.filter((t) => t.customerId === id);
  return (
    <Dialog title="Profil pelanggan" subtitle={c.number} onClose={close} wide>
      <div className="detail-body">
        <div className="customer-profile">
          <Avatar name={c.name} />
          <div>
            <h3>{c.name}</h3>
            <p>Bergabung {dateLabel(c.createdAt)}</p>
          </div>
          <Badge status={c.status} />
        </div>
        <div className="contact-grid">
          <div>
            <Mail size={16} />
            <span>{c.email || "Belum ditambahkan"}</span>
          </div>
          <div>
            <Phone size={16} />
            <span>{c.phone}</span>
          </div>
          <div>
            <MapPin size={16} />
            <span>{c.address}</span>
          </div>
        </div>
        <h4 className="section-label">Langganan · {subs.length}</h4>
        {subs.length ? (
          subs.map((s) => (
            <button
              className="detail-row"
              key={s.id}
              onClick={() => open({ kind: "subscription-detail", id: s.id })}
            >
              <div>
                <strong>
                  {state.packages.find((p) => p.id === s.packageId)?.name}
                </strong>
                <span>
                  {s.number} · {money(s.price)}/bulan
                </span>
              </div>
              <Badge status={s.status} />
              <ArrowRight size={15} />
            </button>
          ))
        ) : (
          <p className="muted">Belum memiliki langganan.</p>
        )}
        <h4 className="section-label">Tiket bantuan · {tickets.length}</h4>
        {tickets.length ? (
          tickets.map((t) => (
            <button
              className="detail-row"
              key={t.id}
              onClick={() => open({ kind: "ticket-detail", id: t.id })}
            >
              <div>
                <strong>{t.subject}</strong>
                <span>{t.number}</span>
              </div>
              <Badge status={t.status} />
              <ArrowRight size={15} />
            </button>
          ))
        ) : (
          <p className="muted">Belum ada tiket bantuan.</p>
        )}
      </div>
      <div className="dialog-footer">
        <button className="btn btn-secondary" onClick={close}>
          Tutup
        </button>
        {canWrite(state.role, "master") && (
          <button
            className="btn btn-primary"
            onClick={() => open({ kind: "customer", id })}
          >
            Edit profil
          </button>
        )}
        {canWrite(state.role, "operations") && c.status === "ACTIVE" && (
          <button
            className="btn btn-primary"
            onClick={() => open({ kind: "subscription", customerId: id })}
          >
            Tambah langganan
          </button>
        )}
      </div>
    </Dialog>
  );
}
function SubscriptionDetail({ id, close }: { id: string; close: () => void }) {
  const { state, run, open } = useCrm();
  const s = state.subscriptions.find((s) => s.id === id);
  if (!s) return null;
  const c = state.customers.find((c) => c.id === s.customerId);
  const p = state.packages.find((p) => p.id === s.packageId);
  const invoice = state.invoices.find((i) => i.subscriptionId === id);
  const f = state.fulfillments.find((f) => f.subscriptionId === id);
  return (
    <Dialog
      title={s.number}
      subtitle="Detail langganan dan kesiapan layanan"
      onClose={close}
      wide
    >
      <div className="detail-body">
        <div className="subscription-banner">
          <Wifi size={32} />
          <div>
            <h3>{p?.name}</h3>
            <p>
              {p?.speed} Mbps · {money(s.price)}/bulan
            </p>
          </div>
          <Badge status={s.status} />
        </div>
        <div className="detail-grid">
          <div>
            <span>Pelanggan</span>
            <strong>{c?.name}</strong>
          </div>
          <div>
            <span>Tanggal dibuat</span>
            <strong>{dateLabel(s.createdAt)}</strong>
          </div>
          <div>
            <span>Alamat instalasi</span>
            <strong>{s.address}</strong>
          </div>
          <div>
            <span>Harga kontrak</span>
            <strong>{money(s.price)} / bulan</strong>
          </div>
        </div>
        <h4 className="section-label">Kesiapan aktivasi</h4>
        <div className="activation-step">
          <CreditCard size={20} />
          <div>
            <strong>Invoice awal · {invoice?.number}</strong>
            <span>{invoice ? money(invoice.amount) : "Belum tersedia"}</span>
          </div>
          {invoice && <Badge status={invoice.status} />}
        </div>
        {s.device && (
          <div className="activation-step">
            <PackageCheck size={20} />
            <div>
              <strong>Pemenuhan perangkat</strong>
              <span>Router / ONT untuk instalasi</span>
            </div>
            {f && <Badge status={f.status} />}
          </div>
        )}
        <div className="info-note">
          <CircleCheck size={17} />
          <span>
            Aktivasi otomatis setelah invoice lunas
            {s.device ? " dan perangkat terpenuhi" : ""}. Perubahan harga
            katalog tidak mengubah harga kontrak ini.
          </span>
        </div>
        {s.status === "CANCELLED" && (
          <div className="info-note warning">
            <AlertTriangle size={18} />
            <span>
              Pembatalan layanan tidak otomatis membatalkan invoice atau
              mengembalikan perangkat. Rekonsiliasi dilakukan terpisah.
            </span>
          </div>
        )}
      </div>
      <div className="dialog-footer">
        <Link
          className="btn btn-secondary"
          href="/integrations"
          onClick={close}
        >
          Buka integrasi
          <ArrowRight size={15} />
        </Link>
        {canWrite(state.role, "operations") && (
          <>
            {s.status === "PENDING" && (
              <button
                className="btn btn-primary"
                onClick={() =>
                  run({ type: "SUBSCRIPTION_STATUS", id, status: "ACTIVE" })
                }
              >
                Cek aktivasi
              </button>
            )}
            {s.status === "ACTIVE" && (
              <button
                className="btn btn-secondary"
                onClick={() =>
                  open({
                    kind: "confirm",
                    title: "Tangguhkan langganan?",
                    description:
                      "Layanan ditandai ditangguhkan dan dapat dilanjutkan kembali.",
                    action: {
                      type: "SUBSCRIPTION_STATUS",
                      id,
                      status: "SUSPENDED",
                    },
                  })
                }
              >
                Tangguhkan
              </button>
            )}
            {s.status === "SUSPENDED" && (
              <button
                className="btn btn-primary"
                onClick={() =>
                  run({ type: "SUBSCRIPTION_STATUS", id, status: "ACTIVE" })
                }
              >
                Lanjutkan layanan
              </button>
            )}
            {s.status !== "CANCELLED" && (
              <button
                className="btn btn-danger-soft"
                onClick={() =>
                  open({
                    kind: "confirm",
                    title: "Batalkan langganan?",
                    description:
                      "Pembatalan bersifat final pada demo ini. Invoice dan perangkat perlu direkonsiliasi terpisah.",
                    action: {
                      type: "SUBSCRIPTION_STATUS",
                      id,
                      status: "CANCELLED",
                    },
                  })
                }
              >
                Batalkan layanan
              </button>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
function TicketDetail({ id, close }: { id: string; close: () => void }) {
  const { state, run } = useCrm();
  const [comment, setComment] = useState("");
  const t = state.tickets.find((t) => t.id === id);
  if (!t) return null;
  const customer = state.customers.find((c) => c.id === t.customerId);
  const writable =
    canWrite(state.role, "ticket") &&
    (state.role !== "TECHNICIAN" || t.assignee === "Raka Wijaya");
  return (
    <Dialog title={t.number} subtitle={t.subject} onClose={close} wide>
      <div className="detail-body">
        <div className="ticket-meta">
          <Badge status={t.status} />
          <Badge status={t.priority} />
          <span>{dateLabel(t.createdAt)}</span>
        </div>
        <h3 className="ticket-subject">{t.subject}</h3>
        <p className="ticket-description">{t.description}</p>
        <div className="detail-grid">
          <div>
            <span>Pelanggan</span>
            <strong>{customer?.name}</strong>
          </div>
          <div>
            <span>Langganan</span>
            <strong>
              {state.subscriptions.find((s) => s.id === t.subscriptionId)
                ?.number ?? "Keluhan umum"}
            </strong>
          </div>
        </div>
        <label className="form-field">
          <span>Teknisi penanggung jawab</span>
          <select
            value={t.assignee}
            disabled={
              !writable || state.role === "TECHNICIAN" || t.status === "CLOSED"
            }
            onChange={(e) =>
              run({
                type: "TICKET_ASSIGN",
                id,
                assignee: e.target.value as TicketInput["assignee"],
              })
            }
          >
            {technicians.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <h4 className="section-label">
          <MessageSquare size={15} />
          Catatan penanganan · {t.comments.length}
        </h4>
        <div className="comment-list">
          {t.comments.length ? (
            t.comments.map((c) => (
              <article key={c.id}>
                <div>
                  <strong>{c.author}</strong>
                  <span>{dateLabel(c.at)}</span>
                </div>
                <p>{c.text}</p>
              </article>
            ))
          ) : (
            <p className="muted">
              Belum ada catatan. Tambahkan hasil pemeriksaan sebelum
              menyelesaikan tiket.
            </p>
          )}
        </div>
        {writable && t.status !== "CLOSED" && (
          <form
            className="comment-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (
                run(
                  { type: "TICKET_COMMENT", id, text: comment },
                  "Catatan penanganan ditambahkan.",
                )
              )
                setComment("");
            }}
          >
            <textarea
              aria-label="Catatan penanganan"
              placeholder="Tulis catatan penanganan…"
              required
              minLength={3}
              maxLength={2000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">
              <Send size={15} />
              Kirim catatan
            </button>
          </form>
        )}
      </div>
      <div className="dialog-footer">
        <button className="btn btn-secondary" onClick={close}>
          Tutup
        </button>
        {writable && (
          <>
            {t.status === "OPEN" && (
              <button
                className="btn btn-primary"
                onClick={() =>
                  run({ type: "TICKET_STATUS", id, status: "IN_PROGRESS" })
                }
              >
                Mulai tangani
              </button>
            )}
            {t.status === "IN_PROGRESS" && (
              <button
                className="btn btn-primary"
                onClick={() =>
                  run({ type: "TICKET_STATUS", id, status: "RESOLVED" })
                }
              >
                Selesaikan tiket
              </button>
            )}
            {t.status === "RESOLVED" && (
              <>
                <button
                  className="btn btn-secondary"
                  onClick={() =>
                    run({ type: "TICKET_STATUS", id, status: "IN_PROGRESS" })
                  }
                >
                  Buka penanganan
                </button>
                {state.role !== "TECHNICIAN" && (
                  <button
                    className="btn btn-primary"
                    onClick={() =>
                      run({ type: "TICKET_STATUS", id, status: "CLOSED" })
                    }
                  >
                    Tutup tiket
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
export function CrmDialogs() {
  const { modal, open, run } = useCrm();
  const close = useCallback(() => open(null), [open]);
  if (!modal) return null;
  switch (modal.kind) {
    case "customer":
      return (
        <CustomerForm
          key={modal.id ?? "new-customer"}
          id={modal.id}
          close={close}
        />
      );
    case "package":
      return (
        <PackageForm
          key={modal.id ?? "new-package"}
          id={modal.id}
          close={close}
        />
      );
    case "ticket":
      return (
        <TicketForm
          key={modal.id ?? "new-ticket"}
          id={modal.id}
          close={close}
        />
      );
    case "subscription":
      return (
        <SubscriptionForm
          customerId={modal.customerId}
          packageId={modal.packageId}
          close={close}
        />
      );
    case "customer-detail":
      return <CustomerDetail id={modal.id} close={close} />;
    case "subscription-detail":
      return <SubscriptionDetail id={modal.id} close={close} />;
    case "ticket-detail":
      return <TicketDetail key={modal.id} id={modal.id} close={close} />;
    case "confirm":
      return (
        <Dialog title={modal.title} onClose={close}>
          <div className="form-body">
            <p className="muted">{modal.description}</p>
          </div>
          <div className="dialog-footer">
            <button className="btn btn-secondary" onClick={close}>
              Kembali
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (run(modal.action)) close();
              }}
            >
              Ya, lanjutkan
            </button>
          </div>
        </Dialog>
      );
  }
}
