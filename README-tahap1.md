# Panduan Setup — Tahap 1
# Sistem Procurement (SiPro) — Firebase + Cloudflare Pages

---

## File yang Ada di Tahap Ini

| File               | Fungsi                                      |
|--------------------|---------------------------------------------|
| `firebase-config.js` | Konfigurasi Firebase & daftar user/role   |
| `index.html`        | Halaman login (email & Google)             |
| `gudang.html`       | Form permintaan barang untuk petugas gudang |

---

## LANGKAH 1 — Buat Project Firebase

1. Buka https://console.firebase.google.com
2. Klik **"Add project"** → isi nama project (misal: `sipro-perusahaan`)
3. Nonaktifkan Google Analytics (tidak diperlukan) → klik **"Create project"**
4. Tunggu hingga selesai → klik **"Continue"**

---

## LANGKAH 2 — Aktifkan Firestore Database

1. Di sidebar Firebase, klik **"Firestore Database"**
2. Klik **"Create database"**
3. Pilih **"Start in production mode"** → klik **Next**
4. Pilih region terdekat: **`asia-southeast1` (Singapore)** → klik **Enable**

### Rules Firestore — Salin & paste ini:

Buka tab **"Rules"** di Firestore, hapus semua isi, paste ini:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Permintaan: gudang bisa buat & baca miliknya
    // kepala_gudang, manager, pembelian bisa baca & update semua
    match /permintaan/{docId} {
      allow create: if request.auth != null;
      allow read:   if request.auth != null;
      allow update: if request.auth != null;
    }

  }
}
```

Klik **"Publish"**

---

## LANGKAH 3 — Aktifkan Authentication

1. Di sidebar, klik **"Authentication"** → **"Get started"**
2. Klik tab **"Sign-in method"**
3. Aktifkan **Email/Password** → Enable → Save
4. Aktifkan **Google** → Enable → isi Project support email → Save

### Tambah User Manual:

1. Klik tab **"Users"** → **"Add user"**
2. Tambah satu per satu sesuai daftar di `firebase-config.js`:

   | Email                          | Password (buat sendiri) |
   |-------------------------------|------------------------|
   | gudang1@perusahaan.com        | (min 6 karakter)       |
   | gudang2@perusahaan.com        | (min 6 karakter)       |
   | kepala.gudang@perusahaan.com  | (min 6 karakter)       |
   | manager@perusahaan.com        | (min 6 karakter)       |
   | pembelian@perusahaan.com      | (min 6 karakter)       |

> **Ganti email di atas** sesuai email perusahaan Anda!

---

## LANGKAH 4 — Ambil Konfigurasi Firebase

1. Di sidebar, klik ikon **gear (⚙)** → **"Project settings"**
2. Scroll ke bawah ke bagian **"Your apps"**
3. Klik ikon **`</>`** (Web)
4. Isi App nickname: `sipro-web` → klik **"Register app"**
5. Salin kode `firebaseConfig` yang muncul
6. **Buka file `firebase-config.js`** dan ganti bagian ini:

```javascript
const firebaseConfig = {
  apiKey: "GANTI_API_KEY_ANDA",           // ← ganti
  authDomain: "GANTI_PROJECT_ID...",      // ← ganti
  projectId: "GANTI_PROJECT_ID",          // ← ganti
  storageBucket: "GANTI_PROJECT_ID...",   // ← ganti
  messagingSenderId: "GANTI_SENDER_ID",   // ← ganti
  appId: "GANTI_APP_ID"                   // ← ganti
};
```

---

## LANGKAH 5 — Sesuaikan Data Perusahaan

Buka `firebase-config.js` dan sesuaikan bagian `USER_ROLES`:

```javascript
const USER_ROLES = {
  "emailasli@perusahaan.com": { role: "gudang", nama: "Nama Asli", lokasi: "Gedung A" },
  // tambah semua user di sini
};
```

**Role yang tersedia:**
- `gudang` → akses ke `gudang.html`
- `kepala_gudang` → akses ke `approval.html` (Tahap 2)
- `manager` → akses ke `approval.html` (Tahap 2)
- `pembelian` → akses ke `pembelian.html` (Tahap 3)

Buka `gudang.html` dan sesuaikan **dropdown Lokasi** sesuai gedung/lokasi perusahaan:

```html
<option>Gedung A — Gudang Utama</option>
<option>Gedung B — Gudang Cadangan</option>
<!-- tambah/ubah sesuai kebutuhan -->
```

---

## LANGKAH 6 — Deploy ke Cloudflare Pages

1. Buka https://pages.cloudflare.com → Login/daftar akun Cloudflare
2. Klik **"Create a project"** → **"Direct Upload"**
3. Isi nama project: `sipro` → klik **"Create project"**
4. **Upload semua file** (firebase-config.js, index.html, gudang.html)
5. Klik **"Deploy site"**
6. Selesai! URL Anda akan jadi: `https://sipro.pages.dev`

### Update Cloudflare (jika ada perubahan file):
- Klik project → **"Upload assets"** → upload file yang diubah → Deploy

---

## LANGKAH 7 — Tambahkan Domain Cloudflare ke Firebase

Ini penting agar login Google bisa bekerja dari domain Cloudflare.

1. Di Firebase → **Authentication** → tab **"Settings"**
2. Scroll ke **"Authorized domains"**
3. Klik **"Add domain"** → isi `sipro.pages.dev` (sesuai URL Anda)
4. Klik **"Add"**

---

## STRUKTUR DATA FIRESTORE

Koleksi: `permintaan`
Setiap dokumen (ID = No. Permintaan):

```
{
  noPerm:           "PR-250625-4821"
  lokasi:           "Gedung A — Gudang Utama"
  requester:        "Andi Wijaya"
  namaBarang:       "Kardus Box 40x40"
  jumlah:           100
  satuan:           "Pcs"
  keperluan:        "Operasional Harian"
  keterangan:       "Double layer, coklat"
  prioritas:        "High"
  petugasInput:     "Budi Santoso"
  petugasEmail:     "gudang1@perusahaan.com"
  petugasUID:       "firebase-uid-xxx"
  tanggalInput:     Timestamp
  status:           "Pending"
  statusLabel:      "Menunggu Kepala Gudang"
  approvalKepGudang: null
  approvalManager:   null
  catatanApproval:  ""
  syncedToSheets:   false
}
```

**Alur Status:**
```
Pending → Approved1 → Approved2 → Purchased → Received
         (Kep.Gudang)  (Manager)  (Pembelian)  (Gudang)
         
         Approved1 atau Approved2 bisa → Rejected
```

---

## TEST SETELAH SETUP

1. Buka URL Cloudflare Pages Anda
2. Login dengan salah satu akun gudang
3. Isi form permintaan → klik "Kirim Permintaan"
4. Buka Firebase Console → Firestore → cek koleksi `permintaan`
5. Data harus muncul dengan status "Pending"

---

## SELANJUTNYA

**Tahap 2** akan mencakup:
- `approval.html` — halaman kepala gudang & manager untuk approve/reject
- Notifikasi email saat ada permintaan baru
- Dashboard ringkasan permintaan per status

---

*SiPro v1.0 — Tahap 1 of 3*
