"use client";
import { useState } from "react";
import {
  Layers,
  Download,
  CreditCard,
  Activity,
  TrendingUp,
  FileText,
} from "lucide-react";
import { useCrm } from "@/modules/crm/context";
import {
  money,
  shortMoney,
  dateLabel,
  statusLabels,
} from "@/modules/crm/domain";
import { type CrmState } from "@/modules/crm/types";
import { exportCsv } from "@/modules/crm/store";
import { PageHeading } from "@/components/crm/ui";
import { CardTitle } from "@/components/crm/page-helpers";
function reportRows(state: CrmState) {
  return [
    [
      "Nomor langganan",
      "Pelanggan",
      "Paket",
      "Status",
      "Harga kontrak (Rp)",
      "Dibuat",
    ],
    ...state.subscriptions.map((s) => [
      s.number,
      state.customers.find((c) => c.id === s.customerId)?.name ?? "",
      state.packages.find((p) => p.id === s.packageId)?.name ?? "",
      statusLabels[s.status],
      s.price,
      s.createdAt,
    ]),
  ];
}
export function ReportsPage() {
  const { state } = useCrm();
  const [range, setRange] = useState("ALL");
  const months = [
    ...new Set(state.subscriptions.map((s) => s.createdAt.slice(0, 7))),
  ]
    .sort()
    .reverse();
  const filtered = state.subscriptions.filter(
    (s) => range === "ALL" || s.createdAt.startsWith(range),
  );
  const active = filtered.filter((s) => s.status === "ACTIVE");
  const ids = new Set(filtered.map((s) => s.id));
  const paid = state.invoices
    .filter((i) => ids.has(i.subscriptionId) && i.status === "PAID")
    .reduce((sum, i) => sum + i.amount, 0);
  const unpaid = state.invoices
    .filter((i) => ids.has(i.subscriptionId) && ["PENDING", "ISSUED"].includes(i.status))
    .reduce((sum, i) => sum + i.amount, 0);
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="INSIGHTS & REPORTS"
        title="Laporan operasional"
        description="Ubah data layanan menjadi gambaran bisnis yang lebih jelas."
      >
        <select
          className="compact-select"
          aria-label="Periode laporan"
          value={range}
          onChange={(e) => setRange(e.target.value)}
        >
          <option value="ALL">Semua periode pendaftaran</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <button
          className="btn btn-primary"
          onClick={() =>
            exportCsv(
              "nusa-laporan-langganan.csv",
              reportRows({ ...state, subscriptions: filtered }),
            )
          }
        >
          <Download size={16} />
          Unduh laporan CSV
        </button>
      </PageHeading>
      <div className="metric-grid report-metrics">
        {[
          {
            label: "Langganan periode ini",
            value: filtered.length,
            icon: Layers,
            note: "Berdasarkan tanggal pendaftaran",
          },
          {
            label: "Estimasi nilai bulanan",
            value: shortMoney(active.reduce((sum, s) => sum + s.price, 0)),
            icon: TrendingUp,
            note: "Harga kontrak layanan aktif",
          },
          {
            label: "Pembayaran tercatat",
            value: shortMoney(paid),
            icon: CreditCard,
            note: "Invoice yang ditandai lunas",
          },
          {
            label: "Invoice belum lunas",
            value: shortMoney(unpaid),
            icon: FileText,
            note: "Invoice tertunda / diterbitkan",
          },
        ].map((m) => (
          <article className="metric-card" key={m.label}>
            <div>
              <span>{m.label}</span>
              <span className="metric-icon red">
                <m.icon size={20} />
              </span>
            </div>
            <strong>{m.value}</strong>
            <p>{m.note}</p>
          </article>
        ))}
      </div>
      <section className="panel">
        <CardTitle
          title="Performa paket layanan"
          description="Mengikuti periode pendaftaran langganan yang dipilih"
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Paket</th>
                <th>Total langganan</th>
                <th>Aktif</th>
                <th>Menunggu</th>
                <th>Nilai kontrak aktif / bulan</th>
              </tr>
            </thead>
            <tbody>
              {state.packages.map((p) => {
                const subs = filtered.filter((s) => s.packageId === p.id);
                return (
                  <tr key={p.id}>
                    <td>
                      <span className="stacked-cell">
                        {p.name}
                        <small>{p.speed} Mbps</small>
                      </span>
                    </td>
                    <td>{subs.length}</td>
                    <td>{subs.filter((s) => s.status === "ACTIVE").length}</td>
                    <td>{subs.filter((s) => s.status === "PENDING").length}</td>
                    <td className="amount-cell">
                      {money(
                        subs
                          .filter((s) => s.status === "ACTIVE")
                          .reduce((sum, s) => sum + s.price, 0),
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <CardTitle
          title="Jejak aktivitas"
          description="Perubahan operasional terbaru pada workspace perusahaan"
        />
        <div className="activity-feed">
          {state.activity.slice(0, 30).map((a) => (
            <div key={a.id}>
              <span className={`activity-icon activity-${a.category}`}>
                <Activity size={15} />
              </span>
              <div>
                <p>{a.text}</p>
                <span>
                  {dateLabel(a.at)} ·{" "}
                  {new Intl.DateTimeFormat("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Jakarta",
                  }).format(new Date(a.at))}{" "}
                  WIB
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
