# Laporan implementasi server v1.0 — 14 November 2026

## Tujuan dan kondisi awal

Repository yang diperiksa: https://github.com/doees/crm-telko, base main `b4071cb3c8c08cdaa67bab0094e25449da93d701`, feature branch `feat/server-crm`. Versi sebelumnya merupakan demo Pages dengan localStorage, simulator peran dan integrasi simulasi. Pemilik meminta backend nyata; memilih paket deployment VPS karena belum mempunyai hosting/domain, serta meminta layanan Keuangan dan SCM dibuat karena modul kelompok lain belum tersedia. Repository lain tidak digunakan.

## Hasil implementasi

- Login server, hash password scrypt, sesi persisten, CSRF/Origin, batas login, RBAC dan manajemen staf nyata.
- PostgreSQL CRM dengan relasi customer/package/subscription/ticket/comments, invoice/fulfillment, audit, inbox/outbox dan idempotency receipt; migrasi versioned, harga kontrak snapshot dan nomor unik.
- REST API v1, input tervalidasi dan penolakan mutasi berdasarkan peran/relasi/transisi. Teknisi dibatasi pada penugasannya.
- Finance REST terpisah dengan database sendiri, invoice, pelunasan manual yang diverifikasi operator, reference unik dan ledger.
- SCM REST terpisah dengan database sendiri, penerimaan stok, reservasi dengan lock transaksi, antrean menunggu stok, penyerahan dan pembatalan reservasi.
- Worker durable, retry eksponensial, lease/takeover terbatas, idempotensi, callback bertanda tangan HMAC, duplicate guard dan version ordering. Aktivasi langganan mengikuti status kedua layanan.
- UI semua menu memakai server, formulir menunggu acknowledgment; tidak ada localStorage database, role switch bebas, tombol lunas/pemenuhan simulasi, atau restore/reset yang menimpa data.
- Docker Compose VPS, Caddy HTTPS, healthcheck, migrasi/bootstrap, generator konfigurasi privat, contoh env kosong, backup tiga database dan prosedur restore.
- CI untuk lint/TypeScript/unit/build, tiga layanan dan browser; job terpisah memeriksa image Docker dan Compose. Pages diubah menjadi status deployment jujur.

## Kelompok berkas yang dibuat/diubah

| Area | Berkas utama |
|---|---|
| Database CRM | prisma/schema.prisma; migrations operational_crm dan command_receipts |
| Backend CRM | src/server/{db,http,auth,state,integration,worker}.ts; src/app/api/v1/[...path]/route.ts |
| Layanan terpisah | services/{server,protocol,start-finance,start-scm}.ts; services/prisma/schema.prisma; migration service_ledgers |
| Frontend | src/app/(auth)/login; modules/crm client/provider/context/store/domain/types/empty; shell/dialog; dashboard, integrasi, tiket, laporan, pengaturan |
| Konfigurasi | next.config.ts, package.json/lock, tsconfig, eslint, Playwright, .env.example, .gitignore |
| Deployment | Dockerfile, .dockerignore, compose.yml, ops/Caddyfile, ops/init-databases.sh, ops/compose.local.yml, ops/compose.qa.yml, ops/backup.sh |
| Tooling | scripts/setup-env.mjs, init-stack.ts, bootstrap-admin.ts, migrate-services.mjs, test-server.mjs, assert-persistence.mjs, smoke-compose.mjs |
| Pengujian | tests/unit/crm-domain.test.ts; tests/integration/server.test.ts; tests/e2e/crm.spec.ts |
| Dokumentasi/CI | README; docs/{ARCHITECTURE,API,DEPLOYMENT,SERVER-IMPLEMENTATION}.md; public/openapi.json; services/openapi.json; .github/workflows; ops/pages/index.html |

Daftar lengkap berkas aktual dapat diperoleh melalui `git diff --name-status main...feat/server-crm` pada Pull Request. `.env`, `.env.test`, generated clients, node_modules, cache, log privat, trace browser dan backup tidak dilacak Git.

## Perintah yang dijalankan

Pemeriksaan repository dilakukan sebelum perubahan dengan git status/branch/remote/log dan pembacaan berkas proyek. Perintah utama selama implementasi:

