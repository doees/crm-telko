# Nusa CRM — Tahap 1

Fondasi aplikasi CRM telekomunikasi untuk final project Integrasi Aplikasi Korporasi, kelompok 5 orang. Aplikasi berada di root repository mandiri; tidak membawa file maupun riwayat Git project lain.

## Lingkup

Next.js App Router, TypeScript strict, Tailwind CSS 4, dashboard responsif, navigasi mobile, data contoh fiktif, Prisma dan konfigurasi PostgreSQL. Pencarian pada tabel dan pilihan periode grafik bekerja hanya pada data contoh. Tanggal dashboard adalah snapshot demo 13 November 2026. Grafik memakai indeks 0–100, bukan hitungan pelanggan. Nilai langganan merupakan estimasi, bukan kas diterima.

Halaman Pelanggan, Paket, Langganan, Tiket, dan Integrasi hanya penanda tahap berikutnya. Belum ada autentikasi, otorisasi, CRUD, API bisnis, worker, seed database, atau koneksi Keuangan/SCM. Jangan memasukkan data pelanggan nyata ke demo ini.

## Prasyarat

- Node.js 22 LTS (lihat `.nvmrc`), npm, dan Git. Node 24 juga didukung.
- PostgreSQL 16+ hanya diperlukan untuk pengujian database; dashboard dapat berjalan tanpa database.

## Instalasi dan menjalankan

Clone feature branch, lalu jalankan dari root repository:

```bash
git clone --branch feat/crm-foundation https://github.com/doees/crm-telko.git
cd crm-telko
npm ci
npm run dev
```

Buka http://localhost:3000; root langsung menampilkan dashboard. Tidak perlu `.env` untuk dashboard contoh. Instalasi menghasilkan Prisma Client secara otomatis tanpa menghubungi database.

Untuk production lokal:

```bash
npm run build
npm start
```

## Konfigurasi PostgreSQL

Tidak ada layanan atau kredensial database yang disediakan oleh repository. Siapkan PostgreSQL lokal/layanan milik tim dan buat database kosong, user, password serta hak aksesnya. Jangan gunakan identitas atau password rekaan sebagai kredensial layanan sebenarnya.

```bash
# macOS / Linux / Git Bash
cp .env.example .env
# Windows PowerShell: Copy-Item .env.example .env
```

Edit `DATABASE_URL` di `.env` dengan **nilai milik Anda**. Format pada `.env.example` berisi placeholder; bukan konfigurasi siap koneksi. URL-encode karakter khusus pada user/password. Untuk layanan remote, ikuti parameter SSL dari penyedia. `.env` dan variasinya diabaikan Git kecuali `.env.example`.

```bash
npm run db:validate
npm run db:generate
npm run db:deploy
npm run db:studio
```

`db:deploy` menerapkan migration awal tabel `customers`. Jalankan hanya setelah memeriksa target koneksi; gunakan database khusus proyek. Prisma Studio tersedia pada alamat yang dicetak CLI (umumnya http://localhost:5555). Keberhasilan `db:validate` dan `db:generate` saja tidak membuktikan koneksi database.

Untuk perubahan schema pada tahap berikutnya:

```bash
npm run db:migrate -- --name nama_perubahan
```

`migrate dev` membutuhkan database pengembangan dan kemampuan membuat shadow database (atau konfigurasi shadow database khusus). Untuk menerapkan migration yang telah disimpan di Git, gunakan `db:deploy`. Jangan mengedit migration yang sudah diterapkan bersama. Dashboard tahap 1 tidak membaca tabel ini.

## Struktur

```text
src/app/                         routing dan layout App Router
src/app/(dashboard)/             dashboard dan halaman penanda modul
src/app/api/v1/                  tempat API mendatang; masih kosong
src/components/layout/           sidebar, header, navigasi responsif
src/components/ui/, shared/      tempat komponen bersama mendatang
src/modules/dashboard/           komponen dan fixture dashboard
src/modules/{customers,packages,subscriptions,tickets}/
                                 tempat modul mendatang
src/lib/                        navigasi dan Prisma server-only
src/integrations/{finance,scm,shared}/
                                 tempat adapter mendatang
src/workers/                     tempat worker mendatang
prisma/                          schema dan migration PostgreSQL
 tests/{unit,integration,e2e}/    tempat pengujian mendatang
```

Folder mendatang berisi `.gitkeep` saja agar struktur tercatat tanpa implementasi prematur. Model awal `Customer` hanya fondasi skema; model paket, langganan, tiket, pengguna, outbox dan inbox ditambahkan bertahap beserta aturan bisnisnya.

## Verifikasi

```bash
npm run lint
npm run db:generate
npm run typecheck
npm run build
```

Pemeriksaan TypeScript menjalankan `next typegen` lebih dahulu agar tipe route tersedia pada checkout bersih sebelum build. Next.js memperbarui `next-env.d.ts` lokal saat build/dev; file tersebut diabaikan Git. CI menjalankan lint, generate, typecheck, build tanpa database atau secret.

Pemeriksaan manual di browser:

1. Buka `/` dan `/dashboard`; pastikan keduanya menampilkan dashboard.
2. Cari `Andi`: satu pelanggan tampil; cari teks acak: pesan hasil kosong tampil.
3. Ganti periode 6 bulan menjadi 3 bulan: grafik berubah.
4. Buka setiap menu: halaman penanda tampil dan menu aktif sesuai URL.
5. Pada lebar 390px, buka/tutup sidebar, pilih menu dan geser tabel secara horizontal bila perlu. Seluruh halaman tidak boleh meluap horizontal.
6. Gunakan Tab untuk memeriksa fokus, skip link, tombol menu, pencarian, dan pilihan periode.
7. Buka URL tidak dikenal; pastikan halaman 404 tampil.

## GitHub dan kolaborasi

Branch tahap ini: `feat/crm-foundation`. Ajukan Pull Request ke `main`; jangan merge tanpa review anggota kelompok. CI memeriksa aplikasi pada setiap Pull Request ke main dan push ke feature branch. Commit `package-lock.json` dan migration; jangan commit `.env`, `node_modules`, `.next`, atau kredensial.

Lihat [laporan tahap 1](docs/TAHAP-1.md) dan [catatan perintah](docs/COMMANDS.md) untuk bukti pengerjaan dan batas validasi.

## Demo publik GitHub Pages

Target: https://doees.github.io/crm-telko/

Workflow `.github/workflows/pages.yml` membangun dan menerbitkan dashboard contoh dari `feat/crm-foundation`. Branch main tetap menjadi dasar review PR. GitHub Pages dikonfigurasi dengan Source **GitHub Actions**. Build memakai `GITHUB_PAGES=true`, `output: export`, `basePath: /crm-telko` dan trailing slash agar akses langsung ke setiap halaman bekerja.

GitHub Pages hanya menyajikan HTML/CSS/JavaScript statis. Demo tidak menjalankan PostgreSQL, Prisma query, autentikasi atau API. Mode Next.js server tetap tersedia dengan build normal tanpa `GITHUB_PAGES`; gunakan hosting Node.js dan PostgreSQL ketika tahap backend dimulai.

Untuk membuat ekspor yang sama secara lokal (macOS/Linux/Git Bash):

```bash
GITHUB_PAGES=true npm run build
```

Pada PowerShell: `$env:GITHUB_PAGES="true"; npm run build`. Hasil statis berada di `out/` (diabaikan Git). Hapus variabel `GITHUB_PAGES` sebelum menjalankan build server. Untuk build normal gunakan `npm run build`, kemudian `npm start`.
