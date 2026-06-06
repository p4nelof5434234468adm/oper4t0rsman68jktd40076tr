// ============================================================
// OPERATOR PANEL — SMAN 68 JAKARTA
// V 3.0.0 | Full-Featured | Secure | Responsive
// ============================================================
'use strict';

const firebaseConfig = {
    apiKey: "AIzaSyDAcKcg3alPOTH3FFGelYmsW7jcMMe2PLI",
    authDomain: "upnvjdatsystem.firebaseapp.com",
    projectId: "upnvjdatsystem",
    storageBucket: "upnvjdatsystem.firebasestorage.app",
    messagingSenderId: "57095309946",
    appId: "1:57095309946:web:b0e9f3f86380d549ffc9c3"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// ── Global State ──────────────────────────────────────────
const State = {
    user: null,
    page: 'dashboard',
    theme: localStorage.getItem('op68-theme') || 'light',
    notifications: [],
    unreadCount: 0,
    realtimeUnsubs: [],
    chartInstances: {},
    isFirstLogin: false,
};

const DEFAULT_EMAIL    = 'operator@sman68jkt.sch.id';
const DEFAULT_PASSWORD = 'operator123';

// ── DOM Helpers ───────────────────────────────────────────
const el  = (id) => document.getElementById(id);
const qs  = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

// Cached DOM
const DOM = {
    preloader:        el('preloader'),
    loginOverlay:     el('loginOverlay'),
    firstLoginOverlay:el('firstLoginOverlay'),
    mainPanel:        el('mainPanel'),
    loginForm:        el('loginForm'),
    firstLoginForm:   el('firstLoginForm'),
    loginEmail:       el('loginEmail'),
    loginPassword:    el('loginPassword'),
    togglePass:       el('togglePass'),
    toggleNewPass:    el('toggleNewPass'),
    btnLogin:         el('btnLogin'),
    btnFirstLogin:    el('btnFirstLogin'),
    logoutBtn:        el('logoutBtn'),
    menuToggle:       el('menuToggle'),
    sidebarClose:     el('sidebarClose'),
    sidebarBackdrop:  el('sidebarBackdrop'),
    sidebar:          el('sidebar'),
    sidebarSearch:    el('sidebarSearch'),
    pageContainer:    el('pageContainer'),
    pageTitle:        el('pageTitle'),
    suName:           el('suName'),
    suEmail:          el('suEmail'),
    topbarClock:      el('topbarClock'),
    themeToggle:      el('themeToggle'),
    notifWrap:        el('notifWrap'),
    notifBtn:         el('notifBtn'),
    notifPanel:       el('notifPanel'),
    notifList:        el('notifList'),
    notifDot:         el('notifDot'),
    clearAllNotif:    el('clearAllNotif'),
    modalOverlay:     el('modalOverlay'),
    modalBox:         el('modalBox'),
    toastStack:       el('toastStack'),
};

// ── Auth State ────────────────────────────────────────────
auth.onAuthStateChanged(async (user) => {
    setTimeout(() => DOM.preloader?.classList.add('hide'), 900);

    if (user) {
        const isDefault = user.email === DEFAULT_EMAIL;
        State.user = user;

        if (isDefault) {
            // Force first-login setup
            State.isFirstLogin = true;
            showFirstLogin();
        } else {
            const opDoc = await db.collection('operators').doc(user.uid).get().catch(() => ({ exists: false }));
            if (opDoc.exists || user.email !== DEFAULT_EMAIL) {
                showMainPanel();
            } else {
                await auth.signOut();
                showToast('Akses ditolak. Bukan akun operator.', 'error');
            }
        }
    } else {
        showLogin();
    }
});

// ── Login Page ────────────────────────────────────────────
function showLogin() {
    DOM.loginOverlay.style.display = 'flex';
    DOM.firstLoginOverlay.style.display = 'none';
    DOM.mainPanel.style.display = 'none';
    applyTheme(State.theme);
}

function showFirstLogin() {
    DOM.loginOverlay.style.display = 'none';
    DOM.firstLoginOverlay.style.display = 'flex';
    DOM.mainPanel.style.display = 'none';
    applyTheme(State.theme);
}

function showMainPanel() {
    DOM.loginOverlay.style.display = 'none';
    DOM.firstLoginOverlay.style.display = 'none';
    DOM.mainPanel.style.display = 'flex';
    if (DOM.suEmail) DOM.suEmail.textContent = State.user.email;
    if (DOM.suName)  DOM.suName.textContent  = 'Operator';
    applyTheme(State.theme);
    initOperator();
}

DOM.loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = DOM.loginEmail.value.trim();
    const password = DOM.loginPassword.value;
    setLoginLoading(DOM.btnLogin, true);
    try {
        await auth.signInWithEmailAndPassword(email, password);
        showToast('Login berhasil!', 'success');
    } catch (err) {
        showToast('Email atau password salah.', 'error');
    } finally {
        setLoginLoading(DOM.btnLogin, false);
    }
});

function setLoginLoading(btn, isLoading) {
    if (!btn) return;
    btn.disabled = isLoading;
    qs('.btn-login-text', btn).style.display = isLoading ? 'none' : '';
    qs('.btn-login-loader', btn).style.display = isLoading ? 'flex' : 'none';
}

DOM.togglePass?.addEventListener('click', () => togglePassVis(DOM.loginPassword, DOM.togglePass.querySelector('i')));

// ── First Login Setup ─────────────────────────────────────
DOM.firstLoginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newEmail   = el('newEmail').value.trim();
    const newPass    = el('newPassword').value;
    const confirmPass= el('confirmNewPassword').value;

    if (newEmail === DEFAULT_EMAIL) {
        showToast('Email tidak boleh sama dengan default!', 'warning'); return;
    }
    if (newPass.length < 8) {
        showToast('Password minimal 8 karakter!', 'warning'); return;
    }
    if (newPass !== confirmPass) {
        showToast('Konfirmasi password tidak cocok!', 'error'); return;
    }

    setLoginLoading(DOM.btnFirstLogin, true);
    try {
        const user = auth.currentUser;

        // Update password first
        await user.updatePassword(newPass);

        // Send verification link to new email — Firebase will update Auth email after user clicks the link
        // This avoids auth/operation-not-allowed error from updateEmail()
        await user.verifyBeforeUpdateEmail(newEmail);

        // Save new email to Firestore immediately (used for display purposes)
        await db.collection('operators').doc(user.uid).set({
            email: newEmail,
            pendingEmail: newEmail,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            isFirstSetup: true,
        }, { merge: true });

        showToast('Password berhasil diperbarui! Link verifikasi dikirim ke ' + newEmail + ' — klik untuk mengaktifkan email baru.', 'success');
        // Brief pause so user can read the toast, then proceed to panel
        await new Promise(r => setTimeout(r, 1800));
        State.isFirstLogin = false;
        State.user = user;
        showMainPanel();
    } catch (err) {
        console.error(err);
        if (err.code === 'auth/email-already-in-use') {
            showToast('Email sudah digunakan akun lain.', 'error');
        } else if (err.code === 'auth/requires-recent-login') {
            showToast('Sesi habis. Silakan login ulang.', 'error');
            await auth.signOut();
            showLogin();
        } else if (err.code === 'auth/operation-not-allowed') {
            // Fallback: skip email change, only update password
            try {
                await db.collection('operators').doc(auth.currentUser.uid).set({
                    email: newEmail,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    isFirstSetup: true,
                }, { merge: true });
                showToast('Password berhasil diperbarui! Email baru disimpan. (Verifikasi email dinonaktifkan di Firebase Console — aktifkan fitur Email Enumeration Protection di Authentication > Settings)', 'info');
                await new Promise(r => setTimeout(r, 2200));
                State.isFirstLogin = false;
                State.user = auth.currentUser;
                showMainPanel();
            } catch (e2) {
                showToast('Gagal menyimpan: ' + e2.message, 'error');
            }
        } else {
            showToast('Gagal menyimpan: ' + err.message, 'error');
        }
    } finally {
        setLoginLoading(DOM.btnFirstLogin, false);
    }
});

DOM.toggleNewPass?.addEventListener('click', () => {
    const inp = el('newPassword');
    const icon = DOM.toggleNewPass.querySelector('i');
    togglePassVis(inp, icon);
});

// Password strength meter
el('newPassword')?.addEventListener('input', function() {
    const bar = el('passStrength');
    const fill = el('psBar');
    const label = el('psLabel');
    if (!bar) return;
    const val = this.value;
    if (!val) { bar.style.display='none'; return; }
    bar.style.display = 'flex';
    const score = getPasswordStrength(val);
    const colors = ['#ef4444','#f59e0b','#22c55e','#16a34a'];
    const labels = ['Lemah','Cukup','Kuat','Sangat Kuat'];
    fill.style.width = ((score+1)*25)+'%';
    fill.style.background = colors[score];
    label.textContent = labels[score];
    label.style.color = colors[score];
});

function getPasswordStrength(p) {
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return Math.min(s - 1, 3);
}

// ── Logout ────────────────────────────────────────────────
DOM.logoutBtn?.addEventListener('click', async () => {
    unsubscribeAll();
    await auth.signOut();
    showToast('Logout berhasil.', 'info');
});

// ── Init Operator ─────────────────────────────────────────
function initOperator() {
    startClock();
    setupNav();
    setupSidebar();
    setupNotif();
    setupTheme();
    setupRealtime();
    navigateTo('dashboard');
}

// ── Clock ─────────────────────────────────────────────────
function startClock() {
    function tick() {
        if (!DOM.topbarClock) return;
        const now = new Date();
        DOM.topbarClock.textContent = now.toLocaleDateString('id-ID', {
            weekday:'short', day:'numeric', month:'short', year:'numeric',
            hour:'2-digit', minute:'2-digit', second:'2-digit'
        });
    }
    tick();
    setInterval(tick, 1000);
}

// ── Nav ───────────────────────────────────────────────────
const PAGE_TITLES = {
    dashboard:              'Dashboard',
    'siswa-pending':        'Pendaftaran Siswa',
    'guru-pending':         'Pendaftaran Guru',
    mutasi:                 'Pendaftaran Mutasi',
    'reset-password-guru':  'Request Reset Password Guru',
    'absensi-siswa':        'Absensi Siswa',
    'absensi-guru':         'Absensi Guru',
    'data-siswa':           'Data Siswa',
    'data-guru':            'Data Guru',
    'pengaturan-akun':      'Akun Operator',
};

const PAGE_LOADERS = {
    dashboard:              loadDashboard,
    'siswa-pending':        loadSiswaPending,
    'guru-pending':         loadGuruPending,
    mutasi:                 loadMutasiPage,
    'reset-password-guru':  loadResetPasswordGuru,
    'absensi-siswa':        loadAbsensiSiswa,
    'absensi-guru':         loadAbsensiGuru,
    'data-siswa':           loadDataSiswa,
    'data-guru':            loadDataGuru,
    'pengaturan-akun':      loadPengaturanAkun,
};

function setupNav() {
    qsa('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            if (page) navigateTo(page);
            if (window.innerWidth < 992) closeMobileSidebar();
        });
    });
}

function navigateTo(page) {
    // Lepas listener realtime halaman reset jika pindah ke halaman lain
    if (page !== 'reset-password-guru' && _resetPageUnsub) {
        _resetPageUnsub(); _resetPageUnsub = null;
    }
    State.page = page;
    qsa('.nav-item').forEach(n => n.classList.remove('active'));
    qs(`.nav-item[data-page="${page}"]`)?.classList.add('active');
    if (DOM.pageTitle) DOM.pageTitle.textContent = PAGE_TITLES[page] || page;
    const loader = PAGE_LOADERS[page];
    if (loader) loader();
    else DOM.pageContainer.innerHTML = renderEmpty('Halaman tidak ditemukan', 'fas fa-compass');
}

