/* ============================================================
   SiPro — Firebase Config & Helpers
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyCZWGsc734tAQLGPgftLT5Pbxgqug4N_XE",
  authDomain: "sipro-perusahaan.firebaseapp.com",
  projectId: "sipro-perusahaan",
  storageBucket: "sipro-perusahaan.firebasestorage.app",
  messagingSenderId: "1048868048718",
  appId: "1:1048868048718:web:f99edd62bb80b78167981f"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence — Firebase compat SDK v9
// { synchronizeTabs: true } = multi-tab support
db.enablePersistence({ synchronizeTabs: true }).catch(err => {
  if (err.code === 'failed-precondition') {
    console.warn('Firestore persistence: tab lain sudah aktif, lanjut tanpa persistence');
  } else if (err.code === 'unimplemented') {
    console.warn('Firestore persistence: browser tidak mendukung IndexedDB');
  }
});

/* ============================================================
   DAFTAR USER & ROLE
   ============================================================ */
const USER_ROLES = {
  "gudang1@perusahaan.com": { role: "gudang", nama: "Fadlur Rohman", lokasi: "Gudang A" },
  "gudang3@perusahaan.com": { role: "gudang", nama: "Sobikhul Mubarok", lokasi: "Gudang B" },
  "kepala.gudang1@perusahaan.com": { role: "kepala_gudang", nama: "Amin Bagus Q", lokasi: "Semua" },
  "kepala.gudang3@perusahaan.com": { role: "kepala_gudang", nama: "Idran Yusuf", lokasi: "Semua" },
  "manager@perusahaan.com": { role: "manager", nama: "Dewi Lestari", lokasi: "Semua" },
  "pembelian@perusahaan.com": { role: "pembelian", nama: "Rizky Pratama", lokasi: "Semua" },
};

// Cache user info untuk session ini
let __currentUserInfoCache = null;

function clearUserInfoCache() {
  __currentUserInfoCache = null;
}

/* ============================================================
   Auto-init dokumen users/{uid} di Firestore
   → SELALU cek dan buat jika belum ada
   → Dipanggil di awal setiap halaman setelah login
   ============================================================ */
async function ensureUserDoc() {
  const user = auth.currentUser;
  if (!user) {
    console.warn('[ensureUserDoc] Tidak ada user yang login');
    return;
  }

  const local = USER_ROLES[user.email];
  if (!local) {
    console.warn('[ensureUserDoc] Email', user.email, 'tidak terdaftar di USER_ROLES');
    return;
  }

  console.log('[ensureUserDoc] Cek users/' + user.uid);

  try {
    // Coba baca dari server (bukan cache) untuk memastikan dokumen sudah tersinkron
    let doc;
    try {
      doc = await db.collection('users').doc(user.uid).get({ source: 'server' });
      console.log('[ensureUserDoc] Server read OK');
    } catch (serverErr) {
      // Kalau gagal baca server (offline), fallback ke cache
      console.warn('[ensureUserDoc] Server read gagal, pakai cache:', serverErr.message);
      doc = await db.collection('users').doc(user.uid).get();
    }

    if (!doc.exists) {
      console.log('[ensureUserDoc] Dokumen belum ada, membuat...');
      await db.collection('users').doc(user.uid).set({
        role: local.role,
        nama: local.nama,
        lokasi: local.lokasi,
      });
      console.log('[ensureUserDoc] ✓ Berhasil membuat users/' + user.uid);
    } else {
      console.log('[ensureUserDoc] ✓ Dokumen sudah ada');
    }
  } catch (e) {
    console.error('[ensureUserDoc] ✗ GAGAL:', e.code, e.message);
    console.error('[ensureUserDoc]   → Pastikan Firestore Rules sudah di-publish dengan allow create di users/{uid}');
  }
}

/* ============================================================
   Ambil info user yang sedang login
   ============================================================ */
async function getCurrentUserInfo() {
  if (__currentUserInfoCache) return __currentUserInfoCache;
  const user = auth.currentUser;
  if (!user) return null;

  const local = USER_ROLES[user.email];

  // Coba baca dari Firestore
  try {
    const doc = await db.collection('users').doc(user.uid).get();
    if (doc.exists) {
      const data = doc.data();
      __currentUserInfoCache = {
        uid: user.uid,
        email: user.email,
        role: data.role || 'gudang',
        nama: data.nama || user.email,
        lokasi: data.lokasi || '-',
      };
      return __currentUserInfoCache;
    }
  } catch (e) {
    console.error('getCurrentUserInfo Firestore error:', e);
  }

  // Fallback: user tidak terdaftar di daftar lokal
  __currentUserInfoCache = { uid: user.uid, email: user.email, role: 'gudang', nama: user.email, lokasi: '-' };
  return __currentUserInfoCache;
}

/* ============================================================
   Redirect ke halaman sesuai role
   ============================================================ */
function redirectByRole(role) {
  const pages = {
    gudang: 'gudang.html',
    kepala_gudang: 'approval.html',
    manager: 'approval.html',
    pembelian: 'pembelian.html',
  };
  window.location.href = pages[role] || 'gudang.html';
}

/* ============================================================
   Auth guard helper
   ============================================================ */
async function requireAuth(allowedRoles) {
  return new Promise(resolve => {
    const unsubscribe = auth.onAuthStateChanged(async user => {
      unsubscribe(); // Unsubscribe agar tidak memory leak
      if (!user) { resolve(null); return; }
      const info = await getCurrentUserInfo();
      if (!info || (allowedRoles && !allowedRoles.includes(info.role))) {
        resolve(null); return;
      }
      resolve(info);
    });
  });
}
