"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Users,
  Layers,
  Headphones,
  Wallet,
  CalendarDays,
  Search,
  Wifi,
  Plug,
  CircleCheck,
} from "lucide-react";
import { demoCustomers, demoTickets, growth } from "../data/mock-dashboard";
const metrics = [
  {
    label: "Total pelanggan",
    value: "1.284",
    change: "+12,8%",
    note: "dari bulan lalu",
    icon: Users,
    color: "bg-teal-50 text-teal-700",
  },
  {
    label: "Langganan aktif",
    value: "1.156",
    change: "+8,2%",
    note: "dari bulan lalu",
    icon: Layers,
    color: "bg-blue-50 text-blue-600",
  },
  {
    label: "Tiket terbuka",
    value: "24",
    change: "8 prioritas tinggi",
    note: "perlu ditindaklanjuti",
    icon: Headphones,
    color: "bg-orange-50 text-orange-500",
  },
  {
    label: "Nilai langganan / bulan",
    value: "Rp 346,8 jt",
    change: "+6,4%",
    note: "estimasi, bukan penerimaan",
    icon: Wallet,
    color: "bg-violet-50 text-violet-500",
  },
];
export function DashboardOverview() {
  const [period, setPeriod] = useState<keyof typeof growth>("6 bulan");
  const [query, setQuery] = useState("");
  const chart = growth[period];
  const customers = demoCustomers.filter((c) =>
    `${c.name} ${c.number} ${c.email}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">OVERVIEW</p>
          <h1 className="text-[28px] font-semibold tracking-[-1px] sm:text-[30px]">
            Dashboard
          </h1>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Selamat datang, Tim CRM. Berikut ringkasan layanan Anda.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[11px] text-slate-500">
          <CalendarDays size={14} />
          13 November 2026<span className="ml-1 text-slate-300">|</span>
          <span className="text-teal-700">Snapshot demo</span>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => (
          <article key={m.label} className="panel p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium text-slate-500">
                {m.label}
              </p>
              <span
                className={`grid size-9 place-items-center rounded-xl ${m.color}`}
              >
                <m.icon size={17} />
              </span>
            </div>
            <p className="mt-3 text-[29px] font-semibold tracking-[-1px]">
              {m.value}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px]">
              <span
                className={`inline-flex items-center gap-0.5 font-medium ${m.label === "Tiket terbuka" ? "text-orange-600" : "text-teal-700"}`}
              >
                {m.label !== "Tiket terbuka" && <ArrowUpRight size={12} />}{" "}
                {m.change}
              </span>
              <span className="text-slate-400">{m.note}</span>
            </div>
          </article>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.8fr_1fr]">
        <section className="panel p-5 sm:p-6" aria-labelledby="growth-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="growth-title" className="text-sm font-semibold">
                Pertumbuhan pelanggan
              </h2>
              <p className="mt-1.5 text-[11px] text-slate-400">
                Perkembangan pelanggan pada periode contoh
              </p>
            </div>
            <select
              aria-label="Periode grafik"
              value={period}
              onChange={(e) => setPeriod(e.target.value as keyof typeof growth)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-[10px] text-slate-500"
            >
              <option>6 bulan</option>
              <option>3 bulan</option>
            </select>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <span className="text-3xl font-semibold tracking-tight">
              {chart.total}
            </span>
            <span className="rounded bg-teal-50 px-2 py-1 text-[10px] font-medium text-teal-700">
              {chart.change}
            </span>
            <span className="text-[10px] text-slate-400">pelanggan</span>
          </div>
          <div
            className="relative mt-6 h-44 pl-8"
            role="img"
            aria-label={`Grafik contoh ${period}: ${chart.labels.map((month, i) => `${month} indeks ${chart.current[i]}`).join(", ")}. Indeks dinormalisasi, bukan jumlah pelanggan.`}
          >
            <div className="absolute inset-0 bottom-6 flex flex-col justify-between text-[9px] text-slate-400">
              {[100, 75, 50, 25, 0].map((n) => (
                <div key={n} className="flex items-center gap-3">
                  <span className="w-5">{n}</span>
                  <span className="grow border-t border-dashed border-slate-100" />
                </div>
              ))}
            </div>
            <div className="relative flex h-full items-end justify-around gap-4">
              {chart.labels.map((label, i) => (
                <div
                  key={label}
                  className="flex h-full flex-1 flex-col items-center justify-end"
                >
                  <div className="flex h-[calc(100%-24px)] w-full max-w-14 items-end justify-center gap-1.5">
                    <span
                      className="w-1/3 rounded-t-[4px] bg-[#d5eae0]"
                      style={{ height: `${chart.previous[i]}%` }}
                    />
                    <span
                      className="w-1/3 rounded-t-[4px] bg-[#278367]"
                      style={{ height: `${chart.current[i]}%` }}
                    />
                  </div>
                  <span className="mt-3 h-3 text-[9px] text-slate-400">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-5 text-[9px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <i className="size-2 rounded-sm bg-[#278367]" />
              Periode ini
            </span>
            <span className="flex items-center gap-1.5">
              <i className="size-2 rounded-sm bg-[#d5eae0]" />
              Pembanding
            </span>
            <span className="text-slate-400">Indeks demo (0–100)</span>
          </div>
        </section>
        <section className="panel p-5 sm:p-6">
          <h2 className="text-sm font-semibold">Distribusi paket</h2>
          <p className="mt-1.5 text-[11px] text-slate-400">
            Berdasarkan 1.156 langganan aktif contoh
          </p>
          <div className="my-6 flex justify-center">
            <div
              role="img"
              aria-label="Nusa Family 45 persen, Nusa Home 35 persen, Nusa Business 20 persen"
              className="grid size-36 place-items-center rounded-full"
              style={{
                background:
                  "conic-gradient(#278367 0% 45%, #80b9a2 45% 80%, #e1eee7 80% 100%)",
              }}
            >
              <div className="grid size-28 place-content-center rounded-full bg-white text-center">
                <span className="text-2xl font-semibold tracking-tight">
                  1.156
                </span>
                <span className="mt-1 text-[9px] text-slate-400">
                  Langganan aktif
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {[
              {
                name: "Nusa Family",
                count: "520",
                percent: "45%",
                color: "#278367",
              },
              {
                name: "Nusa Home",
                count: "405",
                percent: "35%",
                color: "#80b9a2",
              },
              {
                name: "Nusa Business",
                count: "231",
                percent: "20%",
                color: "#e1eee7",
              },
            ].map((p) => (
              <div key={p.name} className="flex items-center gap-2 text-[11px]">
                <span
                  className="size-2 rounded-full"
                  style={{ background: p.color }}
                />
                <span className="text-slate-500">{p.name}</span>
                <span className="ml-auto font-medium">{p.count}</span>
                <span className="w-9 text-right text-slate-400">
                  {p.percent}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.8fr_1fr]">
        <section className="panel min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-6">
            <div>
              <h2 className="text-sm font-semibold">Pelanggan terbaru</h2>
              <p className="mt-1.5 text-[11px] text-slate-400">
                Kenali pelanggan yang baru bergabung
              </p>
            </div>
            <Link
              href="/customers"
              className="inline-flex items-center gap-1 text-[10px] font-medium text-teal-700"
            >
              Lihat modul <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className="mx-5 mb-4 flex max-w-xs items-center gap-2 rounded-lg border border-slate-200 px-3 sm:mx-6">
            <Search size={14} className="text-slate-400" />
            <input
              aria-label="Cari pelanggan contoh"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama atau nomor pelanggan…"
              className="min-w-0 flex-1 bg-transparent py-2 text-[11px] outline-none"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[530px] text-left text-[10px]">
              <caption className="sr-only">
                Pelanggan terbaru, seluruh data fiktif
              </caption>
              <thead className="border-y border-slate-100 bg-slate-50/60 text-[9px] font-medium text-slate-400">
                <tr>
                  <th scope="col" className="px-6 py-3 font-medium">
                    PELANGGAN
                  </th>
                  <th scope="col" className="py-3 font-medium">
                    PAKET LAYANAN
                  </th>
                  <th scope="col" className="py-3 font-medium">
                    STATUS
                  </th>
                  <th scope="col" className="pr-5 font-medium">
                    BERGABUNG
                  </th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr
                    key={c.number}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`grid size-8 shrink-0 place-items-center rounded-full text-[9px] font-semibold ${c.color}`}
                        >
                          {c.initials}
                        </span>
                        <div>
                          <p className="font-semibold">{c.name}</p>
                          <p className="mt-1 text-[9px] text-slate-400">
                            {c.number}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <p className="font-medium">{c.package}</p>
                      <p className="mt-1 text-[9px] text-slate-400">
                        {c.speed}
                      </p>
                    </td>
                    <td>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] ${c.status === "Aktif" ? "bg-teal-50 text-teal-700" : "bg-amber-50 text-amber-700"}`}
                      >
                        <span
                          className={`size-1 rounded-full ${c.status === "Aktif" ? "bg-teal-600" : "bg-amber-500"}`}
                        />
                        {c.status}
                      </span>
                    </td>
                    <td className="pr-5 text-[9px] text-slate-500">{c.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {customers.length === 0 && (
              <p
                role="status"
                className="p-8 text-center text-xs text-slate-500"
              >
                Tidak ada pelanggan contoh yang cocok.
              </p>
            )}
          </div>
          <div
            className="border-t border-slate-100 px-6 py-3 text-[9px] text-slate-400"
            aria-live="polite"
          >
            Menampilkan {customers.length} dari {demoCustomers.length} pelanggan
            contoh
          </div>
        </section>
        <div className="space-y-5">
          <section className="panel p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Tiket perlu perhatian</h2>
              <span className="rounded-md bg-orange-50 px-2 py-1 text-[9px] text-orange-600">
                3 contoh
              </span>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {demoTickets.map((t) => (
                <div key={t.id} className="py-3 first:pt-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] text-slate-400">#{t.id}</span>
                    <span
                      className={`rounded px-1.5 py-1 text-[8px] ${t.color}`}
                    >
                      {t.priority}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] font-medium">{t.title}</p>
                  <p className="mt-1 text-[9px] text-slate-400">{t.customer}</p>
                </div>
              ))}
            </div>
            <Link
              href="/tickets"
              className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-medium text-teal-700"
            >
              Buka modul tiket <ArrowRight size={12} />
            </Link>
          </section>
          <section className="rounded-2xl border border-teal-100 bg-[#edf5f0] p-5">
            <div className="flex items-center gap-2">
              <Plug size={15} className="text-teal-700" />
              <h2 className="text-xs font-semibold">Koneksi antar modul</h2>
            </div>
            <p className="mt-2 text-[10px] leading-5 text-slate-500">
              Keuangan dan SCM akan terhubung pada tahap integrasi.
            </p>
            <div className="mt-3 flex gap-2">
              {["Keuangan", "SCM"].map((label) => (
                <span
                  key={label}
                  className="rounded-md border border-teal-100 bg-white/70 px-2 py-1 text-[9px] text-slate-500"
                >
                  {label} · Belum terhubung
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
        <CircleCheck size={13} className="text-teal-600" />
        Mode demonstrasi aktif<span className="mx-1 text-slate-300">·</span>
        <Wifi size={13} />
        Seluruh angka dan identitas merupakan data fiktif.
      </div>
    </div>
  );
}