// ── Sidebar ───────────────────────────────────────────────
function setupSidebar() {
    DOM.menuToggle?.addEventListener('click', toggleMobileSidebar);
    DOM.sidebarClose?.addEventListener('click', closeMobileSidebar);
    DOM.sidebarBackdrop?.addEventListener('click', closeMobileSidebar);
    DOM.sidebarSearch?.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        qsa('.nav-item').forEach(item => {
            item.style.display = !q || item.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
        qsa('.nav-section-label').forEach(l => l.style.display = q ? 'none' : '');
    });
}
function toggleMobileSidebar() {
    DOM.sidebar?.classList.toggle('mobile-open');
    DOM.sidebarBackdrop?.classList.toggle('show');
}
function closeMobileSidebar() {
    DOM.sidebar?.classList.remove('mobile-open');
    DOM.sidebarBackdrop?.classList.remove('show');
}

// ── Theme ─────────────────────────────────────────────────
function setupTheme() {
    DOM.themeToggle?.addEventListener('click', () => {
        applyTheme(State.theme === 'light' ? 'dark' : 'light');
    });
}
function applyTheme(t) {
    State.theme = t;
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('op68-theme', t);
    const icon = DOM.themeToggle?.querySelector('i');
    if (icon) icon.className = t === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// ── Realtime ──────────────────────────────────────────────
function setupRealtime() {
    let first = { siswa: true, guru: true, mutasi: true, reset: true };

    const s1 = db.collection('siswa').where('status','==','pending').onSnapshot(snap => {
        updateBadge('badgeSiswa', snap.size);
        if (!first.siswa) snap.docChanges().forEach(c => {
            if (c.type === 'added') addNotification('siswa', `Pendaftaran siswa baru: ${c.doc.data().nama}`, 'fas fa-user-graduate');
        });
        first.siswa = false;
    });

    const s2 = db.collection('guru').where('status','==','pending').onSnapshot(snap => {
        updateBadge('badgeGuru', snap.size);
        if (!first.guru) snap.docChanges().forEach(c => {
            if (c.type === 'added') addNotification('guru', `Pendaftaran guru baru: ${c.doc.data().nama}`, 'fas fa-chalkboard-user');
        });
        first.guru = false;
    });

    const s3 = db.collection('pendaftaranMutasi').where('status','==','pending').onSnapshot(snap => {
        updateBadge('badgeMutasi', snap.size);
        if (!first.mutasi) snap.docChanges().forEach(c => {
            if (c.type === 'added') addNotification('mutasi', `Pendaftaran mutasi: ${c.doc.data().nama}`, 'fas fa-right-left');
        });
        first.mutasi = false;
    });

    const s4 = db.collection('resetPasswordRequests').where('status','==','pending').onSnapshot(snap => {
        updateBadge('badgeReset', snap.size);
        if (!first.reset) snap.docChanges().forEach(c => {
            if (c.type === 'added') addNotification('reset', `Request reset password: ${c.doc.data().nama}`, 'fas fa-key');
        });
        first.reset = false;
    });

    State.realtimeUnsubs.push(s1, s2, s3, s4);
}

function updateBadge(id, count) {
    const b = el(id);
    if (b) { b.textContent = count; b.style.display = count > 0 ? 'inline-flex' : 'none'; }
}

function unsubscribeAll() {
    State.realtimeUnsubs.forEach(fn => { try { fn(); } catch(e) {} });
    State.realtimeUnsubs = [];
}

// ── Notifications ─────────────────────────────────────────
function setupNotif() {
    DOM.notifBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        DOM.notifWrap?.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
        if (!DOM.notifWrap?.contains(e.target)) DOM.notifWrap?.classList.remove('open');
    });
    DOM.clearAllNotif?.addEventListener('click', () => {
        State.notifications.forEach(n => n.read = true);
        State.unreadCount = 0;
        renderNotifList(); updateNotifDot();
    });
}

function addNotification(type, message, icon) {
    State.notifications.unshift({ id: Date.now()+Math.random(), type, message, icon: icon||'fas fa-bell', timestamp: new Date(), read: false });
    if (State.notifications.length > 50) State.notifications.pop();
    State.unreadCount++;
    renderNotifList(); updateNotifDot();
}

function updateNotifDot() {
    if (DOM.notifDot) DOM.notifDot.style.display = State.unreadCount > 0 ? 'block' : 'none';
}

function renderNotifList() {
    if (!DOM.notifList) return;
    if (!State.notifications.length) {
        DOM.notifList.innerHTML = `<div class="notif-empty"><i class="fas fa-bell-slash"></i><p>Tidak ada notifikasi</p></div>`;
        return;
    }
    DOM.notifList.innerHTML = State.notifications.slice(0,15).map(n => `
        <div class="notif-item ${n.read?'':'unread'}" onclick="markNotifRead('${n.id}')">
            <div class="notif-item-icon ${n.type||''}"><i class="${n.icon}"></i></div>
            <div class="notif-item-body">
                <p>${escapeHtml(n.message)}</p>
                <small>${n.timestamp.toLocaleString('id-ID',{hour:'2-digit',minute:'2-digit',day:'numeric',month:'short'})}</small>
            </div>
        </div>`).join('');
}

function markNotifRead(id) {
    const n = State.notifications.find(x => String(x.id) === String(id));
    if (n && !n.read) { n.read = true; State.unreadCount = Math.max(0, State.unreadCount-1); renderNotifList(); updateNotifDot(); }
}

// ── Toast ─────────────────────────────────────────────────
const TOAST_CFG = {
    success: { icon:'fas fa-circle-check',  label:'Berhasil' },
    error:   { icon:'fas fa-circle-xmark',  label:'Error' },
    warning: { icon:'fas fa-triangle-exclamation', label:'Peringatan' },
    info:    { icon:'fas fa-circle-info',   label:'Info' },
};

function showToast(message, type='success', duration=4500) {
    if (!DOM.toastStack) return;
    const id  = 'toast-'+Date.now();
    const cfg = TOAST_CFG[type] || TOAST_CFG.info;
    const t   = document.createElement('div');
    t.className = `toast ${type}`;
    t.id = id;
    t.innerHTML = `
        <div class="toast-icon"><i class="${cfg.icon}"></i></div>
        <div class="toast-content"><strong>${cfg.label}</strong><span>${escapeHtml(message)}</span></div>
        <button class="toast-close" onclick="removeToast('${id}')"><i class="fas fa-xmark"></i></button>`;
    DOM.toastStack.appendChild(t);
    t._timer = setTimeout(() => removeToast(id), duration);
}

function removeToast(id) {
    const t = el(id);
    if (!t) return;
    clearTimeout(t._timer);
    t.classList.add('removing');
    setTimeout(() => t.remove(), 300);
}

// ── Utilities ─────────────────────────────────────────────
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function fmtDate(ts, opts) {
    if (!ts) return '-';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('id-ID', opts || { day:'numeric', month:'long', year:'numeric' });
}

function fmtDateTime(ts) {
    if (!ts) return '-';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('id-ID', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function extractGDriveId(url) {
    if (!url) return null;
    const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return m ? m[1] : null;
}

function statusBadge(status) {
    const map = {
        pending:          ['badge badge-amber',  'Pending'],
        approved:         ['badge badge-green',  'Disetujui'],
        rejected:         ['badge badge-rose',   'Ditolak'],
        proses:           ['badge badge-blue',   'Diproses'],
        diterima:         ['badge badge-green',  'Diterima'],
        ditolak:          ['badge badge-rose',   'Ditolak'],
        aktif:            ['badge badge-green',  'Aktif'],
        nonaktif_sementara:['badge badge-amber', 'Non-Aktif Sementara'],
        nonaktif_permanen: ['badge badge-rose',  'Non-Aktif Permanen'],
        valid:            ['badge badge-green',  'Valid'],
    };
    const [cls, label] = map[status] || ['badge badge-gray', status || '-'];
    return `<span class="${cls}">${label}</span>`;
}

function debounce(fn, delay) {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), delay); };
}

function togglePassVis(input, icon) {
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    if (icon) icon.className = input.type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
}

// ── Render Helpers ────────────────────────────────────────
function renderEmpty(text='Tidak ada data', icon='fas fa-inbox', sub='') {
    return `<div class="empty-state">
        <div class="empty-icon"><i class="${icon}"></i></div>
        <h4>${text}</h4>
        ${sub ? `<p>${sub}</p>` : ''}
    </div>`;
}

function renderLoadingPage() {
    return `<div class="table-wrap"><div class="loading-rows">${
        Array(6).fill('').map(() => `
        <div class="skeleton-row">
            <div class="skeleton sk-avatar"></div>
            <div style="flex:1;display:flex;flex-direction:column;gap:6px;">
                <div class="skeleton sk" style="width:${50+Math.random()*30}%"></div>
                <div class="skeleton sk-sm" style="width:${30+Math.random()*20}%"></div>
            </div>
        </div>`).join('')
    }</div></div>`;
}

function renderSearchTable(headers, rows, count, unit='data') {
    return `<div class="table-wrap fade-in">
        <div class="table-toolbar">
            <div class="table-search">
                <i class="fas fa-magnifying-glass"></i>
                <input type="text" placeholder="Cari..." id="tblSearch">
            </div>
            <span class="table-count" id="tblCount">${count} ${unit}</span>
        </div>
        <div class="table-scroll">
            <table>
                <thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
                <tbody id="mainTableBody">${rows}</tbody>
            </table>
        </div>
    </div>`;
}

function attachTableSearch(tbodyId='mainTableBody', inputId='tblSearch', countId='tblCount', unit='data') {
    const input = el(inputId), tbody = el(tbodyId), counter = el(countId);
    if (!input || !tbody) return;
    const doSearch = debounce(() => {
        const q = input.value.toLowerCase().trim();
        let v = 0;
        qsa('tr', tbody).forEach(row => {
            const match = !q || row.textContent.toLowerCase().includes(q);
            row.style.display = match ? '' : 'none';
            if (match) v++;
        });
        if (counter) counter.textContent = `${v} ${unit}`;
    }, 180);
    input.addEventListener('input', doSearch);
}

// ── Modal ─────────────────────────────────────────────────
function openModal(html, size='') {
    if (!DOM.modalBox) return;
    DOM.modalBox.className = `modal-box ${size}`;
    DOM.modalBox.innerHTML = html;
    DOM.modalOverlay?.classList.add('open');
    document.body.style.overflow = 'hidden';
}
function closeModal() {
    DOM.modalOverlay?.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => { if (DOM.modalBox) DOM.modalBox.innerHTML = ''; }, 300);
}
DOM.modalOverlay?.addEventListener('click', (e) => { if (e.target === DOM.modalOverlay) closeModal(); });

