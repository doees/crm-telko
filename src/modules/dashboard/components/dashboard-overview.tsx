"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Plus,
  ArrowUpRight,
  ArrowRight,
  Users,
  Wifi,
  Layers,
  Headphones,
  Download,
  ChevronRight,
  ShieldCheck,
  PlugZap,
  TrendingUp,
  CircleDollarSign,
} from "lucide-react";
import { useCrm } from "@/modules/crm/context";
import { canWrite, shortMoney, dateLabel } from "@/modules/crm/domain";
import { Avatar, Badge, PageHeading, Empty } from "@/components/crm/ui";
import { CardTitle } from "@/components/crm/page-helpers";
export function DashboardOverview() {
  const { state, open } = useCrm();
  const [period, setPeriod] = useState("6");
  const active = state.subscriptions.filter((s) => s.status === "ACTIVE");
  const openTickets = state.tickets.filter((t) =>
    ["OPEN", "IN_PROGRESS"].includes(t.status),
  );
  const revenue = active.reduce((sum, s) => sum + s.price, 0);
  const pending = state.subscriptions.filter(
    (s) => s.status === "PENDING",
  ).length;
  const end = state.customers.reduce(
    (latest, c) =>
      c.createdAt.slice(0, 7) > latest ? c.createdAt.slice(0, 7) : latest,
    "2026-11",
  );
  const months = Array.from({ length: Number(period) }, (_, i) => {
    const d = new Date(`${end}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - Number(period) + i + 1);
    return {
      key: d.toISOString().slice(0, 7),
      label: new Intl.DateTimeFormat("id-ID", {
        month: "short",
        timeZone: "UTC",
      }).format(d),
    };
  });
  const bars = months.map((m) => ({
    ...m,
    count: state.customers.filter((c) => c.createdAt.startsWith(m.key)).length,
  }));
  const max = Math.max(1, ...bars.map((b) => b.count));
  const recent = [...state.customers]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="WORKSPACE OVERVIEW"
        title="Ringkasan operasional"
        description="Semua koneksi, pelanggan, dan layanan Anda. Dalam satu tempat."
      >
        <Link href="/reports" className="btn btn-secondary">
          <Download size={16} />
          Laporan
        </Link>
        <button
          className="btn btn-primary"
          disabled={!canWrite(state.role, "operations")}
          onClick={() => open({ kind: "subscription" })}
        >
          <Plus size={17} />
          Langganan baru
        </button>
      </PageHeading>
      <section className="telecom-hero">
        <div className="hero-copy">
          <span className="hero-kicker">
            <span />
            NUSA CONNECTED EXPERIENCE
          </span>
          <h2>
            Koneksi yang lebih baik.
            <br />
            Pelanggan yang lebih dekat.
          </h2>
          <p>
            Kelola setiap perjalanan pelanggan, dari koneksi pertama
            <br className="desktop-only" /> hingga layanan yang selalu bisa
            diandalkan.
          </p>
          <Link href="/customers" className="hero-link">
            Jelajahi pelanggan <ArrowRight size={16} />
          </Link>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <div className="hero-router">
            <Wifi size={60} strokeWidth={1.4} />
            <span>CONNECTED</span>
            <div>
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="hero-chip chip-top">
            <ShieldCheck size={19} />
            <div>
              <strong>Layanan terhubung</strong>
              <span>Satu ekosistem CRM</span>
            </div>
          </div>
          <div className="hero-chip chip-bottom">
            <span className="signal-bars">
              <i />
              <i />
              <i />
              <i />
            </span>
            <div>
              <strong>Selalu lebih dekat</strong>
              <span>Customer-first experience</span>
            </div>
          </div>
          <div className="hero-dot dot-one" />
          <div className="hero-dot dot-two" />
        </div>
      </section>
      <div className="metric-grid">
        {[
          {
            label: "Total pelanggan",
            value: String(state.customers.length).padStart(2, "0"),
            note: `${state.customers.filter((c) => c.status === "ACTIVE").length} pelanggan aktif`,
            icon: Users,
            color: "blue",
          },
          {
            label: "Langganan aktif",
            value: String(active.length).padStart(2, "0"),
            note: `${pending} menunggu aktivasi`,
            icon: Layers,
            color: "violet",
          },
          {
            label: "Tiket perlu perhatian",
            value: String(openTickets.length).padStart(2, "0"),
            note: `${openTickets.filter((t) => t.priority === "HIGH").length} prioritas tinggi`,
            icon: Headphones,
            color: "orange",
          },
          {
            label: "Nilai langganan bulanan",
            value: shortMoney(revenue),
            note: "Estimasi kontrak aktif, bukan kas",
            icon: CircleDollarSign,
            color: "red",
          },
        ].map((m) => (
          <article key={m.label} className="metric-card">
            <div>
              <span>{m.label}</span>
              <span className={`metric-icon ${m.color}`}>
                <m.icon size={20} />
              </span>
            </div>
            <strong>{m.value}</strong>
            <p>
              <span className="tiny-dot" />
              {m.note}
            </p>
          </article>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel chart-card">
          <CardTitle
            title="Pertumbuhan pelanggan"
            description="Pelanggan baru berdasarkan tanggal bergabung"
          >
            <select
              className="compact-select"
              aria-label="Periode grafik"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value="6">6 bulan terakhir</option>
              <option value="3">3 bulan terakhir</option>
            </select>
          </CardTitle>
          <div className="chart-total">
            <strong>{bars.reduce((sum, b) => sum + b.count, 0)}</strong>
            <span>pelanggan baru pada periode ini</span>
            <span className="chart-trend">
              <TrendingUp size={14} />
              Data tersimpan
            </span>
          </div>
          <div
            className="bar-chart"
            role="img"
            aria-label={bars
              .map((b) => `${b.label}: ${b.count} pelanggan`)
              .join(", ")}
          >
            <div className="chart-guides">
              {[max, Math.round(max / 2), 0].map((n, i) => (
                <span key={i}>
                  {n}
                  <i />
                </span>
              ))}
            </div>
            <div className="chart-columns">
              {bars.map((b, i) => (
                <div className="chart-column" key={b.key}>
                  <div className="bar-space">
                    <div
                      className={
                        i === bars.length - 1
                          ? "chart-bar current"
                          : "chart-bar"
                      }
                      style={{
                        height: `${(b.count / max) * 100}%`,
                        minHeight: b.count ? 8 : 0,
                      }}
                    >
                      <span>{b.count}</span>
                    </div>
                  </div>
                  <span>{b.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="chart-legend">
            <span />
            <p>Pelanggan baru</p>
            <small>Jumlah aktual pada data demo</small>
          </div>
        </section>
        <section className="panel distribution-card">
          <CardTitle
            title="Pilihan pelanggan"
            description="Distribusi langganan aktif per paket"
          />
          <div className="distribution-summary">
            <div className="mini-ring">
              <Wifi size={29} />
            </div>
            <div>
              <strong>{active.length}</strong>
              <span>layanan aktif</span>
            </div>
            <span className="soft-pill">
              {state.packages.filter((p) => p.status === "ACTIVE").length} paket
            </span>
          </div>
          <div className="package-distribution">
            {state.packages.slice(0, 5).map((p, i) => {
              const count = active.filter((s) => s.packageId === p.id).length;
              return (
                <div key={p.id}>
                  <div>
                    <span className={`distribution-dot dot-${i % 4}`} />
                    <span>{p.name.replace("Nusa ", "")}</span>
                    <strong>{count}</strong>
                  </div>
                  <div className="progress-track">
                    <span
                      className={`progress-${i % 4}`}
                      style={{
                        width: `${active.length ? (count / active.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <Link href="/packages" className="card-bottom-link">
            Lihat semua paket <ArrowUpRight size={15} />
          </Link>
        </section>
      </div>
      <div className="dashboard-grid">
        <section className="panel latest-card">
          <CardTitle
            title="Pelanggan terbaru"
            description="Setiap koneksi dimulai dari hubungan yang baik"
          >
            <Link href="/customers" className="text-link">
              Lihat semua <ArrowRight size={14} />
            </Link>
          </CardTitle>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Pelanggan</th>
                  <th>Paket layanan</th>
                  <th>Status</th>
                  <th>Bergabung</th>
                  <th>
                    <span className="sr-only">Detail</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {recent.map((c, i) => (
                  <tr key={c.id}>
                    <td>
                      <button
                        className="customer-cell"
                        onClick={() =>
                          open({ kind: "customer-detail", id: c.id })
                        }
                      >
                        <Avatar name={c.name} index={i} />
                        <span>
                          <strong>{c.name}</strong>
                          <small>{c.number}</small>
                        </span>
                      </button>
                    </td>
                    <td>
                      {state.packages
                        .find(
                          (p) =>
                            p.id ===
                            state.subscriptions.find(
                              (s) =>
                                s.customerId === c.id &&
                                s.status !== "CANCELLED",
                            )?.packageId,
                        )
                        ?.name.replace("Nusa ", "") ?? "Belum berlangganan"}
                    </td>
                    <td>
                      <Badge status={c.status} />
                    </td>
                    <td className="muted-cell">{dateLabel(c.createdAt)}</td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Detail ${c.name}`}
                        onClick={() =>
                          open({ kind: "customer-detail", id: c.id })
                        }
                      >
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel attention-card">
          <CardTitle
            title="Butuh perhatian"
            description="Prioritas untuk pengalaman yang lebih baik"
          >
            <span className="count-chip">{openTickets.length}</span>
          </CardTitle>
          {openTickets.length ? (
            openTickets.slice(0, 3).map((t) => (
              <button
                key={t.id}
                className="attention-ticket"
                onClick={() => open({ kind: "ticket-detail", id: t.id })}
              >
                <span
                  className={`ticket-indicator priority-${t.priority.toLowerCase()}`}
                />
                <span>
                  <small>
                    {t.number} ·{" "}
                    {state.customers.find((c) => c.id === t.customerId)?.name}
                  </small>
                  <strong>{t.subject}</strong>
                  <span>{t.assignee}</span>
                </span>
                <ChevronRight size={15} />
              </button>
            ))
          ) : (
            <Empty
              title="Semua tertangani"
              description="Tidak ada tiket terbuka saat ini."
            />
          )}
          <Link href="/tickets" className="card-bottom-link">
            Buka pusat bantuan <ArrowUpRight size={15} />
          </Link>
        </section>
      </div>
      <section className="integration-strip">
        <span className="integration-strip-icon">
          <PlugZap size={25} />
        </span>
        <div>
          <h3>Satu ekosistem, banyak kemungkinan.</h3>
          <p>Hubungkan alur pelanggan, pembayaran, dan pemenuhan perangkat.</p>
        </div>
        <div className="connection-chips">
          <span>
            <i className={state.connections.FINANCE ? "online" : "offline"} />
            Keuangan
          </span>
          <span>
            <i className={state.connections.SCM ? "online" : "offline"} />
            SCM
          </span>
        </div>
        <Link href="/integrations" className="btn btn-secondary">
          Kelola integrasi <ArrowRight size={15} />
        </Link>
      </section>
    </div>
  );
}
