# Kontrak API versi 1

CRM: `/api/v1`. Success `{ "data": ... }`; error `{ "error": { "code": "...", "message": "..." } }`. Semua respons API no-store. JSON mutasi dibatasi 32 KB (login/password 4 KB). ID resource UUID. Uang IDR dalam rupiah bulat, tidak menggunakan float untuk ledger.

Login POST `/auth/login` dengan `{email,password}` dan header Origin yang sama dengan APP_ORIGIN. Cookie `nusa_session` HttpOnly dikirim server; response memuat `user` dan `csrf`. GET `/auth/session` untuk memperoleh user/CSRF terbaru. Sertakan cookie, `Origin`, `X-CSRF-Token` dan `Content-Type: application/json` saat mutasi berikutnya. `Idempotency-Key` 8–120 karakter disarankan untuk command/resource write; gunakan key yang sama bila mengulang permintaan yang sama. Command receipt mencegah penerapan ganda dan menolak payload berbeda pada key sama (409). Endpoint administratif akun/password tidak memakai command receipt.

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | /health | Database health tanpa data pelanggan |
| POST | /auth/login, /auth/logout, /auth/password | Masuk, keluar, ganti password |
| GET | /auth/session, /state, /dashboard/summary | Sesi, snapshot sesuai akses, agregat |
| GET, POST | /customers, /packages, /subscriptions, /tickets | Daftar dan pembuatan |
| GET | /{resource}/{id} | Detail |
| PATCH | /customers/{id}, /packages/{id}, /tickets/{id} | Edit field yang diizinkan |
| PATCH | /{customers,packages,subscriptions,tickets}/{id}/status | Transisi status |
| GET | /customers/{id}/subscriptions, /customers/{id}/tickets | Relasi pelanggan |
| GET, POST | /tickets/{id}/comments | Catatan penanganan |
| PATCH | /tickets/{id}/assignment | Penugasan akun teknisi aktif |
| GET | /invoices, /fulfillments, /events | Proyeksi status integrasi |
| POST | /commands | Command union untuk UI, otorisasi tetap di server |
| GET, POST | /users | Daftar/buat staf, admin |
| PATCH | /users/{id} | Role/isActive/newPassword, admin |
| GET | /audit | 200 audit terbaru, admin |
| GET | /integrations/inventory | Stok SCM, admin |
| POST | /integrations/inventory/receipts | Penerimaan stok, admin |
| POST | /integrations/finance/invoices/{id}/payments | Pelunasan manual terverifikasi, admin |
| POST | /integrations/scm/fulfillments/{id}/deliver | Catat serah-terima, admin |
| POST | /integrations/{finance,scm}/callbacks/retry | Retry callback gagal, admin |
| POST | /integrations/{finance,scm}/events | Callback service dengan HMAC, tanpa cookie |

Daftar resource memakai `page` (default 1), `pageSize` (1–100, default20), `search`, `status`; response `data.items` dan `data.meta`. Implementasi awal memfilter snapshot dalam memori server; tidak ditujukan untuk jutaan baris. Pembuatan/perubahan resource mengembalikan snapshot workspace sesuai peran, bukan hanya satu baris. Status yang tidak memenuhi transisi bisnis menghasilkan 409. Tidak ada hard-delete endpoint.

Lihat [OpenAPI CRM](../public/openapi.json) untuk schema permintaan. READ di peran teknisi dibatasi ke tiket ditugaskan dan relasi yang diperlukan, bukan seluruh pelanggan/ledger. /users dan /audit hanya admin. Server menolak command palsu ROLE, CONNECTION, PAY_INVOICE dan FULFILL.

## Keuangan dan SCM

Berjalan sebagai proses/database berbeda. URL dikonfigurasi di FINANCE_API_URL/SCM_API_URL. Semua endpoint kecuali GET /health memerlukan `Authorization: Bearer <service token>`. Semua POST memerlukan `Idempotency-Key` (8–200 karakter), dan operasi ledger/resource memakai payload hash + receipt tersimpan. POST callbacks/retry mengatur ulang antrean gagal tanpa membuat transaksi keuangan baru. Token tidak dikirim ke browser.

| Layanan | Endpoint |
|---|---|
| Keuangan | GET/POST /v1/invoices, GET /v1/invoices/{id} |
| Keuangan | POST /v1/invoices/{id}/payments, POST /v1/invoices/{id}/void |
| SCM | GET /v1/inventory, POST /v1/inventory/receipts |
| SCM | GET/POST /v1/requests, GET /v1/requests/{id} |
| SCM | POST /v1/requests/{id}/deliver, POST /v1/requests/{id}/cancel |
| Keduanya | GET /v1/callbacks, POST /v1/callbacks/retry, GET /health |

Finance hanya menerima pelunasan tepat nominal dan referensi unik, tanggal tidak boleh di masa depan. SCM mereservasi stok yang tersedia, menunggu stok bila habis, dan menolak penyerahan tanpa reservasi. Pembatalan invoice PAID dan perangkat DELIVERED ditolak karena memerlukan refund/retur tersendiri. Baca [OpenAPI layanan](../services/openapi.json).

## Callback

Header `X-Hook-Timestamp` berupa Unix millisecond string. Header `X-Hook-Signature` berupa hex HMAC-SHA256 dengan secret per layanan atas string `timestamp + "." + rawJSON`. CRM memverifikasi timestamp dalam 5 menit dan signature secara constant-time. Contoh bentuk payload (nilai placeholder):

```json
{
  "eventId": "unique-service-event-id",
  "type": "invoice.paid",
  "resourceId": "crm-invoice-uuid",
  "externalId": "finance-invoice-uuid",
  "version": 2,
  "status": "PAID",
  "amount": 349000,
  "currency": "IDR",
  "paidAt": "2026-11-14T09:00:00.000Z"
}
```

Status SCM: WAITING_STOCK, RESERVED, DELIVERED, CANCELLED. Event ID unik per sumber, versi meningkat per resource. Event berulang diakui tanpa menggandakan perubahan; versi lama tidak menimpa status terbaru. Nominal/currency serta externalId wajib konsisten dengan resource CRM. Worker menyimpan antrean sebelum HTTP sehingga restart proses tidak kehilangan event. /health dan status koneksi berasal dari pemeriksaan database/HTTP, bukan tombol simulasi.

401: sesi/credential/signature salah. 403: peran/Origin/CSRF tidak diizinkan. 409: konflik atau transisi bisnis tidak sah. 413: body terlalu besar. 415: tipe konten salah. 422: validasi input. 429: batas percobaan login. 500/502: kegagalan server/service; periksa log tanpa menampilkan secret kepada browser.
