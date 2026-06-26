// ============================================================
//  GOOGLE APPS SCRIPT — SiPro Sync ke Google Sheets
//  
//  CARA PASANG:
//  1. Buka Google Sheets baru
//  2. Klik menu Extensions → Apps Script
//  3. Hapus semua isi, paste seluruh kode ini
//  4. Klik Save (Ctrl+S)
//  5. Klik Deploy → New deployment
//  6. Type: Web app
//     Execute as: Me
//     Who has access: Anyone
//  7. Klik Deploy → Copy URL yang muncul
//  8. Paste URL tersebut ke file pembelian.html
//     di baris: const APPS_SCRIPT_URL = '...'
// ============================================================

// ID Spreadsheet — ambil dari URL Google Sheets Anda
// https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
const SPREADSHEET_ID = '1HNkSaYLwdjj-L8qparWV2TOHVPhI03v7sUHfFfvnuIM';

// Nama sheet di dalam Spreadsheet
const SHEET_PERMINTAAN = 'Data Permintaan';
const SHEET_REKAP = 'Rekap Bulanan';
const SHEET_DASHBOARD = 'Dashboard';

// ── Header kolom ──
const HEADERS = [
  'No. Permintaan', 'Tanggal Input', 'Lokasi / Gedung', 'Nama Pemohon',
  'Petugas Input', 'Nama Barang', 'Jumlah', 'Satuan', 'Kebutuhan',
  'Keterangan', 'Prioritas', 'Status Akhir',
  'Disetujui Kep. Gudang', 'Disetujui Manager',
  'Supplier', 'No. PO / Invoice', 'Harga Satuan (Rp)', 'Total Harga (Rp)',
  'Tanggal Beli', 'Tanggal Kirim', 'Catatan Kirim',
  'Jml Diterima', 'Tanggal Terima', 'Kondisi Barang', 'Penerima Gudang',
  'Waktu Sync'
];

// ============================================================
//  MAIN: Handle POST request dari web
// ============================================================
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    upsertRow(ss, data);
    updateRekap(ss);
    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Handle GET (untuk test)
function doGet(e) {
  return ContentService
    .createTextOutput('SiPro Apps Script aktif ✓')
    .setMimeType(ContentService.MimeType.TEXT);
}

// ============================================================
//  Upsert baris di sheet Data Permintaan
//  (update jika sudah ada, insert jika baru)
// ============================================================
function upsertRow(ss, data) {
  let sheet = ss.getSheetByName(SHEET_PERMINTAAN);

  // Buat sheet jika belum ada
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_PERMINTAAN);
    setupHeaderRow(sheet);
  }

  // Cek apakah header sudah ada
  if (sheet.getLastRow() === 0) setupHeaderRow(sheet);

  const noPerm = data.noPerm;
  const allData = sheet.getDataRange().getValues();

  // Cari baris yang sudah ada (kolom A = No. Permintaan)
  let existingRow = -1;
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][0] === noPerm) { existingRow = i + 1; break; }
  }

  const row = buildRow(data);

  if (existingRow > 0) {
    // Update baris yang sudah ada
    sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
  } else {
    // Tambah baris baru
    sheet.appendRow(row);
    // Format baris baru
    const lastRow = sheet.getLastRow();
    formatDataRow(sheet, lastRow);
  }
}

// ── Build array baris dari data ──
function buildRow(d) {
  return [
    d.noPerm || '',
    d.tanggalInput || '',
    d.lokasi || '',
    d.requester || '',
    d.petugasInput || '',
    d.namaBarang || '',
    d.jumlah || 0,
    d.satuan || '',
    d.keperluan || '',
    d.keterangan || '',
    d.prioritas || '',
    d.statusAkhir || '',
    d.approvedKepGudang || '',
    d.approvedManager || '',
    d.supplier || '',
    d.noPO || '',
    d.hargaSatuan || 0,
    d.totalHarga || 0,
    d.tglBeli || '',
    d.tglKirim || '',
    d.catatanKirim || '',
    d.jmlDiterima || '',
    d.tglTerima || '',
    d.kondisi || '',
    d.penerima || '',
    new Date().toLocaleString('id-ID'),
  ];
}

