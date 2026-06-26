# Panduan Setup — Tahap 2 & 3
# Sistem Procurement (SiPro)

---

## File Baru di Tahap Ini

| File                    | Fungsi                                              |
|-------------------------|-----------------------------------------------------|
| `approval.html`         | Dashboard approval kepala gudang & manager          |
| `pembelian.html`        | Dashboard pembelian + konfirmasi penerimaan gudang  |
| `apps-script-sheets.js` | Kode untuk di-paste ke Google Apps Script           |

---

## TAHAP 2 — Halaman Approval

### Yang sudah ada di `approval.html`:

- Dashboard dengan stats (menunggu, disetujui, ditolak, total)
- Tabel semua permintaan dengan filter & search
- Filter: Semua / Perlu Aksi / Selesai
- Modal detail lengkap per permintaan
- Tombol Setujui / Tolak dengan catatan wajib saat tolak
- Riwayat proses approval (log siapa approve/reject kapan)
- Otomatis bedakan tampilan: Kepala Gudang vs Manager

### Alur approval:

```
Petugas Gudang submit
        ↓
Status: Pending
        ↓ (Kepala Gudang login → approval.html)
Approve → Status: Approved1 (menunggu manager)
Reject  → Status: Rejected (selesai)
        ↓ (Manager login → approval.html)
Approve → Status: Approved2 (siap diproses pembelian)
Reject  → Status: Rejected (selesai)
```

### Tidak ada konfigurasi tambahan untuk Tahap 2.
Cukup upload `approval.html` ke Cloudflare Pages (tambahkan ke file yang sudah ada).

---

## TAHAP 3 — Pembelian + Sinkronisasi Google Sheets

### LANGKAH A — Setup Google Sheets & Apps Script

**1. Buat Google Sheets baru:**
- Buka https://sheets.google.com → buat spreadsheet baru
- Beri nama: `SiPro — Data Procurement`
- Salin ID dari URL:
  ```
  https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
                                          ↑ ini yang dicopy
  ```

**2. Buka Apps Script:**
- Di Sheets: klik menu `Extensions` → `Apps Script`
- Hapus semua kode yang ada
- Buka file `apps-script-sheets.js` → salin semua isinya → paste di editor
- Ganti `GANTI_SPREADSHEET_ID_ANDA` dengan ID Sheets Anda
- Klik **Save** (ikon disket atau Ctrl+S)

**3. Jalankan Setup Awal:**
- Di editor Apps Script, pilih fungsi `setupSheets` dari dropdown
- Klik tombol **Run** (▶)
- Izinkan akses jika diminta (klik Review permissions → pilih akun Google → Allow)
- Tunggu hingga muncul popup "✓ Setup selesai!"

**4. Deploy sebagai Web App:**
- Klik **Deploy** → **New deployment**
- Klik ikon gear (⚙) → pilih **Web app**
- Isi konfigurasi:
  ```
  Description      : SiPro Sync v1
  Execute as       : Me
  Who has access   : Anyone
  ```
- Klik **Deploy**
- **Salin URL** yang muncul (bentuknya: `https://script.google.com/macros/s/xxx/exec`)

**5. Paste URL ke `pembelian.html`:**
- Buka file `pembelian.html`
- Cari baris ini di bagian `<script>`:
  ```javascript
  const APPS_SCRIPT_URL = 'GANTI_DENGAN_URL_APPS_SCRIPT_ANDA';
  ```
- Ganti dengan URL yang tadi disalin:
  ```javascript
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/xxx/exec';
  ```
- Upload ulang `pembelian.html` ke Cloudflare Pages

---

### LANGKAH B — Upload Semua File ke Cloudflare Pages

Upload file-file ini (tambahkan ke project Cloudflare yang sudah ada dari Tahap 1):

```
approval.html      ← baru
pembelian.html     ← baru (setelah diisi URL Apps Script)
```

Cara update di Cloudflare:
1. Buka https://pages.cloudflare.com → pilih project `sipro`
2. Klik **Upload assets**
3. Upload `approval.html` dan `pembelian.html`
4. Klik **Deploy**

