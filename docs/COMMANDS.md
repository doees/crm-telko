# Catatan perintah — repository mandiri

## Koreksi lokasi repository

- Implementasi awal sempat dikirim ke feature branch pada repository Primarizki sebelum pengguna mengoreksi lokasi tujuan. Draft PR lama ditutup tanpa merge melalui plugin GitHub. Main pada repository lama tidak diubah oleh pengerjaan ini; branch lama tidak dihapus.
- `gh repo create doees/telecom-crm --private --add-readme --description ...`: gagal HTTP 403 `Resource not accessible by integration`. Koneksi sesi tidak memiliki izin membuat repository. Pengguna kemudian menyediakan `https://github.com/doees/crm-telko.git`.
- `git init -b main /workspace/work/telecom-crm`: membuat repository lokal mandiri.
- Commit awal `docs: initialize standalone CRM repository`: hanya README pengantar.
- `git switch -c feat/crm-foundation`: implementasi tetap berada pada feature branch.
- Source aplikasi disalin dari berkas CRM yang tercatat di Git, tanpa `.git`, project Python, cache, node_modules, kredensial atau artefak build lama.
- README, workflow CI dan dokumentasi diperbarui untuk struktur root repository.

## Dependency dan pemeriksaan

- Runtime: Node 24.22.1, npm 11.9.0; `.nvmrc` menyarankan Node 22 LTS.
- Cache npm menggunakan `/workspace/work/npm-cache` karena cache default home tidak writable di sandbox; cache tidak masuk repository.
- `npm ci --cache /workspace/work/npm-cache`: berhasil, 405 paket; instalasi berdasarkan lockfile, postinstall menghasilkan Prisma Client tanpa koneksi database.
- `npm run lint`, `npm run typecheck`, `npm run build`: seluruhnya exit 0 pada repository mandiri, tanpa artefak build lama. Build menghasilkan 9 halaman.
- `set -a`, `. ./.env.example`, `npm run db:validate`: exit 0; memvalidasi struktur schema memakai placeholder URL, tanpa menghubungi database.
- `git diff --cached --check`: pemeriksaan whitespace sebelum commit.

## Pemeriksaan sebelumnya pada source awal

Next.js build, lint dan typecheck telah lulus sebelum pemindahan. Satu warning export anonim PostCSS diperbaiki. Script typecheck menggunakan `next typegen && tsc --noEmit` agar tidak bergantung pada hasil build lama. SQL migration dibuat menggunakan `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` tanpa koneksi database. Hasil tersebut tidak menggantikan pemeriksaan ulang pada project mandiri.

## Batas validasi

Tidak menjalankan `db:deploy`/`db:migrate` karena PostgreSQL dan kredensial tidak tersedia. Tidak melakukan QA browser karena tool `cua_repl.js` tidak tersedia pada preview managed. Tidak mengklaim CI GitHub berhasil sebelum repository baru dan workflow tersedia.

## Repository tujuan yang disediakan pengguna

- `git ls-remote https://github.com/doees/crm-telko.git` dan clone dengan credential helper sesi: berhasil, tidak ada refs; clone melaporkan repository kosong.
- `gh repo view doees/crm-telko --json nameWithOwner,isEmpty,defaultBranchRef,visibility`: isEmpty=true, belum ada default branch, visibility PUBLIC. Visibility dipertahankan.
- Direktori clone kosong disimpan terpisah sebagai bukti pemeriksaan; source mandiri yang sudah diuji ditempatkan di `/workspace/work/crm-telko`.
- Remote `origin` diset ke `https://github.com/doees/crm-telko.git`. Tidak ada remote Primarizki pada repository mandiri.
- `git add .`, `git diff --cached --check`, commit implementasi pada feature branch. Push menggunakan credential helper `gh auth git-credential`; token tidak disimpan dalam file.
- Push `main` hanya untuk README pengantar commit awal, lalu push `feat/crm-foundation` berisi source aplikasi. Tidak ada merge aplikasi ke main.
- Draft PR dibuat melalui plugin GitHub pada repository baru; URL dan hasil CI dilaporkan pada penyerahan.
