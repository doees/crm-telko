# Deployment server Nusa CRM

Status 14 November 2026: paket VPS disediakan atas pilihan pemilik repository; VPS, domain dan akun hosting belum tersedia. Belum ada URL backend permanen. GitHub Pages hanya halaman status. Jangan mengarahkan pelanggan ke Pages sebagai aplikasi operasional.

## VPS dan domain

Sediakan VPS Linux dengan Docker Engine dan Docker Compose v2, dianjurkan 2 vCPU, RAM 4 GB atau lebih dan SSD 20 GB atau lebih. Sediakan domain/subdomain yang dimiliki sendiri dan arahkan DNS A (serta AAAA hanya bila IPv6 berfungsi) ke IP VPS. Izinkan inbound TCP 80/443; pertahankan akses SSH admin. PostgreSQL, Keuangan dan SCM tidak dipublikasikan ke internet.

Di VPS, clone versi main yang sudah lulus CI. Generator hanya membutuhkan Node.js; bila Node tidak tersedia di host, gunakan image Node melalui Docker:

```bash
git clone https://github.com/doees/crm-telko.git
cd crm-telko
# Ganti crm.domain-anda.id dengan hostname yang Anda miliki.
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/work" -w /work node:22-bookworm-slim node scripts/setup-env.mjs crm.domain-anda.id
docker compose config --quiet
docker compose up -d --build
```

Generator membuat kredensial baru untuk database/service lokal yang benar-benar diprovisikan Compose, bukan mengarang kredensial pihak ketiga. `.env` berizin 0600 dan tidak ditimpa bila sudah ada. Simpan di password manager/inventori rahasia tim. Jangan commit atau mengunggah isinya sebagai artifact. Untuk domain, APP_ORIGIN harus persis `https://hostname` tanpa path. Caddy memperoleh sertifikat TLS setelah DNS dan port dapat dijangkau.

`migrate` menunggu database sehat, menerapkan migrasi tiga database dan membuat administrator hanya bila belum ada admin. Periksa hasil:

```bash
docker compose ps -a
docker compose logs --tail=100 migrate crm worker finance scm web
# Ganti hostname sesuai konfigurasi Anda:
curl --fail https://crm.domain-anda.id/api/v1/health
```

Buka https://crm.domain-anda.id/login, gunakan email/password bootstrap dari `.env` secara privat, lalu ganti password di Pengaturan. Akun operasional dibuat administrator. Tidak ada password default publik atau signup anonim. Jangan menghapus volume untuk memperbaiki masalah login. Password bootstrap tidak mengubah ulang akun yang sudah ada; simpan akses administrator kedua sesuai kebutuhan tim.

## Komponen dan port

| Komponen | Proses | Port jaringan Docker |
|---|---|---|
| web | Caddy TLS/reverse proxy | 80/443 publik |
| crm | Next.js UI + REST | 3000 privat |
| worker | Durable CRM outbox + probe health | tanpa port |
| finance | REST invoice/payment + callback worker | 4101 privat |
| scm | REST inventori/fulfillment + callback worker | 4102 privat |
| db | PostgreSQL 16, 3 database + 3 app roles | 5432 privat |
| migrate | Migrasi + bootstrap satu kali | tanpa port |

Volume `postgres-data` menyimpan data; `caddy-data` menyimpan sertifikat. Ketiga aplikasi memiliki database dan role berbeda dalam satu instance PostgreSQL. Jangan memakai user superuser postgres sebagai DATABASE_URL aplikasi. Credentials database awal diterapkan init script hanya pada volume kosong; mengganti `.env` saja tidak mengganti password role yang sudah dibuat.

Untuk lokal gunakan `ops/compose.local.yml` dan mulai eksplisit `crm worker finance scm`, agar Caddy tidak meminta sertifikat domain. Untuk pengujian image gunakan konfigurasi QA terisolasi yang didokumentasikan pada laporan pengujian.

## Pembaruan

Selesaikan perubahan di feature branch dan Pull Request. Sesudah CI/review/merge, buat backup sebelum menerapkan migrasi baru:

