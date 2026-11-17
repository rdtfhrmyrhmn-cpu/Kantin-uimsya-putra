# PANDUAN SETUP — Kantin Uimsya Putra v2 (Sistem Role)

## Apa yang baru di v2?

- **Sistem Role**: Admin dan Kasir dengan hak akses berbeda
- **Manajemen Pengguna dari dalam aplikasi**: Admin bisa buat, aktifkan/nonaktifkan, dan ubah role pengguna tanpa masuk ke Supabase
- **Kasir tidak bisa hapus data**: Tombol Hapus tersembunyi untuk Kasir
- **Keamanan database**: Hanya Admin yang dapat menghapus data di level database (RLS)

---

## 1. Isi folder

- `index.html`, `app.html`, `app.js`, `home.js`, `style.css`, `supabase.js`, `icons.js`, `_headers`, `_redirects`, `database.sql`, folder `vendor/`, `assets/logo.png`

Tidak ada framework dan tidak ada build command.

---

## 2. Supabase — Setup Database

Buka **Supabase > SQL Editor**, jalankan seluruh isi `database.sql`.

Ini akan membuat:
- Tabel `kantin_data` (data transaksi)
- Tabel `kantin_user_roles` (**BARU**: peta user → role)
- Fungsi `auth_is_admin()` untuk RLS
- Policy RLS yang membatasi delete hanya untuk Admin

---

## 3. Supabase — Nonaktifkan Konfirmasi Email

**Wajib** agar pembuatan akun dari dalam aplikasi berhasil.

1. Buka **Supabase > Authentication > Providers > Email**
2. Matikan **"Enable email confirmations"**
3. Simpan

Ini diperlukan karena alamat email internal `@kantin-uimsya.local` tidak nyata dan tidak bisa menerima email konfirmasi.

---

## 4. Buat Akun Admin Pertama

### Opsi A: Via Supabase (Cara Lama)

1. Buka **Supabase > Authentication > Users > Add user**
2. Email: `admin@kantin-uimsya.local`
3. Password: pilih password kuat
4. Login ke aplikasi dengan username `admin`
5. Karena belum ada role sama sekali, aplikasi **otomatis menjadikan pengguna pertama sebagai Admin**

### Opsi B: Via Supabase SQL (lebih cepat)

```sql
-- Buat user di auth (ganti password)
SELECT supabase.auth.create_user(
  '{"email": "admin@kantin-uimsya.local", "password": "passwordkuat123", "email_confirm": true}'
);
```

---

## 5. Membuat Pengguna Kasir (dari dalam aplikasi)

Setelah login sebagai Admin:

1. Klik menu **👥 Pengguna** di sidebar
2. Klik tombol **"Buat Pengguna"**
3. Isi form:
   - **Username**: huruf kecil, angka, underscore (contoh: `kasir1`)
   - **Password**: minimal 8 karakter
   - **Role**: Kasir (terbatas) atau Admin (penuh)
   - **Password Admin Anda**: konfirmasi identitas admin
4. Klik Simpan

Akun baru langsung bisa digunakan.

---

## 6. Perbedaan Role

| Fitur | 👑 Admin | 👤 Kasir |
|-------|----------|---------|
| Lihat semua data | ✅ | ✅ |
| Tambah transaksi | ✅ | ✅ |
| Edit data | ✅ | ✅ |
| Input laporan harian | ✅ | ✅ |
| Tandai libur | ✅ | ✅ |
| **Hapus data** | ✅ | ❌ |
| **Ubah status libur** | ✅ | ❌ |
| **Reset semua data** | ✅ | ❌ |
| **Ubah saldo awal** | ✅ | ❌ |
| **Kelola pengguna** | ✅ | ❌ |

---

## 7. supabase.js

Sudah dikonfigurasi untuk project ini. Untuk project berbeda, ubah:

```js
const SUPABASE_URL = 'https://PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_...';
```

Gunakan **Publishable/anon key**, bukan service_role.

---

## 8. Deploy ke Cloudflare Pages

Situs ini statis (tanpa build). Pilih salah satu cara:

**A. Upload langsung (paling mudah)**
1. Buka Cloudflare Dashboard → **Workers & Pages** → **Create** → tab **Pages** → **Upload assets**.
2. Beri nama proyek (mis. `kantin-uimsya-putra`), lalu **seret folder proyek** ini (isi folder, bukan file zip) → **Deploy**.
3. Situs aktif di `https://NAMA-PROYEK.pages.dev`. Untuk memperbarui: buka proyek → **Create deployment** → upload ulang folder.

**B. Lewat GitHub**
1. Workers & Pages → Create → Pages → **Connect to Git**, pilih repositori.
2. Framework preset: **None**. Build command: *(kosong)*. Build output directory: `/` (root).
3. Setiap `git push` otomatis ter-deploy.

**C. Lewat terminal (Wrangler)**
```
npx wrangler pages deploy . --project-name=kantin-uimsya-putra
```

