# SiPro — Sistem Procurement Internal

Aplikasi web internal untuk mengelola alur permintaan barang: **Gudang → Kepala Gudang → Manager → Pembelian → Gudang**.

---

## 📁 Struktur File

```
sipro-main/
├── index.html              # Halaman login (Email/Password & Google)
├── gudang.html             # Form permintaan barang + riwayat + batal PR
├── approval.html           # Dashboard approval (Kepala Gudang & Manager)
├── pembelian.html          # Dashboard pembelian + penerimaan + sync Sheets
├── firebase-config.js      # Inisialisasi Firebase + helper auth
├── shared-style.css        # Semua style CSS yang dipakai bersama
├── shared-utils.js         # Helper JS (format, badge, toast, pagination, dsb)
├── apps-script-sheets.js   # Google Apps Script untuk sinkronisasi ke Sheets
├── firestore-rules.txt     # Security Rules untuk Firestore
└── README.md               # Dokumentasi ini
```

---

## 🚀 Cara Deploy

### 1. Buat Project Firebase

1. Buka [Firebase Console](https://console.firebase.google.com/)
2. Buat project baru → aktifkan **Authentication** (Email/Password & Google) dan **Firestore Database**
3. Ambil config → paste ke `firebase-config.js`
4. Tambahkan user & role di `firebase-config.js` atau buat collection `users` di Firestore

### 2. Setup Firestore Database

#### Buat Collection `users` (opsional, jika ingin manajemen user via Firestore)

```
users/{uid}
  role: "gudang" | "kepala_gudang" | "manager" | "pembelian"
  nama: "Nama Lengkap"
  lokasi: "Gudang A"
```

#### Buat Collection `permintaan`

Dokumen akan otomatis dibuat oleh aplikasi. Struktur data:

```
permintaan/{noPerm}
  noPerm: "PR-250625-0001"
  lokasi: "Gedung 1 — Gudang Kalipucang"
  requester: "Nama Pemohon"
  namaBarang: "Nama Barang"
  jumlah: 10
  satuan: "Pcs"
  keperluan: "Operasional Harian"
  keterangan: ""
  prioritas: "Medium"
  petugasInput: "Nama Petugas"
  petugasEmail: "email@perusahaan.com"
  petugasUID: "uidFirebase"
  tanggalInput: Timestamp
  status: "Pending" | "Approved1" | "Approved2" | "Rejected" | "Purchased" | "Received"
  statusLabel: "..."
  approvalKepGudang: { keputusan, nama, email, catatan, waktu }
  approvalManager: { keputusan, nama, email, catatan, waktu }
  catatanApproval: ""
  syncedToSheets: false
  pembelian: { supplier, noPO, hargaSatuan, totalHarga, tglBeli, estimasiTiba, catatanBeli, oleh, waktu }
  penerimaan: { jumlahDiterima, tglTerima, kondisi, penerima, catatanTerima, waktu }
```

#### Buat Document `metadata/counter` (untuk No. Permintaan)

```
metadata/counter
  noPerm: 0
```

Dokumen ini akan auto-increment saat petugas membuat PR baru.

### 3. Pasang Firestore Security Rules

Buka **Firebase Console → Firestore Database → Rules**, lalu paste isi `firestore-rules.txt`.

> ⚠️ Rules ini membatasi siapa yang boleh mengubah data berdasarkan role. Pastikan semua user sudah tercatat di `firebase-config.js` atau collection `users`.

### 4. Setup Composite Index

Buka **Firebase Console → Firestore Database → Indexes**, lalu buat index composite:

| Collection | Fields | Query Scope |
|---|---|---|
| `permintaan` | `petugasUID` (Ascending), `tanggalInput` (Descending) | Collection |
| `permintaan` | `status` (Ascending), `tanggalInput` (Descending) | Collection |

> Tanpa index ini, query riwayat dan filter status akan error.

### 5. Setup Google Apps Script (Sync ke Sheets)

1. Buat Google Sheets baru
2. Buka **Extensions → Apps Script**
3. Hapus semua isi, paste `apps-script-sheets.js`
4. Ganti `SPREADSHEET_ID` dengan ID Spreadsheet Anda
5. Simpan → Deploy → New deployment → Web app
   - Execute as: Me
   - Who has access: Anyone
6. Copy URL deployment → paste ke `pembelian.html` baris `const APPS_SCRIPT_URL = '...'`

---

## 🔄 Flow Status

```
┌──────────┐     ┌─────────────────┐     ┌──────────┐     ┌───────────┐     ┌──────────┐
│  GUDANG  │────→│ KEPALA GUDANG   │────→│ MANAGER  │────→│ PEMBELIAN │────→│  GUDANG  │
│  (Input) │     │ (Approve/Tolak) │     │(Approve) │     │ (Beli)    │     │ (Terima) │
└──────────┘     └─────────────────┘     └──────────┘     └───────────┘     └──────────┘
     │                 │                      │                  │                 │
  Pending          Approved1               Approved2          Purchased         Received
     │                 │                      │                  │                 │
   Rejected ←─────── Rejected ←────────── Rejected           (bisa tolak)     (bisa tolak)
```

Petugas Gudang juga bisa **membatalkan** PR-nya sendiri selama status masih `Pending`.

---

## 🛠️ Fitur yang Sudah Diperbaiki

| Perbaikan | Detail |
|---|---|
| **Shared CSS & JS** | Duplikasi style & utility dihapus, dipindah ke `shared-style.css` dan `shared-utils.js` |
| **No. Permintaan** | Dari random string → Firestore transaction counter, anti-collision |
| **Batal/Cancel PR** | Petugas gudang bisa membatalkan PR sendiri yang masih Pending |
| **Escape HTML** | Input & output di-escape untuk mencegah XSS |
| **Pagination** | Query dibatasi 50 dokumen terakhir + info jumlah data |
| **Offline Support** | Firestore persistence diaktifkan + offline indicator bar |
| **Sync Sheets** | Gunakan `no-cors` karena keterbatasan CORS Apps Script; status sync menggunakan `syncedToSheets` flag |
| **NoScript** | Halaman tetap menampilkan pesan jika JavaScript dimatikan |
| **Security Rules** | Role-based access control untuk create, read, update |
| **Form Validation** | Helper `validateRequired` + `highlightError` dari shared utils |
| **Auth Guard** | `requireAuth()` helper + cache user info untuk performa |

---

## 📱 Tech Stack

- **Frontend**: Vanilla HTML + CSS + JS (no framework)
- **Backend**: Firebase (Auth + Firestore)
- **Integration**: Google Apps Script → Google Sheets
- **Deployment**: Firebase Hosting / Netlify / Vercel / shared hosting biasa

---

## ⚠️ Catatan Penting

- **File `firebase-config.js` sudah berisi config asli**. Jika project berbeda, ganti dengan config Anda sendiri.
- **User & role sekarang WAJIB ada di Firestore collection `users`**. Firestore Security Rules baru memeriksa role dari `/users/{uid}`, bukan dari hardcoded list. Pastikan semua user sudah didaftarkan di Firestore sebelum deploy. Hardcoded list di `firebase-config.js` hanya untuk client-side redirect.
- **Google Apps Script URL** harus diisi manual di `pembelian.html`.
- **Composite Index** wajib dibuat di Firebase Console agar query tidak error.
- **Semua file HTML** sekarang mengandalkan `shared-style.css` dan `shared-utils.js`. Jangan lupa upload ketiga file tersebut bersama HTML.

---

*SiPro v2.0 — Diperbaiki & Ditingkatkan*
