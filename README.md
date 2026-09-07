# Kantin Uimsya Putra — Web + Supabase + Netlify

Versi ini mengubah aplikasi Electron menjadi **web statis** yang bisa dideploy ke Netlify. Data transaksi tidak lagi disimpan di `transaksi.json`, tetapi di Supabase.

## Struktur

- `renderer/login.html` — login
- `renderer/index.html` — aplikasi utama
- `renderer/app.js` — logika aplikasi + koneksi Supabase
- `renderer/supabase-config.js` — isi URL + anon key Supabase
- `renderer/setup.html` — membuat akun awal
- `supabase.sql` — tabel + RLS
- `netlify.toml` — konfigurasi Netlify

## 1. Buat database Supabase

1. Buat project di Supabase.
2. Buka **SQL Editor**.
3. Jalankan seluruh isi `supabase.sql`.
4. Buka **Project Settings > API** dan salin:
   - Project URL
   - Publishable/anon key

## 2. Isi konfigurasi

Buka `renderer/supabase-config.js`:

```js
const SUPABASE_URL = 'https://PROJECT-REF.supabase.co'
const SUPABASE_ANON_KEY = 'PASTE_ANON_KEY'
```

Gunakan **anon/publishable key**, jangan pernah memasukkan `service_role` key ke website.

## 3. Buat akun pertama

Sebelum login, buka:

`setup.html`

Isi default:
- username: `admin`
- password: `admin123`

Pada Supabase, untuk model username internal ini, buka **Authentication > Providers > Email** lalu matikan **Confirm email**. Setelah akun dibuat, gunakan `login.html`.

> Setelah akun pertama berhasil dibuat, Anda boleh menghapus `setup.html` dari deployment untuk keamanan tambahan.

## 4. Deploy ke Netlify

### Cara A — Drag & Drop
Upload folder `keuangan-putra` ke Netlify. File `netlify.toml` sudah mengatur folder publish ke `renderer`.

### Cara B — Git
Upload isi folder proyek ke repository GitHub, lalu di Netlify pilih repository tersebut. Build command boleh dikosongkan karena aplikasi ini static. Publish directory: `renderer`.

## 5. Keamanan data

RLS memastikan setiap akun hanya dapat membaca/menulis baris `finance_data` miliknya sendiri. Data utama disimpan sebagai JSONB sehingga struktur aplikasi lama tetap kompatibel.

## 6. Catatan

Aplikasi membutuhkan internet untuk login dan sinkronisasi Supabase. Fitur CSV sekarang mengunduh file langsung dari browser, sedangkan cetak menggunakan dialog print browser.

### Troubleshooting

- **Invalid API key** → periksa `supabase-config.js`.
- **relation finance_data does not exist** → jalankan `supabase.sql`.
- **Login gagal** → pastikan akun sudah dibuat dan password benar.
- **Akun dibuat tapi tidak bisa login** → matikan Confirm email jika menggunakan `setup.html`.
- **Data tidak tersimpan** → cek RLS dan pastikan user sudah login.
