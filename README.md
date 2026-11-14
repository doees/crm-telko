# Nusa CRM · Telecom Workspace

CRM telekomunikasi untuk final project Integrasi Aplikasi Korporasi. Next.js App Router, TypeScript, Tailwind CSS, Prisma dan PostgreSQL. Antarmuka navy/merah mencakup dashboard, pelanggan, paket, langganan, tiket, laporan, integrasi, dan pengaturan staf.

**Versi 1.0 menggunakan server dan database persisten.** Data dibagikan antarperangkat, login memakai sesi server, dan integrasi memanggil dua layanan REST terpisah: Keuangan dan SCM, masing-masing dengan database sendiri. Instalasi baru berisi satu administrator; pelanggan, paket dan stok diisi operator. Tidak ada seed demo pada runtime.

**Repository:** https://github.com/doees/crm-telko

**Status publik:** https://doees.github.io/crm-telko/ — halaman status deployment, bukan aplikasi backend. VPS dan domain belum disediakan. GitHub Pages tidak dapat menjalankan Next.js server atau PostgreSQL. Ikuti [deployment VPS](docs/DEPLOYMENT.md) untuk mengaktifkan aplikasi di domain sendiri.

## Menjalankan lokal dengan Docker

Prasyarat: Git, Docker Engine/Desktop dan Compose v2; Node.js 22.9+ atau 24 untuk generator konfigurasi. Sediakan sekitar 5 GB ruang kosong untuk build image.

```bash
git clone https://github.com/doees/crm-telko.git
cd crm-telko
node scripts/setup-env.mjs
# Membuat .env privat baru, tidak menimpa file yang ada.
docker compose -f compose.yml -f ops/compose.local.yml up -d --build crm worker finance scm
```

Buka **http://localhost:3100**. Migrations tiga database dan pembuatan admin pertama berjalan otomatis. Ambil `BOOTSTRAP_ADMIN_EMAIL` dan `BOOTSTRAP_ADMIN_PASSWORD` dari `.env` hanya di komputer Anda. Setelah masuk, ganti password di Pengaturan. Jangan memasukkan `.env`, password atau token ke GitHub/chat. `.env.example` hanya menjelaskan nama variabel, bukan konfigurasi siap pakai.

```bash
docker compose ps
docker compose logs --tail=100 migrate crm worker finance scm
curl --fail http://localhost:3100/api/v1/health
# Menghentikan stack, mempertahankan volume database:
docker compose -f compose.yml -f ops/compose.local.yml down
```

Jangan jalankan `down -v` pada database yang ingin dipertahankan. Jika port 3100/55432 sudah dipakai, hentikan proses lokal yang bersangkutan atau sesuaikan override, URL database dan APP_ORIGIN secara konsisten.

## Pengembangan dengan live reload

Gunakan database lokal dari Compose; jalankan proses aplikasi di host. Hentikan container aplikasi sebelum menjalankan proses pada port yang sama.

```bash
npm ci
node scripts/setup-env.mjs # hanya jika .env belum dibuat
docker compose -f compose.yml -f ops/compose.local.yml up -d db
npm run db:deploy
npm run db:services
npm run admin:create
npm run dev
```

Di tiga terminal tambahan: `npm run worker`, `npm run finance`, `npm run scm`. `.env` hasil generator memakai CRM 3100, Keuangan 4101, SCM 4102 dan PostgreSQL 55432. Untuk memulai mode production pada host: `npm run build` lalu `npm start`, dengan tiga proses layanan tetap berjalan. `admin:create` menolak membuat ulang akun yang sudah ada. Perubahan schema baru dibuat melalui `npm run db:migrate`; produksi menggunakan migrasi yang sudah ditinjau, bukan `db push`.

## Alur operasional

1. Administrator membuat paket layanan serta akun CS, teknisi dan manajer di Pengaturan.
2. CS menambah pelanggan dan langganan. Invoice dan permintaan perangkat masuk antrean dalam transaksi yang sama.
3. Worker mengirim invoice ke Keuangan dan permintaan ke SCM. SCM menunggu stok bila belum tersedia.
4. Administrator mencatat penerimaan stok berdasarkan dokumen barang; SCM mereservasi stok.
5. Setelah memeriksa bukti dana diterima, administrator mencatat pembayaran penuh dengan nomor referensi dan waktu. Ledger Keuangan menyimpan transaksi tersebut.
6. Catat serah-terima perangkat dengan dokumen dan nama penerima. SCM mengurangi stok dan mengirim callback. Langganan aktif setelah invoice lunas dan perangkat terpenuhi.
7. CS membuat tiket, menugaskan akun teknisi aktif, teknisi mengisi catatan/penyelesaian, CS/admin menutup tiket. Laporan dan CSV memakai data database.

Pembayaran adalah **pencatatan manual berdasarkan bukti**, belum terhubung bank/payment gateway. SCM mencatat inventori dan serah-terima, belum mengonfigurasi OLT/ONT atau menyalakan jaringan fisik. Pembatalan membatalkan invoice belum lunas dan reservasi yang belum diserahkan; refund dana/retur barang memerlukan rekonsiliasi terpisah. Billing berulang, perpajakan, portal pelanggan publik dan reset password melalui email belum termasuk versi ini. Ini sistem operasional proyek; bukan klaim telah menjadi operator telekomunikasi berizin atau telah diaudit untuk skala perusahaan nasional.

## Verifikasi

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:server
```

`test:server` membuat PostgreSQL Docker **sementara dan terisolasi** dengan tiga database `*_test`, menjalankan backend production, worker, Keuangan, SCM, pengujian API, restart server dan Playwright. Port 3200/4201/4202/55433 harus bebas. Data operasional dan volume lokal tidak dipakai/dihapus. `.env.test` dibuat otomatis dan diabaikan Git. Docker harus aktif; Linux CI memasang browser melalui `npx playwright install --with-deps chromium`. `/usr/bin/chromium` digunakan bila tersedia. Artefak kegagalan ada di `test-results/` dan log privat `.qa/`.

## Dokumentasi dan kerja kelompok

- [Arsitektur, ERD, pembagian 5 anggota](docs/ARCHITECTURE.md)
- [Deployment VPS, backup dan pemulihan](docs/DEPLOYMENT.md)
- [Kontrak REST dan keamanan integrasi](docs/API.md), [OpenAPI CRM](public/openapi.json), [OpenAPI Keuangan/SCM](services/openapi.json)
- [Laporan implementasi dan pengujian aktual](docs/SERVER-IMPLEMENTATION.md)
- [Dokumentasi tahap 1 historis](docs/TAHAP-1.md), [demo v0.2 historis](docs/DEMO-LENGKAP.md)

Gunakan feature branch → Pull Request → CI → review anggota lain → merge. Jangan push langsung ke main. CI memeriksa lint, TypeScript, unit, build dan pengujian tiga layanan nyata. Workflow Pages hanya menerbitkan halaman status statis; deployment backend dilakukan di VPS dengan Docker Compose.