---

## YANG ADA DI `pembelian.html`

### Tab "Siap Diproses" (status: Approved2)
Permintaan yang sudah disetujui manager, siap dibelikan.
- Klik **Proses Beli** → isi form:
  - Nama Supplier
  - Nomor PO / Invoice
  - Harga Satuan (total otomatis terhitung)
  - Tanggal Beli & Estimasi Tiba
  - Catatan Pembelian
- Simpan → status berubah ke **Purchased**
- Data otomatis sync ke Google Sheets

### Tab "Sudah Dibeli" (status: Purchased)
Barang sudah dibeli, menunggu konfirmasi penerimaan gudang.
- Klik **Konfirmasi Dikirim** → isi form:
  - Jumlah Diterima
  - Tanggal Diterima
  - Kondisi Barang
  - Nama Penerima di Gudang
  - Catatan Penerimaan
- Simpan → status berubah ke **Received** (SELESAI)
- Data otomatis sync ke Google Sheets

### Tombol "Sync ke Google Sheets"
Sinkronisasi manual semua data yang belum tersync.
Data yang sudah tersync ditandai badge hijau ✓.

---

## STRUKTUR GOOGLE SHEETS YANG TERBENTUK

### Sheet 1: "Data Permintaan"
Kolom lengkap:
```
No. Permintaan | Tanggal Input | Lokasi | Nama Pemohon | Petugas Input |
Nama Barang | Jumlah | Satuan | Kebutuhan | Keterangan | Prioritas |
Status Akhir | Disetujui Kep. Gudang | Disetujui Manager |
Supplier | No. PO | Harga Satuan (Rp) | Total Harga (Rp) |
Tanggal Beli | Jml Diterima | Tanggal Terima | Kondisi Barang |
Penerima Gudang | Waktu Sync
```

### Sheet 2: "Rekap Bulanan"
Otomatis dihitung setiap sync:
```
Bulan | Total Permintaan | Disetujui | Ditolak |
Total Pembelian (Rp) | Rata-rata (Rp)
```

### Sheet 3: "Dashboard"
Info ringkas dan timestamp terakhir sync.

---

## ALUR LENGKAP SISTEM

```
[Petugas Gudang]          [Kepala Gudang]       [Manager]
gudang.html               approval.html          approval.html
     │                          │                     │
     │ Submit permintaan         │                     │
     │ ─────────────────────────►                     │
     │                          │ Approve/Reject       │
     │                          │ ─────────────────────►
     │                          │                     │ Approve/Reject
     │                          │                     │
                                                      ▼
                         [Bagian Pembelian]      [Google Sheets]
                          pembelian.html          (Laporan)
                               │                     ▲
                               │ Proses Beli          │
                               │ Konfirmasi Terima    │
                               │ Sync otomatis ───────┘
```

---

## RINGKASAN STATUS

| Status     | Artinya                        | Bisa aksi oleh        |
|------------|--------------------------------|-----------------------|
| Pending    | Menunggu kepala gudang         | Kepala Gudang         |
| Approved1  | Menunggu manager               | Manager               |
| Approved2  | Siap dibelikan                 | Bagian Pembelian      |
| Rejected   | Ditolak (final)                | —                     |
| Purchased  | Sudah dibeli, tunggu terima    | Bagian Pembelian      |
| Received   | Selesai, barang diterima gudang| —                     |

---

## TEST AKHIR

1. Login sebagai gudang → buat permintaan baru
2. Login sebagai kepala_gudang → approve permintaan
3. Login sebagai manager → approve permintaan
4. Login sebagai pembelian → proses beli → isi data pembelian
5. Login sebagai pembelian → konfirmasi terima
6. Cek Google Sheets → data harus muncul otomatis
7. Login sebagai gudang → cek tab Riwayat → status harus "Diterima Gudang"

---

*SiPro v1.0 — Tahap 2 & 3 of 3 — SISTEM LENGKAP*