// ── Setup header row ──
function setupHeaderRow(sheet) {
  sheet.appendRow(HEADERS);

  // Style header
  const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  headerRange.setBackground('#1a56db');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(10);

  // Freeze header
  sheet.setFrozenRows(1);

  // Auto resize
  sheet.autoResizeColumns(1, HEADERS.length);

  // Set lebar kolom tertentu
  sheet.setColumnWidth(1, 160);  // No. Permintaan
  sheet.setColumnWidth(6, 200);  // Nama Barang
  sheet.setColumnWidth(10, 200); // Keterangan
  sheet.setColumnWidth(21, 200); // Catatan Kirim
}

// ── Format baris data ──
function formatDataRow(sheet, rowNum) {
  // Kolom harga — format rupiah
  sheet.getRange(rowNum, 17).setNumberFormat('#,##0');
  sheet.getRange(rowNum, 18).setNumberFormat('#,##0');

  // Warna alternating row
  if (rowNum % 2 === 0) {
    sheet.getRange(rowNum, 1, 1, HEADERS.length).setBackground('#f8faff');
  }

  // Warna kolom prioritas (kolom 11)
  const prioritas = sheet.getRange(rowNum, 11).getValue();
  const prColor = { 'Low': '#dcfce7', 'Medium': '#dbeafe', 'High': '#fef3c7', 'Urgent': '#fee2e2' };
  if (prColor[prioritas]) sheet.getRange(rowNum, 11).setBackground(prColor[prioritas]);

  // Warna status (kolom 12)
  const status = sheet.getRange(rowNum, 12).getValue();
  const stColor = {
    'Approved2': '#dbeafe', 'Purchased': '#f3e8ff',
    'Received': '#dcfce7', 'Rejected': '#fee2e2',
  };
  if (stColor[status]) sheet.getRange(rowNum, 12).setBackground(stColor[status]);
}

