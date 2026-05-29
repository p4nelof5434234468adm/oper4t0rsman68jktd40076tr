/* ════════════════════════════════════════════════════════════
   operator-aduan-penmurmut.js
   Dashboard Operator — Aduan Penmurmut, SMAN 68 Jakarta
   ════════════════════════════════════════════════════════════ */

"use strict";

/* ──────────────────────────────────────────
   1. FIREBASE INITIALIZATION
────────────────────────────────────────── */
const firebaseConfig = {
  apiKey:            "AIzaSyDAcKcg3alPOTH3FFGelYmsW7jcMMe2PLI",
  authDomain:        "upnvjdatsystem.firebaseapp.com",
  projectId:         "upnvjdatsystem",
  storageBucket:     "upnvjdatsystem.firebasestorage.app",
  messagingSenderId: "57095309946",
  appId:             "1:57095309946:web:b0e9f3f86380d549ffc9c3"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db   = firebase.firestore();

/* ──────────────────────────────────────────
   2. DOM REFERENCES
────────────────────────────────────────── */

/* Screens */
const loginScreen   = document.getElementById("loginScreen");
const dashboardWrap = document.getElementById("dashboardWrap");

/* Login form */
const loginForm       = document.getElementById("loginForm");
const loginEmailInput = document.getElementById("loginEmail");
const loginPwInput    = document.getElementById("loginPassword");
const loginEmailErr   = document.getElementById("loginEmailErr");
const loginPwErr      = document.getElementById("loginPwErr");
const loginGlobalErr  = document.getElementById("loginGlobalErr");
const btnLogin        = document.getElementById("btnLogin");
const btnTogglePw     = document.getElementById("btnTogglePw");
const eyeIcon         = document.getElementById("eyeIcon");

/* Top nav */
const navUserName   = document.getElementById("navUserName");
const navUserAvatar = document.getElementById("navUserAvatar");
const btnLogout     = document.getElementById("btnLogout");

/* Header */
const headerDate = document.getElementById("headerDate");

/* Stats */
const valTotal   = document.getElementById("valTotal");
const valPending = document.getElementById("valPending");
const valSelesai = document.getElementById("valSelesai");

/* Table */
const searchInput      = document.getElementById("searchInput");
const searchClear      = document.getElementById("searchClear");
const filterStatus     = document.getElementById("filterStatus");
const tableBody        = document.getElementById("tableBody");
const emptyState       = document.getElementById("emptyState");
const tableLoading     = document.getElementById("tableLoading");
const rowCountDisplay  = document.getElementById("rowCountDisplay");

/* Modal */
const modalOverlay        = document.getElementById("modalOverlay");
const modalCloseBtn       = document.getElementById("modalCloseBtn");
const modalNoAduanDisplay = document.getElementById("modalNoAduanDisplay");

/* Modal detail fields */
const dNoPendaftaran = document.getElementById("dNoPendaftaran");
const dNama          = document.getElementById("dNama");
const dEmail         = document.getElementById("dEmail");
const dWhatsapp      = document.getElementById("dWhatsapp");
const dWhatsappText  = document.getElementById("dWhatsappText");
const dKategori      = document.getElementById("dKategori");
const dCreatedAt     = document.getElementById("dCreatedAt");
const dDetail        = document.getElementById("dDetail");
const dLinkBukti     = document.getElementById("dLinkBukti");
const dLinkBuktiText = document.getElementById("dLinkBuktiText");
const sectionBukti   = document.getElementById("sectionBukti");
const noBuktiNote    = document.getElementById("noBuktiNote");

/* Modal response */
const responseText   = document.getElementById("responseText");
const respCharCount  = document.getElementById("respCharCount");
const statusSelect   = document.getElementById("statusSelect");
const btnSaveResponse= document.getElementById("btnSaveResponse");

/* Template buttons */
const tplBtns = document.querySelectorAll(".tpl-btn");

/* Toast */
const toastContainer = document.getElementById("toastContainer");

/* ──────────────────────────────────────────
   3. STATE
────────────────────────────────────────── */
let allAduan    = [];          // all docs from Firestore snapshot
let activeDocId = null;        // Firestore document ID currently open in modal
let unsubSnapshot = null;      // onSnapshot unsubscribe fn

/* Template texts */
const TEMPLATES = {
  approve: "Aduan/sanggahan Anda telah diterima dan diverifikasi oleh tim mutasi. Silakan datang ke sekolah pada hari kerja berikutnya membawa berkas fisik asli untuk verifikasi akhir.",
  drive:   "Sanggahan belum dapat diproses karena link bukti Google Drive yang Anda lampirkan masih terkunci (akses privat). Mohon ubah pengaturan berbagi link menjadi 'Siapa saja yang memiliki link' lalu ajukan kembali.",
  reject:  "Setelah dilakukan peninjauan ulang terhadap nilai rapor dan kuota kelas, sanggahan Anda dengan hormat kami tolak karena belum memenuhi kriteria regulasi mutasi tahun ini."
};

/* ──────────────────────────────────────────
   4. UTILITY FUNCTIONS
────────────────────────────────────────── */

/**
 * Escape HTML to prevent XSS
 */
function esc(str) {
  if (typeof str !== "string") return str ?? "—";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Format Firestore Timestamp to locale string
 */
function fmtTimestamp(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

/**
 * Format date for table row (shorter)
 */
function fmtDateShort(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Normalize WA number to international format for wa.me link
 */
function normalizeWA(num) {
  if (!num) return null;
  let n = num.replace(/[\s\-().]/g, "");
  if (n.startsWith("0")) n = "62" + n.slice(1);
  if (n.startsWith("+")) n = n.slice(1);
  return n;
}

/**
 * Show/hide element by toggling .d-none
 */
function show(el) { el && el.classList.remove("d-none"); }
function hide(el) { el && el.classList.add("d-none"); }

/* ──────────────────────────────────────────
   5. TOAST SYSTEM
────────────────────────────────────────── */

/**
 * Show a toast notification.
 * @param {'success'|'error'|'info'|'warning'} type
 * @param {string} title
 * @param {string} [message]
 * @param {number} [duration=4000]
 */
function showToast(type = "info", title = "", message = "", duration = 4000) {
  const icons = {
    success: "fas fa-circle-check",
    error:   "fas fa-circle-xmark",
    info:    "fas fa-circle-info",
    warning: "fas fa-triangle-exclamation",
  };

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="${icons[type] || icons.info} toast-ico"></i>
    <div class="toast-body">
      <div class="toast-title">${esc(title)}</div>
      ${message ? `<div class="toast-msg">${esc(message)}</div>` : ""}
    </div>
    <button class="toast-x" aria-label="Tutup">
      <i class="fas fa-xmark"></i>
    </button>
  `;

  const dismiss = () => {
    toast.classList.add("hide");
    setTimeout(() => toast.remove(), 320);
  };

  toast.querySelector(".toast-x").addEventListener("click", dismiss);
  toastContainer.appendChild(toast);
  setTimeout(dismiss, duration);
}

/* ──────────────────────────────────────────
   6. SET HEADER DATE
────────────────────────────────────────── */
function setHeaderDate() {
  const now = new Date();
  headerDate.textContent = now.toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });
}

/* ──────────────────────────────────────────
   7. AUTHENTICATION
────────────────────────────────────────── */

/* Toggle password visibility */
btnTogglePw.addEventListener("click", () => {
  const isPw = loginPwInput.type === "password";
  loginPwInput.type = isPw ? "text" : "password";
  eyeIcon.className  = isPw ? "fas fa-eye-slash" : "fas fa-eye";
});

/* Clear inline login errors on input */
loginEmailInput.addEventListener("input", () => {
  loginEmailErr.textContent  = "";
  loginGlobalErr.textContent = "";
  loginEmailInput.classList.remove("error");
});

loginPwInput.addEventListener("input", () => {
  loginPwErr.textContent     = "";
  loginGlobalErr.textContent = "";
  loginPwInput.classList.remove("error");
});

/* Toggle login button loading state */
function setLoginLoading(loading) {
  const textEl    = btnLogin.querySelector(".btn-login-text");
  const loadingEl = btnLogin.querySelector(".btn-login-loading");
  btnLogin.disabled = loading;
  loading ? hide(textEl)    : show(textEl);
  loading ? show(loadingEl) : hide(loadingEl);
}

/* Login form submit */
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  /* Reset errors */
  loginEmailErr.textContent  = "";
  loginPwErr.textContent     = "";
  loginGlobalErr.textContent = "";
  loginEmailInput.classList.remove("error");
  loginPwInput.classList.remove("error");

  const email    = loginEmailInput.value.trim();
  const password = loginPwInput.value;

  /* Basic local validation */
  let hasErr = false;
  if (!email) {
    loginEmailErr.textContent = "Email wajib diisi.";
    loginEmailInput.classList.add("error");
    hasErr = true;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    loginEmailErr.textContent = "Format email tidak valid.";
    loginEmailInput.classList.add("error");
    hasErr = true;
  }

  if (!password) {
    loginPwErr.textContent = "Kata sandi wajib diisi.";
    loginPwInput.classList.add("error");
    hasErr = true;
  } else if (password.length < 6) {
    loginPwErr.textContent = "Kata sandi minimal 6 karakter.";
    loginPwInput.classList.add("error");
    hasErr = true;
  }

  if (hasErr) return;

  setLoginLoading(true);

  try {
    await auth.signInWithEmailAndPassword(email, password);
    /* onAuthStateChanged handles screen transition */
  } catch (err) {
    console.error("[Auth] Login error:", err.code, err.message);

    const errorMap = {
      "auth/user-not-found":        "Email operator tidak terdaftar di sistem.",
      "auth/wrong-password":        "Kata sandi yang Anda masukkan salah.",
      "auth/invalid-email":         "Format email tidak valid.",
      "auth/user-disabled":         "Akun ini telah dinonaktifkan.",
      "auth/too-many-requests":     "Terlalu banyak percobaan. Coba lagi nanti.",
      "auth/network-request-failed":"Koneksi internet bermasalah. Periksa jaringan Anda.",
      "auth/invalid-credential":    "Kombinasi email/kata sandi salah. Periksa kembali.",
    };

    loginGlobalErr.textContent = errorMap[err.code] || `Gagal masuk: ${err.message}`;
    showToast("error", "Login Gagal", errorMap[err.code] || err.message, 5000);
  } finally {
    setLoginLoading(false);
  }
});

/* Logout */
btnLogout.addEventListener("click", async () => {
  if (!confirm("Apakah Anda yakin ingin keluar dari dashboard?")) return;

  try {
    if (unsubSnapshot) { unsubSnapshot(); unsubSnapshot = null; }
    await auth.signOut();
    showToast("info", "Berhasil Logout", "Anda telah keluar dari sesi operator.");
  } catch (err) {
    console.error("[Auth] Logout error:", err);
    showToast("error", "Gagal Logout", err.message);
  }
});

/* Auth State Observer — controls which screen is visible */
auth.onAuthStateChanged((user) => {
  if (user) {
    /* User logged in */
    hide(loginScreen);
    show(dashboardWrap);
    dashboardWrap.classList.remove("d-none");

    /* Populate nav user info */
    const displayEmail = user.email || "Operator";
    const displayName  = user.displayName || displayEmail.split("@")[0];
    navUserName.textContent   = displayName;
    navUserAvatar.textContent = displayName.charAt(0).toUpperCase();

    setHeaderDate();
    startRealtimeListener();
    showToast("success", "Login Berhasil", `Selamat datang, ${displayName}!`, 4000);

  } else {
    /* User logged out */
    show(loginScreen);
    loginScreen.classList.remove("d-none");
    hide(dashboardWrap);

    /* Cleanup */
    if (unsubSnapshot) { unsubSnapshot(); unsubSnapshot = null; }
    allAduan   = [];
    activeDocId= null;
    resetTableUI();
    loginForm.reset();
  }
});

/* ──────────────────────────────────────────
   8. FIRESTORE REAL-TIME LISTENER
────────────────────────────────────────── */
function startRealtimeListener() {
  if (unsubSnapshot) return; /* already listening */

  /* Show loading */
  show(tableLoading);
  hide(emptyState);
  tableBody.innerHTML = "";

  unsubSnapshot = db
    .collection("aduanMutasi")
    .orderBy("createdAt", "desc")
    .onSnapshot(
      (snapshot) => {
        allAduan = snapshot.docs.map((doc) => ({
          id:   doc.id,
          ...doc.data()
        }));

        hide(tableLoading);
        updateStats();
        renderTable();
      },
      (err) => {
        console.error("[Firestore] onSnapshot error:", err);
        hide(tableLoading);
        showToast("error", "Gagal Memuat Data", "Terjadi kesalahan saat mengambil data dari server.", 6000);
      }
    );
}

/* ──────────────────────────────────────────
   9. STATISTICS
────────────────────────────────────────── */
function updateStats() {
  const total   = allAduan.length;
  const pending = allAduan.filter((a) => (a.status || "pending") === "pending").length;
  const proses  = allAduan.filter((a) => a.status === "proses").length;
  const selesai = allAduan.filter((a) => a.status === "selesai").length;

  animateCount(valTotal,   total);
  animateCount(valPending, pending + proses); /* "Menunggu" = pending + proses */
  animateCount(valSelesai, selesai);
}

/**
 * Animate number counter
 */
function animateCount(el, target) {
  const start    = parseInt(el.textContent, 10) || 0;
  const duration = 600;
  const startTime= performance.now();

  function step(now) {
    const elapsed  = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease     = 1 - Math.pow(1 - progress, 3); /* ease-out cubic */
    el.textContent = Math.round(start + (target - start) * ease);
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

/* ──────────────────────────────────────────
   10. TABLE RENDERING
────────────────────────────────────────── */
function getFilteredData() {
  const query  = searchInput.value.trim().toLowerCase();
  const status = filterStatus.value;

  return allAduan.filter((a) => {
    const matchStatus = status === "semua" || (a.status || "pending") === status;
    const matchQuery  = !query ||
      (a.nama     || "").toLowerCase().includes(query) ||
      (a.noAduan  || "").toLowerCase().includes(query) ||
      (a.noPendaftaran || "").toLowerCase().includes(query);
    return matchStatus && matchQuery;
  });
}

function renderTable() {
  const data = getFilteredData();
  rowCountDisplay.textContent = data.length;

  if (data.length === 0) {
    tableBody.innerHTML = "";
    show(emptyState);
    return;
  }

  hide(emptyState);

  tableBody.innerHTML = data.map((a) => {
    const statusVal = (a.status || "pending").toLowerCase();
    const badgeMap  = {
      pending: `<span class="badge badge-pending"><i class="fas fa-circle badge-dot"></i> Pending</span>`,
      proses:  `<span class="badge badge-proses"><i class="fas fa-circle badge-dot"></i> Proses</span>`,
      selesai: `<span class="badge badge-selesai"><i class="fas fa-circle badge-dot"></i> Selesai</span>`,
    };

    const badge     = badgeMap[statusVal] || badgeMap.pending;
    const dateStr   = fmtDateShort(a.createdAt);
    const kategori  = esc(a.kategori || "—");
    const noAduan   = esc(a.noAduan  || "—");
    const nama      = esc(a.nama     || "—");

    return `
      <tr data-docid="${esc(a.id)}">
        <td class="td-date">${dateStr}</td>
        <td class="td-no-aduan">${noAduan}</td>
        <td class="td-nama">${nama}</td>
        <td class="td-kategori" title="${kategori}">${kategori}</td>
        <td>${badge}</td>
        <td>
          <button class="btn-detail" data-docid="${esc(a.id)}" aria-label="Buka detail aduan ${noAduan}">
            <i class="fas fa-folder-open"></i> Buka Detail
          </button>
        </td>
      </tr>
    `;
  }).join("");

  /* Bind detail buttons */
  tableBody.querySelectorAll(".btn-detail").forEach((btn) => {
    btn.addEventListener("click", () => openModal(btn.getAttribute("data-docid")));
  });
}

function resetTableUI() {
  tableBody.innerHTML     = "";
  rowCountDisplay.textContent = "0";
  valTotal.textContent    = "—";
  valPending.textContent  = "—";
  valSelesai.textContent  = "—";
  hide(emptyState);
}

/* Search & filter reactivity */
searchInput.addEventListener("input", () => {
  const hasVal = searchInput.value.length > 0;
  hasVal ? show(searchClear) : hide(searchClear);
  renderTable();
});

searchClear.addEventListener("click", () => {
  searchInput.value = "";
  hide(searchClear);
  renderTable();
  searchInput.focus();
});

filterStatus.addEventListener("change", renderTable);

/* ──────────────────────────────────────────
   11. MODAL — OPEN & POPULATE
────────────────────────────────────────── */
function openModal(docId) {
  const aduan = allAduan.find((a) => a.id === docId);
  if (!aduan) {
    showToast("error", "Data Tidak Ditemukan", "Dokumen tidak ada dalam cache lokal.");
    return;
  }

  activeDocId = docId;

  /* Header */
  modalNoAduanDisplay.textContent = aduan.noAduan || "ADM-????????";

  /* Info Pelapor */
  dNoPendaftaran.textContent = aduan.noPendaftaran || "—";
  dNama.textContent          = aduan.nama          || "—";

  /* Email as mailto link */
  if (aduan.email) {
    dEmail.textContent = aduan.email;
    dEmail.href        = `mailto:${aduan.email}`;
  } else {
    dEmail.textContent = "—";
    dEmail.href        = "#";
  }

  /* WhatsApp as wa.me link */
  const waNum = normalizeWA(aduan.whatsapp);
  if (waNum) {
    dWhatsappText.textContent = aduan.whatsapp;
    dWhatsapp.href = `https://wa.me/${waNum}?text=Halo%20${encodeURIComponent(aduan.nama || '')}%2C%20kami%20dari%20tim%20mutasi%20SMAN%2068%20Jakarta%20ingin%20menindaklanjuti%20aduan%20nomor%20${encodeURIComponent(aduan.noAduan || '')}.`;
  } else {
    dWhatsappText.textContent = "—";
    dWhatsapp.href = "#";
  }

  dKategori.textContent  = aduan.kategori  || "—";
  dCreatedAt.textContent = fmtTimestamp(aduan.createdAt);

  /* Detail Masalah */
  dDetail.textContent = aduan.detail || "—";

  /* Bukti Pendukung */
  if (aduan.linkBukti) {
    show(dLinkBukti);
    hide(noBuktiNote);
    dLinkBukti.href       = aduan.linkBukti;
    dLinkBuktiText.textContent = "Buka di Google Drive";
  } else {
    hide(dLinkBukti);
    show(noBuktiNote);
  }

  /* Response area — pre-fill if already responded */
  responseText.value             = aduan.responOperator || "";
  respCharCount.textContent      = (aduan.responOperator || "").length;
  statusSelect.value             = "";          /* always reset to placeholder */
  document.getElementById("loginGlobalErr") && (document.getElementById("loginGlobalErr").textContent = "");

  /* Open modal */
  show(modalOverlay);
  modalOverlay.classList.remove("d-none");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  hide(modalOverlay);
  document.body.style.overflow = "";
  activeDocId = null;
}

modalCloseBtn.addEventListener("click", closeModal);

modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

/* ESC key closes modal */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modalOverlay.classList.contains("d-none")) closeModal();
});

