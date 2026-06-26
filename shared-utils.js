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

// ── Pagination helper ──
class Paginator {
  constructor(opts = {}) {
    this.limit = opts.limit || 50;
    this.lastDoc = null;
    this.hasMore = true;
    this.items = [];
    this.onLoad = opts.onLoad || (() => {});
    this.queryFn = opts.queryFn || (() => Promise.resolve([]));
    this.elBtn = opts.elBtn || null;
    this.elInfo = opts.elInfo || null;
  }
  reset() {
    this.lastDoc = null;
    this.hasMore = true;
    this.items = [];
  }
  async loadNext() {
    if (!this.hasMore) return;
    if (this.elBtn) { this.elBtn.disabled = true; this.elBtn.innerHTML = '<span class="spinner"></span> Memuat...'; }
    try {
      let q = this.queryFn(this.limit);
      if (this.lastDoc) q = q.startAfter(this.lastDoc);
      const snap = await q.get();
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (docs.length < this.limit) this.hasMore = false;
      if (docs.length > 0) this.lastDoc = snap.docs[snap.docs.length - 1];
      this.items.push(...docs);
      this.onLoad(this.items, docs);
      if (this.elInfo) this.elInfo.textContent = `Menampilkan ${this.items.length} data`;
      if (this.elBtn) {
        this.elBtn.disabled = false;
        this.elBtn.innerHTML = 'Muat Lebih Banyak';
        this.elBtn.style.display = this.hasMore ? 'flex' : 'none';
      }
    } catch (e) {
      console.error('Pagination error:', e);
      showToast('Gagal memuat data. Coba lagi.', 'error');
      if (this.elBtn) { this.elBtn.disabled = false; this.elBtn.innerHTML = 'Muat Lebih Banyak'; }
    }
  }
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
    // Fallback: timestamp + random
    const ts = String(Date.now()).slice(-6);
    const rnd = String(Math.floor(Math.random() * 900) + 100);
    return `PR-${yy}${mm}${dd}-${ts}${rnd}`;
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
