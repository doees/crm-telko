"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Radio, ArrowRight, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { signIn } from "@/modules/crm/client";
export default function Login() {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [show, setShow] = useState(false);
  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand">
          <Radio size={29} />
          <strong>nusa.</strong>
        </div>
        <span className="hero-kicker">CONNECTED WORKSPACE</span>
        <h1>
          Koneksi yang lebih baik.
          <br />
          Layanan yang lebih dekat.
        </h1>
        <p>
          Satu ekosistem untuk mengelola pelanggan, penagihan, dan pemenuhan
          layanan telekomunikasi.
        </p>
        <div className="login-trust">
          <ShieldCheck size={20} />
          <span>Akses khusus tim operasional</span>
        </div>
      </section>
      <section className="login-form-panel">
        <div className="login-form-card">
          <div className="eyebrow">NUSA TELECOM</div>
          <h2>Selamat datang kembali</h2>
          <p>Masuk dengan akun perusahaan Anda untuk melanjutkan.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              setBusy(true);
              setError("");
              try {
                await signIn(
                  String(form.get("email")),
                  String(form.get("password")),
                );
                router.replace("/dashboard");
              } catch (error) {
                setError(
                  error instanceof Error ? error.message : "Tidak dapat masuk.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="form-field">
              <span>Email perusahaan</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="username"
                placeholder="nama@perusahaan.com"
                maxLength={254}
              />
            </label>
            <label className="form-field">
              <span>Password</span>
              <div className="password-input">
                <input
                  name="password"
                  type={show ? "text" : "password"}
                  required
                  maxLength={128}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  aria-label={
                    show ? "Sembunyikan password" : "Tampilkan password"
                  }
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="btn btn-primary full-width"
              disabled={busy}
              type="submit"
            >
              {busy ? "Memeriksa akun…" : "Masuk ke workspace"}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className="login-help">
            Belum memiliki akun atau lupa password? Hubungi administrator
            perusahaan. Tidak ada pendaftaran akun publik.
          </p>
        </div>
        <footer>© 2026 Nusa Telecom · Customer relationship management</footer>
      </section>
    </main>
  );
}
