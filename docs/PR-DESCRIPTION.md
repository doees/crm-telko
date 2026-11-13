## Perubahan

Membangun fondasi CRM telekomunikasi sebagai aplikasi mandiri pada root repository baru. Menggunakan Next.js App Router, TypeScript strict, Tailwind CSS, dashboard responsif, data contoh, pencarian pelanggan contoh, pilihan periode grafik, dan halaman penanda modul berikutnya.

Menyiapkan Prisma/PostgreSQL, skema dan migration awal Customer, `.env.example` tanpa kredensial nyata, struktur modular, README instalasi, laporan UAS dan CI. Lingkup berhenti pada Tahap 1; autentikasi, CRUD, dan integrasi API belum diimplementasikan.

## Validasi

Lihat `docs/TAHAP-1.md` untuk hasil lint, TypeScript, build, dan validasi Prisma pada repository mandiri. Koneksi database dan penerapan migration memerlukan PostgreSQL serta kredensial milik tim. QA browser belum dijalankan karena tool preview managed tidak tersedia.

## Lokal

Jalankan `npm ci` dan `npm run dev` dari root, lalu buka http://localhost:3000/dashboard. Dashboard contoh tidak membutuhkan database.