// ======================================================
// DASHBOARD
// ======================================================
async function loadDashboard() {
    DOM.pageContainer.innerHTML = renderLoadingPage();
    try {
        const [siswaPend, guruPend, mutasiPend, siswAktif, guruAktif, resetPend] = await Promise.all([
            db.collection('siswa').where('status','==','pending').get(),
            db.collection('guru').where('status','==','pending').get(),
            db.collection('pendaftaranMutasi').where('status','==','pending').get(),
            db.collection('siswa').where('status','==','approved').get(),
            db.collection('guru').where('status','==','approved').get(),
            db.collection('resetPasswordRequests').where('status','==','pending').get(),
        ]);

        DOM.pageContainer.innerHTML = `
            <div class="page-header slide-up">
                <div class="page-header-left">
                    <h2>Dashboard Overview</h2>
                    <p>Selamat datang di Operator Panel SMAN 68 Jakarta</p>
                </div>
                <div class="page-header-actions">
                    <button class="btn btn-ghost btn-sm" onclick="navigateTo('siswa-pending')">
                        <i class="fas fa-clock"></i> Pending
                    </button>
                </div>
            </div>

            <div class="stats-grid">
                ${renderStatCard('Siswa Pending',    siswaPend.size,  'fas fa-user-graduate',    'green',  'Menunggu persetujuan')}
                ${renderStatCard('Guru Pending',     guruPend.size,   'fas fa-chalkboard-user',  'blue',   'Menunggu persetujuan')}
                ${renderStatCard('Mutasi Pending',   mutasiPend.size, 'fas fa-right-left',       'orange', 'Menunggu persetujuan')}
                ${renderStatCard('Total Siswa Aktif',siswAktif.size,  'fas fa-users',            'teal',   'Siswa aktif terdaftar')}
                ${renderStatCard('Total Guru Aktif', guruAktif.size,  'fas fa-person-chalkboard','violet', 'Guru aktif terdaftar')}
                ${renderStatCard('Reset Password',   resetPend.size,  'fas fa-key',              'rose',   'Request menunggu')}
            </div>

            <div class="charts-grid">
                <div class="chart-card">
                    <div class="chart-card-head">
                        <div><h4>Statistik Pendaftaran</h4><p>Perbandingan status</p></div>
                    </div>
                    <canvas id="barChart" height="200"></canvas>
                </div>
                <div class="chart-card">
                    <div class="chart-card-head">
                        <div><h4>Distribusi Pending</h4><p>Semua pendaftaran pending</p></div>
                    </div>
                    <canvas id="doughnutChart" height="200"></canvas>
                </div>
            </div>

            <div class="dashboard-quick-actions slide-up">
                <h3 class="section-title"><i class="fas fa-bolt"></i> Aksi Cepat</h3>
                <div class="quick-grid">
                    <button class="quick-btn" onclick="navigateTo('siswa-pending')">
                        <i class="fas fa-user-graduate"></i><span>Pendaftaran Siswa</span>
                        ${siswaPend.size > 0 ? `<span class="qb-badge">${siswaPend.size}</span>` : ''}
                    </button>
                    <button class="quick-btn" onclick="navigateTo('guru-pending')">
                        <i class="fas fa-chalkboard-user"></i><span>Pendaftaran Guru</span>
                        ${guruPend.size > 0 ? `<span class="qb-badge">${guruPend.size}</span>` : ''}
                    </button>
                    <button class="quick-btn" onclick="navigateTo('reset-password-guru')">
                        <i class="fas fa-key"></i><span>Reset Password Guru</span>
                        ${resetPend.size > 0 ? `<span class="qb-badge">${resetPend.size}</span>` : ''}
                    </button>
                    <button class="quick-btn" onclick="navigateTo('data-siswa')">
                        <i class="fas fa-users"></i><span>Kelola Akun Siswa</span>
                    </button>
                    <button class="quick-btn" onclick="navigateTo('data-guru')">
                        <i class="fas fa-person-chalkboard"></i><span>Kelola Data Guru</span>
                    </button>
                    <button class="quick-btn" onclick="navigateTo('pengaturan-akun')">
                        <i class="fas fa-user-shield"></i><span>Akun Operator</span>
                    </button>
                </div>
            </div>`;

        initDashboardCharts(siswaPend.size, guruPend.size, mutasiPend.size, siswAktif.size, guruAktif.size);
    } catch(e) {
        console.error(e);
        DOM.pageContainer.innerHTML = renderEmpty('Gagal memuat dashboard','fas fa-exclamation-triangle', e.message);
    }
}

function renderStatCard(label, value, icon, color, sub) {
    return `<div class="stat-card">
        <div class="stat-icon ${color}"><i class="${icon}"></i></div>
        <div class="stat-info">
            <h3>${value}</h3><p>${label}</p>
            <span class="stat-trend neutral">${sub}</span>
        </div>
    </div>`;
}

function initDashboardCharts(sp, gp, mp, sa, ga) {
    const isDark = State.theme === 'dark';
    const textColor = isDark ? '#8b949e' : '#6b7280';
    const gridColor = isDark ? '#30363d' : '#e5e7eb';

    ['bar','doughnut'].forEach(k => { if (State.chartInstances[k]) State.chartInstances[k].destroy(); });

    const barCtx = el('barChart')?.getContext('2d');
    if (barCtx) {
        State.chartInstances.bar = new Chart(barCtx, {
            type:'bar',
            data: {
                labels:['Siswa Pending','Guru Pending','Mutasi Pending','Siswa Aktif','Guru Aktif'],
                datasets:[{ label:'Jumlah', data:[sp,gp,mp,sa,ga],
                    backgroundColor:['#22c55e44','#3b82f644','#f59e0b44','#14b8a644','#8b5cf644'],
                    borderColor:['#22c55e','#3b82f6','#f59e0b','#14b8a6','#8b5cf6'],
                    borderWidth:2, borderRadius:8 }]
            },
            options:{ responsive:true, maintainAspectRatio:true,
                plugins:{ legend:{ display:false } },
                scales:{
                    x:{ grid:{ color:gridColor }, ticks:{ color:textColor, font:{family:'DM Sans',size:11} } },
                    y:{ grid:{ color:gridColor }, ticks:{ color:textColor, font:{family:'DM Sans',size:11}, precision:0 } }
                }
            }
        });
    }

    const doCtx = el('doughnutChart')?.getContext('2d');
    if (doCtx) {
        State.chartInstances.doughnut = new Chart(doCtx, {
            type:'doughnut',
            data:{ labels:['Siswa Pending','Guru Pending','Mutasi Pending'],
                datasets:[{ data:[sp,gp,mp], backgroundColor:['#22c55e','#3b82f6','#f59e0b'], borderWidth:0, hoverOffset:6 }] },
            options:{ responsive:true, maintainAspectRatio:true, cutout:'70%',
                plugins:{ legend:{ position:'bottom', labels:{ color:textColor, font:{family:'DM Sans',size:11}, padding:16, boxWidth:12 } } } }
        });
    }
}

// ======================================================
// PENDAFTARAN SISWA — Full Format daftar-siswa-sman-68
// ======================================================
async function loadSiswaPending() {
    DOM.pageContainer.innerHTML = renderLoadingPage();
    try {
        const snapshot = await db.collection('siswa').where('status','==','pending').get();
        const sorted   = snapshot.docs.slice().sort((a,b)=>(b.data().createdAt?.toMillis?.()||0)-(a.data().createdAt?.toMillis?.()||0));

        const header = `<div class="page-header slide-up">
            <div class="page-header-left">
                <h2>Pendaftaran Siswa</h2>
                <p>${snapshot.size} pendaftaran menunggu persetujuan</p>
            </div>
            <div class="page-header-actions">
                <div class="status-filter-wrap">
                    <select id="filterStatusSiswa" class="filter-select" onchange="filterByStatus('mainTableBody','status',this.value,this,'siswa')">
                        <option value="">Semua Status</option>
                        <option value="pending" selected>Pending</option>
                    </select>
                </div>
            </div>
        </div>`;

        if (snapshot.empty) {
            DOM.pageContainer.innerHTML = header + renderEmpty('Tidak ada pendaftaran siswa pending','fas fa-user-graduate','Semua sudah diproses');
            return;
        }

        const rows = sorted.map(doc => {
            const d = doc.data();
            return `<tr data-status="${d.status||'pending'}">
                <td>
                    <div class="td-person">
                        <div class="td-avatar">${(d.nama||'?')[0].toUpperCase()}</div>
                        <div>
                            <strong>${escapeHtml(d.nama||'-')}</strong>
                            <small>${escapeHtml(d.nisn||'-')}</small>
                        </div>
                    </div>
                </td>
                <td>${escapeHtml(d.kelas||'-')}</td>
                <td>${escapeHtml(d.jurusan||'-')}</td>
                <td>${escapeHtml(d.noHp||d.hp||'-')}</td>
                <td>${fmtDate(d.createdAt)}</td>
                <td>${statusBadge(d.status||'pending')}</td>
                <td><div class="td-actions">
                    <button class="btn btn-ghost btn-sm btn-icon" onclick="viewSiswaDetail('${doc.id}')" title="Lihat Detail Lengkap"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-blue btn-sm" onclick="prosesItemSiswa('siswa','${doc.id}')"><i class="fas fa-gear"></i> Proses</button>
                    <button class="btn btn-primary btn-sm" onclick="approveItemSiswa('siswa','${doc.id}')"><i class="fas fa-check"></i> Setujui</button>
                    <button class="btn btn-danger btn-sm" onclick="rejectItemWithReason('siswa','${doc.id}')"><i class="fas fa-xmark"></i> Tolak</button>
                </div></td>
            </tr>`;
        }).join('');

        DOM.pageContainer.innerHTML = header + renderSearchTable(
            ['Siswa','Kelas','Jurusan','No. HP','Tgl Daftar','Status','Aksi'],
            rows, snapshot.size, 'pendaftar'
        );
        attachTableSearch();
    } catch(e) {
        console.error(e);
        DOM.pageContainer.innerHTML = renderEmpty('Gagal memuat data','fas fa-exclamation-triangle', e.message);
    }
}