/* ──────────────────────────────────────────
   12. TEMPLATE BUTTONS
────────────────────────────────────────── */
tplBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const key  = btn.getAttribute("data-tpl");
    const text = TEMPLATES[key];
    if (!text) return;

    responseText.value        = text;
    respCharCount.textContent = text.length;
    respCharCount.style.color = text.length > 540 ? "var(--c-warning)" : "var(--gray-400)";
    responseText.focus();

    /* Visual flash feedback */
    btn.style.transform = "scale(0.95)";
    setTimeout(() => { btn.style.transform = ""; }, 150);

    showToast("info", "Template Dipilih", "Teks tanggapan telah diisi otomatis.", 2500);
  });
});

/* Textarea char counter */
responseText.addEventListener("input", () => {
  const len  = Math.min(responseText.value.length, 600);
  if (responseText.value.length > 600) {
    responseText.value = responseText.value.substring(0, 600);
  }
  respCharCount.textContent = len;
  respCharCount.style.color = len > 540 ? "var(--c-warning)" : "var(--gray-400)";
});

/* ──────────────────────────────────────────
   13. SAVE RESPONSE — UPDATE FIRESTORE
────────────────────────────────────────── */

function setSaveLoading(loading) {
  const textEl    = btnSaveResponse.querySelector(".btn-save-text");
  const loadingEl = btnSaveResponse.querySelector(".btn-save-loading");
  btnSaveResponse.disabled = loading;
  loading ? hide(textEl)    : show(textEl);
  loading ? show(loadingEl) : hide(loadingEl);
}

