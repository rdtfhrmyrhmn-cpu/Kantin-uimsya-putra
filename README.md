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


## Perbaikan v8
Setup admin sekarang memakai Netlify Function + service role di server, sehingga tidak memanggil signUp/email verification dan tidak memicu email rate limit.