```text
npm install --package-lock-only --ignore-scripts
npm run db:generate
npx prisma generate --schema services/prisma/schema.prisma
node scripts/setup-env.mjs
npm run db:deploy
npm run db:services
npm run admin:create
npm run lint
npm run typecheck
npm test
npm run build
npm run test:server
docker compose --env-file .env config --quiet
docker build --secret id=proxy_ca,src=/etc/ssl/certs/ca-certificates.crt -t nusa-crm:server .
```

Docker pada lingkungan eksekusi menggunakan socket eksplisit `unix:///var/run/docker.sock`. `proxy_ca` adalah CA tepercaya lingkungan ini yang dipasok sebagai BuildKit secret; TLS tetap diverifikasi dan CA tidak disalin menjadi credential image. VPS biasa tidak memerlukan flag secret tersebut.

## Pengujian aktual

Lint, TypeScript, production build dan 5 unit test lulus lokal. Satu pengujian integrasi panjang menguji PostgreSQL dan dua proses REST nyata: cookie HttpOnly, anonim 401, CSRF 403, spoof peran ditolak, manager read-only, staf/teknisi nyata, idempotensi, data dua sesi, Finance dihentikan sementara melalui signal OS (bukan switch simulasi), retry, invoice, bukti pembayaran, stok, serah-terima, aktivasi, ledger langsung, duplicate/tampered callback dan logout.

Restart proses CRM mempertahankan data dan autentikasi melalui PostgreSQL. Empat tes browser production lulus: login dan data lintas browser, alur pembayaran/stok/perangkat melalui UI, administrasi staf dan penolakan manager di server, penanganan tiket/CSV serta 8 menu pada viewport mobile 390px tanpa overflow halaman. Seluruhnya memakai data pengujian pada container PostgreSQL terisolasi; volume operasional tidak dihapus.

Image Docker berhasil dibangun lokal dengan Node 22 Debian slim. Pemeriksaan stack Compose lengkap dijalankan oleh job `docker-stack` di GitHub Actions; hasil terakhir ditautkan pada PR. Lingkungan lokal menggunakan disk 8 GB dan driver VFS yang menyalin layer/rootfs sehingga tidak cukup untuk beberapa container image besar bersamaan. Build image diselesaikan dengan cache npm tmpfs dan satu layer install/build, tanpa menghapus volume database.

## Kendala yang ditemukan dan perbaikan

1. SQL advisory lock mengembalikan PostgreSQL void yang tidak dapat dipetakan `$queryRaw` Prisma. Diganti `$executeRaw`; transaksi service dan alur penuh kemudian lulus.
2. Error async auth awalnya dapat melewati catch route. Endpoint auth sekarang menunggu promise sebelum memetakan status error.
3. Konfigurasi port/base URL host dan jaringan Docker berbeda. Compose meng-override URL internal; CLI lokal memakai loopback dan env privat.
4. Kapasitas disk Docker habis pada image penuh dan layer dependensi terduplikasi. Image slim, cache tmpfs dan layer gabungan berhasil dibangun. Yang dibersihkan hanya cache/artifact hasil kerja; data PostgreSQL tetap disimpan.
5. Hosting Pages bersifat statis. Workflow server tidak lagi mengekspor dashboard ke Pages; halaman Pages menunjukkan status menunggu VPS/domain secara eksplisit.

## Yang belum diprovisikan atau dihubungkan

VPS/domain/sertifikat publik belum diprovisikan karena pemilik belum memilikinya. Layanan dapat dijalankan lokal dan paket siap dipasang mengikuti DEPLOYMENT.md. Tidak ada link backend produksi yang diklaim aktif. Backup script dan restore runbook tersedia; cron, offsite storage dan latihan pemulihan pada VPS nyata belum dijalankan.

Keuangan/SCM adalah layanan proyek yang benar-benar dijalankan, bukan API operator/kelompok lain yang diasumsikan sudah tersedia. Pembayaran manual tidak memindahkan uang; belum ada kontrak payment gateway/bank. SCM tidak mengaktifkan jaringan operator secara fisik. Refund/retur, billing berulang, faktur pajak, email recovery dan portal pelanggan publik di luar fitur versi ini. Penilaian skala, penetration test independen dan audit operasional perusahaan belum dilakukan. Uji dengan data kelompok sebelum penggunaan pelanggan sebenarnya.
