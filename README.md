# Kantin Uimsya Putra — Web + Supabase + Netlify

Versi web siap deploy ke Netlify. Database dan autentikasi menggunakan Supabase.

## 1. Buat database

Di Supabase → SQL Editor, jalankan seluruh isi `supabase.sql`.

## 2. Konfigurasi frontend

Edit `supabase-config.js`:

- `SUPABASE_URL` = Project URL
- `SUPABASE_ANON_KEY` = Publishable/anon key

Jangan masukkan `service_role` key ke file frontend.

## 3. Buat admin pertama

1. Pastikan Supabase Authentication → Providers → Email aktif.
2. Untuk setup username internal tanpa email sungguhan, matikan **Confirm email**.
3. Buka `setup.html`.
4. Buat akun pertama, misalnya:
   - username: `admin`
   - password: `admin123`
5. Halaman setup otomatis menjalankan `claim_first_admin()`, sehingga akun pertama menjadi admin.

## 4. Deploy ke Netlify

Upload folder/ZIP ini sebagai site Netlify.

Di Netlify → Site configuration → Environment variables, tambahkan:

- `SUPABASE_URL` = Project URL
- `SUPABASE_ANON_KEY` = Publishable/anon key
- `SUPABASE_SERVICE_ROLE_KEY` = **service_role key dari Supabase**

`SUPABASE_SERVICE_ROLE_KEY` hanya digunakan oleh Netlify Function dan TIDAK boleh dimasukkan ke JavaScript frontend.

## 5. Membuat akun pengguna baru

Setelah login sebagai admin, tombol **👥 Akun** akan muncul di kanan atas.

Klik tombol tersebut → masukkan username dan password → **Buat Akun**.

Akun baru langsung aktif dan bisa login menggunakan username + password. Admin tidak perlu lagi membuka Dashboard Supabase untuk membuat akun.

## Catatan keamanan

- RLS membatasi data keuangan berdasarkan `user_id`.
- Hanya role `admin` yang boleh memanggil fungsi pembuatan akun.
- Service role key hanya berada di Environment Variables Netlify.
- Jangan commit atau membagikan service role key.


## Perbaikan v10
Setup admin sekarang memakai Netlify Function + service role di server, sehingga tidak memanggil signUp/email verification dan tidak memicu email rate limit.

## v10 — Kontrol & Backup
Versi ini menambahkan pencarian transaksi, audit log aktivitas, tutup/buka periode, backup/restore JSON, pembatasan perubahan pada periode yang sudah ditutup, dan zona berbahaya admin-only.


## V10 Professional Core
V10 menambahkan modul transaksi terstruktur (`transactions`), kategori, approval status, audit log terpusat, periode tutup buku, serta role dasar admin/bendahara/petugas/viewer.

### Setup V10
1. Jalankan seluruh `supabase.sql` di Supabase SQL Editor.
2. Pastikan `SUPABASE_URL` dan `SUPABASE_ANON_KEY` tersedia untuk frontend.
3. Pastikan `SUPABASE_SERVICE_ROLE_KEY` hanya berada di Netlify Environment Variables untuk Functions.
4. Deploy ZIP ini ke Netlify.
5. Setelah login, buka menu **Transaksi** untuk modul transaksi baru.

Data lama v9 tetap dipertahankan; modul transaksi V10 berjalan berdampingan agar upgrade tidak menghapus data lama. Migrasi historis otomatis penuh dapat dilakukan pada tahap berikutnya setelah struktur transaksi divalidasi.


## V10.1 Production Hardening
- Admin dapat melihat transaksi seluruh pengguna.
- Role akun: Admin, Bendahara, Petugas, Viewer, User.
- Admin dapat menetapkan role saat membuat akun dan mengubah role pengguna.
- Audit transaksi otomatis tersimpan di `audit_logs`.
- Periode tertutup ditegakkan di database untuk transaksi.
- Tersedia migrasi aman data Pengeluaran/Penarikan V9 ke tabel `transactions` melalui tombol **Migrasi V9** (Admin). Data V9 lama tidak dihapus.
- Jalankan ulang seluruh `supabase.sql` di Supabase SQL Editor untuk menerapkan perubahan V10.1.
