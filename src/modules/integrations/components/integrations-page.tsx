"use client";
import { useState, useEffect } from "react";
import {
  CreditCard,
  PackageCheck,
  Activity,
  RefreshCw,
  Plus,
  Router,
  CircleCheck,
} from "lucide-react";
import { useCrm } from "@/modules/crm/context";
import { operation, request, refresh } from "@/modules/crm/client";
import { money, dateLabel } from "@/modules/crm/domain";
import { Badge, Dialog, Empty, PageHeading } from "@/components/crm/ui";
import { CardTitle } from "@/components/crm/page-helpers";
type Stock = { sku: string; name: string; onHand: number; reserved: number };
type Action = { kind: "payment" | "delivery" | "receipt"; id: string };
export function IntegrationsPage() {
  const { state, user, run, open, toast, busy } = useCrm();
  const [tab, setTab] = useState("FINANCE"),
    [action, setAction] = useState<Action | null>(null),
    [stock, setStock] = useState<Stock[]>([]),
    [inventoryError, setInventoryError] = useState("");
  const admin = user?.role === "ADMIN";
  useEffect(() => {
    if (admin)
      void request("integrations/inventory")
        .then((data) => {
          setStock(data);
          setInventoryError("");
        })
        .catch((e) => setInventoryError(e.message));
  }, [admin, state.revision]);
  const invoice = state.invoices.find((i) => i.id === action?.id);
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="CONNECTED ECOSYSTEM"
        title="Pusat integrasi"
        description="Penagihan dan perangkat tersinkronisasi melalui layanan Keuangan dan SCM."
      >
        <button className="btn btn-secondary" onClick={() => void refresh()}>
          <RefreshCw size={15} />
          Muat ulang status
        </button>
      </PageHeading>
      <div className="integration-cards">
        {[
          {
            key: "FINANCE" as const,
            name: "Layanan Keuangan",
            Icon: CreditCard,
            description: "Invoice dan pencatatan pembayaran terverifikasi",
          },
          {
            key: "SCM" as const,
            name: "Supply Chain Management",
            Icon: PackageCheck,
            description: "Persediaan, reservasi, dan serah-terima perangkat",
          },
        ].map((s) => (
          <section className="panel integration-card" key={s.key}>
            <div className="integration-card-top">
              <span className="metric-icon blue">
                <s.Icon size={25} />
              </span>
              <span
                className={`connection-label ${state.connections[s.key] ? "" : "is-offline"}`}
              >
                <i />
                {state.connections[s.key] ? "Terhubung" : "Belum terjangkau"}
              </span>
            </div>
            <h2>{s.name}</h2>
            <p>{s.description}</p>
            <div className="integration-card-bottom">
              <span>
                {
                  state.events.filter(
                    (e) => e.destination === s.key && e.status !== "SUCCEEDED",
                  ).length
                }{" "}
                event menunggu / perlu ditinjau
              </span>
              {admin && (
                <button
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={async () => {
                    try {
                      await operation(
                        `integrations/${s.key === "FINANCE" ? "finance" : "scm"}/callbacks/retry`,
                        {},
                      );
                      toast("Callback gagal dijadwalkan ulang.");
                    } catch (e) {
                      toast(
                        e instanceof Error ? e.message : "Permintaan gagal.",
                        true,
                      );
                    }
                  }}
                >
                  Ulangi callback gagal
                </button>
              )}
            </div>
          </section>
        ))}
      </div>
      <div className="real-notice">
        Status berasal dari layanan terpisah dan database server. Worker
        mengirim permintaan secara otomatis; status pembayaran/perangkat berubah
        setelah respons atau callback terverifikasi diterima. Pencatatan
        pembayaran manual hanya dilakukan setelah staf memeriksa bukti dana
        masuk.
      </div>
      <div className="tabs integration-tabs">
        {[
          ["FINANCE", "Invoice & pembayaran", CreditCard],
          ["SCM", "Persediaan & perangkat", PackageCheck],
          ["EVENTS", "Antrean & log event", Activity],
        ].map(([value, label, Icon]) => {
          const I = Icon as typeof Activity;
          return (
            <button
              key={String(value)}
              className={tab === value ? "active" : ""}
              onClick={() => setTab(String(value))}
            >
              <I size={16} />
              {String(label)}
            </button>
          );
        })}
      </div>
      {tab === "FINANCE" && (
        <section className="panel">
          <CardTitle
            title="Invoice langganan"
            description="Dokumen diterbitkan oleh layanan Keuangan; pembayaran dicatat dengan referensi bukti."
          />
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Pelanggan / langganan</th>
                  <th>Nominal</th>
                  <th>Status</th>
                  <th>Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {state.invoices.map((i) => {
                  const sub = state.subscriptions.find(
                    (s) => s.id === i.subscriptionId,
                  );
                  return (
                    <tr key={i.id}>
                      <td>
                        <strong>{i.number}</strong>
                        <small className="cell-subtext">
                          {dateLabel(i.createdAt)}
                        </small>
                      </td>
                      <td>
                        <span className="stacked-cell">
                          {
                            state.customers.find(
                              (c) => c.id === sub?.customerId,
                            )?.name
                          }
                          <button
                            className="text-link"
                            onClick={() =>
                              open({
                                kind: "subscription-detail",
                                id: i.subscriptionId,
                              })
                            }
                          >
                            {sub?.number}
                          </button>
                        </span>
                      </td>
                      <td className="amount-cell">{money(i.amount)}</td>
                      <td>
                        <Badge status={i.status} />
                      </td>
                      <td>
                        {i.status === "ISSUED" &&
                        admin &&
                        sub?.status !== "CANCELLED" ? (
                          <button
                            className="btn btn-secondary btn-small"
                            disabled={busy}
                            onClick={() =>
                              setAction({ kind: "payment", id: i.id })
                            }
                          >
                            <CreditCard size={14} />
                            Catat pembayaran
                          </button>
                        ) : i.status === "PAID" ? (
                          <span className="success-text">
                            <CircleCheck size={14} />
                            Pembayaran tercatat
                          </span>
                        ) : i.status === "PENDING" ? (
                          <span className="muted">
                            Menunggu layanan Keuangan
                          </span>
                        ) : (
                          <span className="muted">Rekonsiliasi pembatalan</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!state.invoices.length && (
            <Empty
              title="Belum ada invoice"
              description="Invoice dibuat setelah langganan didaftarkan."
            />
          )}
        </section>
      )}
      {tab === "SCM" && (
        <>
          <section className="panel">
            <CardTitle
              title="Persediaan perangkat"
              description="Jumlah tersedia adalah stok fisik dikurangi reservasi."
            >
              {admin && (
                <button
                  className="btn btn-primary"
                  onClick={() =>
                    setAction({ kind: "receipt", id: "ONT-ROUTER" })
                  }
                >
                  <Plus size={15} />
                  Catat penerimaan stok
                </button>
              )}
            </CardTitle>
            <div className="inventory-summary">
              {inventoryError ? (
                <span>{inventoryError}</span>
              ) : stock.length ? (
                stock.map((s) => (
                  <div key={s.sku}>
                    <strong>{s.name}</strong> · Fisik {s.onHand} · Dipesan{" "}
                    {s.reserved} · Tersedia{" "}
                    <strong>{s.onHand - s.reserved}</strong>
                  </div>
                ))
              ) : (
                <span>
                  {admin
                    ? "Belum ada stok. Catat barang yang telah diterima."
                    : "Rincian stok dikelola administrator SCM."}
                </span>
              )}
            </div>
          </section>
          <section className="panel">
            <CardTitle
              title="Pemenuhan perangkat"
              description="Serah-terima hanya dapat dicatat setelah stok berhasil direservasi."
            />
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Langganan</th>
                    <th>Pelanggan & alamat</th>
                    <th>Perangkat</th>
                    <th>Status SCM</th>
                    <th>Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {state.fulfillments.map((f) => {
                    const sub = state.subscriptions.find(
                      (s) => s.id === f.subscriptionId,
                    );
                    return (
                      <tr key={f.id}>
                        <td>
                          <button
                            className="text-link"
                            onClick={() =>
                              open({
                                kind: "subscription-detail",
                                id: f.subscriptionId,
                              })
                            }
                          >
                            {sub?.number}
                          </button>
                        </td>
                        <td>
                          <span className="stacked-cell">
                            {
                              state.customers.find(
                                (c) => c.id === sub?.customerId,
                              )?.name
                            }
                            <small>{sub?.address}</small>
                          </span>
                        </td>
                        <td>
                          <span className="device-label">
                            <Router size={16} />
                            Router / ONT × 1
                          </span>
                        </td>
                        <td>
                          <Badge status={f.status} />
                          <small className="cell-subtext">
                            {f.externalStatus === "WAITING_STOCK"
                              ? "Menunggu stok"
                              : f.externalStatus === "RESERVED"
                                ? "Stok direservasi"
                                : f.externalStatus === "DELIVERED"
                                  ? "Sudah diserahkan"
                                  : f.externalStatus === "CANCELLED"
                                    ? "Dibatalkan"
                                    : "Menunggu SCM"}
                          </small>
                        </td>
                        <td>
                          {f.externalStatus === "RESERVED" &&
                          admin &&
                          sub?.status !== "CANCELLED" ? (
                            <button
                              className="btn btn-secondary btn-small"
                              disabled={busy}
                              onClick={() =>
                                setAction({ kind: "delivery", id: f.id })
                              }
                            >
                              Catat serah-terima
                            </button>
                          ) : f.status === "FULFILLED" ? (
                            <span className="success-text">
                              <CircleCheck size={14} />
                              Perangkat diterima
                            </span>
                          ) : (
                            <span className="muted">
                              Diproses sesuai kesiapan stok
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!state.fulfillments.length && <Empty />}
          </section>
        </>
      )}
      {tab === "EVENTS" && (
        <section className="panel">
          <CardTitle
            title="Antrean dan riwayat pengiriman"
            description="Event disimpan secara permanen, memakai lease worker dan idempotency key yang sama saat retry."
          />
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Tujuan</th>
                  <th>Status</th>
                  <th>Percobaan</th>
                  <th>Catatan</th>
                  <th>Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {state.events.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <strong>{e.type}</strong>
                      <small className="cell-subtext mono">
                        {e.id.slice(0, 18)}
                      </small>
                    </td>
                    <td>{e.destination === "FINANCE" ? "Keuangan" : "SCM"}</td>
                    <td>
                      <Badge status={e.status} />
                    </td>
                    <td>{e.attempts}</td>
                    <td className="event-note">
                      {e.error ??
                        (e.status === "SUCCEEDED"
                          ? "Diterima layanan tujuan"
                          : e.status === "PROCESSING"
                            ? "Sedang dikirim worker"
                            : "Menunggu jadwal pengiriman")}
                    </td>
                    <td>
                      {e.status === "FAILED" && admin && (
                        <button
                          className="btn btn-secondary btn-small"
                          disabled={busy}
                          onClick={() =>
                            void run(
                              { type: "DISPATCH", id: e.id },
                              "Event dijadwalkan ulang.",
                            )
                          }
                        >
                          <RefreshCw size={13} />
                          Coba ulang
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!state.events.length && <Empty />}
        </section>
      )}
      {action && (
        <Dialog
          title={
            action.kind === "payment"
              ? "Catat pembayaran terverifikasi"
              : action.kind === "delivery"
                ? "Catat serah-terima perangkat"
                : "Catat penerimaan stok"
          }
          subtitle="Pastikan dokumen sumber telah diperiksa sebelum menyimpan."
          onClose={() => setAction(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              let path = "",
                payload: unknown;
              if (action.kind === "payment") {
                path = `integrations/finance/invoices/${action.id}/payments`;
                payload = {
                  amount: invoice?.amount,
                  reference: String(data.get("reference")),
                  paidAt: new Date(String(data.get("paidAt"))).toISOString(),
                  verified: true,
                };
              } else if (action.kind === "delivery") {
                path = `integrations/scm/fulfillments/${action.id}/deliver`;
                payload = {
                  reference: String(data.get("reference")),
                  recipient: String(data.get("recipient")),
                };
              } else {
                path = "integrations/inventory/receipts";
                payload = {
                  reference: String(data.get("reference")),
                  quantity: Number(data.get("quantity")),
                };
              }
              try {
                await operation(path, payload);
                setAction(null);
                toast(
                  "Pencatatan berhasil. Sinkronisasi status sedang diproses.",
                );
                if (action.kind === "receipt")
                  setStock(await request("integrations/inventory"));
              } catch (e) {
                toast(
                  e instanceof Error ? e.message : "Pencatatan gagal.",
                  true,
                );
              }
            }}
          >
            <div className="form-body">
              {action.kind === "payment" && (
                <>
                  <div className="order-summary">
                    <strong>{invoice && money(invoice.amount)}</strong>
                    <p>
                      Pelunasan invoice {invoice?.number}. Ini pencatatan bukti
                      pembayaran, bukan instruksi transfer atau payment gateway.
                    </p>
                  </div>
                  <label className="form-field">
                    <span>Waktu dana diterima</span>
                    <input name="paidAt" type="datetime-local" required />
                  </label>
                </>
              )}
              {action.kind === "receipt" && (
                <label className="form-field">
                  <span>Jumlah perangkat diterima</span>
                  <input
                    name="quantity"
                    type="number"
                    min={1}
                    max={10000}
                    required
                  />
                </label>
              )}
              {action.kind === "delivery" && (
                <label className="form-field">
                  <span>Nama penerima</span>
                  <input
                    name="recipient"
                    minLength={3}
                    maxLength={100}
                    required
                  />
                </label>
              )}
              <label className="form-field">
                <span>
                  {action.kind === "payment"
                    ? "Referensi bukti pembayaran"
                    : action.kind === "delivery"
                      ? "Nomor dokumen serah-terima"
                      : "Referensi dokumen penerimaan"}
                </span>
                <input
                  name="reference"
                  minLength={6}
                  maxLength={100}
                  required
                />
              </label>
              <label className="checkbox-field">
                <input type="checkbox" required />
                Saya telah memeriksa dokumen dan kebenaran pencatatan ini.
              </label>
            </div>
            <div className="dialog-footer">
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setAction(null)}
              >
                Batal
              </button>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                Simpan pencatatan
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