// View Siswa Detail — Format lengkap sesuai daftar-siswa-sman-68.html
async function viewSiswaDetail(id) {
    openModal(`<div class="modal-head"><h3><i class="fas fa-user-graduate" style="color:var(--primary);margin-right:8px;"></i>Memuat data siswa...</h3><button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button></div><div class="modal-body">${renderLoadingPage()}</div>`, 'modal-xl');
    try {
        const doc = await db.collection('siswa').doc(id).get();
        if (!doc.exists) { showToast('Data tidak ditemukan','error'); closeModal(); return; }
        const d = doc.data();
        const isPending = d.status === 'pending';
        const isProses  = d.status === 'proses';

        const f = (label, val, full=false) =>
            `<div class="detail-field${full?' detail-field-full':''}"><label>${label}</label><p>${val||'<span style="color:var(--text-4)">-</span>'}</p></div>`;

        const fotoId = extractGDriveId(d.fotoUrl||d.foto||d.pasFoto||'');
        const fotoHtml = fotoId
            ? `<div class="detail-foto-wrap"><img src="https://drive.google.com/thumbnail?id=${fotoId}&sz=w300" alt="Foto Siswa" class="detail-foto" onerror="this.style.display='none'"></div>`
            : '';

        const dokFields = Object.entries(d).filter(([k,v]) =>
            typeof v==='string' && (v.includes('drive.google.com')||v.includes('http')) && !['email','uid'].includes(k)
        );
        const dokLabels = { fotoUrl:'Pas Foto', foto:'Pas Foto', pasFoto:'Pas Foto', aktaLahir:'Akta Kelahiran', kartuKeluarga:'Kartu Keluarga', ijazah:'Ijazah/SKL', skhu:'SKHU', raport:'Raport', ktpOrtu:'KTP Orang Tua' };
        const dokHtml = dokFields.length ? `
            <div class="detail-section-title"><i class="fas fa-file-lines"></i> Dokumen Pendaftaran</div>
            <div class="doc-grid">${dokFields.map(([k,url]) => {
                const gId = extractGDriveId(url);
                const lbl = dokLabels[k] || k.replace(/([A-Z])/g,' $1').trim();
                return `<div class="doc-item">
                    <div class="doc-item-head"><i class="fab fa-google-drive"></i><span>${escapeHtml(lbl)}</span></div>
                    ${gId ? `<div class="doc-item-frame"><iframe src="https://drive.google.com/file/d/${gId}/preview" allow="autoplay" loading="lazy"></iframe></div>` : ''}
                    <a href="${escapeHtml(url)}" target="_blank" class="doc-item-link"><i class="fas fa-arrow-up-right-from-square"></i> Buka di Google Drive</a>
                </div>`;
            }).join('')}</div>` : '';

        openModal(`
            <div class="modal-head">
                <h3><i class="fas fa-user-graduate" style="color:var(--primary);margin-right:8px;"></i>
                    Detail Pendaftaran Siswa
                    ${statusBadge(d.status||'pending')}
                </h3>
                <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
            </div>
            <div class="modal-body">
                ${fotoHtml}

                <div class="detail-section-title"><i class="fas fa-id-card"></i> Data Pribadi</div>
                <div class="detail-grid">
                    ${f('Nama Lengkap', escapeHtml(d.nama))}
                    ${f('NISN', escapeHtml(d.nisn))}
                    ${f('NIS', escapeHtml(d.nis))}
                    ${f('Jenis Kelamin', escapeHtml(d.jenisKelamin||d.jk||d.gender))}
                    ${f('Tempat Lahir', escapeHtml(d.tempatLahir||d.ttl?.split(',')[0]))}
                    ${f('Tanggal Lahir', escapeHtml(d.tanggalLahir||d.ttl))}
                    ${f('Agama', escapeHtml(d.agama))}
                    ${f('Kewarganegaraan', escapeHtml(d.kewarganegaraan))}
                    ${f('NIK', escapeHtml(d.nik))}
                    ${f('No. KK', escapeHtml(d.noKK||d.noKk))}
                    ${f('No. HP / WA', escapeHtml(d.noHp||d.hp||d.telepon||d.wa))}
                    ${f('Email Siswa', escapeHtml(d.emailSiswa||d.email))}
                    ${f('Alamat Lengkap', escapeHtml(d.alamat), true)}
                    ${f('RT / RW', [d.rt,d.rw].filter(Boolean).join(' / '))}
                    ${f('Kelurahan', escapeHtml(d.kelurahan||d.desa))}
                    ${f('Kecamatan', escapeHtml(d.kecamatan))}
                    ${f('Kota/Kabupaten', escapeHtml(d.kota||d.kabupaten||d.kotaKabupaten))}
                    ${f('Provinsi', escapeHtml(d.provinsi))}
                    ${f('Kode Pos', escapeHtml(d.kodePos))}
                </div>

                <div class="detail-section-title" style="margin-top:16px;"><i class="fas fa-school"></i> Data Sekolah</div>
                <div class="detail-grid">
                    ${f('Kelas', escapeHtml(d.kelas))}
                    ${f('Jurusan', escapeHtml(d.jurusan))}
                    ${f('Tahun Ajaran', escapeHtml(d.tahunAjaran))}
                    ${f('Tgl Masuk', escapeHtml(d.tglMasuk))}
                    ${f('Estimasi Lulus', escapeHtml(d.estimasiLulus))}
                    ${f('Asal Sekolah', escapeHtml(d.asalSekolah||d.sekolahAsal))}
                    ${f('Tahun Lulus SMP', escapeHtml(d.tahunLulus))}
                </div>

                <div class="detail-section-title" style="margin-top:16px;"><i class="fas fa-people-roof"></i> Data Orang Tua / Wali</div>
                <div class="detail-grid">
                    ${f('Nama Ayah', escapeHtml(d.namaAyah))}
                    ${f('Pekerjaan Ayah', escapeHtml(d.pekerjaanAyah))}
                    ${f('Pendidikan Ayah', escapeHtml(d.pendidikanAyah))}
                    ${f('Penghasilan Ayah', escapeHtml(d.penghasilanAyah))}
                    ${f('Nama Ibu', escapeHtml(d.namaIbu))}
                    ${f('Pekerjaan Ibu', escapeHtml(d.pekerjaanIbu))}
                    ${f('Pendidikan Ibu', escapeHtml(d.pendidikanIbu))}
                    ${f('Penghasilan Ibu', escapeHtml(d.penghasilanIbu))}
                    ${f('Nama Wali', escapeHtml(d.namaWali))}
                    ${f('Pekerjaan Wali', escapeHtml(d.pekerjaanWali))}
                    ${f('No. HP Ortu/Wali', escapeHtml(d.noHpOrtu||d.hpOrtu||d.noHpAyah||d.noHpIbu))}
                </div>

                <div class="detail-section-title" style="margin-top:16px;"><i class="fas fa-circle-info"></i> Info Pendaftaran</div>
                <div class="detail-grid">
                    ${f('Status', statusBadge(d.status||'pending'))}
                    ${f('Tgl Daftar', fmtDateTime(d.createdAt))}
                    ${d.approvedAt ? f('Tgl Disetujui', fmtDateTime(d.approvedAt)) : ''}
                    ${d.rejectedAt  ? f('Tgl Ditolak',  fmtDateTime(d.rejectedAt))  : ''}
                    ${d.alasanTolak ? f('Alasan Ditolak', escapeHtml(d.alasanTolak)) : ''}
                </div>
                ${dokHtml}
            </div>
            <div class="modal-footer">
                ${(isPending||isProses) ? `
                    <button class="btn btn-blue" onclick="prosesItemSiswa('siswa','${id}');closeModal()"><i class="fas fa-gear"></i> Proses</button>
                    <button class="btn btn-primary" onclick="approveItemSiswa('siswa','${id}');closeModal()"><i class="fas fa-check"></i> Setujui</button>
                    <button class="btn btn-danger" onclick="closeModal();setTimeout(()=>rejectItemWithReason('siswa','${id}'),300)"><i class="fas fa-xmark"></i> Tolak</button>
                ` : ''}
                <button class="btn btn-ghost" onclick="closeModal()">Tutup</button>
            </div>`, 'modal-xl');
    } catch(e) { console.error(e); showToast('Gagal memuat detail siswa','error'); closeModal(); }
}

async function prosesItemSiswa(coll, id) {
    try {
        await db.collection(coll).doc(id).update({ status:'proses', prosesAt: firebase.firestore.FieldValue.serverTimestamp() });
        showToast('Status diubah ke Diproses','success');
        navigateTo(State.page);
    } catch(e) { showToast('Gagal mengubah status','error'); }
}

async function approveItemSiswa(coll, id) {
    try {
        await db.collection(coll).doc(id).update({ status:'approved', approvedAt: firebase.firestore.FieldValue.serverTimestamp(), akunStatus:'aktif' });
        showToast('Pendaftaran disetujui! Siswa sekarang dapat login.','success');
        navigateTo(State.page);
    } catch(e) { showToast('Gagal menyetujui','error'); }
}

function rejectItemWithReason(coll, id, callback) {
    const label = coll === 'siswa' ? 'Siswa' : 'Item';
    openModal(`
        <div class="modal-head">
            <h3><i class="fas fa-xmark-circle" style="color:var(--rose-500);margin-right:8px;"></i>Tolak Pendaftaran ${label}</h3>
            <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
        </div>
        <div class="modal-body">
            <div class="reject-warning">
                <i class="fas fa-triangle-exclamation"></i>
                <span>Pendaftaran akan ditolak. Siswa akan diberitahu alasan penolakan.</span>
            </div>
            <div class="form-group">
                <label class="form-label">Alasan Penolakan <span style="color:var(--rose-500)">*</span></label>
                <textarea id="alasanTolakItem" class="form-textarea" rows="4" placeholder="Contoh: Dokumen tidak lengkap / NISN tidak valid / Data tidak sesuai..."></textarea>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-danger" onclick="confirmRejectItem('${coll}','${id}')">
                <i class="fas fa-xmark"></i> Tolak Pendaftaran
            </button>
            <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        </div>`);
}

