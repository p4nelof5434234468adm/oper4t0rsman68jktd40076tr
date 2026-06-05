// ============================================================
// OPERATOR PANEL — SMAN 68 JAKARTA
// Premium Rebuild | Clean Architecture | Full Features
// ============================================================

'use strict';

// ── Firebase Config ────────────────────────────────────────
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

// ── Global State ───────────────────────────────────────────
const State = {
    user:        null,
    page:        'dashboard',
    theme:       localStorage.getItem('op68-theme') || 'light',
    notifications: [],
    unreadCount: 0,
    realtimeUnsubs: [],
    chartInstances: {},
    searchDebounce: null,
};

// ── DOM Helpers ────────────────────────────────────────────
const el   = (id) => document.getElementById(id);
const qs   = (sel, root = document) => root.querySelector(sel);
const qsa  = (sel, root = document) => [...root.querySelectorAll(sel)];

// ── Elements ───────────────────────────────────────────────
const DOM = {
    preloader:      el('preloader'),
    loginOverlay:   el('loginOverlay'),
    mainPanel:      el('mainPanel'),
    loginForm:      el('loginForm'),
    loginEmail:     el('loginEmail'),
    loginPassword:  el('loginPassword'),
    togglePass:     el('togglePass'),
    btnLogin:       el('btnLogin'),
    logoutBtn:      el('logoutBtn'),
    menuToggle:     el('menuToggle'),
    sidebarClose:   el('sidebarClose'),
    sidebarBackdrop:el('sidebarBackdrop'),
    sidebar:        el('sidebar'),
    sidebarSearch:  el('sidebarSearch'),
    pageContainer:  el('pageContainer'),
    pageTitle:      el('pageTitle'),
    suName:         el('suName'),
    suEmail:        el('suEmail'),
    topbarClock:    el('topbarClock'),
    themeToggle:    el('themeToggle'),
    notifWrap:      el('notifWrap'),
    notifBtn:       el('notifBtn'),
    notifPanel:     el('notifPanel'),
    notifList:      el('notifList'),
    notifDot:       el('notifDot'),
    clearAllNotif:  el('clearAllNotif'),
    modalOverlay:   el('modalOverlay'),
    modalBox:       el('modalBox'),
    toastStack:     el('toastStack'),
};

// ── Auth State ─────────────────────────────────────────────
auth.onAuthStateChanged(async (user) => {
    // Hide preloader after small delay
    setTimeout(() => DOM.preloader?.classList.add('hide'), 800);

    if (user) {
        // Validate operator access
        const opDoc = await db.collection('operators').doc(user.uid).get().catch(() => ({ exists: false }));
        const isAllowed = opDoc.exists || user.email === 'operator@sman68jkt.sch.id';
        if (isAllowed) {
            State.user = user;
            showMainPanel();
        } else {
            await auth.signOut();
            showToast('Akses ditolak. Bukan akun operator.', 'error');
        }
    } else {
        showLogin();
    }
});

// ── Login ──────────────────────────────────────────────────
function showLogin() {
    if (DOM.loginOverlay) DOM.loginOverlay.style.display = 'flex';
    if (DOM.mainPanel)    DOM.mainPanel.style.display    = 'none';
    applyTheme(State.theme);
}

function showMainPanel() {
    if (DOM.loginOverlay) DOM.loginOverlay.style.display = 'none';
    if (DOM.mainPanel)    DOM.mainPanel.style.display    = 'flex';

    if (DOM.suName)  DOM.suName.textContent  = 'Operator';
    if (DOM.suEmail) DOM.suEmail.textContent = State.user.email;

    applyTheme(State.theme);
    initOperator();
}

DOM.loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = DOM.loginEmail.value.trim();
    const password = DOM.loginPassword.value;

    // Show loader
    const btnText = qs('.btn-login-text', DOM.btnLogin?.closest('button') || document);
    const btnLoader = qs('.btn-login-loader', DOM.btnLogin?.closest('button') || document);
    if (DOM.btnLogin) { DOM.btnLogin.disabled = true; }
    if (btnText)   btnText.style.display   = 'none';
    if (btnLoader) btnLoader.style.display = 'flex';

    try {
        await auth.signInWithEmailAndPassword(email, password);
        showToast('Login berhasil! Selamat datang.', 'success');
    } catch (err) {
        showToast('Email atau password salah.', 'error');
    } finally {
        if (DOM.btnLogin) { DOM.btnLogin.disabled = false; }
        if (btnText)   btnText.style.display   = '';
        if (btnLoader) btnLoader.style.display = 'none';
    }
});

DOM.togglePass?.addEventListener('click', () => {
    const inp = DOM.loginPassword;
    const icon = DOM.togglePass.querySelector('i');
    if (inp.type === 'password') {
        inp.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        inp.type = 'password';
        icon.className = 'fas fa-eye';
    }
});

DOM.logoutBtn?.addEventListener('click', async () => {
    unsubscribeAll();
    await auth.signOut();
    showToast('Logout berhasil.', 'info');
});

// ── Init ───────────────────────────────────────────────────
function initOperator() {
    startClock();
    setupNav();
    setupSidebar();
    setupNotif();
    setupTheme();
    setupRealtime();
    navigateTo('dashboard');
}

// ── Clock ──────────────────────────────────────────────────
function startClock() {
    function tick() {
        if (!DOM.topbarClock) return;
        const now  = new Date();
        const opts = { weekday:'short', day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' };
        DOM.topbarClock.textContent = now.toLocaleDateString('id-ID', opts);
    }
    tick();
    setInterval(tick, 1000);
}

// ── Navigation ─────────────────────────────────────────────
const PAGE_TITLES = {
    dashboard:       'Dashboard',
    'siswa-pending': 'Pendaftaran Siswa',
    'guru-pending':  'Pendaftaran Guru',
    mutasi:          'Pendaftaran Mutasi',
    'absensi-siswa': 'Absensi Siswa',
    'absensi-guru':  'Absensi Guru',
    'data-siswa':    'Data Siswa',
    'data-guru':     'Data Guru',
};

const PAGE_LOADERS = {
    dashboard:       loadDashboard,
    'siswa-pending': loadSiswaPending,
    'guru-pending':  loadGuruPending,
    mutasi:          loadMutasiPage,
    'absensi-siswa': loadAbsensiSiswa,
    'absensi-guru':  loadAbsensiGuru,
    'data-siswa':    loadDataSiswa,
    'data-guru':     loadDataGuru,
};

function setupNav() {
    qsa('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            if (page) navigateTo(page);
            // Close mobile sidebar
            if (window.innerWidth < 768) closeMobileSidebar();
        });
    });
}

function navigateTo(page) {
    State.page = page;

    // Update active nav
    qsa('.nav-item').forEach(n => n.classList.remove('active'));
    const activeNav = qs(`.nav-item[data-page="${page}"]`);
    if (activeNav) activeNav.classList.add('active');

    // Update title
    if (DOM.pageTitle) DOM.pageTitle.textContent = PAGE_TITLES[page] || page;

    // Load page
    const loader = PAGE_LOADERS[page];
    if (loader) loader();
    else DOM.pageContainer.innerHTML = renderEmpty('Halaman tidak ditemukan', 'fas fa-compass');
}

// ── Sidebar ────────────────────────────────────────────────
function setupSidebar() {
    DOM.menuToggle?.addEventListener('click', toggleMobileSidebar);
    DOM.sidebarClose?.addEventListener('click', closeMobileSidebar);
    DOM.sidebarBackdrop?.addEventListener('click', closeMobileSidebar);

    // Search
    DOM.sidebarSearch?.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        qsa('.nav-item').forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = q === '' || text.includes(q) ? '' : 'none';
        });
        qsa('.nav-section-label').forEach(label => {
            label.style.display = q === '' ? '' : 'none';
        });
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

