"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  Wifi,
  Layers,
  Headphones,
  PlugZap,
  Menu,
  X,
  ArrowUpRight,
  Search,
  Bell,
  ChevronDown,
  ArrowRight,
  FileBarChart,
  Settings2,
  ChevronRight,
  Radio,
  Globe,
  CheckCheck,
} from "lucide-react";
import { navigation } from "@/lib/navigation";
import { useCrm } from "@/modules/crm/context";
import { roleLabels } from "@/modules/crm/types";
import { Avatar } from "@/components/crm/ui";
const icons = {
  dashboard: LayoutDashboard,
  customers: Users,
  packages: Wifi,
  subscriptions: Layers,
  tickets: Headphones,
  integrations: PlugZap,
  reports: FileBarChart,
  settings: Settings2,
};
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const path = pathname === "/" ? "/dashboard" : pathname.replace(/\/$/, "");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [notices, setNotices] = useState(false);
  const { state, open: openModal } = useCrm();
  const title =
    navigation.find((item) => item.href === path)?.label ?? "Ringkasan";
  const activeTickets = state.tickets.filter((t) =>
    ["OPEN", "IN_PROGRESS"].includes(t.status),
  ).length;
  const results = search.trim()
    ? state.customers
        .filter((c) =>
          `${c.name} ${c.number}`.toLowerCase().includes(search.toLowerCase()),
        )
        .slice(0, 4)
    : [];
  useEffect(() => {
    if (!open) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = oldOverflow; };
  }, [open]);
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Lewati ke konten
      </a>
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="Tutup navigasi"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        id="main-navigation"
        className={`app-sidebar ${open ? "is-open" : ""}`}
        aria-label="Navigasi utama"
      >
        <Link
          href="/dashboard"
          className="brand"
          onClick={() => setOpen(false)}
        >
          <span className="brand-symbol">
            <Radio size={24} />
          </span>
          <span>
            nusa<span className="brand-dot">.</span>
            <small>CONNECTED WORKSPACE</small>
          </span>
        </Link>
        <button
          className="sidebar-close"
          aria-label="Tutup menu"
          onClick={() => setOpen(false)}
        >
          <X size={20} />
        </button>
        <div className="workspace-switch">
          <span className="workspace-icon">
            <Globe size={19} />
          </span>
          <div>
            <strong>Nusa Telecom</strong>
            <small>Customer relationship</small>
          </div>
          <span className="workspace-tag">CRM</span>
        </div>
        <p className="nav-section-label">WORKSPACE</p>
        <nav>
          {navigation.slice(0, 6).map((item) => {
            const Icon = icons[item.icon];
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${path === item.href ? "active" : ""}`}
                aria-current={path === item.href ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                <Icon size={19} />
                <span>{item.label}</span>
                {item.icon === "tickets" && activeTickets > 0 && (
                  <span className="nav-count">{activeTickets}</span>
                )}
                {item.icon === "integrations" && <i className="nav-new-dot" />}
              </Link>
            );
          })}
          <p className="nav-section-label nav-section-second">
            ANALITIK & PREFERENSI
          </p>
          {navigation.slice(6).map((item) => {
            const Icon = icons[item.icon];
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${path === item.href ? "active" : ""}`}
                aria-current={path === item.href ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-promo">
            <span className="promo-icon">
              <Wifi size={20} />
            </span>
            <h3>
              Lebih terhubung.
              <br />
              Lebih bermakna.
            </h3>
            <p>Satu workspace untuk setiap perjalanan pelanggan.</p>
            <Link href="/packages" onClick={() => setOpen(false)}>
              Jelajahi layanan <ArrowUpRight size={14} />
            </Link>
          </div>
          <Link
            href="/settings"
            className="sidebar-profile"
            onClick={() => setOpen(false)}
          >
            <span className="profile-avatar">NT</span>
            <span>
              <strong>Tim Nusa Telecom</strong>
              <small>{roleLabels[state.role]}</small>
            </span>
            <Settings2 size={15} />
          </Link>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-header">
          <div className="header-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Buka menu"
              aria-expanded={open}
              aria-controls="main-navigation"
              onClick={() => setOpen(true)}
            >
              <Menu size={23} />
            </button>
            <span className="header-breadcrumb">
              Workspace <ChevronRight size={13} />
              <strong>{title}</strong>
            </span>
          </div>
          <div className="header-right">
            <div className="global-search">
              <Search size={17} />
              <input
                aria-label="Cari pelanggan global"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari pelanggan…"
                onKeyDown={(e) => {
                  if (e.key === "Escape") setSearch("");
                }}
              />
              <span className="search-shortcut">⌕</span>
              {search && (
                <div className="search-results">
                  <div className="popover-heading">
                    <strong>Hasil pelanggan</strong>
                    <button
                      className="icon-button"
                      aria-label="Tutup pencarian"
                      onClick={() => setSearch("")}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  {results.length ? (
                    results.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          openModal({ kind: "customer-detail", id: c.id });
                          setSearch("");
                        }}
                      >
                        <Avatar name={c.name} />
                        <span>
                          <strong>{c.name}</strong>
                          <small>{c.number}</small>
                        </span>
                        <ArrowUpRight size={14} />
                      </button>
                    ))
                  ) : (
                    <p>Tidak ada pelanggan yang cocok.</p>
                  )}
                </div>
              )}
            </div>
            <span className="header-demo-label">
              <span />
              Demo interaktif
            </span>
            <div className="notification-wrap">
              <button
                className={`icon-button notification-button ${notices ? "is-active" : ""}`}
                aria-label="Lihat notifikasi"
                aria-expanded={notices}
                onClick={() => setNotices(!notices)}
              >
                <Bell size={19} />
                {state.activity.length > 0 && <span />}
              </button>
              {notices && (
                <div className="notifications-popover">
                  <div className="popover-heading">
                    <strong>Aktivitas terbaru</strong>
                    <button
                      className="icon-button"
                      aria-label="Tutup notifikasi"
                      onClick={() => setNotices(false)}
                    >
                      <X size={15} />
                    </button>
                  </div>
                  {state.activity.slice(0, 4).map((a) => (
                    <div className="notification-item" key={a.id}>
                      <span>
                        <CheckCheck size={15} />
                      </span>
                      <p>{a.text}</p>
                    </div>
                  ))}
                  <Link href="/reports" onClick={() => setNotices(false)}>
                    Lihat jejak aktivitas
                    <ArrowRight size={14} />
                  </Link>
                </div>
              )}
            </div>
            <span className="header-divider" />
            <Link href="/settings" className="header-profile">
              <span className="header-avatar">NT</span>
              <span>
                <strong>Tim Nusa</strong>
                <small>{roleLabels[state.role]}</small>
              </span>
              <ChevronDown size={13} />
            </Link>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {children}
          <footer className="app-footer">
            <span>
              © 2026 Nusa Telecom <i />
              Customer relationship management
            </span>
            <span>
              <span className="tiny-dot" />
              Data demo tersimpan di browser ini
              <Link href="/settings">
                Kelola data
                <ArrowUpRight size={11} />
              </Link>
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
