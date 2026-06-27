/* ============================================================
   SiPro — Shared Utilities
   ============================================================ */

// ── Format tanggal ──
function formatTgl(d) {
  if (!d || !(d instanceof Date)) return '—';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatTglLong(d) {
  if (!d || !(d instanceof Date)) return '—';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function formatTanggal(d) {
  return formatTgl(d);
}

// ── Format Rupiah ──
function formatRp(n) {
  return 'Rp ' + (n || 0).toLocaleString('id-ID');
}

// ── Badge status ──
function badgeStatus(s) {
  const map = {
    'Pending':   ['badge-pending',   'Menunggu Kep. Gudang'],
    'Approved1': ['badge-approved1', 'Disetujui Kep. Gudang'],
    'Approved2': ['badge-approved2', 'Siap Dibeli'],
    'Rejected':  ['badge-rejected',  'Ditolak'],
    'Purchased': ['badge-purchased', 'Sudah Dibeli'],
    'Received':  ['badge-received',  'Diterima Gudang'],
  };
  const [cls, lbl] = map[s] || ['badge-pending', s];
  return `<span class="badge ${cls}">${lbl}</span>`;
}

// ── Toast ──
let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = '', 3500);
}

// ── Logout ──
function logout() {
  clearUserInfoCache(); // Reset cache & userDoc flag agar user berikutnya auto-create
  auth.signOut().then(() => window.location.href = 'index.html');
}

// ── Offline indicator ──
function initOfflineIndicator() {
  const bar = document.getElementById('offline-bar');
  if (!bar) return;
  const update = () => {
    if (!navigator.onLine) bar.classList.add('show');
    else bar.classList.remove('show');
  };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

// ── Generate No. Permintaan (collision-resistant) ──
async function generateNoPerm() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  // Ambil counter dari Firestore transaction
  const counterRef = db.collection('metadata').doc('counter');
  try {
    const result = await db.runTransaction(async transaction => {
      const doc = await transaction.get(counterRef);
      const current = doc.exists ? (doc.data().noPerm || 0) : 0;
      const next = current + 1;
      transaction.set(counterRef, { noPerm: next }, { merge: true });
      return next;
    });
    return `PR-${yy}${mm}${dd}-${String(result).padStart(4, '0')}`;
  } catch (e) {
    console.error('Counter error:', e);
    // Fallback: timestamp + 6-digit random (jauh lebih aman dari collision)
    const ts = String(Date.now()).slice(-6);
    const rnd = String(Math.floor(Math.random() * 900000) + 100000);
    return `PR-${yy}${mm}${dd}-${ts}-${rnd}`;
  }
}

// ── Set loading button ──
function setBtnLoading(btnId, isLoading, defaultHTML) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = isLoading;
  if (isLoading) {
    btn.innerHTML = '<span class="spinner"></span> Memproses...';
  } else {
    btn.innerHTML = defaultHTML;
  }
}

// ── Escape HTML ──
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Confirm dialog wrapper ──
function confirmDialog(msg) {
  return new Promise(resolve => {
    resolve(window.confirm(msg));
  });
}

// ── Input validation helpers ──
function validateRequired(fields, onError) {
  for (const f of fields) {
    const el = document.getElementById(f.id);
    if (!el || !el.value || el.value.trim() === '') {
      if (onError) onError(el, f.label);
      return false;
    }
  }
  return true;
}
function highlightError(el) {
  if (!el) return;
  el.style.borderColor = 'var(--danger)';
  setTimeout(() => el.style.borderColor = '', 2000);
  el.focus();
}

// ── Init toast & offline on DOM ready ──
document.addEventListener('DOMContentLoaded', () => {
  initOfflineIndicator();
});

/* ============================================================
   SYNC KE GOOGLE SHEETS (Shared)
   → Bisa dipakai dari pembelian.html maupun gudang.html
   ============================================================ */

// Google Apps Script tidak mengirim header CORS pada preflight OPTIONS,
// sehingga fetch biasa selalu diblok browser. Solusi: gunakan mode: 'no-cors'
// langsung. Response akan "opaque" (tidak bisa dibaca), tapi request tetap
// terkirim ke Apps Script dan data masuk ke Sheets.
// Content-Type harus 'text/plain' agar request dianggap "simple" (no preflight).
async function syncSingleToSheets(doc) {
  const url = (typeof window !== 'undefined' && window.APPS_SCRIPT_URL) || '';
  if (!url || url.includes('GANTI') || url === 'GANTI_DENGAN_URL_APPS_SCRIPT_ANDA') {
    console.warn('[syncSingleToSheets] APPS_SCRIPT_URL belum diisi');
    return;
  }
  if (!doc) return;

  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(buildSheetRow(doc)),
    });
    // Dengan no-cors kita tidak bisa baca response, asumsikan sukses jika tidak throw
    await db.collection('permintaan').doc(doc.id).update({ syncedToSheets: true });
    console.log('[syncSingleToSheets] ✓ Sync terkirim:', doc.noPerm);
  } catch (e) {
    console.error('[syncSingleToSheets] ✗ Gagal:', e);
  }
}

async function syncAllToSheets(docs) {
  const url = (typeof window !== 'undefined' && window.APPS_SCRIPT_URL) || '';
  if (!url || url.includes('GANTI') || url === 'GANTI_DENGAN_URL_APPS_SCRIPT_ANDA') {
    console.warn('[syncAllToSheets] APPS_SCRIPT_URL belum diisi');
    return;
  }
  const toSync = docs.filter(d => !d.syncedToSheets && ['Purchased','Received'].includes(d.status));
  if (!toSync.length) { console.log('[syncAllToSheets] Semua data sudah tersync'); return; }

  console.log('[syncAllToSheets] Syncing', toSync.length, 'items...');
  let ok = 0;
  for (const doc of toSync) {
    try {
      await fetch(url, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(buildSheetRow(doc)),
      });
      await db.collection('permintaan').doc(doc.id).update({ syncedToSheets: true });
      ok++;
    } catch (e) { console.error('[syncAllToSheets] Item gagal:', doc.noPerm, e); }
  }
  console.log('[syncAllToSheets] ✓', ok, 'data berhasil disync');
}

function buildSheetRow(d) {
  return {
    noPerm:         d.noPerm,
    tanggalInput:   d.tanggalInput?.toDate ? formatTgl(d.tanggalInput.toDate()) : '',
    lokasi:         d.lokasi,
    requester:      d.requester,
    petugasInput:   d.petugasInput,
    namaBarang:     d.namaBarang,
    jumlah:         d.jumlah,
    satuan:         d.satuan,
    keperluan:      d.keperluan,
    keterangan:     d.keterangan,
    prioritas:      d.prioritas,
    statusAkhir:    d.status,
    approvedKepGudang: d.approvalKepGudang?.nama || '',
    approvedManager:   d.approvalManager?.nama   || '',
    supplier:       d.pembelian?.supplier   || '',
    noPO:           d.pembelian?.noPO       || '',
    hargaSatuan:    d.pembelian?.hargaSatuan || 0,
    totalHarga:     d.pembelian?.totalHarga  || 0,
    tglBeli:        d.pembelian?.tglBeli     || '',
    tglKirim:       d.pengiriman?.tglKirim   || '',
    catatanKirim:   d.pengiriman?.catatanKirim || '',
    jmlDiterima:    d.penerimaan?.jumlahDiterima || '',
    tglTerima:      d.penerimaan?.tglTerima      || '',
    kondisi:        d.penerimaan?.kondisi         || '',
    penerima:       d.penerimaan?.penerima        || '',
  };
}