// ── Theme ──────────────────────────────────────────────────
function setupTheme() {
    DOM.themeToggle?.addEventListener('click', () => {
        const newTheme = State.theme === 'light' ? 'dark' : 'light';
        applyTheme(newTheme);
    });
}

function applyTheme(theme) {
    State.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('op68-theme', theme);
    const icon = DOM.themeToggle?.querySelector('i');
    if (icon) icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// ── Realtime ───────────────────────────────────────────────
function setupRealtime() {
    let first = { siswa: true, guru: true, mutasi: true };

    const s1 = db.collection('siswa').where('status', '==', 'pending')
        .onSnapshot(snap => {
            const badge = el('badgeSiswa');
            if (badge) {
                badge.textContent = snap.size;
                badge.style.display = snap.size > 0 ? 'inline-flex' : 'none';
            }
            if (!first.siswa) {
                snap.docChanges().forEach(c => {
                    if (c.type === 'added')
                        addNotification('siswa', `Pendaftaran siswa baru: ${c.doc.data().nama}`, 'fas fa-user-graduate');
                });
            }
            first.siswa = false;
        });

    const s2 = db.collection('guru').where('status', '==', 'pending')
        .onSnapshot(snap => {
            const badge = el('badgeGuru');
            if (badge) {
                badge.textContent = snap.size;
                badge.style.display = snap.size > 0 ? 'inline-flex' : 'none';
            }
            if (!first.guru) {
                snap.docChanges().forEach(c => {
                    if (c.type === 'added')
                        addNotification('guru', `Pendaftaran guru baru: ${c.doc.data().nama}`, 'fas fa-chalkboard-user');
                });
            }
            first.guru = false;
        });

    const s3 = db.collection('pendaftaranMutasi').where('status', '==', 'pending')
        .onSnapshot(snap => {
            const badge = el('badgeMutasi');
            if (badge) {
                badge.textContent = snap.size;
                badge.style.display = snap.size > 0 ? 'inline-flex' : 'none';
            }
            if (!first.mutasi) {
                snap.docChanges().forEach(c => {
                    if (c.type === 'added')
                        addNotification('mutasi', `Pendaftaran mutasi baru: ${c.doc.data().nama}`, 'fas fa-right-left');
                });
            }
            first.mutasi = false;
        });

    State.realtimeUnsubs.push(s1, s2, s3);
}

function unsubscribeAll() {
    State.realtimeUnsubs.forEach(fn => { try { fn(); } catch(e) {} });
    State.realtimeUnsubs = [];
}

// ── Notifications ──────────────────────────────────────────
function setupNotif() {
    DOM.notifBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        DOM.notifWrap?.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
        if (!DOM.notifWrap?.contains(e.target)) {
            DOM.notifWrap?.classList.remove('open');
        }
    });
    DOM.clearAllNotif?.addEventListener('click', () => {
        State.notifications.forEach(n => n.read = true);
        State.unreadCount = 0;
        renderNotifList();
        updateNotifDot();
    });
}

function addNotification(type, message, icon) {
    State.notifications.unshift({
        id: Date.now() + Math.random(),
        type, message, icon: icon || 'fas fa-bell',
        timestamp: new Date(),
        read: false,
    });
    if (State.notifications.length > 50) State.notifications.pop();
    State.unreadCount++;
    renderNotifList();
    updateNotifDot();
}

function updateNotifDot() {
    if (DOM.notifDot) {
        DOM.notifDot.style.display = State.unreadCount > 0 ? 'block' : 'none';
    }
}

function renderNotifList() {
    if (!DOM.notifList) return;
    if (State.notifications.length === 0) {
        DOM.notifList.innerHTML = `<div class="notif-empty"><i class="fas fa-bell-slash"></i><p>Tidak ada notifikasi</p></div>`;
        return;
    }
    DOM.notifList.innerHTML = State.notifications.slice(0, 15).map(n => {
        const iconTypeClass = { siswa: 'siswa', guru: 'guru', mutasi: 'mutasi' }[n.type] || '';
        return `<div class="notif-item ${n.read ? '' : 'unread'}" onclick="markNotifRead('${n.id}')">
            <div class="notif-item-icon ${iconTypeClass}"><i class="${n.icon}"></i></div>
            <div class="notif-item-body">
                <p>${escapeHtml(n.message)}</p>
                <small>${n.timestamp.toLocaleString('id-ID', { hour:'2-digit', minute:'2-digit', day:'numeric', month:'short' })}</small>
            </div>
        </div>`;
    }).join('');
}

function markNotifRead(id) {
    const notif = State.notifications.find(n => String(n.id) === String(id));
    if (notif && !notif.read) {
        notif.read = true;
        State.unreadCount = Math.max(0, State.unreadCount - 1);
        renderNotifList();
        updateNotifDot();
    }
}

// ── Toast ──────────────────────────────────────────────────
const TOAST_ICONS = {
    success: 'fas fa-circle-check',
    error:   'fas fa-circle-xmark',
    warning: 'fas fa-triangle-exclamation',
    info:    'fas fa-circle-info',
};
const TOAST_LABELS = { success: 'Berhasil', error: 'Error', warning: 'Peringatan', info: 'Info' };

function showToast(message, type = 'success', duration = 4500) {
    if (!DOM.toastStack) return;
    const id   = 'toast-' + Date.now();
    const icon = TOAST_ICONS[type] || TOAST_ICONS.info;
    const label = TOAST_LABELS[type] || 'Info';

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.id = id;
    toast.innerHTML = `
        <div class="toast-icon"><i class="${icon}"></i></div>
        <div class="toast-content">
            <strong>${label}</strong>
            <span>${escapeHtml(message)}</span>
        </div>
        <button class="toast-close" onclick="removeToast('${id}')"><i class="fas fa-xmark"></i></button>
    `;
    DOM.toastStack.appendChild(toast);

    const timer = setTimeout(() => removeToast(id), duration);
    toast._timer = timer;
}

function removeToast(id) {
    const t = el(id);
    if (!t) return;
    clearTimeout(t._timer);
    t.classList.add('removing');
    setTimeout(() => t.remove(), 300);
}

// ── Utilities ──────────────────────────────────────────────
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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
        pending:   ['badge badge-amber', 'Pending'],
        approved:  ['badge badge-green', 'Disetujui'],
        rejected:  ['badge badge-rose',  'Ditolak'],
        proses:    ['badge badge-blue',  'Diproses'],
        diterima:  ['badge badge-green', 'Diterima'],
        ditolak:   ['badge badge-rose',  'Ditolak'],
    };
    const [cls, label] = map[status] || ['badge badge-gray', status || '-'];
    return `<span class="${cls}">${label}</span>`;
}

function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// ── Render Helpers ─────────────────────────────────────────
function renderEmpty(text = 'Tidak ada data', icon = 'fas fa-inbox', sub = '') {
    return `<div class="empty-state">
        <div class="empty-icon"><i class="${icon}"></i></div>
        <h4>${text}</h4>
        ${sub ? `<p>${sub}</p>` : ''}
    </div>`;
}