// ============================================================
//  Update Rekap Bulanan
// ============================================================
function updateRekap(ss) {
  let rekapSheet = ss.getSheetByName(SHEET_REKAP);
  if (!rekapSheet) {
    rekapSheet = ss.insertSheet(SHEET_REKAP);
    rekapSheet.appendRow(['Bulan', 'Total Permintaan', 'Disetujui', 'Ditolak', 'Total Pembelian (Rp)', 'Rata-rata (Rp)']);
    const hdr = rekapSheet.getRange(1, 1, 1, 6);
    hdr.setBackground('#057a55'); hdr.setFontColor('#ffffff'); hdr.setFontWeight('bold');
    rekapSheet.setFrozenRows(1);
  }

  const dataSheet = ss.getSheetByName(SHEET_PERMINTAAN);
  if (!dataSheet || dataSheet.getLastRow() < 2) return;

  const data = dataSheet.getRange(2, 1, dataSheet.getLastRow() - 1, HEADERS.length).getValues();

  // ── Parse date string untuk grouping bulan (support berbagai format) ──
  function parseMonthYear(dateStr) {
    if (!dateStr) return null;
    const str = dateStr.toString().trim();

    // Coba parse langsung sebagai Date (ISO, MM/DD/YYYY, dsb)
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${mm}/${yyyy}`;
    }

    // Format Indonesia: "25 Jun 2025" atau "25 Juni 2025"
    const parts = str.split(' ');
    if (parts.length >= 3) {
      const monthMap = {
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'mei': '05', 'jun': '06',
        'jul': '07', 'agu': '08', 'sep': '09', 'okt': '10', 'nov': '11', 'des': '12'
      };
      const m = monthMap[parts[1].toLowerCase().substring(0, 3)];
      if (m) {
        const y = parts[2].substring(0, 4);
        return `${m}/${y}`;
      }
    }

    // Format slash: "25/06/2025" atau "25/6/2025"
    const slashParts = str.split('/');
    if (slashParts.length >= 3) {
      const mm = String(parseInt(slashParts[1])).padStart(2, '0');
      const yyyy = slashParts[2].substring(0, 4);
      return `${mm}/${yyyy}`;
    }

    return null;
  }

  // Group by bulan (dari kolom tanggalInput)
  const byMonth = {};
  data.forEach(row => {
    const tgl = row[1];
    const month = parseMonthYear(tgl);
    if (!month) return;
    if (!byMonth[month]) byMonth[month] = { total: 0, approved: 0, rejected: 0, totalBeli: 0, countBeli: 0 };
    byMonth[month].total++;
    if (['Approved2', 'Purchased', 'Received'].includes(row[11])) byMonth[month].approved++;
    if (row[11] === 'Rejected') byMonth[month].rejected++;
    if (row[17] > 0) { byMonth[month].totalBeli += row[17]; byMonth[month].countBeli++; }
  });

  // Tulis rekap
  rekapSheet.clearContents();
  rekapSheet.appendRow(['Bulan', 'Total Permintaan', 'Disetujui', 'Ditolak', 'Total Pembelian (Rp)', 'Rata-rata (Rp)']);
  const hdr = rekapSheet.getRange(1, 1, 1, 6);
  hdr.setBackground('#057a55'); hdr.setFontColor('#ffffff'); hdr.setFontWeight('bold');

  Object.keys(byMonth).sort().reverse().forEach(month => {
    const m = byMonth[month];
    rekapSheet.appendRow([
      month, m.total, m.approved, m.rejected,
      m.totalBeli, m.countBeli > 0 ? Math.round(m.totalBeli / m.countBeli) : 0
    ]);
  });

  // Format kolom angka
  const lastRow = rekapSheet.getLastRow();
  if (lastRow > 1) {
    rekapSheet.getRange(2, 5, lastRow - 1, 2).setNumberFormat('#,##0');
  }
}

// ============================================================
//  SETUP AWAL — jalankan sekali untuk inisialisasi sheet
//  Cara: buka Apps Script → pilih fungsi setupSheets → klik Run
// ============================================================
function setupSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 1. Data Permintaan
  let sheet = ss.getSheetByName(SHEET_PERMINTAAN);
  if (!sheet) sheet = ss.insertSheet(SHEET_PERMINTAAN);
  sheet.clearContents();
  setupHeaderRow(sheet);

  // 2. Rekap Bulanan
  let rekap = ss.getSheetByName(SHEET_REKAP);
  if (!rekap) rekap = ss.insertSheet(SHEET_REKAP);
  rekap.clearContents();
  rekap.appendRow(['Bulan', 'Total Permintaan', 'Disetujui', 'Ditolak', 'Total Pembelian (Rp)', 'Rata-rata (Rp)']);
  const hdr = rekap.getRange(1, 1, 1, 6);
  hdr.setBackground('#057a55'); hdr.setFontColor('#ffffff'); hdr.setFontWeight('bold');
  rekap.setFrozenRows(1);

  // 3. Dashboard info
  let dash = ss.getSheetByName(SHEET_DASHBOARD);
  if (!dash) dash = ss.insertSheet(SHEET_DASHBOARD);
  dash.clearContents();
  dash.getRange('A1').setValue('SiPro — Sistem Procurement').setFontSize(16).setFontWeight('bold');
  dash.getRange('A2').setValue('Data otomatis tersync dari aplikasi SiPro').setFontColor('#6b7280');
  dash.getRange('A4').setValue('Terakhir diperbarui:');
  dash.getRange('B4').setValue(new Date().toLocaleString('id-ID'));
  dash.getRange('A6').setValue('Lihat sheet "Data Permintaan" untuk data lengkap').setFontColor('#1a56db');

  SpreadsheetApp.getUi().alert('✓ Setup selesai! Sheet sudah siap digunakan.');
}