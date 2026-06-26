# SiPro — Pre-Deploy Checklist (Langkah Demi Langkah)

Berikut panduan super detail untuk 5 hal yang **WAJIB** dilakukan sebelum deploy SiPro ke production. Ikuti satu per satu, jangan diskip.

---

## 1️⃣ Buat Firestore Composite Index

Firestore membutuhkan **composite index** untuk query yang mengurutkan data berdasarkan 2 field atau lebih. Kalau index ini belum ada, aplikasi akan error di browser (console error: `failed-precondition`).

### Step-by-Step:

1. **Buka Firebase Console** → [console.firebase.google.com](https://console.firebase.google.com)
2. **Pilih project "sipro-perusahaan"**
3. **Klik menu Firestore Database** di sidebar kiri
4. **Klik tab "Indexes"** (di sebelah kanan atas, sejajar dengan tab "Data" dan "Rules")
5. **Klik tombol "+ Composite Index"** (warna biru, di kanan atas)
6. **Isi index pertama — untuk riwayat gudang:**
   - Collection: `permintaan`
   - Field 1: `petugasUID` → pilih **Ascending**
   - Field 2: `tanggalInput` → pilih **Descending**
   - Query scope: `Collection` (bukan Collection Group)
   - Klik **"Create Index"**

   Hasil yang muncul di tabel:
   ```
   Collection: permintaan
   Fields: petugasUID Ascending, tanggalInput Descending
   Status: Building → Building → Enabled
   ```
   Tunggu sampai status jadi **Enabled** (biasanya 1-2 menit).

7. **Klik tombol "+ Composite Index" lagi**
8. **Isi index kedua — untuk dashboard approval & pembelian:**
   - Collection: `permintaan`
   - Field 1: `tanggalInput` → pilih **Descending**
   - Query scope: `Collection`
   - Klik **"Create Index"**

   Tunggu sampai status jadi **Enabled**.

### ✅ Verifikasi:
Buka tab **Indexes**, pastikan ada 2 baris:
```
permintaan | petugasUID Ascending, tanggalInput Descending | Enabled
permintaan | tanggalInput Descending | Enabled
```

> ⚠️ **Jika ini diskip**: Saat petugas gudang buka tab "Riwayat Saya", halaman akan error dan tidak menampilkan data apa pun. Console browser akan menunjukkan error `failed-precondition`.

---

## 2️⃣ Buat Dokumen Counter untuk Nomor Permintaan

Aplikasi menggunakan Firestore transaction untuk generate nomor PR yang berurutan (PR-250625-0001, PR-250625-0002, dst). Perlu ada dokumen `metadata/counter` di Firestore sebagai "counter".

### Step-by-Step:

1. **Di Firebase Console**, pastikan masih di menu **Firestore Database**
2. **Klik tab "Data"**
3. **Klik tombol "+ Start collection"** (biasanya di tengah layar kalau belum ada collection)
4. **Isi Collection ID:** `metadata`
5. **Klik "Next"**
6. **Isi Document ID:** `counter` (ketik manual, jangan auto-generate)
7. **Klik "Next"**
8. **Tambahkan field:**
   - Klik **"+ Add field"**
   - Field type: `number`
   - Field name: `noPerm`
   - Field value: `0`
   - Klik **"Save"**

### Hasil yang harus terlihat:
```
metadata (collection)
└── counter (document)
    └── noPerm: 0 (number)
```

### ✅ Verifikasi:
Klik collection `metadata` → klik dokumen `counter` → pastikan ada field `noPerm` dengan value `0` dan type **number** (bukan string!).

> ⚠️ **Jika ini diskip**: Saat petugas gudang klik "Kirim Permintaan", aplikasi akan error `Counter error` dan fallback ke random string. Nomor PR bisa collision (sama dengan PR lain).

---

## 3️⃣ Pasang Firestore Security Rules

Tanpa security rules, **siapa pun bisa baca/tulis data Firestore Anda** — termasuk orang luar yang bukan karyawan. Ini sangat berbahaya.

### Step-by-Step:

1. **Di Firebase Console**, masih di **Firestore Database**
2. **Klik tab "Rules"** (sejajar dengan "Data" dan "Indexes")
3. **Hapus semua isi rules yang default** (biasanya cuma `allow read, write: if false;`)
4. **Copy seluruh isi dari file `firestore-rules.txt`** yang sudah ada di project folder
5. **Paste ke text editor rules di Firebase Console**
6. **Klik "Publish"** (tombol biru di kanan atas)
7. **Tunggu muncul notifikasi "Rules published successfully"**

### Isi rules yang dipasang (ringkasan):
- `users/{uid}` → hanya user itu sendiri yang bisa baca profilnya
- `permintaan/{docId}` → semua user login bisa baca, tapi:
  - Petugas gudang hanya bisa **buat** PR untuk dirinya sendiri
  - Petugas gudang hanya bisa **batalin** PR miliknya sendiri
  - Kepala Gudang hanya bisa **approve/reject** PR yang status `Pending`
  - Manager hanya bisa **approve/reject** PR yang status `Approved1`
  - Pembelian hanya bisa **update** PR yang status `Approved2` → `Purchased` → `Received`
  - Tidak ada yang bisa **delete** PR dari client
- `metadata/counter` → semua user login bisa baca, hanya bisa update field `noPerm`

### ✅ Verifikasi:
Klik tab **"Rules"** lagi, pastikan rules sudah berubah dari default menjadi rules yang Anda paste. Periksa baris pertama ada `rules_version = '2';`.

> ⚠️ **Jika ini diskip**: Data perusahaan (nomor PO, supplier, harga, nama karyawan) bisa diakses dan diubah oleh siapa pun yang punya API key. Ancaman keamanan serius.

---

## 4️⃣ Isi URL Google Apps Script (Opsional tapi Direkomendasikan)

Ini untuk fitur **sinkronisasi otomatis ke Google Sheets**. Kalau belum diisi, fitur sync tidak akan jalan tapi aplikasi tetap bisa dipakai normal.

### Step-by-Step:

1. **Buka file `pembelian.html`** di text editor (VS Code, Notepad, dsb)
2. **Cari baris:**
   ```javascript
   const APPS_SCRIPT_URL = 'GANTI_DENGAN_URL_APPS_SCRIPT_ANDA';
   ```
   Biasanya di sekitar baris 60.
3. **Ganti dengan URL Apps Script deployment Anda:**
   ```javascript
   const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
   ```
4. **Simpan file**

### Cara mendapatkan URL Apps Script (kalau belum punya):
1. Buka Google Sheets baru
2. Klik menu **Extensions → Apps Script**
3. Hapus semua kode default, paste isi `apps-script-sheets.js`
4. Ganti `SPREADSHEET_ID` dengan ID Spreadsheet Anda (ambil dari URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`)
5. Save (Ctrl+S)
6. Klik **Deploy → New deployment**
7. Type: **Web app**
8. Execute as: **Me**
9. Who has access: **Anyone**
10. Klik **Deploy** → copy URL yang muncul

### ✅ Verifikasi:
Buka `pembelian.html`, pastikan baris `APPS_SCRIPT_URL` sudah berisi URL yang dimulai dengan `https://script.google.com/macros/s/...` (bukan `GANTI_DENGAN...`).

> ⚠️ **Jika ini diskip**: Aplikasi tetap jalan normal, tapi tombol "Sync ke Google Sheets" tidak akan berfungsi. Data tetap tersimpan di Firestore, tapi tidak masuk ke Google Sheets.

---

## 5️⃣ Tambahkan User ke Firestore Collection `users` (WAJIB!)

> ⚠️ **Firestore Security Rules sekarang memeriksa role dari `/users/{uid}`**. Tanpa dokumen user di Firestore, rules akan menolak SEMUA operasi approve/reject/beli/terima. Hardcoded list di `firebase-config.js` hanya untuk client-side redirect, **tidak cukup untuk keamanan server-side**.

### Cara 1: Buat Collection `users` di Firestore (WAJIB & Direkomendasikan)

1. **Di Firebase Console**, buka **Firestore Database → Data**
2. **Klik "+ Start collection"**
3. **Collection ID:** `users`
4. **Klik "Auto ID"** atau ketik UID Firebase user (bisa dilihat di **Authentication → Users**)
5. **Tambahkan 3 field:**
   - `role` (string) → `gudang` / `kepala_gudang` / `manager` / `pembelian`
   - `nama` (string) → `Nama Lengkap`
   - `lokasi` (string) → `Gudang A` atau `Semua`
6. **Klik "Save"**
7. **Ulangi untuk setiap karyawan**

### Format dokumen user:
```
users/{uidFirebase}
  role: "gudang"
  nama: "Fadlur Rohman"
  lokasi: "Gudang A"
```

Dengan cara ini, setiap ada karyawan baru cukup tambah dokumen di Firestore Console — **tidak perlu edit file dan deploy ulang**.

### Cara 2: Edit `firebase-config.js` (Hanya untuk Client-Side)

> **Catatan**: Ini hanya mengatur redirect halaman setelah login. **Tidak menggantikan** kebutuhan dokumen `users` di Firestore untuk security rules.

1. **Buka file `firebase-config.js`** di text editor
2. **Cari bagian `USER_ROLES`** (sekitar baris 20-30)
3. **Tambahkan baris baru sesuai format:**
   ```javascript
   const USER_ROLES = {
     // ... user yang sudah ada ...
     "nama@perusahaan.com": { role: "gudang", nama: "Nama Lengkap", lokasi: "Gudang A" },
   };
   ```
4. **Simpan file** dan **deploy ulang**

### ✅ Verifikasi:
1. Buka **Firestore → Data** → pastikan collection `users` ada dan setiap user punya field `role`, `nama`, `lokasi`
2. Setelah deploy, login dengan akun gudang → berhasil masuk ke `gudang.html` dan bisa submit PR
3. Login dengan akun kepala gudang → berhasil masuk ke `approval.html` dan bisa approve/reject
4. Login dengan akun manager → berhasil masuk ke `approval.html` dan bisa approve/reject
5. Login dengan akun pembelian → berhasil masuk ke `pembelian.html` dan bisa proses beli

> ⚠️ **Jika dokumen `users` tidak dibuat**: Semua user bisa login dan lihat data, tapi **tidak bisa melakukan aksi apapun** (approve, beli, terima) karena Firestore rules akan menolak dengan permission denied.

---

## 🚀 Checklist Sebelum Deploy (Print & Centang)

| No | Checklist | Status |
|:---|:---|:---|
| ☐ | Collection `users` sudah dibuat dengan dokumen untuk setiap karyawan (role, nama, lokasi) | |
| ☐ | Index 1: `permintaan` → `petugasUID` (Asc) + `tanggalInput` (Desc) | |
| ☐ | Index 2: `permintaan` → `tanggalInput` (Desc) | |
| ☐ | Dokumen `metadata/counter` dengan field `noPerm = 0` (number) | |
| ☐ | Firestore Security Rules sudah di-publish | |
| ☐ | `APPS_SCRIPT_URL` sudah diisi (opsional) | |
| ☐ | Collection `users` sudah dibuat untuk SEMUA karyawan (role, nama, lokasi) — WAJIB untuk rules | |
| ☐ | Firebase Hosting sudah diinisialisasi (`firebase init hosting`) | |
| ☐ | Deploy sukses (`firebase deploy --only hosting`) | |
| ☐ | URL `https://sipro-perusahaan.web.app` bisa dibuka | |
| ☐ | Login dengan email gudang → berhasil masuk ke gudang.html | |
| ☐ | Login dengan email kepala gudang → berhasil masuk ke approval.html | |
| ☐ | Login dengan email manager → berhasil masuk ke approval.html | |
| ☐ | Login dengan email pembelian → berhasil masuk ke pembelian.html | |

---

*SiPro v2.0 — Pre-Deploy Checklist*
