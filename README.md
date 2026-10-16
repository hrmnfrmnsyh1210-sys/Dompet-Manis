# Dompet Manis

Aplikasi pencatatan keuangan pribadi: saldo, pemasukan, pengeluaran, kategori, laporan PDF & Excel.
Dibangun dengan **Nuxt 4**, database **TiDB Cloud**, siap deploy ke **Vercel**.

## Menjalankan di komputer

1. Salin `.env.example` menjadi `.env`, lalu isi `NUXT_DATABASE_URL` dengan connection string TiDB Cloud.
2. Jalankan:
   ```bash
   npm install
   npm run dev
   ```
3. Buka http://localhost:3000, lalu buat akun pertama. Akun ini otomatis menjadi **admin**. Setelah itu, siapa pun bisa **mendaftar sendiri** lewat tautan "Daftar gratis" di halaman login (sebagai pengguna biasa). Admin bisa menutup pendaftaran di halaman Pengguna.

Tabel database dibuat otomatis saat aplikasi pertama kali dipakai.

## Menyiapkan TiDB Cloud

1. Daftar di https://tidbcloud.com, lalu buat cluster **Serverless / Starter** (gratis).
2. Buka **SQL Editor** dan jalankan `CREATE DATABASE dompet;`
3. Klik **Connect**, pilih **Serverless Driver**, buat password, lalu salin URL-nya.
   Ganti nama database di ujung URL menjadi `/dompet`.

## Deploy ke Vercel

1. Push folder ini ke GitHub.
2. Di Vercel: **Add New → Project**, lalu pilih repo-nya. Framework otomatis terdeteksi sebagai Nuxt.
3. Di **Settings → Environment Variables**, tambahkan:
   - `NUXT_DATABASE_URL` = connection string TiDB
   - `NUXT_APP_TIMEZONE` = `Asia/Jakarta`
4. Klik **Deploy**.

Kalau kamu memakai integrasi resmi **TiDB Cloud ↔ Vercel**, variabel `DATABASE_URL` yang dibuat otomatis juga langsung terbaca.

## Pengguna & peran

- **Pendaftaran mandiri** terbuka secara bawaan: pengunjung bisa membuat akun sendiri dan langsung mendapat kategori bawaan. Admin bisa menutup/membuka pendaftaran lewat centang **Pendaftaran terbuka untuk umum** di halaman Pengguna. Pendaftaran dibatasi **3 akun per IP per 15 menit**.
- **Admin** bisa membuka tab **Pengguna** untuk menambah pengguna, mereset password, mengubah peran (admin/pengguna), dan menghapus pengguna beserta seluruh datanya.
- Halaman Pengguna menampilkan **saldo, pemasukan, dan pengeluaran tiap akun** (per bulan atau semua waktu), hanya angka ringkasan, bukan rincian transaksi.
- Setiap pengguna punya data terpisah: kategori, transaksi, saldo awal, dan API key sendiri. Pengguna biasa tidak bisa melihat atau mengubah data orang lain.
- Harus selalu ada minimal satu admin, dan admin tidak bisa menghapus akunnya sendiri.

## Keamanan

- Password di-hash dengan **scrypt**. Sesi login disimpan di database dengan cookie `HttpOnly` dan `SameSite=Lax`, yang menjadi `Secure` di production.
- Login dibatasi **5 percobaan gagal per 15 menit** per IP.
- Semua data hanya bisa diakses lewat API setelah login.
- Ganti password otomatis mengeluarkan semua perangkat lain.
- Menghapus semua transaksi wajib memasukkan password.

## API untuk bot Telegram / LLM

Buat API Key di **Pengaturan → Integrasi Bot**. Key hanya ditampilkan sekali. Setiap pengguna punya key sendiri, dan key itulah yang menentukan ke akun siapa transaksi dicatat. Kirim key di header:

```
Authorization: Bearer dm_xxxxxxxx
```

| Method | Endpoint | Keterangan |
|---|---|---|
| `GET` | `/api/categories` | Daftar kategori (masukkan ke prompt LLM) |
| `POST` | `/api/transactions` | Catat transaksi |
| `GET` | `/api/transactions?month=2026-10&type=out&limit=10` | Daftar transaksi |
| `PUT` | `/api/transactions/:id` | Ubah sebagian field transaksi |
| `DELETE` | `/api/transactions/:id` | Hapus transaksi |
| `GET` | `/api/summary?month=2026-10` | Saldo sekarang + ringkasan bulan |

Contoh body `POST /api/transactions`:

```json
{
  "type": "out",
  "amount": 25000,
  "category": "Makan & Minum",
  "note": "Boba",
  "date": "2026-10-08",
  "source": "telegram"
}
```

- `type`: `in` (pemasukan) atau `out` (pengeluaran)
- `amount`: angka, atau teks seperti `"25.000"`
- `category`: nama kategori (huruf besar/kecil bebas), atau kirim `category_id`
- `date`: opsional, default hari ini sesuai `NUXT_APP_TIMEZONE`
- `source`: label yang tampil sebagai badge robot di riwayat transaksi

Kalau nama kategori tidak dikenal, API membalas `400` dengan `data.available` berisi daftar nama kategori yang valid, sehingga bot bisa bertanya ulang atau memilih yang paling cocok.
Setiap kategori punya field `icon` (key ikon MingCute, daftar lengkapnya di `shared/utils/icons.ts`).
Respons sukses juga menyertakan `summary`, jadi bot bisa langsung membalas misalnya "Tercatat! Sisa saldo Rp …".

Webhook bot nanti bisa dibuat sebagai route baru di `server/api/telegram/` dalam proyek yang sama, supaya ikut ter-deploy di Vercel.

## Struktur

```
app/          halaman (pages), komponen, layout, composable, utilitas laporan
server/api/   endpoint REST
server/utils/ koneksi TiDB, autentikasi, logika keuangan
```