btnSaveResponse.addEventListener("click", async () => {
  if (!activeDocId) {
    showToast("error", "Tidak Ada Dokumen Aktif", "Buka detail aduan terlebih dahulu.");
    return;
  }

  const responOperator = responseText.value.trim();
  const newStatus      = statusSelect.value;

  /* Validation */
  if (!responOperator) {
    showToast("warning", "Tanggapan Kosong", "Tulis tanggapan atau pilih template terlebih dahulu.");
    responseText.focus();
    return;
  }

  if (!newStatus) {
    showToast("warning", "Status Belum Dipilih", "Pilih status aduan (Proses / Selesai).");
    statusSelect.focus();
    return;
  }

  setSaveLoading(true);

  try {
    await db.collection("aduanMutasi").doc(activeDocId).update({
      responOperator,
      status:      newStatus,
      updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
    });

    showToast(
      "success",
      "Tanggapan Tersimpan",
      `Status aduan diubah ke "${newStatus}". Data berhasil diperbarui.`,
      5000
    );

    closeModal();

  } catch (err) {
    console.error("[Firestore] Update error:", err);
    showToast(
      "error",
      "Gagal Menyimpan",
      "Terjadi kesalahan saat memperbarui data. Coba lagi.",
      5000
    );
  } finally {
    setSaveLoading(false);
  }
});

/* ──────────────────────────────────────────
   14. INIT LOG
────────────────────────────────────────── */
console.info(
  "%c✦ Operator Dashboard — Aduan Penmurmut v1.0 %c | SMAN 68 Jakarta",
  "background:#006633;color:#fff;padding:2px 8px;border-radius:4px;font-weight:700;",
  "color:#0088cc;font-weight:600;"
);