```bash
./ops/backup.sh
git pull --ff-only
docker compose build
docker compose up -d
docker compose ps -a
```

Periksa migrasi lebih dahulu. `migrate deploy` tidak otomatis dapat dibatalkan dengan rollback image. Pada perubahan schema yang tidak kompatibel, lakukan pemulihan dari backup ke lingkungan baru dan validasi sebelum mengalihkan DNS. Simpan commit/tag sebelumnya. Jangan menjalankan `prisma migrate reset` atau `docker compose down -v` di produksi.

## Backup dan pemulihan

```bash
./ops/backup.sh
```

Script menghentikan penulis CRM/worker/Keuangan/SCM sementara, membuat tiga `pg_dump -Fc` yang konsisten, lalu menjalankan kembali proses melalui trap. Terdapat downtime singkat. File privat di `backups/<UTC>/crm.dump`, `finance.dump`, `scm.dump`; direktori diabaikan Git. Salin terenkripsi ke penyimpanan terpisah. Jadwalkan melalui cron/systemd di VPS setelah memeriksa kapasitas, retensi dan tujuan offsite. Penjadwalan belum aktif sebelum VPS disediakan.

Latihan restore harus memakai **VPS/stack baru yang kosong**, `.env` yang disalin secara aman dan Docker project terpisah. Jangan melakukan langkah berikut terhadap data operasional aktif:

```bash
docker compose up -d db
# Tunggu db healthy. BACKUP adalah direktori dump yang dipindahkan secara aman.
BACKUP=backups/TIMESTAMP
for service in crm finance scm; do
  case "$service" in
    crm) owner=crm_app; password_name=CRM_DB_PASSWORD ;;
    finance) owner=finance_app; password_name=FINANCE_DB_PASSWORD ;;
    scm) owner=scm_app; password_name=SCM_DB_PASSWORD ;;
  esac
  docker compose exec -T -e RESTORE_DATABASE="$service" -e RESTORE_OWNER="$owner" -e RESTORE_PASSWORD_NAME="$password_name" db sh -c 'export PGPASSWORD="$(printenv "$RESTORE_PASSWORD_NAME")"; exec pg_restore --exit-on-error --no-owner --no-acl -h 127.0.0.1 -U "$RESTORE_OWNER" -d "$RESTORE_DATABASE"' < "$BACKUP/$service.dump"
done
docker compose up -d
```

Database pada target wajib masih kosong, bukan sudah diinisialisasi migrasi aplikasi. Roles/databases saja dibuat oleh init database. Pulihkan ketiga dump dari timestamp yang sama untuk menjaga referensi integrasi. Verifikasi login, jumlah data, relasi, invoice dan inventori sebelum cutover. Prosedur restore tersedia, tetapi latihan restore terhadap VPS nyata belum dilakukan.

## Diagnosis

- `migrate` gagal: periksa db healthy, init role dan log migrasi. Jangan reset volume data.
- HTTP 502 di integrasi: periksa service sehat, URL internal, token dan log. Antrean tersimpan dan retry otomatis; admin dapat menjadwalkan retry gagal dari UI.
- Langganan PENDING: invoice harus PAID dan perangkat FULFILLED jika paket membutuhkan perangkat. Menekan tombol aktivasi tidak boleh melewati syarat server.
- Login/CSRF gagal: pastikan APP_ORIGIN sama dengan origin browser, sertifikat valid, jam VPS sinkron dan cookie tidak diblokir.
- Sertifikat belum terbit: periksa DNS dan akses publik 80/443. Jangan menonaktifkan verifikasi TLS.
- Ruang build kurang: bersihkan hanya cache build yang aman; jangan menghapus volume database. Lingkungan pengembangan ini memakai storage driver VFS sehingga Dockerfile menyatukan install dan build agar tidak menggandakan dependensi setiap layer.

Sebelum layanan dipakai untuk pelanggan sebenarnya, tentukan operator pembayaran/inventori, kebijakan privasi, monitoring, retensi backup dan prosedur dukungan. Pembayaran otomatis bank, refund dan provisioning jaringan membutuhkan kontrak/provider API tersendiri; nilainya tidak disimulasikan sebagai transaksi nyata.
