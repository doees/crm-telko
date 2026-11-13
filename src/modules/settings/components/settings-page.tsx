"use client";
import { useState } from "react";
import {
  Download,
  ShieldCheck,
  Settings2,
  Upload,
  RotateCcw,
  Database,
  LockKeyhole,
} from "lucide-react";
import { useCrm } from "@/modules/crm/context";
import { roleLabels, type Role } from "@/modules/crm/types";
import { resetDemo, restoreDemo, downloadFile } from "@/modules/crm/store";
import { PageHeading, Dialog } from "@/components/crm/ui";
export function SettingsPage() {
  const { state, run, toast } = useCrm();
  const [confirm, setConfirm] = useState(false);
  const [backup, setBackup] = useState<string | null>(null);
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="WORKSPACE SETTINGS"
        title="Pengaturan"
        description="Atur pengalaman demonstrasi dan kelola data workspace."
      />
      <div className="settings-grid">
        <section className="panel settings-card">
          <span className="metric-icon red">
            <Settings2 size={23} />
          </span>
          <h2>Simulasi peran pengguna</h2>
          <p>
            Coba pengalaman akses setiap anggota tim. Ini simulasi UI dan aturan
            bisnis lokal, bukan autentikasi atau pembatasan keamanan server.
          </p>
          <label className="form-field">
            <span>Peran aktif</span>
            <select
              value={state.role}
              onChange={(e) =>
                run(
                  { type: "ROLE", role: e.target.value as Role },
                  "Peran simulasi diperbarui.",
                )
              }
            >
              {Object.entries(roleLabels).map(([key, label]) => (
                <option value={key} key={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="role-permissions">
            {[
              [
                "Administrator",
                "Seluruh pengelolaan data dan simulator integrasi.",
              ],
              [
                "Customer service",
                "Pelanggan, langganan, dan penanganan tiket.",
              ],
              [
                "Teknisi · Raka",
                "Status dan catatan pada tiket yang ditugaskan ke Raka.",
              ],
              ["Manajer", "Melihat dashboard, data, dan mengunduh laporan."],
            ].map(([title, text]) => (
              <div key={title}>
                <ShieldCheck size={16} />
                <span>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </span>
              </div>
            ))}
          </div>
        </section>
        <div className="settings-column">
          <section className="panel settings-card">
            <span className="metric-icon blue">
              <Database size={23} />
            </span>
            <h2>Data demonstrasi</h2>
            <p>
              Data tersimpan di browser dan perangkat ini. Tidak disinkronkan ke
              database atau pengguna lain. Ekspor salinan sebelum menghapus data
              browser.
            </p>
            <button
              className="btn btn-secondary"
              onClick={() =>
                downloadFile(
                  "nusa-crm-backup.json",
                  JSON.stringify(state, null, 2),
                )
              }
            >
              <Download size={16} />
              Ekspor backup JSON
            </button>
            <label className="btn btn-secondary import-backup">
              <Upload size={16} />
              Impor backup JSON
              <input
                aria-label="Pilih file backup JSON"
                className="sr-only"
                type="file"
                accept="application/json,.json"
                disabled={state.role !== "ADMIN"}
                onChange={async (e) => {
                  const input = e.currentTarget;
                  const file = input.files?.[0];
                  if (file) {
                    if (file.size > 2000000)
                      toast("Ukuran backup maksimal 2 MB.", true);
                    else setBackup(await file.text());
                  }
                  input.value = "";
                }}
              />
            </label>
            <div className="settings-divider" />
            <h3>Mulai ulang workspace</h3>
            <p>
              Mengganti seluruh perubahan lokal dengan data contoh awal.
              Tindakan ini tidak dapat dibatalkan tanpa backup.
            </p>
            <button
              className="btn btn-danger-soft"
              disabled={state.role !== "ADMIN"}
              onClick={() => setConfirm(true)}
            >
              <RotateCcw size={15} />
              Reset data demo
            </button>
          </section>
          <section className="security-note">
            <LockKeyhole size={23} />
            <div>
              <h3>Dirancang untuk demonstrasi</h3>
              <p>
                Jangan masukkan data pelanggan nyata. Database PostgreSQL, login
                yang aman, serta API Keuangan/SCM nyata memerlukan deployment
                backend dan kredensial tersendiri.
              </p>
            </div>
          </section>
        </div>
      </div>
      {confirm && (
        <Dialog
          title="Reset seluruh data demo?"
          onClose={() => setConfirm(false)}
        >
          <div className="form-body">
            <p className="muted">
              Seluruh pelanggan, langganan, tiket, dan perubahan lokal akan
              diganti dengan data awal. Unduh backup terlebih dahulu jika
              diperlukan.
            </p>
          </div>
          <div className="dialog-footer">
            <button
              className="btn btn-secondary"
              onClick={() => setConfirm(false)}
            >
              Batal
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                try {
                  resetDemo();
                  toast("Workspace dikembalikan ke data awal.");
                  setConfirm(false);
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Reset gagal.", true);
                }
              }}
            >
              Ya, reset data
            </button>
          </div>
        </Dialog>
      )}
      {backup !== null && (
        <Dialog
          title="Pulihkan backup workspace?"
          onClose={() => setBackup(null)}
        >
          <div className="form-body">
            <p className="muted">
              Data lokal saat ini akan diganti dengan isi backup. File diperiksa
              sebelum perubahan diterapkan.
            </p>
          </div>
          <div className="dialog-footer">
            <button
              className="btn btn-secondary"
              onClick={() => setBackup(null)}
            >
              Batal
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                try {
                  restoreDemo(backup);
                  toast("Backup berhasil dipulihkan.");
                  setBackup(null);
                } catch (e) {
                  toast(
                    e instanceof Error
                      ? e.message
                      : "Backup tidak dapat dibaca.",
                    true,
                  );
                  setBackup(null);
                }
              }}
            >
              Pulihkan data
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