async function confirmRejectItem(coll, id) {
    const alasan = el('alasanTolakItem')?.value.trim();
    if (!alasan) { showToast('Alasan penolakan wajib diisi!','warning'); return; }
    try {
        await db.collection(coll).doc(id).update({
            status:'rejected',
            alasanTolak: alasan,
            rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        closeModal();
        showToast('Pendaftaran ditolak.','success');
        navigateTo(State.page);
    } catch(e) { showToast('Gagal menolak','error'); }
}

// ======================================================
// PENDAFTARAN GURU — Full Format daftar-guru
// ======================================================
async function loadGuruPending() {
    DOM.pageContainer.innerHTML = renderLoadingPage();
    try {
        const snapshot = await db.collection('guru').where('status','==','pending').get();
        const sorted   = snapshot.docs.slice().sort((a,b)=>(b.data().createdAt?.toMillis?.()||0)-(a.data().createdAt?.toMillis?.()||0));

        const header = `<div class="page-header slide-up">
            <div class="page-header-left">
                <h2>Pendaftaran Guru</h2>
                <p>${snapshot.size} pendaftaran menunggu persetujuan</p>
            </div>
        </div>`;

        if (snapshot.empty) {
            DOM.pageContainer.innerHTML = header + renderEmpty('Tidak ada pendaftaran guru pending','fas fa-chalkboard-user','Semua sudah diproses');
            return;
        }

        const rows = sorted.map(doc => {
            const d = doc.data();
            return `<tr>
                <td>
                    <div class="td-person">
                        <div class="td-avatar td-avatar-blue">${(d.nama||'?')[0].toUpperCase()}</div>
                        <div>
                            <strong>${escapeHtml(d.nama||'-')}</strong>
                            <small>${escapeHtml(d.nuptk||'-')}</small>
                        </div>
                    </div>
                </td>
                <td class="td-mono">${escapeHtml(d.nip||'-')}</td>
                <td>${escapeHtml(d.jabatan||'-')}</td>
                <td>${fmtDateTime(d.createdAt)}</td>
                <td>${statusBadge(d.status||'pending')}</td>
                <td><div class="td-actions">
                    <button class="btn btn-ghost btn-sm btn-icon" onclick="viewGuruDetail('${doc.id}')" title="Detail"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-primary btn-sm" onclick="approveItemGuru('guru','${doc.id}')"><i class="fas fa-check"></i> Setujui</button>
                    <button class="btn btn-danger btn-sm" onclick="rejectGuruWithReason('${doc.id}')"><i class="fas fa-xmark"></i> Tolak</button>
                </div></td>
            </tr>`;
        }).join('');

        DOM.pageContainer.innerHTML = header + renderSearchTable(
            ['Guru','NIP/NIPY','Jabatan','Tgl Daftar','Status','Aksi'],
            rows, snapshot.size, 'pendaftar'
        );
        attachTableSearch();
    } catch(e) {
        console.error(e);
        DOM.pageContainer.innerHTML = renderEmpty('Gagal memuat data','fas fa-exclamation-triangle', e.message);
    }
}

async function approveItemGuru(coll, id) {
    try {
        await db.collection(coll).doc(id).update({ status:'approved', approvedAt: firebase.firestore.FieldValue.serverTimestamp() });
        showToast('Pendaftaran guru disetujui! Guru dapat login.','success');
        navigateTo(State.page);
    } catch(e) { showToast('Gagal menyetujui','error'); }
}

function rejectGuruWithReason(id) {
    openModal(`
        <div class="modal-head">
            <h3><i class="fas fa-xmark-circle" style="color:var(--rose-500);margin-right:8px;"></i>Tolak Pendaftaran Guru</h3>
            <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
        </div>
        <div class="modal-body">
            <div class="reject-warning">
                <i class="fas fa-triangle-exclamation"></i>
                <span>Guru akan diberitahu alasan penolakan.</span>
            </div>
            <div class="form-group">
                <label class="form-label">Alasan Penolakan <span style="color:var(--rose-500)">*</span></label>
                <textarea id="alasanTolakGuru" class="form-textarea" rows="4" placeholder="Contoh: NUPTK tidak ditemukan / Data tidak valid / NIP tidak sesuai..."></textarea>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-danger" onclick="confirmRejectGuru('${id}')"><i class="fas fa-xmark"></i> Tolak Pendaftaran</button>
            <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        </div>`);
}

async function confirmRejectGuru(id) {
    const alasan = el('alasanTolakGuru')?.value.trim();
    if (!alasan) { showToast('Alasan penolakan wajib diisi!','warning'); return; }
    try {
        await db.collection('guru').doc(id).update({
            status:'rejected',
            alasanTolak: alasan,
            rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        closeModal();
        showToast('Pendaftaran guru ditolak.','success');
        navigateTo(State.page);
    } catch(e) { showToast('Gagal menolak','error'); }
}

// View Guru Detail
async function viewGuruDetail(id) {
    openModal(`<div class="modal-head"><h3><i class="fas fa-chalkboard-user" style="color:var(--accent);margin-right:8px;"></i>Memuat data guru...</h3><button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button></div><div class="modal-body">${renderLoadingPage()}</div>`, 'modal-xl');
    try {
        const doc = await db.collection('guru').doc(id).get();
        if (!doc.exists) { showToast('Data tidak ditemukan','error'); closeModal(); return; }
        const d = doc.data();
        const isPending = d.status === 'pending';

        const f = (label, val, full=false) =>
            `<div class="detail-field${full?' detail-field-full':''}"><label>${label}</label><p>${val||'<span style="color:var(--text-4)">-</span>'}</p></div>`;

        const fotoId = extractGDriveId(d.fotoUrl||d.foto||d.pasFoto||'');
        const fotoHtml = fotoId
            ? `<div class="detail-foto-wrap"><img src="https://drive.google.com/thumbnail?id=${fotoId}&sz=w300" alt="Foto Guru" class="detail-foto" onerror="this.style.display='none'"></div>`
            : '';

        const dokFields = Object.entries(d).filter(([k,v]) =>
            typeof v==='string' && (v.includes('drive.google.com') || (v.startsWith('http') && !v.includes('mailto'))) && !['email','uid'].includes(k)
        );
        const dokLabels = { fotoUrl:'Pas Foto', foto:'Pas Foto', ijazah:'Ijazah Terakhir', sertifikasi:'Sertifikasi Guru', sk:'SK Pengangkatan', ktp:'KTP', npwp:'NPWP' };
        const dokHtml = dokFields.length ? `
            <div class="detail-section-title" style="margin-top:16px;"><i class="fas fa-file-lines"></i> Dokumen</div>
            <div class="doc-grid">${dokFields.map(([k,url]) => {
                const gId = extractGDriveId(url);
                const lbl = dokLabels[k] || k.replace(/([A-Z])/g,' $1').trim();
                return `<div class="doc-item">
                    <div class="doc-item-head"><i class="fab fa-google-drive"></i><span>${escapeHtml(lbl)}</span></div>
                    ${gId ? `<div class="doc-item-frame"><iframe src="https://drive.google.com/file/d/${gId}/preview" allow="autoplay" loading="lazy"></iframe></div>` : ''}
                    <a href="${escapeHtml(url)}" target="_blank" class="doc-item-link"><i class="fas fa-arrow-up-right-from-square"></i> Buka di Google Drive</a>
                </div>`;
            }).join('')}</div>` : '';

        openModal(`
            <div class="modal-head">
                <h3><i class="fas fa-chalkboard-user" style="color:var(--accent);margin-right:8px;"></i>
                    Detail Guru ${statusBadge(d.status||'pending')}
                </h3>
                <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
            </div>
            <div class="modal-body">
                ${fotoHtml}
                <div class="detail-section-title"><i class="fas fa-id-card"></i> Data Pribadi</div>
                <div class="detail-grid">
                    ${f('Nama Lengkap', escapeHtml(d.nama))}
                    ${f('NIP / NIPY', escapeHtml(d.nip))}
                    ${f('NUPTK', escapeHtml(d.nuptk))}
                    ${f('NIK', escapeHtml(d.nik))}
                    ${f('Jabatan', escapeHtml(d.jabatan))}
                    ${f('Mata Pelajaran', escapeHtml(d.mapel||d.mataPelajaran))}
                    ${f('Jenis Kelamin', escapeHtml(d.jenisKelamin||d.jk||d.gender))}
                    ${f('Tempat Lahir', escapeHtml(d.tempatLahir))}
                    ${f('Tanggal Lahir', escapeHtml(d.tanggalLahir||d.ttl))}
                    ${f('Agama', escapeHtml(d.agama))}
                    ${f('No. HP / WA', escapeHtml(d.noHp||d.hp||d.telepon||d.wa))}
                    ${f('Email', escapeHtml(d.emailGuru||d.email))}
                </div>

                <div class="detail-section-title" style="margin-top:16px;"><i class="fas fa-graduation-cap"></i> Data Kepegawaian</div>
                <div class="detail-grid">
                    ${f('Status Kepegawaian', escapeHtml(d.statusKepegawaian||d.statusPegawai))}
                    ${f('Golongan / Pangkat', escapeHtml(d.golongan||d.pangkat))}
                    ${f('Pendidikan Terakhir', escapeHtml(d.pendidikanTerakhir||d.pendidikan))}
                    ${f('Universitas / Institusi', escapeHtml(d.universitas||d.institusi))}
                </div>

                <div class="detail-section-title" style="margin-top:16px;"><i class="fas fa-circle-info"></i> Info Pendaftaran</div>
                <div class="detail-grid">
                    ${f('Status', statusBadge(d.status||'pending'))}
                    ${f('Tgl Daftar', fmtDateTime(d.createdAt))}
                    ${d.approvedAt ? f('Tgl Disetujui', fmtDateTime(d.approvedAt)) : ''}
                    ${d.rejectedAt  ? f('Tgl Ditolak',  fmtDateTime(d.rejectedAt))  : ''}
                    ${d.alasanTolak ? f('Alasan Ditolak', escapeHtml(d.alasanTolak)) : ''}
                </div>
                ${dokHtml}
            </div>
            <div class="modal-footer">
                ${isPending ? `
                    <button class="btn btn-primary" onclick="approveItemGuru('guru','${id}');closeModal()"><i class="fas fa-check"></i> Setujui</button>
                    <button class="btn btn-danger" onclick="closeModal();setTimeout(()=>rejectGuruWithReason('${id}'),300)"><i class="fas fa-xmark"></i> Tolak</button>
                ` : ''}
                <button class="btn btn-ghost" onclick="closeModal()">Tutup</button>
            </div>`, 'modal-xl');
    } catch(e) { console.error(e); showToast('Gagal memuat detail guru','error'); closeModal(); }
}

// ======================================================
// RESET PASSWORD GURU
// ======================================================
// Simpan unsubscribe listener halaman reset agar bisa dilepas saat pindah halaman
let _resetPageUnsub = null;

function _renderResetTable(docs) {
    const sorted = docs.slice().sort((a,b) =>
        (b.data().createdAt?.toMillis?.() || 0) - (a.data().createdAt?.toMillis?.() || 0)
    );
    const header = `<div class="page-header slide-up">
            <div class="page-header-left">
                <h2>Request Reset Password Guru</h2>
                <p>${docs.length} total request</p>
            </div>
        </div>`;

    if (sorted.length === 0) {
        DOM.pageContainer.innerHTML = header + renderEmpty('Tidak ada request reset password','fas fa-key');
        return;
    }

    const rows = sorted.map(doc => {
        const d = doc.data();
        let statusStr = d.status || 'pending';
        const badge = statusStr === 'approved'
            ? (d.passwordChanged ? statusBadge('valid') : statusBadge('proses'))
            : statusBadge(statusStr);

        return `<tr>
                <td>
                    <div class="td-person">
                        <div class="td-avatar td-avatar-blue">${(d.nama||'?')[0].toUpperCase()}</div>
                        <div>
                            <strong>${escapeHtml(d.nama||'-')}</strong>
                            <small>NIP: ${escapeHtml(d.nip||'-')}</small>
                        </div>
                    </div>
                </td>
                <td class="td-mono">${escapeHtml(d.nuptk||'-')}</td>
                <td>${fmtDateTime(d.createdAt)}</td>
                <td>${badge}</td>
                <td><div class="td-actions">
                    <button class="btn btn-ghost btn-sm btn-icon" onclick="viewResetDetail('${doc.id}')" title="Detail"><i class="fas fa-eye"></i></button>
                    ${statusStr === 'pending' ? `
                        <button class="btn btn-primary btn-sm" onclick="approveResetRequest('${doc.id}')"><i class="fas fa-check"></i> Setujui</button>
                        <button class="btn btn-danger btn-sm" onclick="rejectResetRequest('${doc.id}')"><i class="fas fa-xmark"></i> Tolak</button>
                    ` : statusStr === 'approved' && !d.passwordChanged ? `
                        <button class="btn btn-blue btn-sm" onclick="kirimLinkReset('${doc.id}')"><i class="fas fa-paper-plane"></i> Kirim Link</button>
                    ` : ''}
                </div></td>
            </tr>`;
    }).join('');

    DOM.pageContainer.innerHTML = header + renderSearchTable(
        ['Guru','NUPTK','Tgl Request','Status Reset','Aksi'],
        rows, docs.length, 'request'
    );
    attachTableSearch();
}

function loadResetPasswordGuru() {
    // Lepas listener lama jika masih aktif
    if (_resetPageUnsub) { _resetPageUnsub(); _resetPageUnsub = null; }

    DOM.pageContainer.innerHTML = renderLoadingPage();

    _resetPageUnsub = db.collection('resetPasswordRequests')
        .onSnapshot(snapshot => {
            _renderResetTable(snapshot.docs);
        }, err => {
            console.error(err);
            DOM.pageContainer.innerHTML = renderEmpty('Gagal memuat data','fas fa-exclamation-triangle', err.message);
        });
}

async function viewResetDetail(id) {
    try {
        const doc = await db.collection('resetPasswordRequests').doc(id).get();
        if (!doc.exists) { showToast('Data tidak ditemukan','error'); return; }
        const d = doc.data();
        const f = (label, val) => `<div class="detail-field"><label>${label}</label><p>${val||'-'}</p></div>`;

        let statusStr = d.status||'pending';
        const displayStatus = statusStr === 'approved'
            ? (d.passwordChanged ? statusBadge('valid') : statusBadge('proses'))
            : statusBadge(statusStr);

        openModal(`
            <div class="modal-head">
                <h3><i class="fas fa-key" style="color:var(--amber-500);margin-right:8px;"></i>
                    Detail Request Reset Password
                </h3>
                <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
            </div>
            <div class="modal-body">
                <div class="detail-grid">
                    ${f('Nama Guru', escapeHtml(d.nama))}
                    ${f('NIP / NIPY', escapeHtml(d.nip))}
                    ${f('NUPTK', escapeHtml(d.nuptk))}
                    ${f('Tgl Request', fmtDateTime(d.createdAt))}
                    ${f('Status', displayStatus)}
                    ${d.alasanTolak ? f('Alasan Ditolak', escapeHtml(d.alasanTolak)) : ''}
                    ${d.approvedAt  ? f('Tgl Disetujui', fmtDateTime(d.approvedAt)) : ''}
                    ${d.resetLinkSentAt ? f('Link Reset Dikirim', fmtDateTime(d.resetLinkSentAt)) : ''}
                    ${d.passwordChangedAt ? f('Password Diganti', fmtDateTime(d.passwordChangedAt)) : ''}
                </div>
                ${d.resetToken ? `
                    <div class="reset-link-box">
                        <div class="reset-link-label"><i class="fas fa-link"></i> Link Reset Password (berlaku 3 menit saat dikirim)</div>
                        <div class="reset-link-url" id="rlUrl">${escapeHtml('portal-guru.html?resetToken='+d.resetToken+'&guruId='+id)}</div>
                        <button class="btn btn-ghost btn-sm" onclick="copyResetLink('${id}','${d.resetToken}')"><i class="fas fa-copy"></i> Copy Link</button>
                    </div>` : ''}
            </div>
            <div class="modal-footer">
                ${statusStr === 'pending' ? `
                    <button class="btn btn-primary" onclick="approveResetRequest('${id}');closeModal()"><i class="fas fa-check"></i> Setujui</button>
                    <button class="btn btn-danger" onclick="closeModal();setTimeout(()=>rejectResetRequest('${id}'),300)"><i class="fas fa-xmark"></i> Tolak</button>
                ` : statusStr === 'approved' && !d.passwordChanged ? `
                    <button class="btn btn-blue" onclick="kirimLinkReset('${id}');closeModal()"><i class="fas fa-paper-plane"></i> Kirim Link Reset</button>
                ` : ''}
                <button class="btn btn-ghost" onclick="closeModal()">Tutup</button>
            </div>`);
    } catch(e) { showToast('Gagal memuat detail','error'); }
}

async function approveResetRequest(id) {
    try {
        const token = generateResetToken();
        await db.collection('resetPasswordRequests').doc(id).update({
            status:'approved',
            resetToken: token,
            approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
            passwordChanged: false,
        });
        showToast('Request disetujui. Guru dapat mereset password menggunakan link.','success');
    } catch(e) { showToast('Gagal menyetujui','error'); }
}

function rejectResetRequest(id) {
    openModal(`
        <div class="modal-head">
            <h3><i class="fas fa-xmark-circle" style="color:var(--rose-500);margin-right:8px;"></i>Tolak Request Reset Password</h3>
            <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label class="form-label">Alasan Penolakan <span style="color:var(--rose-500)">*</span></label>
                <textarea id="alasanTolakReset" class="form-textarea" rows="3" placeholder="Contoh: NUPTK tidak sesuai / Identitas tidak valid..."></textarea>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-danger" onclick="confirmRejectReset('${id}')"><i class="fas fa-xmark"></i> Tolak</button>
            <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        </div>`);
}

async function confirmRejectReset(id) {
    const alasan = el('alasanTolakReset')?.value.trim();
    if (!alasan) { showToast('Alasan wajib diisi!','warning'); return; }
    try {
        await db.collection('resetPasswordRequests').doc(id).update({
            status:'rejected', alasanTolak: alasan,
            rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        closeModal();
        showToast('Request ditolak.','success');
    } catch(e) { showToast('Gagal','error'); }
}

async function kirimLinkReset(id) {
    try {
        const doc = await db.collection('resetPasswordRequests').doc(id).get();
        const d = doc.data();
        const token = d.resetToken || generateResetToken();
        await db.collection('resetPasswordRequests').doc(id).update({
            resetToken: token,
            resetLinkSentAt: firebase.firestore.FieldValue.serverTimestamp(),
            passwordChanged: false,
        });
        const link = `portal-guru.html?resetToken=${token}&guruId=${id}`;
        openModal(`
            <div class="modal-head">
                <h3><i class="fas fa-paper-plane" style="color:var(--accent);margin-right:8px;"></i>Link Reset Password</h3>
                <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
            </div>
            <div class="modal-body">
                <div class="success-notice">
                    <i class="fas fa-circle-check"></i>
                    <span>Link reset berhasil dibuat. Bagikan link berikut kepada guru yang bersangkutan. Link berlaku 3 menit sejak dibuka.</span>
                </div>
                <div class="reset-link-box" style="margin-top:16px;">
                    <div class="reset-link-label"><i class="fas fa-link"></i> Link Reset Password</div>
                    <div class="reset-link-url" id="rlUrlGenerated">${escapeHtml(link)}</div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" onclick="navigator.clipboard.writeText('${link}').then(()=>showToast('Link disalin!','success'))">
                    <i class="fas fa-copy"></i> Salin Link
                </button>
                <button class="btn btn-ghost" onclick="closeModal()">Tutup</button>
            </div>`);
    } catch(e) { showToast('Gagal membuat link reset','error'); }
}

function copyResetLink(id, token) {
    const link = `portal-guru.html?resetToken=${token}&guruId=${id}`;
    navigator.clipboard.writeText(link).then(() => showToast('Link disalin ke clipboard!','success'));
}

function generateResetToken() {
    return Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b=>b.toString(16).padStart(2,'0')).join('');
}

// ======================================================
// DATA SISWA — dengan kelola akun
// ======================================================
async function loadDataSiswa() {
    DOM.pageContainer.innerHTML = renderLoadingPage();
    try {
        const kelasList = [];
        for (let i=10;i<=12;i++) for (let j=1;j<=8;j++) kelasList.push(`${i}.${j}`);

        const snapshot = await db.collection('siswa').where('status','==','approved').orderBy('kelas').orderBy('nama').get();

        // Check fitur edit toggle setting
        const settingDoc = await db.collection('settings').doc('portalSiswa').get();
        const editEnabled = settingDoc.exists ? (settingDoc.data().editDataEnabled ?? false) : false;

        const chipHtml = `<div class="filter-chips">
            <button class="chip active" onclick="filterTableRows('siswaBody','kelas','',this)">Semua</button>
            ${kelasList.map(k=>`<button class="chip" onclick="filterTableRows('siswaBody','kelas','${k}',this)">${k}</button>`).join('')}
        </div>`;

        const header = `<div class="page-header slide-up">
            <div class="page-header-left">
                <h2>Data Siswa Aktif</h2>
                <p>${snapshot.size} siswa terdaftar</p>
            </div>
            <div class="page-header-actions">
                <div class="feature-toggle-wrap">
                    <span class="feature-toggle-label"><i class="fas fa-pencil"></i> Fitur Edit Data Siswa di Portal</span>
                    <button class="toggle-switch ${editEnabled?'active':''}" id="editFeatureToggle" onclick="toggleEditFeature(this)">
                        <span class="toggle-knob"></span>
                    </button>
                    <span class="toggle-status" id="editToggleStatus">${editEnabled?'<span style="color:var(--primary)">Aktif</span>':'<span style="color:var(--text-4)">Nonaktif</span>'}</span>
                </div>
            </div>
        </div>`;

        if (snapshot.empty) {
            DOM.pageContainer.innerHTML = header + chipHtml + renderEmpty('Belum ada siswa aktif','fas fa-users');
            return;
        }

        const rows = snapshot.docs.map(doc => {
            const d = doc.data();
            const akunStatus = d.akunStatus || 'aktif';
            return `<tr data-kelas="${escapeHtml(d.kelas||'')}">
                <td>
                    <div class="td-person">
                        <div class="td-avatar">${(d.nama||'?')[0].toUpperCase()}</div>
                        <div>
                            <strong>${escapeHtml(d.nama||'-')}</strong>
                            <small>${escapeHtml(d.nisn||'-')}</small>
                        </div>
                    </div>
                </td>
                <td>${escapeHtml(d.kelas||'-')}</td>
                <td>${escapeHtml(d.jurusan||'-')}</td>
                <td>${statusBadge(akunStatus)}</td>
                <td><div class="td-actions">
                    <button class="btn btn-ghost btn-sm btn-icon" onclick="viewSiswaDetail('${doc.id}')" title="Detail"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-ghost btn-sm btn-icon" onclick="kelolaAkunSiswa('${doc.id}','${escapeHtml(d.nama||'')}','${akunStatus}')" title="Kelola Akun"><i class="fas fa-user-gear"></i></button>
                </div></td>
            </tr>`;
        }).join('');

        DOM.pageContainer.innerHTML = header + `<div class="table-wrap fade-in">
            ${chipHtml}
            <div class="table-toolbar">
                <div class="table-search"><i class="fas fa-magnifying-glass"></i><input type="text" placeholder="Cari nama siswa..." id="tblSearch"></div>
                <span class="table-count" id="tblCount">${snapshot.size} siswa</span>
            </div>
            <div class="table-scroll">
                <table>
                    <thead><tr><th>Siswa</th><th>Kelas</th><th>Jurusan</th><th>Status Akun</th><th>Aksi</th></tr></thead>
                    <tbody id="siswaBody">${rows}</tbody>
                </table>
            </div>
        </div>`;
        attachTableSearch('siswaBody','tblSearch','tblCount','siswa');
    } catch(e) {
        console.error(e);
        DOM.pageContainer.innerHTML = renderEmpty('Gagal memuat data','fas fa-exclamation-triangle', e.message);
    }
}

async function toggleEditFeature(btn) {
    const current = btn.classList.contains('active');
    const newState = !current;
    try {
        await db.collection('settings').doc('portalSiswa').set({ editDataEnabled: newState }, { merge:true });
        btn.classList.toggle('active', newState);
        const statusEl = el('editToggleStatus');
        if (statusEl) statusEl.innerHTML = newState
            ? '<span style="color:var(--primary)">Aktif</span>'
            : '<span style="color:var(--text-4)">Nonaktif</span>';
        showToast(`Fitur edit data siswa di portal: ${newState?'DIAKTIFKAN':'DINONAKTIFKAN'}`, 'success');
    } catch(e) {
        showToast('Gagal mengubah pengaturan','error');
    }
}

function kelolaAkunSiswa(id, nama, currentStatus) {
    const opts = [
        { val:'aktif',               icon:'fas fa-circle-check', color:'green', label:'Aktif', desc:'Siswa dapat login normal' },
        { val:'nonaktif_sementara',  icon:'fas fa-pause-circle',  color:'amber', label:'Non-Aktif Sementara', desc:'Akun diblokir sementara (misal: absen lama)' },
        { val:'nonaktif_permanen',   icon:'fas fa-ban',           color:'rose',  label:'Non-Aktif Permanen', desc:'Akun diblokir permanen (misal: keluar sekolah)' },
    ];

    openModal(`
        <div class="modal-head">
            <h3><i class="fas fa-user-gear" style="color:var(--accent);margin-right:8px;"></i>Kelola Status Akun Siswa</h3>
            <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
        </div>
        <div class="modal-body">
            <div class="akun-profile-row">
                <div class="td-avatar td-avatar-lg">${nama[0].toUpperCase()}</div>
                <div>
                    <strong>${escapeHtml(nama)}</strong>
                    <p style="font-size:.82rem;color:var(--text-3)">Status saat ini: ${statusBadge(currentStatus)}</p>
                </div>
            </div>
            <p style="font-size:.85rem;color:var(--text-3);margin:12px 0 16px;">Pilih status akun baru. Status ini akan langsung tersinkron saat siswa login.</p>
            <div class="akun-status-grid" id="akunStatusGrid">
                ${opts.map(o => `
                    <div class="akun-status-opt ${o.val===currentStatus?'active':''}" onclick="selectAkunStatus('${o.val}',this)" data-val="${o.val}">
                        <div class="aso-icon ${o.color}"><i class="${o.icon}"></i></div>
                        <div><strong>${o.label}</strong><p>${o.desc}</p></div>
                        ${o.val===currentStatus ? '<span class="aso-check"><i class="fas fa-check"></i></span>' : ''}
                    </div>`).join('')}
            </div>
            <div class="form-group" id="alasanAkunGroup">
                <label class="form-label">Alasan Perubahan Status <span style="color:var(--rose-500)">*</span></label>
                <textarea id="alasanAkunSiswa" class="form-textarea" rows="3" placeholder="Tuliskan alasan perubahan status akun... (wajib untuk nonaktif)"></textarea>
                <small class="field-hint">Alasan ini akan ditampilkan kepada siswa saat login.</small>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-primary" onclick="saveAkunSiswaStatus('${id}')"><i class="fas fa-save"></i> Simpan Perubahan</button>
            <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        </div>`);
}

let selectedAkunStatus = null;

function selectAkunStatus(val, el) {
    selectedAkunStatus = val;
    qsa('.akun-status-opt').forEach(o => {
        o.classList.toggle('active', o.dataset.val === val);
    });
}

async function saveAkunSiswaStatus(id) {
    const newStatus = selectedAkunStatus || qs('.akun-status-opt.active')?.dataset.val;
    const alasan    = el('alasanAkunSiswa')?.value.trim();
    if (!newStatus) { showToast('Pilih status terlebih dahulu!','warning'); return; }
    if (newStatus !== 'aktif' && !alasan) { showToast('Alasan wajib diisi untuk status nonaktif!','warning'); return; }
    try {
        const updateData = {
            akunStatus: newStatus,
            akunUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };
        if (alasan) updateData.akunAlasan = alasan;
        await db.collection('siswa').doc(id).update(updateData);
        closeModal();
        showToast('Status akun berhasil diperbarui!','success');
        loadDataSiswa();
        selectedAkunStatus = null;
    } catch(e) { showToast('Gagal menyimpan status','error'); }
}

function filterTableRows(tbodyId, attr, value, btn) {
    qsa('.chip').forEach(c => c.classList.remove('active'));
    btn?.classList.add('active');
    const tbody = el(tbodyId);
    if (!tbody) return;
    let visible = 0;
    qsa('tr', tbody).forEach(row => {
        const match = !value || row.dataset[attr] === value;
        row.style.display = match ? '' : 'none';
        if (match) visible++;
    });
    const counter = qs('.table-count');
    if (counter) counter.textContent = `${visible} ${tbodyId.includes('guru')?'guru':'siswa'}`;
}

// ======================================================
// DATA GURU
// ======================================================
async function loadDataGuru() {
    DOM.pageContainer.innerHTML = renderLoadingPage();
    try {
        const jabatanList = ['Kepala Sekolah','Wakil Kepala Sekolah','Guru Matematika','Guru Bahasa Indonesia','Guru Bahasa Inggris','Guru Fisika','Guru Kimia','Guru Biologi','Guru Sejarah','Guru Geografi','Guru Ekonomi','Guru Sosiologi','Guru PJOK','Guru Seni Budaya','Guru Informatika','Guru Pendidikan Agama','Guru PKN','Guru BK','Kesiswaan','Tata Usaha','Lainnya'];
        const snapshot = await db.collection('guru').where('status','==','approved').orderBy('jabatan').orderBy('nama').get();

        const chipHtml = `<div class="filter-chips">
            <button class="chip active" onclick="filterTableRows('guruBody','jabatan','',this)">Semua</button>
            ${jabatanList.map(j=>`<button class="chip" onclick="filterTableRows('guruBody','jabatan','${escapeHtml(j)}',this)">${escapeHtml(j)}</button>`).join('')}
        </div>`;

        const header = `<div class="page-header slide-up">
            <div class="page-header-left">
                <h2>Data Guru Aktif</h2>
                <p>${snapshot.size} guru terdaftar</p>
            </div>
        </div>`;

        if (snapshot.empty) {
            DOM.pageContainer.innerHTML = header + chipHtml + renderEmpty('Belum ada guru aktif','fas fa-person-chalkboard');
            return;
        }

        const rows = snapshot.docs.map(doc => {
            const d = doc.data();
            return `<tr data-jabatan="${escapeHtml(d.jabatan||'')}">
                <td>
                    <div class="td-person">
                        <div class="td-avatar td-avatar-blue">${(d.nama||'?')[0].toUpperCase()}</div>
                        <div>
                            <strong>${escapeHtml(d.nama||'-')}</strong>
                            <small>NUPTK: ${escapeHtml(d.nuptk||'-')}</small>
                        </div>
                    </div>
                </td>
                <td class="td-mono">${escapeHtml(d.nip||'-')}</td>
                <td>${escapeHtml(d.jabatan||'-')}</td>
                <td>${fmtDate(d.approvedAt)}</td>
                <td><div class="td-actions">
                    <button class="btn btn-ghost btn-sm btn-icon" onclick="viewGuruDetail('${doc.id}')" title="Detail"><i class="fas fa-eye"></i></button>
                </div></td>
            </tr>`;
        }).join('');

        DOM.pageContainer.innerHTML = header + `<div class="table-wrap fade-in">
            ${chipHtml}
            <div class="table-toolbar">
                <div class="table-search"><i class="fas fa-magnifying-glass"></i><input type="text" placeholder="Cari nama guru..." id="tblSearch"></div>
                <span class="table-count" id="tblCount">${snapshot.size} guru</span>
            </div>
            <div class="table-scroll">
                <table>
                    <thead><tr><th>Guru</th><th>NIP/NIPY</th><th>Jabatan</th><th>Tgl Disetujui</th><th>Aksi</th></tr></thead>
                    <tbody id="guruBody">${rows}</tbody>
                </table>
            </div>
        </div>`;
        attachTableSearch('guruBody','tblSearch','tblCount','guru');
    } catch(e) {
        console.error(e);
        DOM.pageContainer.innerHTML = renderEmpty('Gagal memuat data','fas fa-exclamation-triangle', e.message);
    }
}

// ======================================================
// MUTASI PAGE
// ======================================================
async function loadMutasiPage() {
    DOM.pageContainer.innerHTML = renderLoadingPage();
    try {
        const snapshot = await db.collection('pendaftaranMutasi').get();
        const sorted   = snapshot.docs.slice().sort((a,b)=>(b.data().createdAt?.toMillis?.()||0)-(a.data().createdAt?.toMillis?.()||0));

        const header = `<div class="page-header slide-up">
            <div class="page-header-left"><h2>Pendaftaran Mutasi</h2><p>${snapshot.size} total pendaftaran mutasi</p></div>
        </div>`;

        if (snapshot.empty) {
            DOM.pageContainer.innerHTML = header + renderEmpty('Tidak ada pendaftaran mutasi','fas fa-right-left');
            return;
        }

        const rows = sorted.map(doc => {
            const d = doc.data();
            return `<tr>
                <td class="td-mono td-strong">${escapeHtml(d.noDaftar||'-')}</td>
                <td>
                    <div class="td-person">
                        <div class="td-avatar">${(d.nama||'?')[0].toUpperCase()}</div>
                        <div><strong>${escapeHtml(d.nama||'-')}</strong><small>${escapeHtml(d.sekolahAsal||'-')}</small></div>
                    </div>
                </td>
                <td>${statusBadge(d.status)}</td>
                <td>${fmtDate(d.createdAt)}</td>
                <td><div class="td-actions">
                    <button class="btn btn-ghost btn-sm btn-icon" onclick="viewMutasiDocs('${doc.id}')" title="Dokumen"><i class="fas fa-folder-open"></i></button>
                    <button class="btn btn-blue btn-sm btn-icon" onclick="prosesMutasi('${doc.id}')" title="Proses"><i class="fas fa-gear"></i></button>
                    <button class="btn btn-primary btn-sm btn-icon" onclick="approveMutasi('${doc.id}')" title="Setujui"><i class="fas fa-check"></i></button>
                    <button class="btn btn-danger btn-sm btn-icon" onclick="rejectMutasi('${doc.id}')" title="Tolak"><i class="fas fa-xmark"></i></button>
                </div></td>
            </tr>`;
        }).join('');

        DOM.pageContainer.innerHTML = header + renderSearchTable(['No.Daftar','Siswa / Asal Sekolah','Status','Tanggal','Aksi'], rows, snapshot.size, 'mutasi');
        attachTableSearch();
    } catch(e) {
        console.error(e);
        DOM.pageContainer.innerHTML = renderEmpty('Gagal memuat data','fas fa-exclamation-triangle', e.message);
    }
}

async function viewMutasiDocs(id) {
    openModal(`<div class="modal-head"><h3>Memuat dokumen...</h3><button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button></div><div class="modal-body">${renderLoadingPage()}</div>`, 'modal-xl');
    try {
        const doc = await db.collection('pendaftaranMutasi').doc(id).get();
        if (!doc.exists) { showToast('Data tidak ditemukan','error'); closeModal(); return; }
        const d = doc.data();
        const docLabels = { nilaiRapor:'Nilai Rapor', pasFoto:'Pas Foto', aktaLahir:'Akta Kelahiran', kartuKeluarga:'Kartu Keluarga', ktpOrKia:'KTP/KIA', suratBaik:'Surat Keterangan Baik', suratSehat:'Surat Kesehatan', suratPindahOrtu:'Surat Pindah Ortu', suratPindahSekolah:'Surat Pindah Sekolah' };
        const allDocs = { ...(d.dokumen||{}) };
        if (d.linkSuratPernyataan && d.linkSuratPernyataan !== '-') allDocs.suratPernyataan = d.linkSuratPernyataan;
        const docsHtml = Object.entries(allDocs).filter(([,url])=>url&&url!=='-').map(([k,url]) => {
            const gId = extractGDriveId(url);
            return `<div class="doc-item">
                <div class="doc-item-head"><i class="fab fa-google-drive"></i><span>${escapeHtml(docLabels[k]||k)}</span></div>
                ${gId ? `<div class="doc-item-frame"><iframe src="https://drive.google.com/file/d/${gId}/preview" allow="autoplay" loading="lazy"></iframe></div>` : ''}
                <a href="${escapeHtml(url)}" target="_blank" class="doc-item-link"><i class="fas fa-arrow-up-right-from-square"></i> Buka di Google Drive</a>
            </div>`;
        }).join('');

        openModal(`
            <div class="modal-head">
                <h3>Dokumen Mutasi — ${escapeHtml(d.nama)}</h3>
                <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
            </div>
            <div class="modal-body">
                <div class="detail-grid" style="margin-bottom:16px;">
                    <div class="detail-field"><label>No. Pendaftaran</label><p>${escapeHtml(d.noDaftar||'-')}</p></div>
                    <div class="detail-field"><label>Sekolah Asal</label><p>${escapeHtml(d.sekolahAsal||'-')}</p></div>
                    <div class="detail-field"><label>Status</label><p>${statusBadge(d.status)}</p></div>
                    ${d.catatanOperator ? `<div class="detail-field detail-field-full"><label>Catatan Operator</label><p>${escapeHtml(d.catatanOperator)}</p></div>` : ''}
                </div>
                ${!docsHtml ? renderEmpty('Tidak ada dokumen','fas fa-file-slash') : `<div class="doc-grid">${docsHtml}</div>`}
            </div>
            <div class="modal-footer">
                <button class="btn btn-blue" onclick="prosesMutasi('${id}');closeModal()"><i class="fas fa-gear"></i> Proses</button>
                <button class="btn btn-primary" onclick="approveMutasi('${id}');closeModal()"><i class="fas fa-check"></i> Setujui</button>
                <button class="btn btn-danger" onclick="closeModal();setTimeout(()=>rejectMutasi('${id}'),300)"><i class="fas fa-xmark"></i> Tolak</button>
                <button class="btn btn-ghost" onclick="closeModal()">Tutup</button>
            </div>`, 'modal-xl');
    } catch(e) { showToast('Gagal memuat dokumen','error'); closeModal(); }
}

async function prosesMutasi(id) {
    try {
        await db.collection('pendaftaranMutasi').doc(id).update({ status:'proses', updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        showToast('Status diubah ke Diproses','success'); loadMutasiPage();
    } catch(e) { showToast('Gagal','error'); }
}

async function approveMutasi(id) {
    try {
        await db.collection('pendaftaranMutasi').doc(id).update({ status:'diterima', updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        showToast('Mutasi disetujui!','success'); loadMutasiPage();
    } catch(e) { showToast('Gagal','error'); }
}

function rejectMutasi(id) {
    openModal(`
        <div class="modal-head">
            <h3>Tolak Pendaftaran Mutasi</h3>
            <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label class="form-label">Alasan Penolakan <span style="color:var(--rose-500)">*</span></label>
                <textarea id="alasanTolak" class="form-textarea" rows="4" placeholder="Tuliskan alasan penolakan secara jelas..."></textarea>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-danger" onclick="confirmRejectMutasi('${id}')"><i class="fas fa-xmark"></i> Tolak Pendaftaran</button>
            <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        </div>`);
}

async function confirmRejectMutasi(id) {
    const alasan = el('alasanTolak')?.value.trim();
    if (!alasan) { showToast('Alasan wajib diisi!','warning'); return; }
    try {
        await db.collection('pendaftaranMutasi').doc(id).update({ status:'ditolak', catatanOperator:alasan, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        closeModal(); showToast('Mutasi ditolak.','success'); loadMutasiPage();
    } catch(e) { showToast('Gagal','error'); }
}

// ======================================================
// ABSENSI
// ======================================================
async function loadAbsensiSiswa() {
    DOM.pageContainer.innerHTML = renderLoadingPage();
    try {
        const snapshot = await db.collection('absensiSiswa').orderBy('timestamp','desc').limit(100).get();
        const header = `<div class="page-header slide-up"><div class="page-header-left"><h2>Absensi Siswa</h2><p>${snapshot.size} data terbaru (100 terakhir)</p></div></div>`;
        if (snapshot.empty) { DOM.pageContainer.innerHTML = header + renderEmpty('Belum ada data absensi','fas fa-clipboard-list'); return; }
        const rows = snapshot.docs.map(doc => {
            const d = doc.data();
            return `<tr>
                <td><div class="td-person"><div class="td-avatar">${(d.nama||'?')[0].toUpperCase()}</div><div><strong>${escapeHtml(d.nama||'-')}</strong></div></div></td>
                <td>${escapeHtml(d.kelas||'-')}</td>
                <td>${fmtDateTime(d.timestamp)}</td>
                <td>${statusBadge(d.status)}</td>
                <td>${d.buktiUrl?`<a href="${escapeHtml(d.buktiUrl)}" target="_blank" class="file-link"><i class="fab fa-google-drive"></i> Lihat</a>`:'-'}</td>
            </tr>`;
        }).join('');
        DOM.pageContainer.innerHTML = header + renderSearchTable(['Siswa','Kelas','Tanggal & Jam','Status','Bukti'], rows, snapshot.size, 'absensi');
        attachTableSearch();
    } catch(e) { DOM.pageContainer.innerHTML = renderEmpty('Gagal memuat data','fas fa-exclamation-triangle', e.message); }
}

async function loadAbsensiGuru() {
    DOM.pageContainer.innerHTML = renderLoadingPage();
    try {
        const snapshot = await db.collection('absensiGuru').orderBy('timestamp','desc').limit(100).get();
        const header = `<div class="page-header slide-up"><div class="page-header-left"><h2>Absensi Guru</h2><p>${snapshot.size} data terbaru (100 terakhir)</p></div></div>`;
        if (snapshot.empty) { DOM.pageContainer.innerHTML = header + renderEmpty('Belum ada data absensi guru','fas fa-clipboard-check'); return; }
        const rows = snapshot.docs.map(doc => {
            const d = doc.data();
            return `<tr>
                <td><div class="td-person"><div class="td-avatar td-avatar-blue">${(d.nama||'?')[0].toUpperCase()}</div><div><strong>${escapeHtml(d.nama||'-')}</strong></div></div></td>
                <td>${escapeHtml(d.jabatan||'-')}</td>
                <td>${fmtDateTime(d.timestamp)}</td>
                <td>${statusBadge(d.status)}</td>
                <td>${d.buktiUrl?`<a href="${escapeHtml(d.buktiUrl)}" target="_blank" class="file-link"><i class="fab fa-google-drive"></i> Lihat</a>`:'-'}</td>
            </tr>`;
        }).join('');
        DOM.pageContainer.innerHTML = header + renderSearchTable(['Guru','Jabatan','Tanggal & Jam','Status','Bukti'], rows, snapshot.size, 'absensi');
        attachTableSearch();
    } catch(e) { DOM.pageContainer.innerHTML = renderEmpty('Gagal memuat data','fas fa-exclamation-triangle', e.message); }
}

// ======================================================
// PENGATURAN AKUN OPERATOR
// ======================================================
async function loadPengaturanAkun() {
    DOM.pageContainer.innerHTML = `
        <div class="page-header slide-up">
            <div class="page-header-left">
                <h2>Akun Operator</h2>
                <p>Kelola email dan password akun operator Anda</p>
            </div>
        </div>

        <div class="settings-grid">
            <div class="settings-card">
                <div class="settings-card-head">
                    <div class="settings-card-icon"><i class="fas fa-envelope"></i></div>
                    <div><h3>Ubah Email</h3><p>Email aktif: <strong>${escapeHtml(State.user?.email||'-')}</strong></p></div>
                </div>
                <form id="changeEmailForm" class="settings-form">
                    <div class="field-group">
                        <label>Email Baru</label>
                        <div class="field-input-wrap">
                            <i class="fas fa-envelope field-icon"></i>
                            <input type="email" id="settingsNewEmail" placeholder="email-baru@domain.com" required>
                        </div>
                    </div>
                    <div class="field-group">
                        <label>Password Saat Ini (verifikasi)</label>
                        <div class="field-input-wrap">
                            <i class="fas fa-lock field-icon"></i>
                            <input type="password" id="settingsEmailPass" placeholder="Masukkan password aktif" required>
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Simpan Email Baru</button>
                </form>
            </div>

            <div class="settings-card">
                <div class="settings-card-head">
                    <div class="settings-card-icon" style="background:var(--accent-soft);color:var(--accent)"><i class="fas fa-lock"></i></div>
                    <div><h3>Ubah Password</h3><p>Ganti password akun operator</p></div>
                </div>
                <form id="changePassForm" class="settings-form">
                    <div class="field-group">
                        <label>Password Lama</label>
                        <div class="field-input-wrap">
                            <i class="fas fa-lock field-icon"></i>
                            <input type="password" id="settingsOldPass" placeholder="Password saat ini" required>
                        </div>
                    </div>
                    <div class="field-group">
                        <label>Password Baru (min. 8 karakter)</label>
                        <div class="field-input-wrap">
                            <i class="fas fa-lock field-icon"></i>
                            <input type="password" id="settingsNewPass" placeholder="Minimal 8 karakter" required minlength="8">
                        </div>
                    </div>
                    <div class="field-group">
                        <label>Konfirmasi Password Baru</label>
                        <div class="field-input-wrap">
                            <i class="fas fa-lock field-icon"></i>
                            <input type="password" id="settingsConfPass" placeholder="Ulangi password baru" required>
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Simpan Password Baru</button>
                </form>
            </div>
        </div>`;

    // Bind forms
    el('changeEmailForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newEmail = el('settingsNewEmail').value.trim();
        const pass     = el('settingsEmailPass').value;
        if (!newEmail || !pass) return;
        try {
            const cred = firebase.auth.EmailAuthProvider.credential(State.user.email, pass);
            await State.user.reauthenticateWithCredential(cred);
            await State.user.updateEmail(newEmail);
            await db.collection('operators').doc(State.user.uid).set({ email: newEmail }, { merge:true });
            if (DOM.suEmail) DOM.suEmail.textContent = newEmail;
            showToast('Email berhasil diperbarui!','success');
            e.target.reset();
        } catch(err) {
            if (err.code === 'auth/wrong-password') showToast('Password salah.','error');
            else showToast('Gagal: ' + err.message,'error');
        }
    });

    el('changePassForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldPass  = el('settingsOldPass').value;
        const newPass  = el('settingsNewPass').value;
        const confPass = el('settingsConfPass').value;
        if (newPass.length < 8) { showToast('Password minimal 8 karakter!','warning'); return; }
        if (newPass !== confPass) { showToast('Konfirmasi password tidak cocok!','error'); return; }
        try {
            const cred = firebase.auth.EmailAuthProvider.credential(State.user.email, oldPass);
            await State.user.reauthenticateWithCredential(cred);
            await State.user.updatePassword(newPass);
            showToast('Password berhasil diperbarui!','success');
            e.target.reset();
        } catch(err) {
            if (err.code === 'auth/wrong-password') showToast('Password lama salah.','error');
            else showToast('Gagal: ' + err.message,'error');
        }
    });
}

// ── Window Exports ────────────────────────────────────────
window.navigateTo             = navigateTo;
window.closeModal             = closeModal;
window.removeToast            = removeToast;
window.markNotifRead          = markNotifRead;
window.filterTableRows        = filterTableRows;
// Siswa
window.viewSiswaDetail        = viewSiswaDetail;
window.prosesItemSiswa        = prosesItemSiswa;
window.approveItemSiswa       = approveItemSiswa;
window.rejectItemWithReason   = rejectItemWithReason;
window.confirmRejectItem      = confirmRejectItem;
window.kelolaAkunSiswa        = kelolaAkunSiswa;
window.selectAkunStatus       = selectAkunStatus;
window.saveAkunSiswaStatus    = saveAkunSiswaStatus;
window.toggleEditFeature      = toggleEditFeature;
// Guru
window.viewGuruDetail         = viewGuruDetail;
window.approveItemGuru        = approveItemGuru;
window.rejectGuruWithReason   = rejectGuruWithReason;
window.confirmRejectGuru      = confirmRejectGuru;
// Reset Password
window.viewResetDetail        = viewResetDetail;
window.approveResetRequest    = approveResetRequest;
window.rejectResetRequest     = rejectResetRequest;
window.confirmRejectReset     = confirmRejectReset;
window.kirimLinkReset         = kirimLinkReset;
window.copyResetLink          = copyResetLink;
// Mutasi
window.viewMutasiDocs         = viewMutasiDocs;
window.prosesMutasi           = prosesMutasi;
window.approveMutasi          = approveMutasi;
window.rejectMutasi           = rejectMutasi;
window.confirmRejectMutasi    = confirmRejectMutasi;

console.log('%c✅ Operator Panel SMAN 68 Jakarta V3.0.0 — Loaded', 'color:#22c55e;font-weight:700;font-size:14px;');
