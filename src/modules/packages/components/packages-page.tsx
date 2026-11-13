"use client";
import { useState } from "react";
import {
  Plus,
  ArrowRight,
  Wifi,
  Pencil,
  ShieldCheck,
  Globe,
  Zap,
  Check,
} from "lucide-react";
import { useCrm } from "@/modules/crm/context";
import { canWrite, money } from "@/modules/crm/domain";
import { Badge, PageHeading, Empty } from "@/components/crm/ui";
export function PackagesPage() {
  const { state, open } = useCrm();
  const [segment, setSegment] = useState("ALL");
  const [showInactive, setShowInactive] = useState(false);
  const items = state.packages.filter(
    (p) =>
      (segment === "ALL" || p.category === segment) &&
      (showInactive || p.status === "ACTIVE"),
  );
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="PRODUCT & SERVICES"
        title="Paket layanan"
        description="Koneksi andal untuk rumah, bisnis, dan setiap kemungkinan."
      >
        {state.role === "ADMIN" && (
          <button
            className="btn btn-primary"
            onClick={() => open({ kind: "package" })}
          >
            <Plus size={17} />
            Paket baru
          </button>
        )}
      </PageHeading>
      <div className="catalog-banner">
        <div>
          <span className="eyebrow">NUSA FIBER NETWORK</span>
          <h2>
            Internet cepat.
            <br />
            Pengalaman tanpa batas.
          </h2>
          <p>Pilihan layanan untuk setiap kebutuhan pelanggan Anda.</p>
        </div>
        <div className="catalog-illustration" aria-hidden="true">
          <Globe size={106} strokeWidth={0.7} />
          <span className="catalog-5g">
            FIBER<span>CONNECTED TO MORE</span>
          </span>
        </div>
      </div>
      <div className="catalog-toolbar">
        <div className="tabs">
          {[
            ["ALL", "Semua paket"],
            ["HOME", "Internet rumah"],
            ["BUSINESS", "Internet bisnis"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={segment === value ? "active" : ""}
              onClick={() => setSegment(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Tampilkan nonaktif
        </label>
      </div>
      <div className="package-grid">
        {items.map((p, i) => (
          <article
            className={`package-card ${i === 1 ? "featured" : ""}`}
            key={p.id}
          >
            {i === 1 && (
              <span className="popular-ribbon">
                <Zap size={12} />
                PILIHAN POPULER
              </span>
            )}
            <div className="package-top">
              <span className="package-symbol">
                {p.category === "HOME" ? (
                  <Wifi size={24} />
                ) : (
                  <Globe size={24} />
                )}
              </span>
              <Badge status={p.status} />
            </div>
            <p className="eyebrow">
              {p.category === "HOME" ? "INTERNET RUMAH" : "INTERNET BISNIS"}
            </p>
            <h2>{p.name}</h2>
            <div className="package-speed">
              <strong>{p.speed}</strong>
              <span>Mbps</span>
            </div>
            <p className="package-speed-note">Kecepatan hingga</p>
            <div className="package-price">
              {money(p.price)}
              <span>/bulan</span>
            </div>
            <div className="package-benefits">
              <span>
                <Check size={15} />
                Internet fiber tanpa batas kuota
              </span>
              <span>
                <Check size={15} />
                {p.device
                  ? "Perangkat router / ONT"
                  : "Tanpa perangkat tambahan"}
              </span>
              <span>
                <Check size={15} />
                Dukungan layanan pelanggan
              </span>
              <span>
                <Check size={15} />
                Alur aktivasi terintegrasi
              </span>
            </div>
            <div className="package-subscriber">
              {
                state.subscriptions.filter(
                  (s) => s.packageId === p.id && s.status === "ACTIVE",
                ).length
              }{" "}
              pelanggan aktif menggunakan paket ini
            </div>
            {p.status === "ACTIVE" && (
              <button
                className={`btn ${i === 1 ? "btn-primary" : "btn-secondary"} full-width`}
                disabled={!canWrite(state.role, "operations")}
                onClick={() => open({ kind: "subscription", packageId: p.id })}
              >
                Buat langganan <ArrowRight size={16} />
              </button>
            )}
            {state.role === "ADMIN" && (
              <div className="package-admin">
                <button onClick={() => open({ kind: "package", id: p.id })}>
                  <Pencil size={13} />
                  Edit paket
                </button>
                <button
                  onClick={() =>
                    open({
                      kind: "confirm",
                      title:
                        p.status === "ACTIVE"
                          ? "Nonaktifkan paket?"
                          : "Aktifkan paket?",
                      description:
                        "Langganan yang sudah ada tetap menggunakan kontrak semula. Perubahan ini hanya memengaruhi pilihan paket untuk langganan baru.",
                      action: { type: "TOGGLE_PACKAGE", id: p.id },
                    })
                  }
                >
                  {p.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      {!items.length && <Empty title="Paket belum tersedia" />}
      <div className="info-note">
        <ShieldCheck size={18} />
        <span>
          Harga adalah nilai kontrak contoh per bulan. Perubahan katalog tidak
          mengubah harga langganan yang sudah berjalan.
        </span>
      </div>
    </div>
  );
}