Catatan:
- `_headers` (header keamanan & cache) dan `_redirects` (`/login` → halaman login) dibaca otomatis oleh Cloudflare Pages.
- Alamat `app.html` otomatis tampil sebagai `/app`, dan `index.html` sebagai `/`.
- Cloudflare Pages **tidak** memasang pop-up/badge di halaman. Jika ada widget melayang, cek **Web Analytics** di proyek dan pastikan *auto-install* tidak diaktifkan bila tidak diperlukan.
- Domain sendiri: proyek → **Custom domains** → Set up a domain.
- Jika memakai domain baru, tambahkan juga ke Supabase → Authentication → URL Configuration (Site URL / Redirect URLs).

---

## 9. Catatan Keamanan

- **service_role key** tidak boleh ada di frontend
- Hapus data dibatasi di level database (RLS policy `auth_is_admin()`)
- Akun nonaktif diblokir di level aplikasi (untuk block total, hapus akun di Supabase Auth)
- Kasir yang mencoba akses API langsung tetap dibatasi oleh RLS untuk operasi DELETE

---

## 10. Troubleshooting

**"Gagal membuat akun: ...email_already_used"**
→ Username sudah dipakai di Supabase Auth. Pilih username lain.

**"Gagal membuat akun: ...Email confirmation required"**
→ Nonaktifkan konfirmasi email di Supabase (lihat langkah 3).

**"Akun Anda belum memiliki akses"**
→ User ada di Supabase Auth tapi belum punya role. Admin harus membuat role di tabel `kantin_user_roles` secara manual atau via menu Pengguna.

**"Akun dibuat tapi gagal masuk kembali sebagai admin"**
→ Password konfirmasi admin salah. Akun baru tetap terbuat. Login manual ke Supabase Auth untuk verifikasi.

---

## 11. Fitur v3: Periode, Pengeluaran, Evaluasi

- **Periode (Beranda)**: pilih bulan di kolom *Periode*. Beranda, Transaksi, Pengeluaran, Buku Kas, Tabungan, Laporan Harian dan Evaluasi hanya menampilkan data bulan tersebut. Pilihan tersimpan di browser. Pilih "Semua Periode" untuk melihat seluruhnya. Saldo tabungan dan piutang/hutang tetap menampilkan total berjalan.
- **Pengeluaran**: rekap per kategori + rincian, tombol *Cetak Rekap* / *Cetak Lengkap*. Kategori yang ditulis dengan huruf besar/kecil berbeda (mis. "Gas" dan "gas") digabung otomatis.
- **Evaluasi dan Rekapitulasi**: catatan keluh kesah anggota dan target kantin, plus rekap angka periode. Catatan disimpan di tabel `kantin_data` dengan tipe `catatan` — **tidak perlu mengubah database**.

## 12. Simpan PDF

- Tombol **📄 PDF** ada di samping setiap tombol Cetak, dan **📄 Simpan PDF Semua Laporan** di tab Laporan. PDF langsung terunduh (A4, bernomor halaman). Library-nya ada di folder `vendor/` — ikut di-upload bersama file lain.

## 13. Tampilan Dasbor Kaca (v4)

- Tampilan baru bergaya *glassy dashboard*: bingkai kaca, dock navigasi melengkung di kiri, bar atas dengan sub-menu, kartu kaca, dan pilihan tema **Terang / Gelap** (tersimpan di browser).
- Di HP, dock berubah menjadi bar menu di bawah dan bar atas bisa digeser.
- Kolom pencarian (atau `Ctrl+K`) bisa dipakai untuk pindah halaman dan menjalankan perintah (transaksi baru, cetak semua, simpan PDF, ganti tema).
- Beranda: peringatan otomatis (laporan hari ini belum diisi, stok menipis, piutang jatuh tempo, keluhan belum selesai), pengeluaran per kategori, keluh kesah & target, kalender periode (klik tanggal untuk membuka Laporan Harian), dan ring margin laba / target tercapai.
- File baru: `icons.js`, `assets/bg.jpg`. Semua fungsi lama (cetak, PDF, periode, evaluasi) tetap sama.

## 14. Batas Sesi Login 1 Jam

- Setiap login berlaku **maksimal 1 jam**. Setelah itu pengguna otomatis keluar dan kembali ke halaman login dengan pesan "Sesi login 1 jam telah berakhir".
- Sisa waktu tampil sebagai hitung mundur (⏱ 59:59) di bar atas. Peringatan muncul 5 menit dan 1 menit sebelum habis.
- Berlaku untuk semua tab/jendela sekaligus. Menutup browser lalu membuka lagi setelah lewat 1 jam juga tidak otomatis masuk.
- Mengubah lama sesi: ubah `LIMIT_MS` di `session-guard.js` (mis. `30 * 60 * 1000` untuk 30 menit).
- Catatan keamanan: batas ini dijalankan di browser. Untuk pemaksaan di sisi server, aktifkan *Time-box user sessions* di Supabase → Authentication → Sessions (fitur paket berbayar).
