"use client";
import { useState, useEffect } from "react";
import {
  Plus,
  LockKeyhole,
  ShieldCheck,
  Download,
  LogOut,
  Users,
} from "lucide-react";
import { useCrm } from "@/modules/crm/context";
import { operation, request, signOut } from "@/modules/crm/client";
import { PageHeading, Dialog } from "@/components/crm/ui";
import { roleLabels, type Role } from "@/modules/crm/types";
import { downloadFile } from "@/modules/crm/store";
type Account = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
};
export function SettingsPage() {
  const { state, user, toast, busy } = useCrm();
  const [accounts, setAccounts] = useState<Account[]>([]),
    [creating, setCreating] = useState(false),
    [reset, setReset] = useState<Account | null>(null),
    [version, setVersion] = useState(0);
  useEffect(() => {
    if (user?.role === "ADMIN")
      void request("users")
        .then(setAccounts)
        .catch((e) => toast(e.message, true));
  }, [user?.role, version, toast]); // Server remains the source of permissions.
  const update = async (id: string, input: unknown) => {
    try {
      await request("users/" + id, "PATCH", input);
      setVersion((v) => v + 1);
      toast("Akun staf diperbarui.");
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Perubahan gagal.", true);
      return false;
    }
  };
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="ACCOUNT & WORKSPACE"
        title="Akun & pengaturan"
        description="Kelola akses tim dan keamanan akun perusahaan."
      />
      <div className="account-grid">
        <section className="panel settings-card">
          <span className="metric-icon red">
            <ShieldCheck size={23} />
          </span>
          <h2>{user?.name}</h2>
          <p>
            {user?.email}
            <br />
            {user ? roleLabels[user.role] : ""}
          </p>
          <div className="real-notice">
            Hak akses ditetapkan oleh administrator dan diperiksa di server pada
            setiap permintaan. Perubahan tidak disimpan di browser.
          </div>
          <h3 style={{ marginTop: 24 }}>Ubah password</h3>
          <form
            className="page-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget,
                data = new FormData(form);
              if (data.get("newPassword") !== data.get("confirmation")) {
                toast("Konfirmasi password tidak sama.", true);
                return;
              }
              try {
                await operation("auth/password", {
                  currentPassword: String(data.get("currentPassword")),
                  newPassword: String(data.get("newPassword")),
                });
                form.reset();
                toast("Password diganti. Sesi perangkat lain telah dicabut.");
              } catch (e) {
                toast(
                  e instanceof Error ? e.message : "Gagal mengganti password.",
                  true,
                );
              }
            }}
          >
            <label className="form-field">
              <span>Password saat ini</span>
              <input
                name="currentPassword"
                type="password"
                required
                maxLength={128}
                autoComplete="current-password"
              />
            </label>
            <label className="form-field">
              <span>Password baru</span>
              <input
                name="newPassword"
                type="password"
                minLength={12}
                maxLength={128}
                required
                autoComplete="new-password"
              />
            </label>
            <label className="form-field">
              <span>Ulangi password baru</span>
              <input
                name="confirmation"
                type="password"
                minLength={12}
                maxLength={128}
                required
                autoComplete="new-password"
              />
            </label>
            <button disabled={busy} className="btn btn-primary" type="submit">
              <LockKeyhole size={16} />
              Ganti password
            </button>
          </form>
          <div className="settings-divider" />
          <button
            className="btn btn-secondary"
            onClick={() => void signOut().catch((e) => toast(e.message, true))}
          >
            <LogOut size={16} />
            Keluar dari akun
          </button>
        </section>
        <div className="settings-column">
          <section className="panel settings-card">
            <span className="metric-icon blue">
              <Download size={23} />
            </span>
            <h2>Ekspor data operasional</h2>
            <p>
              Unduh salinan data yang dapat diakses akun Anda. Pencadangan
              database lengkap dijalankan oleh pengelola server; aplikasi tidak
              menyediakan tombol penghapusan seluruh database.
            </p>
            <button
              className="btn btn-secondary"
              onClick={() =>
                downloadFile(
                  "nusa-data-operasional.json",
                  JSON.stringify(state, null, 2),
                )
              }
            >
              Unduh data JSON
            </button>
          </section>
          {user?.role === "ADMIN" && (
            <section className="panel settings-card">
              <div className="card-heading" style={{ padding: 0 }}>
                <h2>
                  <Users size={19} /> Akun staf
                </h2>
                <button
                  className="btn btn-primary"
                  onClick={() => setCreating(true)}
                >
                  <Plus size={15} />
                  Tambah akun
                </button>
              </div>
              <div className="account-list">
                {accounts.map((a) => (
                  <article key={a.id} className="account-row">
                    <div>
                      <strong>{a.name}</strong>
                      <small>{a.isActive ? "Aktif" : "Nonaktif"}</small>
                    </div>
                    <small>{a.email}</small>
                    <div>
                      <select
                        aria-label={`Peran ${a.name}`}
                        value={a.role}
                        onChange={(e) =>
                          void update(a.id, { role: e.target.value })
                        }
                      >
                        {Object.entries(roleLabels).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <button
                        className="text-button"
                        onClick={() =>
                          void update(a.id, { isActive: !a.isActive })
                        }
                      >
                        {a.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                    </div>
                    <button className="text-link" onClick={() => setReset(a)}>
                      Atur ulang password
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
      {creating && (
        <Dialog
          title="Buat akun staf"
          subtitle="Password minimal 12 karakter, mengandung huruf dan angka."
          onClose={() => setCreating(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const data = Object.fromEntries(new FormData(e.currentTarget));
              try {
                await request("users", "POST", data);
                setCreating(false);
                setVersion((v) => v + 1);
                toast("Akun staf dibuat.");
              } catch (e) {
                toast(
                  e instanceof Error ? e.message : "Akun gagal dibuat.",
                  true,
                );
              }
            }}
          >
            <div className="form-body">
              <label className="form-field">
                <span>Nama staf</span>
                <input name="name" minLength={3} maxLength={80} required />
              </label>
              <label className="form-field">
                <span>Email staf</span>
                <input name="email" type="email" required maxLength={254} />
              </label>
              <label className="form-field">
                <span>Peran staf</span>
                <select name="role" defaultValue="CS">
                  {Object.entries(roleLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Password awal</span>
                <input
                  name="password"
                  type="password"
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  required
                />
              </label>
            </div>
            <div className="dialog-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCreating(false)}
              >
                Batal
              </button>
              <button className="btn btn-primary" type="submit">
                Simpan akun
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {reset && (
        <Dialog
          title={`Password baru: ${reset.name}`}
          subtitle="Seluruh sesi akun ini akan dicabut setelah perubahan."
          onClose={() => setReset(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              if (
                await update(reset.id, {
                  newPassword: String(data.get("password")),
                })
              )
                setReset(null);
            }}
          >
            <div className="form-body">
              <label className="form-field">
                <span>Password baru staf</span>
                <input
                  name="password"
                  type="password"
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  required
                />
              </label>
            </div>
            <div className="dialog-footer">
              <button className="btn btn-primary" type="submit">
                Ganti password staf
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
