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

// Enable offline persistence (multi-tab, menggunakan API baru)
// Catatan: db.settings() harus dipanggil SEBELUM operasi Firestore apapun
try {
  db.settings({
    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
  });
  db.enableMultiTabIndexedDbPersistence().catch(err => {
    if (err.code === 'failed-precondition') {
      // Fallback: single-tab persistence jika multi-tab tidak bisa
      db.enablePersistence().catch(() => {});
      console.warn('Firestore: fallback ke single-tab persistence');
    } else if (err.code === 'unimplemented') {
      console.warn('Firestore persistence: browser tidak mendukung IndexedDB');
    }
  });
} catch (e) {
  console.warn('Firestore persistence error:', e);
}

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

/* ============================================================
   Ambil info user yang sedang login
   ============================================================ */
async function getCurrentUserInfo() {
  if (__currentUserInfoCache) return __currentUserInfoCache;
  const user = auth.currentUser;
  if (!user) return null;

  // Cek di daftar lokal dulu
  const local = USER_ROLES[user.email];
  if (local) {
    __currentUserInfoCache = { uid: user.uid, email: user.email, ...local };
    return __currentUserInfoCache;
  }

  // Fallback: cek Firestore collection users
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

  // Default fallback
  __currentUserInfoCache = { uid: user.uid, email: user.email, role: 'gudang', nama: user.email, lokasi: '-' };
  return __currentUserInfoCache;
}

function clearUserInfoCache() {
  __currentUserInfoCache = null;
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
    auth.onAuthStateChanged(async user => {
      if (!user) { resolve(null); return; }
      const info = await getCurrentUserInfo();
      if (!info || (allowedRoles && !allowedRoles.includes(info.role))) {
        resolve(null); return;
      }
      resolve(info);
    });
  });
}

