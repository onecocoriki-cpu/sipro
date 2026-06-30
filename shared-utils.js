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
    'Partial':   ['badge-partial',   'Dibeli Sebagian'],
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

/* ============================================================
   PAGINATION HELPER (Cocoriki-style)
   ============================================================ */

function paginateData(data, pageSize = 10, page = 1) {
  const total = data.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  return {
    data: data.slice(start, end),
    total,
    totalPages,
    currentPage,
    start: start + 1,
    end: Math.min(end, total),
    pageSize,
  };
}

function renderPagination(containerId, totalPages, currentPage, onChange) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  let html = '<div class="pagination-controls">';
  // Prev
  html += `<button class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}" onclick="${onChange}(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>←</button>`;

  // Pages
  const maxVisible = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  if (startPage > 1) {
    html += `<button class="pagination-btn" onclick="${onChange}(1)">1</button>`;
    if (startPage > 2) html += '<span class="pagination-btn ellipsis">…</span>';
  }
  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="${onChange}(${i})">${i}</button>`;
  }
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += '<span class="pagination-btn ellipsis">…</span>';
    html += `<button class="pagination-btn" onclick="${onChange}(${totalPages})">${totalPages}</button>`;
  }

  // Next
  html += `<button class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}" onclick="${onChange}(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>→</button>`;
  html += '</div>';
  container.innerHTML = html;
}

/* ============================================================
   SEARCH HELPER
   ============================================================ */
function filterData(data, query, fields) {
  if (!query || !query.trim()) return data;
  const q = query.toLowerCase().trim();
  return data.filter(d => {
    const text = fields.map(f => {
      // Support nested fields like 'pembelian.supplier'
      let val = d;
      const parts = f.split('.');
      for (const part of parts) {
        if (val == null) break;
        val = val[part];
      }
      if (val == null) return '';
      if (typeof val === 'string') return val;
      if (val instanceof Date) return val.toLocaleDateString('id-ID');
      if (val.toDate) return val.toDate().toLocaleDateString('id-ID');
      return String(val);
    }).join(' ').toLowerCase();
    return text.includes(q);
  });
}

/* ============================================================
   PRINT HELPER
   ============================================================ */
function openPrintPage(docId) {
  if (!docId) return;
  const url = `print.html?id=${encodeURIComponent(docId)}`;
  window.open(url, '_blank', 'width=900,height=700,scrollbars=yes');
}

/* ============================================================
   MINI PROJECT HELPER
   ============================================================ */
function getTypeBadge(type) {
  if (type === 'project') return '<span class="badge badge-project">🔧 Project</span>';
  return '<span class="badge badge-request">📋 Request</span>';
}

/* ============================================================
   DATE PARSER HELPER
   ============================================================ */
function parseFirestoreDate(val) {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function formatDateInput(d) {
  if (!d || !(d instanceof Date)) return '';
  return d.toISOString().split('T')[0];
}

/* ============================================================
   AUTO SYNC HELPER
   ============================================================ */
async function autoSyncAfterUpdate(docId) {
  const url = (typeof window !== 'undefined' && window.APPS_SCRIPT_URL) || '';
  if (!url || url.includes('GANTI') || url === 'GANTI_DENGAN_URL_APPS_SCRIPT_ANDA') {
    console.warn('[AutoSync] APPS_SCRIPT_URL belum diisi, skip sync');
    return;
  }

  setTimeout(async () => {
    try {
      const docSnap = await db.collection('permintaan').doc(docId).get();
      if (!docSnap.exists) { console.warn('[AutoSync] Dokumen tidak ditemukan'); return; }
      const doc = { id: docSnap.id, ...docSnap.data() };
      if (doc.syncedToSheets) { console.log('[AutoSync] Dokumen sudah tersync, skip'); return; }

      console.log('[AutoSync] Memulai sync untuk:', doc.noPerm);
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(buildSheetRow(doc)),
      });
      await db.collection('permintaan').doc(docId).update({ syncedToSheets: true });
      console.log('[AutoSync] ✓ Sync sukses:', doc.noPerm);
      showToast('✓ Data tersync ke Google Sheets', 'success');
    } catch (e) { console.error('[AutoSync] ✗ Gagal sync:', e); }
  }, 1500);
}
