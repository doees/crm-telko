"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Wifi,
  Layers,
  Headphones,
  Plug,
  Menu,
  X,
  Radio,
  ChevronRight,
  FlaskConical,
  ArrowUpRight,
} from "lucide-react";
import { navigation } from "@/lib/navigation";
const icons = {
  dashboard: LayoutDashboard,
  customers: Users,
  packages: Wifi,
  subscriptions: Layers,
  tickets: Headphones,
  integrations: Plug,
};
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const title = navigation.find((item) => item.href === path)?.label ?? "CRM";
  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only z-50 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:bg-white focus:p-4"
      >
        Lewati ke konten
      </a>
      {open && (
        <button
          className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
          aria-label="Tutup navigasi"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        id="main-navigation"
        aria-label="Navigasi utama"
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-slate-200/70 bg-white p-5 ${open ? "flex" : "hidden lg:flex"}`}
      >
        <Link
          href="/dashboard"
          onClick={() => setOpen(false)}
          className="mb-11 mt-3 flex items-center gap-2.5 px-2"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-teal-800 text-white">
            <Radio size={22} />
          </span>
          <span className="text-[25px] font-bold tracking-[-1.3px]">
            nusa<span className="ml-1 text-teal-700">.</span>
            <span className="ml-2 text-[10px] font-semibold tracking-[.17em] text-slate-400">
              CRM
            </span>
          </span>
        </Link>
        <button
          onClick={() => setOpen(false)}
          className="absolute right-2 top-2 p-2 lg:hidden"
          aria-label="Tutup menu"
        >
          <X size={20} />
        </button>
        <p className="eyebrow mb-4 px-3">WORKSPACE</p>
        <nav className="space-y-1.5">
          {navigation.map((item) => {
            const Icon = icons[item.icon];
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={path === item.href ? "page" : undefined}
                className={`sidebar-link ${path === item.href ? "active" : ""}`}
              >
                <Icon size={18} />
                {item.label}
                {item.href === "/integrations" && (
                  <span
                    className="ml-auto size-1.5 rounded-full bg-amber-400"
                    aria-label="Belum terhubung"
                  />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-xl border border-teal-100 bg-[#f4faf7] p-4">
          <FlaskConical size={20} className="mb-3 text-teal-700" />
          <p className="text-xs font-semibold">Ruang demo proyek</p>
          <p className="mt-2 text-[11px] leading-5 text-slate-500">
            Jelajahi tampilan CRM dengan data contoh sementara.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-teal-700">
            TAHAP 01 <ArrowUpRight size={12} />
          </span>
        </div>
        <div className="mt-5 flex items-center gap-3 border-t border-slate-100 px-1 pt-5">
          <span className="grid size-9 place-items-center rounded-full bg-[#efece7] text-xs font-semibold text-stone-600">
            TK
          </span>
          <div>
            <p className="text-xs font-semibold">Tim CRM</p>
            <p className="mt-1 text-[10px] text-slate-400">Proyek akademik</p>
          </div>
          <span className="ml-auto rounded border border-slate-200 px-1.5 py-1 text-[9px] text-slate-500">
            DEMO
          </span>
        </div>
      </aside>
      <div className="lg:pl-60">
        <header className="flex h-20 items-center justify-between gap-4 border-b border-slate-200/70 bg-white px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <button
              aria-label="Buka menu"
              aria-expanded={open}
              aria-controls="main-navigation"
              onClick={() => setOpen(true)}
              className="rounded-lg p-2 lg:hidden"
            >
              <Menu size={20} />
            </button>
            <span className="hidden text-xs text-slate-400 sm:inline">
              Workspace
            </span>
            <ChevronRight
              size={13}
              className="hidden text-slate-300 sm:inline"
            />
            <span className="text-xs font-medium">{title}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-medium text-amber-800">
              <span className="size-1.5 rounded-full bg-amber-500" />
              Data contoh
            </span>
            <span className="hidden border-l border-slate-200 pl-4 text-xs text-slate-400 sm:inline">
              Nusa Telecom
            </span>
          </div>
        </header>
        <main id="main-content" className="mx-auto max-w-[1600px] p-5 sm:p-8">
          {children}
          <footer className="mt-8 flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-5 text-[10px] text-slate-400">
            <span>© 2026 Nusa CRM · Integrasi Aplikasi Korporasi</span>
            <span>Fondasi aplikasi · v0.1.0</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