function renderSkeletonRows(cols = 5, rows = 5) {
    const cells = Array(cols).fill(`<td><div class="skeleton sk" style="width:${60+Math.random()*30}%"></div></td>`).join('');
    const rowHtml = Array(rows).fill(`<tr>${cells}</tr>`).join('');
    return rowHtml;
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

// ── Modal ──────────────────────────────────────────────────
function openModal(html, size = '') {
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

DOM.modalOverlay?.addEventListener('click', (e) => {
    if (e.target === DOM.modalOverlay) closeModal();
});

// ── DASHBOARD ──────────────────────────────────────────────
async function loadDashboard() {
    DOM.pageContainer.innerHTML = renderLoadingPage();
    try {
        const [siswaSnap, guruSnap, mutasiSnap, absensiSnap, approvedSiswa, approvedGuru] = await Promise.all([
            db.collection('siswa').where('status','==','pending').get(),
            db.collection('guru').where('status','==','pending').get(),
            db.collection('pendaftaranMutasi').where('status','==','pending').get(),
            db.collection('absensiSiswa').orderBy('timestamp','desc').limit(5).get(),
            db.collection('siswa').where('status','==','approved').get(),
            db.collection('guru').where('status','==','approved').get(),
        ]);

        DOM.pageContainer.innerHTML = `
            <div class="page-header slide-up">
                <div class="page-header-left">
                    <h2>Dashboard Overview</h2>
                    <p>Selamat datang di Operator Panel SMAN 68 Jakarta</p>
                </div>
                <div class="page-header-actions">
                    <button class="btn btn-ghost btn-sm" onclick="navigateTo('siswa-pending')">
                        <i class="fas fa-arrow-right"></i> Lihat Pending
                    </button>
                </div>
            </div>

            <div class="stats-grid">
                ${renderStatCard('Siswa Pending',   siswaSnap.size,   'fas fa-user-graduate',    'green',  'Pendaftaran menunggu')}
                ${renderStatCard('Guru Pending',    guruSnap.size,    'fas fa-chalkboard-user',  'blue',   'Pendaftaran menunggu')}
                ${renderStatCard('Mutasi Pending',  mutasiSnap.size,  'fas fa-right-left',       'orange', 'Pendaftaran menunggu')}
                ${renderStatCard('Total Siswa',     approvedSiswa.size,'fas fa-users',           'teal',   'Siswa aktif terdaftar')}
                ${renderStatCard('Total Guru',      approvedGuru.size, 'fas fa-person-chalkboard','violet', 'Guru aktif terdaftar')}
                ${renderStatCard('Data Absensi',    absensiSnap.size,  'fas fa-clipboard-list',  'rose',   '50 absensi terbaru')}
            </div>

            <div class="charts-grid">
                <div class="chart-card">
                    <div class="chart-card-head">
                        <div>
                            <h4>Statistik Pendaftaran</h4>
                            <p>Perbandingan status pendaftaran</p>
                        </div>
                    </div>
                    <canvas id="barChart" height="200"></canvas>
                </div>
                <div class="chart-card">
                    <div class="chart-card-head">
                        <div>
                            <h4>Distribusi Status</h4>
                            <p>Semua pendaftaran</p>
                        </div>
                    </div>
                    <canvas id="doughnutChart" height="200"></canvas>
                </div>
            </div>

            <div class="table-wrap fade-in" style="animation-delay:.3s">
                <div class="table-toolbar">
                    <h4 style="font-family:var(--font-head);font-size:.9rem;font-weight:700;color:var(--text);">
                        <i class="fas fa-clock" style="color:var(--primary);margin-right:6px;"></i>Absensi Terbaru
                    </h4>
                </div>
                <div class="table-scroll">
                    <table>
                        <thead><tr><th>Nama</th><th>Kelas</th><th>Tanggal</th><th>Status</th><th>Bukti</th></tr></thead>
                        <tbody>
                            ${absensiSnap.empty
                                ? `<tr><td colspan="5">${renderEmpty('Belum ada absensi','fas fa-clipboard-list')}</td></tr>`
                                : absensiSnap.docs.map(doc => {
                                    const d = doc.data();
                                    return `<tr>
                                        <td class="td-strong">${escapeHtml(d.nama)}</td>
                                        <td>${escapeHtml(d.kelas)}</td>
                                        <td>${fmtDate(d.timestamp)}</td>
                                        <td>${statusBadge(d.status)}</td>
                                        <td>${d.buktiUrl ? `<a href="${escapeHtml(d.buktiUrl)}" target="_blank" class="file-link"><i class="fab fa-google-drive"></i> Bukti</a>` : '-'}</td>
                                    </tr>`;
                                }).join('')
                            }
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Init Charts
        initDashboardCharts(siswaSnap.size, guruSnap.size, mutasiSnap.size, approvedSiswa.size, approvedGuru.size);

    } catch (e) {
        console.error(e);
        DOM.pageContainer.innerHTML = renderEmpty('Gagal memuat dashboard', 'fas fa-exclamation-triangle', e.message);
    }
}

function renderStatCard(label, value, icon, color, sub) {
    return `<div class="stat-card">
        <div class="stat-icon ${color}"><i class="${icon}"></i></div>
        <div class="stat-info">
            <h3>${value}</h3>
            <p>${label}</p>
            <span class="stat-trend neutral">${sub}</span>
        </div>
    </div>`;
}

function initDashboardCharts(siswaPend, guruPend, mutasiPend, approvedSiswa, approvedGuru) {
    const isDark = State.theme === 'dark';
    const textColor = isDark ? '#8b949e' : '#6b7280';
    const gridColor = isDark ? '#30363d' : '#e5e7eb';

    // Destroy old
    if (State.chartInstances.bar) State.chartInstances.bar.destroy();
    if (State.chartInstances.doughnut) State.chartInstances.doughnut.destroy();

    const barCtx = el('barChart')?.getContext('2d');
    if (barCtx) {
        State.chartInstances.bar = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: ['Siswa Pending', 'Guru Pending', 'Mutasi Pending', 'Siswa Aktif', 'Guru Aktif'],
                datasets: [{
                    label: 'Jumlah',
                    data: [siswaPend, guruPend, mutasiPend, approvedSiswa, approvedGuru],
                    backgroundColor: ['#22c55e44','#3b82f644','#f59e0b44','#14b8a644','#8b5cf644'],
                    borderColor:     ['#22c55e',  '#3b82f6',  '#f59e0b',  '#14b8a6',  '#8b5cf6'],
                    borderWidth: 2, borderRadius: 8,
                }],
            },
            options: {
                responsive: true, maintainAspectRatio: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'DM Sans', size: 11 } } },
                    y: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'DM Sans', size: 11 }, precision: 0 } },
                },
            },
        });
    }

    const doCtx = el('doughnutChart')?.getContext('2d');
    if (doCtx) {
        State.chartInstances.doughnut = new Chart(doCtx, {
            type: 'doughnut',
            data: {
                labels: ['Siswa Pending', 'Guru Pending', 'Mutasi Pending'],
                datasets: [{
                    data: [siswaPend, guruPend, mutasiPend],
                    backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b'],
                    borderWidth: 0, hoverOffset: 6,
                }],
            },
            options: {
                responsive: true, maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: textColor, font: { family: 'DM Sans', size: 11 }, padding: 16, boxWidth: 12 },
                    },
                },
                cutout: '70%',
            },
        });
    }
}

// ── SISWA PENDING ───────────────────────────────────────────
async function loadSiswaPending() {
    DOM.pageContainer.innerHTML = renderLoadingPage();
    try {
        // Tidak pakai orderBy('createdAt') karena dokumen tanpa field createdAt akan diskip Firestore
        const snapshot = await db.collection('siswa').where('status','==','pending').get();

        let headerHtml = `
            <div class="page-header slide-up">
                <div class="page-header-left">
                    <h2>Pendaftaran Siswa</h2>
                    <p>${snapshot.size} pendaftaran menunggu persetujuan</p>
                </div>
            </div>`;

        if (snapshot.empty) {
            DOM.pageContainer.innerHTML = headerHtml + renderEmpty('Tidak ada pendaftaran siswa','fas fa-user-graduate','Semua pendaftaran sudah diproses');
            return;
        }

        // Sort manual: yang punya createdAt terbaru duluan, yang tidak punya tetap tampil
        const sortedDocs = snapshot.docs.slice().sort((a, b) => {
            const tA = a.data().createdAt?.toMillis?.() ?? 0;
            const tB = b.data().createdAt?.toMillis?.() ?? 0;
            return tB - tA;
        });

        const rows = sortedDocs.map(doc => {
            const d = doc.data();
            return `<tr>
                <td class="td-strong">${escapeHtml(d.nama || '-')}</td>
                <td class="td-mono">${escapeHtml(d.nisn || '-')}</td>
                <td>${escapeHtml(d.kelas || '-')}</td>
                <td>${escapeHtml(d.jurusan || '-')}</td>
                <td>${fmtDate(d.createdAt)}</td>
                <td><div class="td-actions">
                    <button class="btn btn-ghost btn-sm btn-icon" onclick="viewSiswaDetail('${doc.id}')" title="Lihat Detail Lengkap"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-primary btn-sm" onclick="approveItem('siswa','${doc.id}')"><i class="fas fa-check"></i> Setujui</button>
                    <button class="btn btn-danger btn-sm" onclick="rejectItem('siswa','${doc.id}')"><i class="fas fa-xmark"></i> Tolak</button>
                </div></td>
            </tr>`;
        }).join('');

        DOM.pageContainer.innerHTML = headerHtml + renderSearchTable(
            ['Nama','NISN','Kelas','Jurusan','Tanggal Daftar','Aksi'],
            rows, snapshot.size
        );
        attachTableSearch();

    } catch (e) {
        console.error(e);
        DOM.pageContainer.innerHTML = renderEmpty('Gagal memuat data', 'fas fa-exclamation-triangle', e.message);
    }
}

// ── GURU PENDING ────────────────────────────────────────────
async function loadGuruPending() {
    DOM.pageContainer.innerHTML = renderLoadingPage();
    try {
        // Tidak pakai orderBy('createdAt') karena dokumen tanpa field createdAt akan diskip Firestore
        const snapshot = await db.collection('guru').where('status','==','pending').get();

        let headerHtml = `
            <div class="page-header slide-up">
                <div class="page-header-left">
                    <h2>Pendaftaran Guru</h2>
                    <p>${snapshot.size} pendaftaran menunggu persetujuan</p>
                </div>
            </div>`;

        if (snapshot.empty) {
            DOM.pageContainer.innerHTML = headerHtml + renderEmpty('Tidak ada pendaftaran guru','fas fa-chalkboard-user','Semua pendaftaran sudah diproses');
            return;
        }

        // Sort manual: yang punya createdAt terbaru duluan
        const sortedDocs = snapshot.docs.slice().sort((a, b) => {
            const tA = a.data().createdAt?.toMillis?.() ?? 0;
            const tB = b.data().createdAt?.toMillis?.() ?? 0;
            return tB - tA;
        });

        const rows = sortedDocs.map(doc => {
            const d = doc.data();
            return `<tr>
                <td class="td-strong">${escapeHtml(d.nama || '-')}</td>
                <td class="td-mono">${escapeHtml(d.nip || '-')}</td>
                <td class="td-mono">${escapeHtml(d.nuptk || '-')}</td>
                <td>${escapeHtml(d.jabatan || '-')}</td>
                <td>${fmtDateTime(d.createdAt)}</td>
                <td><div class="td-actions">
                    <button class="btn btn-primary btn-sm" onclick="approveItem('guru','${doc.id}')"><i class="fas fa-check"></i> Setujui</button>
                    <button class="btn btn-danger btn-sm" onclick="rejectItem('guru','${doc.id}')"><i class="fas fa-xmark"></i> Tolak</button>
                    <button class="btn btn-ghost btn-sm btn-icon" onclick="viewGuruDetail('${doc.id}')" title="Detail"><i class="fas fa-eye"></i></button>
                </div></td>
            </tr>`;
        }).join('');

        DOM.pageContainer.innerHTML = headerHtml + renderSearchTable(
            ['Nama','NIP/NIPY','NUPTK','Jabatan','Tanggal','Aksi'],
            rows, snapshot.size
        );
        attachTableSearch();

    } catch (e) {
        console.error(e);
        DOM.pageContainer.innerHTML = renderEmpty('Gagal memuat data','fas fa-exclamation-triangle', e.message);
    }
}

// ── DATA GURU ───────────────────────────────────────────────
async function loadDataGuru() {
    DOM.pageContainer.innerHTML = renderLoadingPage();
    try {
        const jabatanList = ['Kepala Sekolah','Wakil Kepala Sekolah','Guru Matematika','Guru Bahasa Indonesia','Guru Bahasa Inggris','Guru Fisika','Guru Kimia','Guru Biologi','Guru Sejarah','Guru Geografi','Guru Ekonomi','Guru Sosiologi','Guru PJOK','Guru Seni Budaya','Guru Informatika','Guru Pendidikan Agama','Guru PKN','Guru BK','Kesiswaan','Tata Usaha','Lainnya'];
        const snapshot = await db.collection('guru').where('status','==','approved').orderBy('jabatan').orderBy('nama').get();

        const chipHtml = `<div class="filter-chips">
            <button class="chip active" data-filter="" onclick="filterTableRows('guruBody','jabatan','',this)">Semua</button>
            ${jabatanList.map(j => `<button class="chip" data-filter="${escapeHtml(j)}" onclick="filterTableRows('guruBody','jabatan','${escapeHtml(j)}',this)">${escapeHtml(j)}</button>`).join('')}
        </div>`;

        let headerHtml = `
            <div class="page-header slide-up">
                <div class="page-header-left">
                    <h2>Data Guru Aktif</h2>
                    <p>${snapshot.size} guru terdaftar aktif</p>
                </div>
            </div>`;

        if (snapshot.empty) {
            DOM.pageContainer.innerHTML = headerHtml + chipHtml + renderEmpty('Belum ada guru aktif','fas fa-person-chalkboard');
            return;
        }

        const rows = snapshot.docs.map(doc => {
            const d = doc.data();
            return `<tr data-jabatan="${escapeHtml(d.jabatan || '')}">
                <td class="td-strong">${escapeHtml(d.nama || '-')}</td>
                <td class="td-mono">${escapeHtml(d.nip || '-')}</td>
                <td class="td-mono">${escapeHtml(d.nuptk || '-')}</td>
                <td>${escapeHtml(d.jabatan || '-')}</td>
                <td>${fmtDate(d.approvedAt)}</td>
                <td><button class="btn btn-ghost btn-sm btn-icon" onclick="viewGuruDetail('${doc.id}')" title="Lihat Detail"><i class="fas fa-eye"></i></button></td>
            </tr>`;
        }).join('');

        DOM.pageContainer.innerHTML = headerHtml + `<div class="table-wrap fade-in">
            ${chipHtml}
            <div class="table-toolbar">
                <div class="table-search">
                    <i class="fas fa-magnifying-glass"></i>
                    <input type="text" placeholder="Cari nama guru..." id="tblSearch">
                </div>
                <span class="table-count" id="tblCount">${snapshot.size} guru</span>
            </div>
            <div class="table-scroll">
                <table>
                    <thead><tr><th>Nama</th><th>NIP/NIPY</th><th>NUPTK</th><th>Jabatan</th><th>Tgl Disetujui</th><th>Detail</th></tr></thead>
                    <tbody id="guruBody">${rows}</tbody>
                </table>
            </div>
        </div>`;
        attachTableSearch('guruBody', 'tblSearch', 'tblCount', 'guru');

    } catch (e) {
        console.error(e);
        DOM.pageContainer.innerHTML = renderEmpty('Gagal memuat data','fas fa-exclamation-triangle', e.message);
    }
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
    if (counter) counter.textContent = `${visible} guru`;
}

// ── VIEW SISWA DETAIL ────────────────────────────────────────
async function viewSiswaDetail(id) {
    openModal(`<div class="modal-head"><h3><i class="fas fa-user-graduate" style="color:var(--primary);margin-right:8px;"></i>Memuat data siswa...</h3><button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button></div><div class="modal-body"><div class="empty-state"><div class="animate-spin" style="width:28px;height:28px;border:3px solid var(--border);border-top-color:var(--primary);border-radius:50%;margin:auto;"></div><p style="margin-top:12px;color:var(--text-3);font-size:.85rem;">Memuat data lengkap...</p></div></div>`, 'modal-lg');
    try {
        const doc = await db.collection('siswa').doc(id).get();
        if (!doc.exists) { showToast('Data tidak ditemukan', 'error'); closeModal(); return; }
        const d = doc.data();
        const isPending = d.status === 'pending';

        // Helper: render field, kosongkan jika tidak ada nilai
        const f = (label, val, full = false) => val
            ? `<div class="detail-field${full ? ' detail-field-full' : ''}"><label>${label}</label><p>${val}</p></div>`
            : `<div class="detail-field${full ? ' detail-field-full' : ''}"><label>${label}</label><p style="color:var(--text-4)">-</p></div>`;

        // Foto / dokumen
        const fotoId = extractGDriveId(d.fotoUrl || d.foto || d.pasFoto || '');
        const fotoHtml = fotoId
            ? `<div class="detail-foto-wrap">
                <img src="https://drive.google.com/thumbnail?id=${fotoId}&sz=w300" alt="Foto Siswa" class="detail-foto" onerror="this.style.display='none'">
               </div>`
            : '';

        // Dokumen pendaftaran
        const docLabels = {
            fotoUrl: 'Pas Foto', foto: 'Pas Foto', pasFoto: 'Pas Foto',
            aktaLahir: 'Akta Kelahiran', kartuKeluarga: 'Kartu Keluarga',
            ijazah: 'Ijazah/SKL', skhu: 'SKHU', raport: 'Raport',
            suratKeterangan: 'Surat Keterangan', ktpOrtu: 'KTP Orang Tua',
            nisn: null, nama: null, kelas: null, jurusan: null, status: null,
            createdAt: null, approvedAt: null, rejectedAt: null, uid: null, email: null,
        };

        // Kumpulkan semua field dokumen (URL)
        const dokFields = Object.entries(d).filter(([k, v]) =>
            typeof v === 'string' &&
            (v.includes('drive.google.com') || v.includes('http')) &&
            !['email','uid'].includes(k)
        );

        const dokHtml = dokFields.length > 0 ? `
            <div class="detail-section-title"><i class="fas fa-file-lines"></i> Dokumen Pendaftaran</div>
            <div class="doc-grid">
                ${dokFields.map(([k, url]) => {
                    const gId = extractGDriveId(url);
                    const label = docLabels[k] || k.replace(/([A-Z])/g,' $1').trim();
                    return `<div class="doc-item">
                        <div class="doc-item-head"><i class="fab fa-google-drive"></i><span>${escapeHtml(label)}</span></div>
                        ${gId ? `<div class="doc-item-frame"><iframe src="https://drive.google.com/file/d/${gId}/preview" allow="autoplay" loading="lazy"></iframe></div>` : ''}
                        <a href="${escapeHtml(url)}" target="_blank" class="doc-item-link"><i class="fas fa-arrow-up-right-from-square"></i> Buka di Google Drive</a>
                    </div>`;
                }).join('')}
            </div>` : '';

        openModal(`
            <div class="modal-head">
                <h3><i class="fas fa-user-graduate" style="color:var(--primary);margin-right:8px;"></i>Detail Siswa${isPending ? ' <span class="badge badge-amber" style="font-size:.7rem;margin-left:6px;">Pending</span>' : ''}</h3>
                <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
            </div>
            <div class="modal-body">
                ${fotoHtml}
                <div class="detail-section-title"><i class="fas fa-id-card"></i> Data Pribadi</div>
                <div class="detail-grid">
                    ${f('Nama Lengkap', escapeHtml(d.nama))}
                    ${f('NISN', escapeHtml(d.nisn))}
                    ${f('Kelas', escapeHtml(d.kelas))}
                    ${f('Jurusan', escapeHtml(d.jurusan))}
                    ${f('Jenis Kelamin', escapeHtml(d.jenisKelamin || d.jk || d.gender))}
                    ${f('Tempat Lahir', escapeHtml(d.tempatLahir || d.ttl?.split(',')[0]))}
                    ${f('Tanggal Lahir', escapeHtml(d.tanggalLahir || d.ttl))}
                    ${f('Agama', escapeHtml(d.agama))}
                    ${f('Kewarganegaraan', escapeHtml(d.kewarganegaraan))}
                    ${f('NIK', escapeHtml(d.nik))}
                    ${f('No. KK', escapeHtml(d.noKK || d.noKk))}
                    ${f('Alamat', escapeHtml(d.alamat), true)}
                    ${f('RT / RW', [d.rt, d.rw].filter(Boolean).join(' / '))}
                    ${f('Kelurahan', escapeHtml(d.kelurahan || d.desa))}
                    ${f('Kecamatan', escapeHtml(d.kecamatan))}
                    ${f('Kota/Kabupaten', escapeHtml(d.kota || d.kabupaten || d.kotaKabupaten))}
                    ${f('Provinsi', escapeHtml(d.provinsi))}
                    ${f('Kode Pos', escapeHtml(d.kodePos))}
                    ${f('No. HP / WA', escapeHtml(d.noHp || d.hp || d.telepon || d.wa))}
                    ${f('Email', escapeHtml(d.emailSiswa || d.email))}
                    ${f('Asal Sekolah', escapeHtml(d.asalSekolah || d.sekolahAsal))}
                    ${f('Tahun Lulus', escapeHtml(d.tahunLulus))}
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
                    ${f('No. HP Orang Tua/Wali', escapeHtml(d.noHpOrtu || d.hpOrtu || d.noHpAyah || d.noHpIbu))}
                </div>

                <div class="detail-section-title" style="margin-top:16px;"><i class="fas fa-circle-info"></i> Info Pendaftaran</div>
                <div class="detail-grid">
                    ${f('Status', statusBadge(d.status))}
                    ${f('Tanggal Daftar', fmtDateTime(d.createdAt))}
                    ${d.approvedAt ? f('Tanggal Disetujui', fmtDateTime(d.approvedAt)) : ''}
                    ${d.rejectedAt  ? f('Tanggal Ditolak',  fmtDateTime(d.rejectedAt))  : ''}
                </div>

                ${dokHtml}
            </div>
            <div class="modal-footer">
                ${isPending ? `
                    <button class="btn btn-primary" onclick="approveItem('siswa','${id}');closeModal()"><i class="fas fa-check"></i> Setujui</button>
                    <button class="btn btn-danger" onclick="closeModal();setTimeout(()=>rejectItem('siswa','${id}'),300)"><i class="fas fa-xmark"></i> Tolak</button>
                ` : ''}
                <button class="btn btn-ghost" onclick="closeModal()">Tutup</button>
            </div>`, 'modal-lg');
    } catch (e) { console.error(e); showToast('Gagal memuat detail siswa', 'error'); closeModal(); }
}

// ── VIEW GURU DETAIL ────────────────────────────────────────
async function viewGuruDetail(id) {
    openModal(`<div class="modal-head"><h3><i class="fas fa-chalkboard-user" style="color:var(--accent);margin-right:8px;"></i>Memuat data guru...</h3><button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button></div><div class="modal-body"><div class="empty-state"><div class="animate-spin" style="width:28px;height:28px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;margin:auto;"></div><p style="margin-top:12px;color:var(--text-3);font-size:.85rem;">Memuat data lengkap...</p></div></div>`, 'modal-lg');
    try {
        const doc = await db.collection('guru').doc(id).get();
        if (!doc.exists) { showToast('Data tidak ditemukan', 'error'); closeModal(); return; }
        const d = doc.data();
        const isPending = d.status === 'pending';

        const f = (label, val, full = false) => val
            ? `<div class="detail-field${full ? ' detail-field-full' : ''}"><label>${label}</label><p>${val}</p></div>`
            : `<div class="detail-field${full ? ' detail-field-full' : ''}"><label>${label}</label><p style="color:var(--text-4)">-</p></div>`;

        const fotoId = extractGDriveId(d.fotoUrl || d.foto || d.pasFoto || '');
        const fotoHtml = fotoId
            ? `<div class="detail-foto-wrap">
                <img src="https://drive.google.com/thumbnail?id=${fotoId}&sz=w300" alt="Foto Guru" class="detail-foto" onerror="this.style.display='none'">
               </div>`
            : '';

        // Dokumen guru
        const dokFields = Object.entries(d).filter(([k, v]) =>
            typeof v === 'string' &&
            (v.includes('drive.google.com') || (v.startsWith('http') && !v.includes('mailto'))) &&
            !['email','uid'].includes(k)
        );
        const dokLabels = {
            fotoUrl:'Pas Foto', foto:'Pas Foto', pasFoto:'Pas Foto',
            ijazah:'Ijazah Terakhir', sertifikasi:'Sertifikasi Guru',
            sk:'SK Pengangkatan', skCpns:'SK CPNS', skGolongan:'SK Kenaikan Pangkat',
            ktp:'KTP', npwp:'NPWP', bpjs:'Kartu BPJS',
        };
        const dokHtml = dokFields.length > 0 ? `
            <div class="detail-section-title" style="margin-top:16px;"><i class="fas fa-file-lines"></i> Dokumen</div>
            <div class="doc-grid">
                ${dokFields.map(([k, url]) => {
                    const gId = extractGDriveId(url);
                    const label = dokLabels[k] || k.replace(/([A-Z])/g,' $1').trim();
                    return `<div class="doc-item">
                        <div class="doc-item-head"><i class="fab fa-google-drive"></i><span>${escapeHtml(label)}</span></div>
                        ${gId ? `<div class="doc-item-frame"><iframe src="https://drive.google.com/file/d/${gId}/preview" allow="autoplay" loading="lazy"></iframe></div>` : ''}
                        <a href="${escapeHtml(url)}" target="_blank" class="doc-item-link"><i class="fas fa-arrow-up-right-from-square"></i> Buka di Google Drive</a>
                    </div>`;
                }).join('')}
            </div>` : '';

        openModal(`
            <div class="modal-head">
                <h3><i class="fas fa-chalkboard-user" style="color:var(--accent);margin-right:8px;"></i>Detail Guru${isPending ? ' <span class="badge badge-amber" style="font-size:.7rem;margin-left:6px;">Pending</span>' : ''}</h3>
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
                    ${f('Mata Pelajaran', escapeHtml(d.mapel || d.mataPelajaran))}
                    ${f('Jenis Kelamin', escapeHtml(d.jenisKelamin || d.jk || d.gender))}
                    ${f('Tempat Lahir', escapeHtml(d.tempatLahir))}
                    ${f('Tanggal Lahir', escapeHtml(d.tanggalLahir || d.ttl))}
                    ${f('Agama', escapeHtml(d.agama))}
                    ${f('Status Perkawinan', escapeHtml(d.statusPerkawinan || d.perkawinan))}
                    ${f('Alamat', escapeHtml(d.alamat), true)}
                    ${f('Kota', escapeHtml(d.kota || d.kotaKabupaten))}
                    ${f('Provinsi', escapeHtml(d.provinsi))}
                    ${f('No. HP / WA', escapeHtml(d.noHp || d.hp || d.telepon || d.wa))}
                    ${f('Email', escapeHtml(d.emailGuru || d.email))}
                </div>

                <div class="detail-section-title" style="margin-top:16px;"><i class="fas fa-graduation-cap"></i> Data Kepegawaian & Pendidikan</div>
                <div class="detail-grid">
                    ${f('Status Kepegawaian', escapeHtml(d.statusKepegawaian || d.statusPegawai))}
                    ${f('Golongan / Pangkat', escapeHtml(d.golongan || d.pangkat))}
                    ${f('TMT Golongan', escapeHtml(d.tmtGolongan))}
                    ${f('TMT CPNS', escapeHtml(d.tmtCpns))}
                    ${f('Pendidikan Terakhir', escapeHtml(d.pendidikanTerakhir || d.pendidikan))}
                    ${f('Jurusan / Prodi', escapeHtml(d.jurusanPendidikan || d.prodi))}
                    ${f('Universitas / Institusi', escapeHtml(d.universitas || d.institusi))}
                    ${f('Tahun Lulus', escapeHtml(d.tahunLulus))}
                    ${f('Sertifikasi', escapeHtml(d.sertifikasi ? 'Ya' : (d.sertifikasi === false ? 'Tidak' : null)))}
                    ${f('No. Sertifikasi', escapeHtml(d.noSertifikasi))}
                </div>

                <div class="detail-section-title" style="margin-top:16px;"><i class="fas fa-circle-info"></i> Info Pendaftaran</div>
                <div class="detail-grid">
                    ${f('Status', statusBadge(d.status))}
                    ${f('Tanggal Daftar', fmtDateTime(d.createdAt))}
                    ${d.approvedAt ? f('Tanggal Disetujui', fmtDateTime(d.approvedAt)) : ''}
                    ${d.rejectedAt  ? f('Tanggal Ditolak',  fmtDateTime(d.rejectedAt))  : ''}
                </div>

                ${dokHtml}
            </div>
            <div class="modal-footer">
                ${isPending ? `
                    <button class="btn btn-primary" onclick="approveItem('guru','${id}');closeModal()"><i class="fas fa-check"></i> Setujui</button>
                    <button class="btn btn-danger" onclick="closeModal();setTimeout(()=>rejectItem('guru','${id}'),300)"><i class="fas fa-xmark"></i> Tolak</button>
                ` : ''}
                <button class="btn btn-ghost" onclick="closeModal()">Tutup</button>
            </div>`, 'modal-lg');
    } catch (e) { console.error(e); showToast('Gagal memuat detail guru', 'error'); closeModal(); }
}

// ── MUTASI PAGE ─────────────────────────────────────────────
async function loadMutasiPage() {
    DOM.pageContainer.innerHTML = renderLoadingPage();
    try {
        // Tidak pakai orderBy('createdAt') karena dokumen tanpa field createdAt akan diskip Firestore
        const snapshot = await db.collection('pendaftaranMutasi').get();

        let headerHtml = `
            <div class="page-header slide-up">
                <div class="page-header-left">
                    <h2>Pendaftaran Mutasi</h2>
                    <p>${snapshot.size} total pendaftaran mutasi</p>
                </div>
            </div>`;

        if (snapshot.empty) {
            DOM.pageContainer.innerHTML = headerHtml + renderEmpty('Tidak ada pendaftaran mutasi','fas fa-right-left');
            return;
        }

        // Sort manual: terbaru duluan
        const sortedDocs = snapshot.docs.slice().sort((a, b) => {
            const tA = a.data().createdAt?.toMillis?.() ?? 0;
            const tB = b.data().createdAt?.toMillis?.() ?? 0;
            return tB - tA;
        });

        const rows = sortedDocs.map(doc => {
            const d = doc.data();
            return `<tr>
                <td class="td-mono td-strong">${escapeHtml(d.noDaftar || '-')}</td>
                <td class="td-strong">${escapeHtml(d.nama || '-')}</td>
                <td>${escapeHtml(d.sekolahAsal || '-')}</td>
                <td>${statusBadge(d.status)}</td>
                <td>${fmtDate(d.createdAt)}</td>
                <td><div class="td-actions">
                    <button class="btn btn-ghost btn-sm btn-icon" onclick="viewMutasiDocs('${doc.id}')" title="Lihat Dokumen"><i class="fas fa-folder-open"></i></button>
                    <button class="btn btn-warn btn-sm btn-icon" onclick="prosesMutasi('${doc.id}')" title="Proses"><i class="fas fa-gear"></i></button>
                    <button class="btn btn-primary btn-sm btn-icon" onclick="approveMutasi('${doc.id}')" title="Setujui"><i class="fas fa-check"></i></button>
                    <button class="btn btn-danger btn-sm btn-icon" onclick="rejectMutasi('${doc.id}')" title="Tolak"><i class="fas fa-xmark"></i></button>
                </div></td>
            </tr>`;
        }).join('');

        DOM.pageContainer.innerHTML = headerHtml + renderSearchTable(
            ['No.Daftar','Nama','Sekolah Asal','Status','Tanggal','Aksi'],
            rows, snapshot.size
        );
        attachTableSearch();

    } catch (e) {
        console.error(e);
        DOM.pageContainer.innerHTML = renderEmpty('Gagal memuat data','fas fa-exclamation-triangle', e.message);
    }
}

// ── VIEW MUTASI DOCS ────────────────────────────────────────
async function viewMutasiDocs(id) {
    openModal(`<div class="modal-head"><h3>Memuat dokumen...</h3><button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button></div><div class="modal-body"><div class="empty-state"><div class="animate-spin" style="width:24px;height:24px;border:3px solid var(--border);border-top-color:var(--primary);border-radius:50%;margin:auto;"></div></div></div>`, 'modal-xl');
    try {
        const doc = await db.collection('pendaftaranMutasi').doc(id).get();
        if (!doc.exists) { showToast('Data tidak ditemukan','error'); closeModal(); return; }
        const d = doc.data();

        const docLabels = {
            nilaiRapor:'Nilai Rapor', pasFoto:'Pas Foto 3x4', aktaLahir:'Akta Kelahiran',
            kartuKeluarga:'Kartu Keluarga', ktpOrKia:'KTP/KIA/Kartu Pelajar',
            suratBaik:'Surat Keterangan Baik', suratSehat:'Surat Kesehatan',
            suratPindahOrtu:'Surat Pindah Orang Tua', suratPindahSekolah:'Surat Pindah Sekolah',
        };

        let docsHtml = '<div class="doc-grid">';
        const allDocs = { ...(d.dokumen || {}) };
        if (d.linkSuratPernyataan && d.linkSuratPernyataan !== '-') {
            allDocs.suratPernyataan = d.linkSuratPernyataan;
        }

        for (const [key, url] of Object.entries(allDocs)) {
            if (!url || url === '-') continue;
            const gId = extractGDriveId(url);
            const label = docLabels[key] || key;
            docsHtml += `<div class="doc-item">
                <div class="doc-item-head">
                    <i class="fab fa-google-drive"></i>
                    <span>${escapeHtml(label)}</span>
                </div>
                ${gId ? `<div class="doc-item-frame"><iframe src="https://drive.google.com/file/d/${gId}/preview" allow="autoplay" loading="lazy"></iframe></div>` : ''}
                <a href="${escapeHtml(url)}" target="_blank" class="doc-item-link">
                    <i class="fas fa-arrow-up-right-from-square"></i> Buka di Google Drive
                </a>
            </div>`;
        }
        docsHtml += '</div>';

        openModal(`
            <div class="modal-head">
                <h3>Dokumen Mutasi — ${escapeHtml(d.nama)}</h3>
                <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
            </div>
            <div class="modal-body">
                <div class="detail-grid" style="margin-bottom:16px;">
                    ${renderDetailField('No. Pendaftaran', d.noDaftar)}
                    ${renderDetailField('Sekolah Asal', d.sekolahAsal)}
                    ${renderDetailField('Alasan Pindah', d.alasanPindah)}
                    ${renderDetailField('Status', statusBadge(d.status))}
                    ${d.catatanOperator ? renderDetailField('Catatan Operator', d.catatanOperator) : ''}
                </div>
                <h4 style="font-size:.85rem;font-weight:700;color:var(--text);margin-bottom:12px;">
                    <i class="fas fa-file" style="margin-right:6px;color:var(--primary)"></i>Dokumen Persyaratan
                </h4>
                ${Object.keys(allDocs).length === 0 ? renderEmpty('Tidak ada dokumen','fas fa-file-slash') : docsHtml}
            </div>
            <div class="modal-footer">
                <button class="btn btn-warn" onclick="prosesMutasi('${id}');closeModal()"><i class="fas fa-gear"></i> Proses</button>
                <button class="btn btn-primary" onclick="approveMutasi('${id}');closeModal()"><i class="fas fa-check"></i> Setujui</button>
                <button class="btn btn-danger" onclick="closeModal();setTimeout(()=>rejectMutasi('${id}'),300)"><i class="fas fa-xmark"></i> Tolak</button>
                <button class="btn btn-ghost" onclick="closeModal()">Tutup</button>
            </div>`, 'modal-xl');

    } catch (e) { showToast('Gagal memuat dokumen','error'); closeModal(); }
}

// ── MUTASI ACTIONS ──────────────────────────────────────────
async function prosesMutasi(id) {
    try {
        await db.collection('pendaftaranMutasi').doc(id).update({ status:'proses', updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        showToast('Status diubah menjadi Diproses', 'success');
        loadMutasiPage();
    } catch (e) { showToast('Gagal mengubah status','error'); }
}

async function approveMutasi(id) {
    try {
        await db.collection('pendaftaranMutasi').doc(id).update({ status:'diterima', updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        showToast('Pendaftaran mutasi disetujui!', 'success');
        loadMutasiPage();
    } catch (e) { showToast('Gagal','error'); }
}

function rejectMutasi(id) {
    openModal(`
        <div class="modal-head">
            <h3>Tolak Pendaftaran Mutasi</h3>
            <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label>Alasan Penolakan</label>
                <textarea id="alasanTolak" class="form-input" rows="4" placeholder="Tuliskan alasan penolakan secara jelas..."></textarea>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-danger" onclick="confirmRejectMutasi('${id}')"><i class="fas fa-xmark"></i> Tolak Pendaftaran</button>
            <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        </div>`);
}

async function confirmRejectMutasi(id) {
    const alasan = el('alasanTolak')?.value.trim();
    if (!alasan) { showToast('Alasan penolakan wajib diisi!','warning'); return; }
    try {
        await db.collection('pendaftaranMutasi').doc(id).update({
            status: 'ditolak',
            catatanOperator: alasan,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        closeModal();
        showToast('Pendaftaran mutasi ditolak.', 'success');
        loadMutasiPage();
    } catch (e) { showToast('Gagal','error'); }
}

// ── APPROVE / REJECT ────────────────────────────────────────
async function approveItem(collection, id) {
    try {
        await db.collection(collection).doc(id).update({
            status: 'approved',
            approvedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('Pendaftaran disetujui!', 'success');
        navigateTo(State.page);
    } catch (e) { showToast('Gagal menyetujui','error'); }
}

async function rejectItem(collection, id) {
    if (!confirm('Tolak pendaftaran ini? Tindakan tidak dapat diurungkan.')) return;
    try {
        await db.collection(collection).doc(id).update({
            status: 'rejected',
            rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('Pendaftaran ditolak.', 'success');
        navigateTo(State.page);
    } catch (e) { showToast('Gagal menolak','error'); }
}

// ── ABSENSI SISWA ───────────────────────────────────────────
async function loadAbsensiSiswa() {
    DOM.pageContainer.innerHTML = renderLoadingPage();
    try {
        const snapshot = await db.collection('absensiSiswa').orderBy('timestamp','desc').limit(50).get();

        let headerHtml = `
            <div class="page-header slide-up">
                <div class="page-header-left">
                    <h2>Absensi Siswa</h2>
                    <p>${snapshot.size} data absensi terbaru (50 terakhir)</p>
                </div>
            </div>`;

        if (snapshot.empty) {
            DOM.pageContainer.innerHTML = headerHtml + renderEmpty('Belum ada data absensi siswa','fas fa-clipboard-list');
            return;
        }

        const rows = snapshot.docs.map(doc => {
            const d = doc.data();
            return `<tr>
                <td class="td-strong">${escapeHtml(d.nama)}</td>
                <td>${escapeHtml(d.kelas)}</td>
                <td>${fmtDate(d.timestamp)}</td>
                <td>${statusBadge(d.status)}</td>
                <td>${d.buktiUrl ? `<a href="${escapeHtml(d.buktiUrl)}" target="_blank" class="file-link"><i class="fab fa-google-drive"></i> Lihat Bukti</a>` : '<span style="color:var(--text-4)">-</span>'}</td>
            </tr>`;
        }).join('');

        DOM.pageContainer.innerHTML = headerHtml + renderSearchTable(
            ['Nama','Kelas','Tanggal','Status','Bukti'],
            rows, snapshot.size
        );
        attachTableSearch();

    } catch (e) {
        console.error(e);
        DOM.pageContainer.innerHTML = renderEmpty('Gagal memuat data','fas fa-exclamation-triangle', e.message);
    }
}

// ── ABSENSI GURU ────────────────────────────────────────────
async function loadAbsensiGuru() {
    DOM.pageContainer.innerHTML = renderLoadingPage();
    try {
        const snapshot = await db.collection('absensiGuru').orderBy('timestamp','desc').limit(50).get();

        let headerHtml = `
            <div class="page-header slide-up">
                <div class="page-header-left">
                    <h2>Absensi Guru</h2>
                    <p>${snapshot.size} data absensi terbaru (50 terakhir)</p>
                </div>
            </div>`;

        if (snapshot.empty) {
            DOM.pageContainer.innerHTML = headerHtml + renderEmpty('Belum ada data absensi guru','fas fa-clipboard-check');
            return;
        }

        const rows = snapshot.docs.map(doc => {
            const d = doc.data();
            return `<tr>
                <td class="td-strong">${escapeHtml(d.nama)}</td>
                <td>${escapeHtml(d.jabatan || '-')}</td>
                <td>${fmtDate(d.timestamp)}</td>
                <td>${statusBadge(d.status)}</td>
                <td>${d.buktiUrl ? `<a href="${escapeHtml(d.buktiUrl)}" target="_blank" class="file-link"><i class="fab fa-google-drive"></i> Lihat Bukti</a>` : '<span style="color:var(--text-4)">-</span>'}</td>
            </tr>`;
        }).join('');

        DOM.pageContainer.innerHTML = headerHtml + renderSearchTable(
            ['Nama','Jabatan','Tanggal','Status','Bukti'],
            rows, snapshot.size
        );
        attachTableSearch();

    } catch (e) {
        console.error(e);
        DOM.pageContainer.innerHTML = renderEmpty('Gagal memuat data','fas fa-exclamation-triangle', e.message);
    }
}

// ── DATA SISWA ──────────────────────────────────────────────
async function loadDataSiswa() {
    DOM.pageContainer.innerHTML = renderLoadingPage();
    try {
        const kelasList = [];
        for (let i = 10; i <= 12; i++) for (let j = 1; j <= 8; j++) kelasList.push(`${i}.${j}`);

        const snapshot = await db.collection('siswa').where('status','==','approved').orderBy('kelas').orderBy('nama').get();

        const chipHtml = `<div class="filter-chips">
            <button class="chip active" data-filter="" onclick="filterTableRows('siswaBody','kelas','',this)">Semua</button>
            ${kelasList.map(k => `<button class="chip" data-filter="${k}" onclick="filterTableRows('siswaBody','kelas','${k}',this)">${k}</button>`).join('')}
        </div>`;

        let headerHtml = `
            <div class="page-header slide-up">
                <div class="page-header-left">
                    <h2>Data Siswa Aktif</h2>
                    <p>${snapshot.size} siswa terdaftar aktif</p>
                </div>
            </div>`;

        if (snapshot.empty) {
            DOM.pageContainer.innerHTML = headerHtml + chipHtml + renderEmpty('Belum ada siswa aktif','fas fa-users');
            return;
        }

        const rows = snapshot.docs.map(doc => {
            const d = doc.data();
            return `<tr data-kelas="${escapeHtml(d.kelas || '')}">
                <td class="td-strong">${escapeHtml(d.nama || '-')}</td>
                <td class="td-mono">${escapeHtml(d.nisn || '-')}</td>
                <td>${escapeHtml(d.kelas || '-')}</td>
                <td>${escapeHtml(d.jurusan || '-')}</td>
                <td><button class="btn btn-ghost btn-sm btn-icon" onclick="viewSiswaDetail('${doc.id}')" title="Lihat Detail"><i class="fas fa-eye"></i></button></td>
            </tr>`;
        }).join('');

        DOM.pageContainer.innerHTML = headerHtml + `<div class="table-wrap fade-in">
            ${chipHtml}
            <div class="table-toolbar">
                <div class="table-search">
                    <i class="fas fa-magnifying-glass"></i>
                    <input type="text" placeholder="Cari nama siswa..." id="tblSearch">
                </div>
                <span class="table-count" id="tblCount">${snapshot.size} siswa</span>
            </div>
            <div class="table-scroll">
                <table>
                    <thead><tr><th>Nama</th><th>NISN</th><th>Kelas</th><th>Jurusan</th><th>Detail</th></tr></thead>
                    <tbody id="siswaBody">${rows}</tbody>
                </table>
            </div>
        </div>`;
        attachTableSearch('siswaBody', 'tblSearch', 'tblCount', 'siswa');

    } catch (e) {
        console.error(e);
        DOM.pageContainer.innerHTML = renderEmpty('Gagal memuat data','fas fa-exclamation-triangle', e.message);
    }
}

// ── Table Helpers ───────────────────────────────────────────
function renderSearchTable(headers, rows, count) {
    return `<div class="table-wrap fade-in">
        <div class="table-toolbar">
            <div class="table-search">
                <i class="fas fa-magnifying-glass"></i>
                <input type="text" placeholder="Cari..." id="tblSearch">
            </div>
            <span class="table-count" id="tblCount">${count} data</span>
        </div>
        <div class="table-scroll">
            <table>
                <thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
                <tbody id="mainTableBody">${rows}</tbody>
            </table>
        </div>
    </div>`;
}

function attachTableSearch(tbodyId = 'mainTableBody', inputId = 'tblSearch', countId = 'tblCount', unit = 'data') {
    const input  = el(inputId);
    const tbody  = el(tbodyId);
    const counter = el(countId);
    if (!input || !tbody) return;

    const doSearch = debounce(() => {
        const q = input.value.toLowerCase().trim();
        let visible = 0;
        qsa('tr', tbody).forEach(row => {
            const text = row.textContent.toLowerCase();
            const match = !q || text.includes(q);
            row.style.display = match ? '' : 'none';
            if (match) visible++;
        });
        if (counter) counter.textContent = `${visible} ${unit}`;
    }, 180);

    input.addEventListener('input', doSearch);
}

function renderDetailField(label, value) {
    return `<div class="detail-field">
        <label>${label}</label>
        <p>${value}</p>
    </div>`;
}

// ── Global Exports ──────────────────────────────────────────
window.navigateTo         = navigateTo;
window.approveItem        = approveItem;
window.rejectItem         = rejectItem;
window.viewSiswaDetail    = viewSiswaDetail;
window.viewMutasiDocs     = viewMutasiDocs;
window.prosesMutasi       = prosesMutasi;
window.approveMutasi      = approveMutasi;
window.rejectMutasi       = rejectMutasi;
window.confirmRejectMutasi= confirmRejectMutasi;
window.closeModal         = closeModal;
window.viewGuruDetail     = viewGuruDetail;
window.filterTableRows    = filterTableRows;
window.removeToast        = removeToast;
window.markNotifRead      = markNotifRead;

console.log('%c✅ Operator Panel SMAN 68 Jakarta — Loaded', 'color:#22c55e;font-weight:700;font-size:14px;');
