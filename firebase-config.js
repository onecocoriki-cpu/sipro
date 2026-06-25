// ============================================================
//  FIREBASE CONFIG — ganti dengan config project Anda
//  Cara ambil: Firebase Console → Project Settings → Your apps
// ============================================================
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

// ============================================================
//  DAFTAR USER & ROLE — tambah/ubah sesuai pegawai Anda
//  role: "gudang" | "kepala_gudang" | "manager" | "pembelian"
// ============================================================
const USER_ROLES = {
  "gudang1@perusahaan.com": { role: "gudang", nama: "Fadlur Rohman", lokasi: "Gudang A" },
  "gudang3@perusahaan.com": { role: "gudang", nama: "Sobikhul Mubarok", lokasi: "Gudang B" },
  "kepala.gudang1@perusahaan.com": { role: "kepala_gudang", nama: "Amin Bagus Q", lokasi: "Semua" },
  "kepala.gudang3@perusahaan.com": { role: "kepala_gudang", nama: "Idran Yusuf", lokasi: "semua" },
  "manager@perusahaan.com": { role: "manager", nama: "Dewi Lestari", lokasi: "Semua" },
  "pembelian@perusahaan.com": { role: "pembelian", nama: "Rizky Pratama", lokasi: "Semua" },
};

// Ambil info user yang sedang login
async function getCurrentUserInfo() {
  const user = auth.currentUser;
  if (!user) return null;
  const info = USER_ROLES[user.email] || { role: "gudang", nama: user.email, lokasi: "-" };
  return { uid: user.uid, email: user.email, ...info };
}

// Redirect ke halaman sesuai role
function redirectByRole(role) {
  const pages = {
    gudang: "gudang.html",
    kepala_gudang: "approval.html",
    manager: "approval.html",
    pembelian: "pembelian.html",
  };
  window.location.href = pages[role] || "gudang.html";
}
