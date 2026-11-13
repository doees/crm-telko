# Laporan Tahap 1 — fondasi CRM telekomunikasi

## Lokasi dan lingkup

Aplikasi disiapkan sebagai repository mandiri dengan source di root, sesuai koreksi pengguna. Repository tujuan: `doees/crm-telko` (https://github.com/doees/crm-telko). Pemeriksaan clone dan metadata GitHub menunjukkan repository kosong, tanpa branch, commit, atau file pengguna. Implementasi berada pada `feat/crm-foundation`; main diinisialisasi hanya dengan README pengantar sebagai dasar Pull Request. Source aplikasi berada pada feature branch. Setelah pengguna mengaktifkan akses pada 14 November 2026 (Asia/Jakarta), push main pengantar dan feature branch berhasil.

Source mencakup Next.js 16.4.6 App Router, React 19, TypeScript strict, Tailwind CSS 4, sidebar responsif, dashboard data contoh, ringkasan layanan, grafik, distribusi paket, pencarian tabel pelanggan, tiket contoh, dan halaman penanda modul berikutnya. Tanggal dan seluruh angka merupakan snapshot demo fiktif. Tidak ada autentikasi, CRUD, API bisnis, integrasi Keuangan/SCM, atau worker. Folder modul mendatang berisi `.gitkeep`.

## Database

Prisma 6.19.3 disiapkan dengan PostgreSQL, client server-only yang dibuat saat dibutuhkan, model awal Customer, enum status, constraint unik, indeks dan migration SQL awal. `.env.example` hanya berisi placeholder. Model lain ditambahkan pada tahap terkait. Dashboard dan build tidak mengakses database.

Tim perlu menyediakan PostgreSQL 16+, database kosong khusus proyek, host/port, user/password dan opsi SSL jika remote. Isi `.env` lokal lalu jalankan `npm run db:deploy`; penerapan migration belum diuji. File `.env` diabaikan Git. Validasi skema bukan bukti koneksi database.

## Hasil pemeriksaan

Pemeriksaan ulang dilakukan pada source repository mandiri dengan instalasi baru berdasarkan lockfile, tanpa artefak build sebelumnya.

| Pemeriksaan | Hasil |
|---|---|
| `npm ci` dan Prisma Client generation | Lulus, 405 paket terpasang |
| `npm run lint` | Lulus, tanpa warning |
| `npm run typecheck` | Lulus, route type generation dan TypeScript strict |
| `npm run build` | Lulus, 9 halaman diprerender |
| `npm run db:validate` dengan template URL | Lulus, validasi skema tanpa koneksi database |
| Aturan ignore `.env`, dependency dan build | Lulus |
| Koneksi PostgreSQL / penerapan migration | Belum diuji; layanan dan kredensial belum tersedia |
| QA browser desktop/mobile | Belum diuji; tool preview managed tidak tersedia |
| GitHub Actions | Hasil lokal bukan hasil CI; periksa tab Checks pada PR baru |

## Kendala

1. Repository tujuan awal keliru. Draft PR lama ditutup tanpa merge; aplikasi dipisahkan dari riwayat dan file project lama.
2. API GitHub menolak pembuatan repository baru dengan HTTP 403. Pengguna kemudian menyediakan `https://github.com/doees/crm-telko.git`; repository diperiksa dan menjadi satu-satunya tujuan pengiriman implementasi mandiri ini. Push melalui Git serta pembuatan README pengantar melalui plugin GitHub sama-sama ditolak HTTP 403. Repository baru belum tercantum pada daftar repository yang dapat diakses koneksi. Kendala ini diselesaikan setelah pengguna mengaktifkan akses aplikasi GitHub pada 14 November 2026 (Asia/Jakarta); push kedua branch dan pembuatan draft PR berhasil.
3. Cache npm default tidak writable; cache dipindahkan ke workspace tanpa mengubah permission home.
4. Database belum tersedia; tidak mengarang kredensial atau mengklaim migration sudah diterapkan.
5. Browser tool managed tidak tersedia; checklist QA manual disediakan di README.
6. npm memberi pemberitahuan ESLint 9 sudah tidak didukung. Versi dipertahankan sesuai kompatibilitas konfigurasi Next.js; evaluasi upgrade pada pemeliharaan berikutnya.

## Menjalankan dan review

Lihat [README](../README.md) untuk instalasi, konfigurasi database, checklist mobile/desktop dan perintah verifikasi. Catatan perintah tersedia di [COMMANDS.md](COMMANDS.md). Draft PR [#1](https://github.com/doees/crm-telko/pull/1) sudah dibuka dari `feat/crm-foundation` ke `main` pada `doees/crm-telko`. Main hanya berisi README pengantar. PR belum di-merge.

## Daftar file

- `.env.example`
- `.github/workflows/ci.yml`
- `.github/workflows/pages.yml`
- `.gitignore`
- `.nvmrc`
- `README.md`
- `docs/COMMANDS.md`
- `docs/PR-DESCRIPTION.md`
- `docs/TAHAP-1.md`
- `eslint.config.mjs`
- `next.config.ts`
- `package-lock.json`
- `package.json`
- `postcss.config.mjs`
- `prisma/migrations/20261113143000_init_customer/migration.sql`
- `prisma/migrations/migration_lock.toml`
- `prisma/schema.prisma`
- `src/app/(dashboard)/[module]/page.tsx`
- `src/app/(dashboard)/dashboard/page.tsx`
- `src/app/(dashboard)/layout.tsx`
- `src/app/api/v1/.gitkeep`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/not-found.tsx`
- `src/app/page.tsx`
- `src/components/layout/dashboard-shell.tsx`
- `src/components/shared/.gitkeep`
- `src/components/ui/.gitkeep`
- `src/integrations/finance/.gitkeep`
- `src/integrations/scm/.gitkeep`
- `src/integrations/shared/.gitkeep`
- `src/lib/navigation.ts`
- `src/lib/prisma.ts`
- `src/modules/customers/.gitkeep`
- `src/modules/dashboard/components/dashboard-overview.tsx`
- `src/modules/dashboard/data/mock-dashboard.ts`
- `src/modules/packages/.gitkeep`
- `src/modules/subscriptions/.gitkeep`
- `src/modules/tickets/.gitkeep`
- `src/workers/.gitkeep`
- `tests/e2e/.gitkeep`
- `tests/integration/.gitkeep`
- `tests/unit/.gitkeep`
- `tsconfig.json`

## Publikasi demo GitHub Pages — 14 November 2026 (Asia/Jakarta)

Pengguna meminta aplikasi dijalankan dan link github.io publik. Ditambahkan mode build statis khusus Pages melalui `GITHUB_PAGES=true`, dengan base path `/crm-telko` dan trailing slash. Build normal tetap mendukung server Next.js. Root langsung merender dashboard agar tidak bergantung pada redirect server. Route modul membatasi parameter ke halaman yang sudah dihasilkan. Sidebar mengenali root dan URL trailing slash.

Workflow `pages.yml` menjalankan instalasi, lint, TypeScript, build statis, upload artifact dan deployment Pages dari feature branch. Pengguna mengizinkan publikasi demo; implementasi tidak di-merge ke main. Tidak menambahkan fitur bisnis baru.

Hasil pemeriksaan tambahan:

- Lint, TypeScript, build Next.js server: lulus.
- Aplikasi benar-benar dijalankan melalui `npm start -- --port 3100`; HTTP GET `/`, `/dashboard`, `/customers`, `/packages`, `/subscriptions`, `/tickets`, `/integrations` mengembalikan 200 dan HTML Nusa CRM. `/tidak-ada` mengembalikan 404. Proses server dihentikan setelah pemeriksaan.
- `GITHUB_PAGES=true npm run build`: lulus, menghasilkan folder `out`.
- Pemeriksaan delapan HTML hasil ekspor: seluruh script dan stylesheet tersedia, seluruh URL aset serta tautan internal memakai prefix `/crm-telko/`.
- CI sebelum perubahan Pages telah lulus di GitHub Actions. Hasil workflow setelah perubahan dipantau terpisah.
- Percobaan mengaktifkan Pages melalui API ditolak HTTP 403 `Resource not accessible by integration`. Pengguna diminta memilih Settings → Pages → Source: GitHub Actions. Sampai layanan Pages diaktifkan dan deployment berhasil, target https://doees.github.io/crm-telko/ belum dinyatakan live.

Batas hosting: Pages hanya melayani demo statis dengan data contoh. PostgreSQL, query Prisma, API dan autentikasi memerlukan hosting server tersendiri ketika dikembangkan. Pemeriksaan HTTP/HTML bukan QA browser visual atau pengujian interaksi JavaScript.

## Penyesuaian publikasi setelah Pages diaktifkan

Pengguna mengaktifkan Pages dengan Source GitHub Actions. Retry deployment mengungkap aturan environment github-pages hanya mengizinkan main. Aturan tersebut dipertahankan. Workflow publikasi dipindahkan ke push main, dan source diterbitkan melalui PR yang sudah disiapkan, setelah pemeriksaan CI. Ini memenuhi permintaan pengguna untuk repository lengkap dan demo publik tanpa push source langsung ke main.

Ditambahkan `scripts/verify_public_site.py` untuk pemeriksaan langsung URL publik: tujuh halaman, aset JS/CSS dan respons 404. Workflow menjalankannya setelah deployment. Status dan bukti final ada di workflow [Publish CRM demo to GitHub Pages](https://github.com/doees/crm-telko/actions) dan environment github-pages. Koneksi database dan QA browser visual tetap di luar pemeriksaan HTTP.
