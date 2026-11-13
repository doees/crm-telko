"use client";
import { useState } from "react";
import {
  CircleCheck,
  Router,
  Send,
  RefreshCw,
  CreditCard,
  PackageCheck,
  CircleAlert,
  Activity,
} from "lucide-react";
import { useCrm } from "@/modules/crm/context";
import { canWrite, money, dateLabel } from "@/modules/crm/domain";
import { Badge, PageHeading, Empty } from "@/components/crm/ui";
import { CardTitle } from "@/components/crm/page-helpers";
export function IntegrationsPage() {
  const { state, run, open } = useCrm();
  const [tab, setTab] = useState("FINANCE");
  const allowed = canWrite(state.role, "integration");
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="CONNECTED ECOSYSTEM"
        title="Pusat integrasi"
        description="Sambungkan proses CRM dengan penagihan dan pemenuhan layanan."
      >
        <span className="demo-badge">
          <span />
          Simulator interaktif
        </span>
      </PageHeading>
      <div className="integration-cards">
        {[
          {
            key: "FINANCE" as const,
            name: "Modul Keuangan",
            icon: CreditCard,
            note: "Invoice, pembayaran, dan status penagihan",
            color: "blue",
          },
          {
            key: "SCM" as const,
            name: "Supply Chain Management",
            icon: PackageCheck,
            note: "Permintaan, perangkat, dan pemenuhan layanan",
            color: "violet",
          },
        ].map((item) => (
          <section className="panel integration-card" key={item.key}>
            <div className="integration-card-top">
              <span className={`metric-icon ${item.color}`}>
                <item.icon size={25} />
              </span>
              <span
                className={`connection-label ${state.connections[item.key] ? "" : "is-offline"}`}
              >
                <i />
                {state.connections[item.key]
                  ? "Simulator online"
                  : "Simulator offline"}
              </span>
            </div>
            <h2>{item.name}</h2>
            <p>{item.note}</p>
            <div className="integration-card-bottom">
              <span>
                {
                  state.events.filter(
                    (e) =>
                      e.destination === item.key && e.status !== "SUCCEEDED",
                  ).length
                }{" "}
                event menunggu / gagal
              </span>
              <button
                className="btn btn-secondary"
                disabled={!allowed}
                onClick={() =>
                  run(
                    {
                      type: "CONNECTION",
                      destination: item.key,
                      connected: !state.connections[item.key],
                    },
                    "Status simulator diperbarui.",
                  )
                }
              >
                {state.connections[item.key]
                  ? "Simulasikan offline"
                  : "Aktifkan simulator"}
              </button>
            </div>
          </section>
        ))}
      </div>
      <div className="simulation-note">
        <CircleAlert size={20} />
        <div>
          <strong>Lingkungan simulasi untuk demonstrasi integrasi</strong>
          <p>
            Tindakan di halaman ini memperbarui data lokal. Tidak ada uang
            berpindah, perangkat dikirim, atau API eksternal yang dihubungi.
            Matikan simulator untuk mencoba kegagalan dan retry.
          </p>
        </div>
      </div>
      <div className="tabs integration-tabs">
        {[
          ["FINANCE", "Invoice & pembayaran", CreditCard],
          ["SCM", "Pemenuhan perangkat", PackageCheck],
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
            description="Kirim permintaan invoice, lalu simulasikan callback pembayaran."
          />
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Pelanggan / langganan</th>
                  <th>Nominal</th>
                  <th>Status</th>
                  <th>Tindakan simulasi</th>
                </tr>
              </thead>
              <tbody>
                {state.invoices.map((i) => {
                  const s = state.subscriptions.find(
                    (s) => s.id === i.subscriptionId,
                  );
                  const c = state.customers.find((c) => c.id === s?.customerId);
                  const e = state.events.find((e) => e.resourceId === i.id);
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
                          {c?.name}
                          <button
                            className="text-link"
                            onClick={() =>
                              open({
                                kind: "subscription-detail",
                                id: i.subscriptionId,
                              })
                            }
                          >
                            {s?.number}
                          </button>
                        </span>
                      </td>
                      <td className="amount-cell">{money(i.amount)}</td>
                      <td>
                        <Badge status={i.status} />
                      </td>
                      <td>
                        {i.status === "PENDING" && e ? (
                          <button
                            className="btn btn-secondary btn-small"
                            disabled={!allowed || s?.status === "CANCELLED"}
                            onClick={() =>
                              run(
                                { type: "DISPATCH", id: e.id },
                                state.connections.FINANCE
                                  ? "Invoice diterbitkan oleh simulator."
                                  : "Percobaan tercatat; simulator offline. Periksa log event.",
                              )
                            }
                          >
                            <Send size={13} />
                            Kirim invoice
                          </button>
                        ) : i.status === "ISSUED" ? (
                          <button
                            className="btn btn-secondary btn-small"
                            disabled={!allowed || s?.status === "CANCELLED"}
                            onClick={() =>
                              run(
                                {
                                  type: "PAY_INVOICE",
                                  id: i.id,
                                  callbackId: `payment-${i.id}`,
                                },
                                "Callback pembayaran diproses. Status langganan diperiksa otomatis.",
                              )
                            }
                          >
                            <CreditCard size={13} />
                            Simulasikan lunas
                          </button>
                        ) : (
                          <span className="success-text">
                            <CircleCheck size={14} />
                            Pembayaran tercatat
                          </span>
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
              description="Buat langganan untuk menghasilkan invoice awal."
            />
          )}
        </section>
      )}
      {tab === "SCM" && (
        <section className="panel">
          <CardTitle
            title="Permintaan perangkat"
            description="Pemenuhan perangkat menjadi salah satu syarat aktivasi."
          />
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Langganan</th>
                  <th>Pelanggan & alamat</th>
                  <th>Perangkat</th>
                  <th>Status</th>
                  <th>Tindakan simulasi</th>
                </tr>
              </thead>
              <tbody>
                {state.fulfillments.map((f) => {
                  const s = state.subscriptions.find(
                    (s) => s.id === f.subscriptionId,
                  );
                  const c = state.customers.find((c) => c.id === s?.customerId);
                  const e = state.events.find((e) => e.resourceId === f.id);
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
                          {s?.number}
                        </button>
                      </td>
                      <td>
                        <span className="stacked-cell">
                          {c?.name}
                          <small>{s?.address}</small>
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
                      </td>
                      <td>
                        {f.status === "PENDING" && e ? (
                          <button
                            className="btn btn-secondary btn-small"
                            disabled={!allowed || s?.status === "CANCELLED"}
                            onClick={() =>
                              run(
                                { type: "DISPATCH", id: e.id },
                                state.connections.SCM
                                  ? "Permintaan diterima simulator SCM."
                                  : "Pengiriman gagal karena simulator offline; periksa log event.",
                              )
                            }
                          >
                            <Send size={13} />
                            Kirim permintaan
                          </button>
                        ) : f.status === "PROCESSING" ? (
                          <button
                            className="btn btn-secondary btn-small"
                            disabled={!allowed || s?.status === "CANCELLED"}
                            onClick={() =>
                              run(
                                {
                                  type: "FULFILL",
                                  id: f.id,
                                  callbackId: `fulfillment-${f.id}`,
                                },
                                "Perangkat terpenuhi. Status aktivasi diperiksa otomatis.",
                              )
                            }
                          >
                            <PackageCheck size={13} />
                            Simulasikan terpenuhi
                          </button>
                        ) : (
                          <span className="success-text">
                            <CircleCheck size={14} />
                            Perangkat siap
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
      )}
      {tab === "EVENTS" && (
        <section className="panel">
          <CardTitle
            title="Antrean integrasi & retry"
            description="ID event tetap dipakai saat retry. Callback duplikat tidak diproses ulang."
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
                  <th>Aksi</th>
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
                          ? "Diterima oleh simulator"
                          : "Menunggu pengiriman")}
                    </td>
                    <td>
                      {e.status !== "SUCCEEDED" && (
                        <button
                          className="btn btn-secondary btn-small"
                          disabled={!allowed}
                          onClick={() =>
                            run(
                              { type: "DISPATCH", id: e.id },
                              "Percobaan pengiriman dicatat. Periksa status event.",
                            )
                          }
                        >
                          <RefreshCw size={13} />
                          {e.status === "FAILED" ? "Coba ulang" : "Kirim"}
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
    </div>
  );
}
