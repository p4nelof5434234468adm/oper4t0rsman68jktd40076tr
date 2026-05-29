/* ══════════════════════════════════════════════════
   OPERATOR MUTASI – SMAN 68 Jakarta
   Firebase Firestore | Realtime | CRUD | Export
══════════════════════════════════════════════════ */

/* ── Firebase Config ── */
const firebaseConfig = {
  apiKey: "AIzaSyDAcKcg3alPOTH3FFGelYmsW7jcMMe2PLI",
  authDomain: "upnvjdatsystem.firebaseapp.com",
  projectId: "upnvjdatsystem",
  storageBucket: "upnvjdatsystem.firebasestorage.app",
  messagingSenderId: "57095309946",
  appId: "1:57095309946:web:b0e9f3f86380d549ffc9c3"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

/* ── Credentials (hardcoded demo) ── */
const OPERATOR_CREDS = { username: 'admin68', password: 'mutasi2026' };

/* ── State ── */
let allData          = [];
let filteredData     = [];
let verifFiltered    = [];
let jadwalFiltered   = [];
let currentPage      = 1;
const PAGE_SIZE      = 10;
let sortKey          = 'createdAt';
let sortAsc          = false;
let selectedStatus   = null;
let selectedDocId    = null;
let jadwalPesertaTarget = null;
let unsubscribeListener = null;

/* ── Berkas Map ── */
const BERKAS_MAP = [
  { key: 'nilaiRapor',        label: 'Nilai Rapor',                icon: 'fa-file-lines',      isRoot: false },
  { key: 'pasFoto',           label: 'Pas Foto',                   icon: 'fa-image',           isRoot: false },
  { key: 'aktaLahir',         label: 'Akta Kelahiran',             icon: 'fa-scroll',          isRoot: false },
  { key: 'kartuKeluarga',     label: 'Kartu Keluarga',             icon: 'fa-users',           isRoot: false },
  { key: 'ktpOrKia',          label: 'KTP / KIA / Kartu Pelajar', icon: 'fa-id-card',         isRoot: false },
  { key: 'suratBaik',         label: 'Surat Keterangan Baik',      icon: 'fa-certificate',     isRoot: false },
  { key: 'suratSehat',        label: 'Surat Kesehatan',            icon: 'fa-heart-pulse',     isRoot: false },
  { key: 'suratPindahOrtu',   label: 'Surat Permohonan Pindah',   icon: 'fa-file-export',     isRoot: false },
  { key: 'suratPindahSekolah',label: 'Surat Keterangan Pindah',   icon: 'fa-school',          isRoot: false },
  { key: 'linkSuratPernyataan', label: 'Surat Pernyataan',        icon: 'fa-file-signature',  isRoot: true  },
];

/* ══════════════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════════════ */
function showLoading(txt = 'Memuat...') {
  document.getElementById('loadingText').textContent = txt;
  document.getElementById('loadingOverlay').classList.remove('hidden');
}
function hideLoading() {
  document.getElementById('loadingOverlay').classList.add('hidden');
}

function showToast(msg, type = 'info') {
  const icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<i class="fa-solid ${icons[type]}"></i><span>${msg}</span>`;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = '.3s'; setTimeout(() => el.remove(), 300); }, 4000);
}

function formatTanggal(val) {
  if (!val) return '-';
  if (val?.toDate) val = val.toDate();
  if (val instanceof Date) return val.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  if (typeof val === 'string') {
    const d = new Date(val);
    if (!isNaN(d)) return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    return val;
  }
  return '-';
}

function formatTglInput(val) {
  if (!val) return '';
  if (val?.toDate) val = val.toDate();
  if (val instanceof Date) return val.toISOString().split('T')[0];
  if (typeof val === 'string') return val.slice(0, 10);
  return '';
}

function badgeHTML(status) {
  const s = (status || 'pending').toLowerCase();
  const labels = { pending: 'Pending', proses: 'Proses', diterima: 'Diterima', ditolak: 'Ditolak' };
  const icons  = { pending: 'fa-clock', proses: 'fa-spinner', diterima: 'fa-circle-check', ditolak: 'fa-circle-xmark' };
  return `<span class="badge badge-${s}"><i class="fa-solid ${icons[s] || 'fa-circle'}"></i> ${labels[s] || s}</span>`;
}

/* ══════════════════════════════════════════════════
   SESSION
══════════════════════════════════════════════════ */
function saveSession() { localStorage.setItem('sman68_op', '1'); }
function hasSession()  { return !!localStorage.getItem('sman68_op'); }
function clearSession(){ localStorage.removeItem('sman68_op'); }

/* ══════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
  startClock();
  if (hasSession()) {
    showPage('dashboardPage');
    initDashboard();
  } else {
    showPage('loginPage');
  }

  // Enter key on login
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && document.getElementById('loginPage').classList.contains('active')) handleLogin();
  });
});

function startClock() {
  const el = document.getElementById('headerTime');
  if (!el) return;
  const update = () => {
    const now = new Date();
    el.textContent = now.toLocaleString('id-ID', { weekday:'short', day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
  };
  update(); setInterval(update, 30000);
}

/* ══════════════════════════════════════════════════
   LOGIN
══════════════════════════════════════════════════ */
function handleLogin() {
  const user = document.getElementById('inputUser').value.trim();
  const pass = document.getElementById('inputPass').value.trim();
  document.getElementById('btnLoginText').classList.add('hidden');
  document.getElementById('btnLoginLoader').classList.remove('hidden');

  setTimeout(() => {
    if (user === OPERATOR_CREDS.username && pass === OPERATOR_CREDS.password) {
      saveSession();
      showPage('dashboardPage');
      initDashboard();
      showToast('Login berhasil! Selamat datang, Operator.', 'success');
    } else {
      showToast('Username atau password salah.', 'error');
    }
    document.getElementById('btnLoginText').classList.remove('hidden');
    document.getElementById('btnLoginLoader').classList.add('hidden');
  }, 800);
}

function togglePass() {
  const inp = document.getElementById('inputPass');
  const ico = document.getElementById('passEyeIcon');
  if (inp.type === 'password') { inp.type = 'text'; ico.className = 'fa-solid fa-eye-slash'; }
  else { inp.type = 'password'; ico.className = 'fa-solid fa-eye'; }
}

/* ══════════════════════════════════════════════════
   LOGOUT
══════════════════════════════════════════════════ */
function handleLogout() {
  openConfirm('Konfirmasi Logout', 'Apakah Anda yakin ingin keluar?', 'fa-right-from-bracket', () => {
    if (unsubscribeListener) unsubscribeListener();
    clearSession();
    showPage('loginPage');
    document.getElementById('inputUser').value = '';
    document.getElementById('inputPass').value = '';
    showToast('Anda telah keluar dari sistem.', 'info');
  });
}

/* ══════════════════════════════════════════════════
   PAGES & SECTIONS
══════════════════════════════════════════════════ */
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => { p.classList.remove('active'); p.classList.add('hidden'); });
  const pg = document.getElementById(id);
  pg.classList.remove('hidden');
  pg.classList.add('active');
}

function switchSection(el, sectionId) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.content-section').forEach(s => { s.classList.remove('active'); s.classList.add('hidden'); });

  if (el) el.classList.add('active');

  const sec = document.getElementById(sectionId);
  if (sec) { sec.classList.remove('hidden'); sec.classList.add('active'); }

  const titles = {
    secDashboard: 'Dashboard',
    secPendaftar: 'Data Pendaftar',
    secVerifikasi: 'Verifikasi Berkas',
    secJadwal: 'Jadwal Seleksi',
    secStatistik: 'Statistik',
  };
  document.getElementById('headerTitle').textContent = titles[sectionId] || 'Dashboard';

  // Trigger renders
  if (sectionId === 'secVerifikasi') renderVerifGrid();
  if (sectionId === 'secStatistik')  renderStatistik();
  if (sectionId === 'secJadwal')     renderJadwalPeserta();

  closeSidebar();
}

/* ══════════════════════════════════════════════════
   SIDEBAR TOGGLE (mobile)
══════════════════════════════════════════════════ */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

/* ══════════════════════════════════════════════════
   FIREBASE REALTIME LISTENER
══════════════════════════════════════════════════ */
function initDashboard() {
  showLoading('Menghubungkan ke database...');

  unsubscribeListener = db.collection('pendaftaranMutasi')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      allData = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
      filteredData = [...allData];
      verifFiltered = [...allData];
      jadwalFiltered = allData.filter(d => (d.status || '').toLowerCase() === 'diterima');

      updateStats();
      renderRecentTable();
      renderMainTable();

      // Re-render active section if needed
      const activeSec = document.querySelector('.content-section.active');
      if (activeSec?.id === 'secVerifikasi') renderVerifGrid();
      if (activeSec?.id === 'secStatistik')  renderStatistik();
      if (activeSec?.id === 'secJadwal')     renderJadwalPeserta();

      hideLoading();
    }, err => {
      console.error(err);
      showToast('Gagal terhubung ke database.', 'error');
      hideLoading();
    });
}

/* ══════════════════════════════════════════════════
   STATISTICS
══════════════════════════════════════════════════ */
function updateStats() {
  const counts = { total: allData.length, pending: 0, proses: 0, diterima: 0, ditolak: 0 };
  allData.forEach(d => {
    const s = (d.status || 'pending').toLowerCase();
    if (counts[s] !== undefined) counts[s]++;
  });

  animateCount('statTotal',    counts.total);
  animateCount('statPending',  counts.pending);
  animateCount('statProses',   counts.proses);
  animateCount('statDiterima', counts.diterima);
  animateCount('statDitolak',  counts.ditolak);
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = parseInt(el.textContent) || 0;
  const dur = 600; const step = 16;
  let cur = start; const inc = (target - start) / (dur / step);
  const timer = setInterval(() => {
    cur += inc;
    if ((inc >= 0 && cur >= target) || (inc < 0 && cur <= target)) {
      el.textContent = target; clearInterval(timer);
    } else el.textContent = Math.round(cur);
  }, step);
}

/* ══════════════════════════════════════════════════
   RECENT TABLE (Dashboard)
══════════════════════════════════════════════════ */
function renderRecentTable() {
  const tbody = document.getElementById('recentTbody');
  const rows  = allData.slice(0, 5);
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="tbl-empty"><i class="fa-solid fa-inbox"></i> Belum ada data pendaftar</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(d => tableRow(d)).join('');
}

/* ══════════════════════════════════════════════════
   MAIN TABLE (Data Pendaftar)
══════════════════════════════════════════════════ */
function renderMainTable() {
  currentPage = 1;
  applyFilter();
}

function applyFilter() {
  const q  = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const fs = (document.getElementById('filterStatus')?.value || '').toLowerCase();

  filteredData = allData.filter(d => {
    const matchQ  = !q || (d.nama || '').toLowerCase().includes(q) || (d.noDaftar || '').toLowerCase().includes(q);
    const matchS  = !fs || (d.status || '').toLowerCase() === fs;
    return matchQ && matchS;
  });

  // Sort
  filteredData.sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey];
    if (av?.toDate) av = av.toDate(); if (bv?.toDate) bv = bv.toDate();
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    if (av < bv) return sortAsc ? -1 : 1;
    if (av > bv) return sortAsc ?  1 : -1;
    return 0;
  });

  renderPagination();
  renderPageRows();
}

function filterTable() { currentPage = 1; applyFilter(); }

function sortTable(key) {
  if (sortKey === key) sortAsc = !sortAsc; else { sortKey = key; sortAsc = true; }
  applyFilter();
}

function renderPageRows() {
  const start = (currentPage - 1) * PAGE_SIZE;
  const rows  = filteredData.slice(start, start + PAGE_SIZE);
  const tbody = document.getElementById('mainTbody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="tbl-empty"><i class="fa-solid fa-inbox"></i> Tidak ada data ditemukan</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(d => tableRow(d)).join('');
}

function tableRow(d) {
  return `
    <tr>
      <td><code style="font-size:.78rem;background:var(--gray-100);padding:3px 8px;border-radius:6px;">${d.noDaftar || '-'}</code></td>
      <td><strong>${d.nama || '-'}</strong></td>
      <td>${d.sekolahAsal || '-'}</td>
      <td>${formatTanggal(d.createdAt)}</td>
      <td>${badgeHTML(d.status)}</td>
      <td>
        <div class="btn-action-wrap">
          <button class="btn-action btn-detail" onclick="openDetail('${d._id}')"><i class="fa-solid fa-eye"></i> Detail</button>
          <button class="btn-action btn-verif" onclick="openVerif('${d._id}')"><i class="fa-solid fa-pen"></i> Status</button>
        </div>
      </td>
    </tr>`;
}

function renderPagination() {
  const total = Math.ceil(filteredData.length / PAGE_SIZE);
  const pg    = document.getElementById('pagination');
  if (!pg) return;
  if (total <= 1) { pg.innerHTML = ''; return; }

  let html = `<button class="pg-btn" onclick="goPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i></button>`;
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - currentPage) <= 1) {
      html += `<button class="pg-btn ${i === currentPage ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
    } else if (Math.abs(i - currentPage) === 2) {
      html += `<span style="color:var(--gray-400);padding:0 4px">…</span>`;
    }
  }
  html += `<button class="pg-btn" onclick="goPage(${currentPage + 1})" ${currentPage === total ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>`;
  pg.innerHTML = html;
}

function goPage(n) {
  const total = Math.ceil(filteredData.length / PAGE_SIZE);
  if (n < 1 || n > total) return;
  currentPage = n;
  renderPageRows();
  renderPagination();
}

/* ══════════════════════════════════════════════════
   VERIFIKASI GRID
══════════════════════════════════════════════════ */
function renderVerifGrid() {
  const q  = (document.getElementById('searchVerif')?.value || '').toLowerCase();
  const fs = (document.getElementById('filterVerifStatus')?.value || '').toLowerCase();

  verifFiltered = allData.filter(d => {
    const matchQ = !q || (d.nama || '').toLowerCase().includes(q) || (d.noDaftar || '').toLowerCase().includes(q);
    const matchS = !fs || (d.status || '').toLowerCase() === fs;
    return matchQ && matchS;
  });

  const grid = document.getElementById('verifGrid');
  if (!verifFiltered.length) {
    grid.innerHTML = `<div class="tbl-empty" style="grid-column:1/-1;padding:40px;text-align:center"><i class="fa-solid fa-inbox" style="font-size:2rem;color:var(--gray-300);display:block;margin-bottom:12px"></i>Tidak ada data</div>`;
    return;
  }

  grid.innerHTML = verifFiltered.map(d => `
    <div class="verif-card">
      <div class="verif-card-header">
        <div>
          <div class="verif-card-name">${d.nama || '-'}</div>
          <div class="verif-card-no">${d.noDaftar || '-'}</div>
        </div>
        ${badgeHTML(d.status)}
      </div>
      <div style="font-size:.78rem;color:var(--gray-500);margin-bottom:4px"><i class="fa-solid fa-school" style="margin-right:5px;color:var(--blue-main)"></i>${d.sekolahAsal || '-'}</div>
      <div style="font-size:.78rem;color:var(--gray-500)"><i class="fa-solid fa-calendar" style="margin-right:5px;color:var(--green-main)"></i>${formatTanggal(d.createdAt)}</div>
      <div class="verif-card-actions">
        <button class="btn-action btn-detail" onclick="openDetail('${d._id}')"><i class="fa-solid fa-eye"></i> Detail</button>
        <button class="btn-action btn-verif" onclick="openVerif('${d._id}')"><i class="fa-solid fa-pen-to-square"></i> Ubah Status</button>
      </div>
    </div>`).join('');
}

function filterVerif() { renderVerifGrid(); }

/* ══════════════════════════════════════════════════
   MODAL DETAIL
══════════════════════════════════════════════════ */
function openDetail(docId) {
  const d = allData.find(x => x._id === docId);
  if (!d) return;
  selectedDocId = docId;

  const jk = d.jk === 'L' ? 'Laki-laki' : d.jk === 'P' ? 'Perempuan' : (d.jk || '-');
  const fields = [
    { label: 'Nomor Pendaftaran', value: d.noDaftar,    wide: false },
    { label: 'Nama Lengkap',      value: d.nama,         wide: false },
    { label: 'Tanggal Lahir',     value: formatTanggal(d.tglLahir), wide: false },
    { label: 'Jenis Kelamin',     value: jk,             wide: false },
    { label: 'Agama',             value: d.agama,        wide: false },
    { label: 'Email',             value: d.email,        wide: false },
    { label: 'No. HP Siswa',      value: d.telpMurid,    wide: false },
    { label: 'No. HP Ortu',       value: d.telpOrtu,     wide: false },
    { label: 'Sekolah Asal',      value: d.sekolahAsal,  wide: true  },
    { label: 'Alasan Pindah',     value: d.alasanPindah, wide: true  },
  ];

  const dokumen = d.dokumen || {};
  const berkasHTML = BERKAS_MAP.map(b => {
    const link  = b.isRoot ? d[b.key] : dokumen[b.key];
    const valid = link && link.trim() !== '';
    return `
      <div class="berkas-detail-item">
        <div class="bd-left">
          <div class="bd-icon ${valid ? 'valid' : 'missing'}"><i class="fa-solid ${valid ? 'fa-circle-check' : b.icon}"></i></div>
          <div>
            <div class="bd-name">${b.label}</div>
            <div class="bd-status ${valid ? 'valid' : 'missing'}">${valid ? '✓ VALID' : '— Belum ada'}</div>
          </div>
        </div>
        ${valid ? `<a href="${link}" target="_blank" class="bd-link"><i class="fa-solid fa-arrow-up-right-from-square"></i> Lihat</a>` : ''}
      </div>`;
  }).join('');

  document.getElementById('modalDetailBody').innerHTML = `
    <div>
      <div class="detail-section-title"><i class="fa-solid fa-user"></i> Data Diri</div>
      <div class="detail-grid">
        ${fields.map(f => `<div class="detail-item${f.wide ? ' wide' : ''}"><div class="di-label">${f.label}</div><div class="di-value">${f.value || '-'}</div></div>`).join('')}
      </div>
      ${d.catatanOperator ? `<div style="background:var(--gold-pale);border:1px solid #fcd34d;border-radius:10px;padding:12px 16px;font-size:.82rem;color:#92400e;margin-bottom:20px"><strong>Catatan Operator:</strong> ${d.catatanOperator}</div>` : ''}
      <div class="detail-section-title"><i class="fa-solid fa-folder-open"></i> Status Berkas</div>
      <div class="berkas-detail-grid">${berkasHTML}</div>
    </div>`;

  openModal('modalDetail');
}

function openVerifFromDetail() {
  closeModal('modalDetail');
  setTimeout(() => openVerif(selectedDocId), 150);
}

/* ══════════════════════════════════════════════════
   MODAL VERIFIKASI STATUS
══════════════════════════════════════════════════ */
function openVerif(docId) {
  const d = allData.find(x => x._id === docId);
  if (!d) return;
  selectedDocId = docId;
  selectedStatus = d.status || 'pending';

  document.getElementById('verifNama').textContent = `${d.nama || '-'} — ${d.noDaftar || '-'}`;
  document.getElementById('inputCatatan').value   = d.catatanOperator || '';

  // Update button selection
  document.querySelectorAll('.btn-status').forEach(b => b.classList.remove('selected'));
  const activeBtn = document.querySelector(`.btn-status.${selectedStatus}`);
  if (activeBtn) activeBtn.classList.add('selected');

  // Show catatan if ditolak
  const catatanWrap = document.getElementById('catatanWrap');
  catatanWrap.classList.toggle('hidden', selectedStatus !== 'ditolak');

  openModal('modalVerif');
}

function setStatusBtn(status) {
  selectedStatus = status;
  document.querySelectorAll('.btn-status').forEach(b => b.classList.remove('selected'));
  const btn = document.querySelector(`.btn-status.${status}`);
  if (btn) btn.classList.add('selected');
  document.getElementById('catatanWrap').classList.toggle('hidden', status !== 'ditolak');
}

async function saveStatus() {
  if (!selectedDocId || !selectedStatus) return;
  const catatan = document.getElementById('inputCatatan').value.trim();

  showLoading('Menyimpan status...');
  try {
    const update = { status: selectedStatus };
    if (catatan) update.catatanOperator = catatan;
    else update.catatanOperator = firebase.firestore.FieldValue.delete();

    await db.collection('pendaftaranMutasi').doc(selectedDocId).update(update);
    showToast(`Status berhasil diubah menjadi "${selectedStatus}".`, 'success');
    closeModal('modalVerif');
  } catch (err) {
    console.error(err);
    showToast('Gagal menyimpan status.', 'error');
  }
  hideLoading();
}

/* ══════════════════════════════════════════════════
   JADWAL
══════════════════════════════════════════════════ */
async function saveJadwalGlobal() {
  const payload = {
    jadwalTes:      document.getElementById('jTanggalTes').value,
    jamTes:         document.getElementById('jJamTes').value,
    jadwalWawancara: document.getElementById('jWawancara').value,
    lokasiTes:      document.getElementById('jLokasi').value,
    catatanPeserta: document.getElementById('jCatatan').value,
    updatedAt:      firebase.firestore.FieldValue.serverTimestamp(),
  };

  if (!payload.jadwalTes && !payload.jadwalWawancara) {
    showToast('Isi minimal satu jadwal.', 'error'); return;
  }

  showLoading('Menyimpan jadwal global...');
  try {
    await db.collection('jadwalMutasi').doc('global').set(payload, { merge: true });
    showToast('Jadwal global berhasil disimpan.', 'success');
  } catch (err) {
    console.error(err);
    showToast('Gagal menyimpan jadwal.', 'error');
  }
  hideLoading();
}

function renderJadwalPeserta() {
  const q = (document.getElementById('searchJadwal')?.value || '').toLowerCase();
  jadwalFiltered = allData
    .filter(d => (d.status || '').toLowerCase() === 'diterima')
    .filter(d => !q || (d.nama || '').toLowerCase().includes(q) || (d.noDaftar || '').toLowerCase().includes(q));

  const list = document.getElementById('jadwalPesertaList');
  if (!jadwalFiltered.length) {
    list.innerHTML = `<div class="tbl-empty"><i class="fa-solid fa-user-graduate" style="display:block;font-size:2rem;margin-bottom:10px;color:var(--gray-300)"></i>Belum ada peserta diterima</div>`;
    return;
  }
  list.innerHTML = jadwalFiltered.map(d => `
    <div class="jp-item">
      <div>
        <div class="jp-name">${d.nama || '-'}</div>
        <div class="jp-no">${d.noDaftar || '-'}</div>
        ${d.jadwalTes ? `<div style="font-size:.72rem;color:var(--green-main);margin-top:3px"><i class="fa-solid fa-calendar-check"></i> Tes: ${formatTanggal(d.jadwalTes)}</div>` : ''}
      </div>
      <button class="btn-set-jadwal" onclick="openJadwalPeserta('${d._id}')"><i class="fa-solid fa-calendar-pen"></i> Atur Jadwal</button>
    </div>`).join('');
}

function filterJadwalPeserta() { renderJadwalPeserta(); }

function openJadwalPeserta(docId) {
  const d = allData.find(x => x._id === docId);
  if (!d) return;
  jadwalPesertaTarget = docId;

  document.getElementById('jadwalPesertaNama').textContent = `${d.nama || '-'} — ${d.noDaftar || '-'}`;
  document.getElementById('jpTes').value        = formatTglInput(d.jadwalTes) || '';
  document.getElementById('jpJam').value        = d.jamTes || '';
  document.getElementById('jpWawancara').value  = formatTglInput(d.jadwalWawancara) || '';
  document.getElementById('jpLokasi').value     = d.lokasiTes || '';
  document.getElementById('jpCatatan').value    = d.catatanPeserta || '';

  openModal('modalJadwalPeserta');
}

async function saveJadwalPeserta() {
  if (!jadwalPesertaTarget) return;
  const payload = {
    jadwalTes:       document.getElementById('jpTes').value,
    jamTes:          document.getElementById('jpJam').value,
    jadwalWawancara: document.getElementById('jpWawancara').value,
    lokasiTes:       document.getElementById('jpLokasi').value,
    catatanPeserta:  document.getElementById('jpCatatan').value,
  };

  showLoading('Menyimpan jadwal peserta...');
  try {
    await db.collection('pendaftaranMutasi').doc(jadwalPesertaTarget).update(payload);
    showToast('Jadwal peserta berhasil disimpan.', 'success');
    closeModal('modalJadwalPeserta');
  } catch (err) {
    console.error(err);
    showToast('Gagal menyimpan jadwal.', 'error');
  }
  hideLoading();
}

/* ══════════════════════════════════════════════════
   STATISTIK
══════════════════════════════════════════════════ */
function renderStatistik() {
  // Status chart
  const statusCounts = { pending: 0, proses: 0, diterima: 0, ditolak: 0 };
  const jkCounts     = { 'Laki-laki': 0, 'Perempuan': 0, 'Lainnya': 0 };
  const sekolahMap   = {};

  allData.forEach(d => {
    const s = (d.status || 'pending').toLowerCase();
    if (statusCounts[s] !== undefined) statusCounts[s]++;
    const jk = d.jk === 'L' ? 'Laki-laki' : d.jk === 'P' ? 'Perempuan' : 'Lainnya';
    jkCounts[jk]++;
    const sk = d.sekolahAsal || 'Tidak diketahui';
    sekolahMap[sk] = (sekolahMap[sk] || 0) + 1;
  });

  const total = allData.length || 1;
  const statusColors = { pending: '#f59e0b', proses: '#1a6ccc', diterima: '#1a9c54', ditolak: '#dc2626' };
  const jkColors     = { 'Laki-laki': '#1a6ccc', 'Perempuan': '#ec4899', 'Lainnya': '#94a3b8' };

  renderBars('chartStatus', statusCounts, statusColors, total);
  renderBars('chartJK', jkCounts, jkColors, total);

  // Top 8 schools
  const top8 = Object.entries(sekolahMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const top8Obj = Object.fromEntries(top8);
  const sekolahColors = {};
  const palette = ['#1a9c54','#1a6ccc','#f59e0b','#ec4899','#7c3aed','#0891b2','#dc2626','#64748b'];
  top8.forEach(([k], i) => { sekolahColors[k] = palette[i % palette.length]; });
  renderBars('chartSekolah', top8Obj, sekolahColors, total, true);
}

function renderBars(containerId, obj, colors, total, longLabel = false) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const maxVal = Math.max(...Object.values(obj), 1);
  el.innerHTML = Object.entries(obj).map(([key, val]) => `
    <div class="chart-row">
      <div class="chart-label" title="${key}" style="width:${longLabel ? '180px' : '100px'};font-size:${longLabel ? '.72rem' : '.78rem'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${key}</div>
      <div class="chart-bar-wrap">
        <div class="chart-bar" style="width:${Math.round(val/maxVal*100)}%;background:${colors[key] || '#94a3b8'}"></div>
      </div>
      <div class="chart-val">${val}</div>
    </div>`).join('');
}

/* ══════════════════════════════════════════════════
   EXPORT EXCEL
══════════════════════════════════════════════════ */
function exportExcel() {
  if (!allData.length) { showToast('Tidak ada data untuk diekspor.', 'error'); return; }
  showLoading('Membuat file Excel...');

  const rows = allData.map(d => ({
    'No. Pendaftaran': d.noDaftar   || '-',
    'Nama Lengkap':    d.nama        || '-',
    'Tgl Lahir':       formatTanggal(d.tglLahir),
    'JK':              d.jk === 'L' ? 'Laki-laki' : 'Perempuan',
    'Agama':           d.agama       || '-',
    'Sekolah Asal':    d.sekolahAsal || '-',
    'Email':           d.email       || '-',
    'No. HP':          d.telpMurid   || '-',
    'No. HP Ortu':     d.telpOrtu    || '-',
    'Alasan Pindah':   d.alasanPindah|| '-',
    'Status':          d.status      || '-',
    'Catatan':         d.catatanOperator || '-',
    'Tgl Daftar':      formatTanggal(d.createdAt),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data Mutasi');
  XLSX.writeFile(wb, `Data_Mutasi_SMAN68_${Date.now()}.xlsx`);
  showToast('File Excel berhasil diunduh.', 'success');
  hideLoading();
}

/* ══════════════════════════════════════════════════
   EXPORT PDF
══════════════════════════════════════════════════ */
async function exportPDF() {
  if (!allData.length) { showToast('Tidak ada data.', 'error'); return; }
  showLoading('Membuat PDF...');

  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // Header
    pdf.setFillColor(13, 108, 58);
    pdf.rect(0, 0, 297, 30, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(14); pdf.setFont(undefined, 'bold');
    pdf.text('SMA NEGERI 68 JAKARTA', 148, 12, { align: 'center' });
    pdf.setFontSize(9); pdf.setFont(undefined, 'normal');
    pdf.text('REKAP DATA PENDAFTAR MUTASI', 148, 20, { align: 'center' });
    pdf.text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, 148, 27, { align: 'center' });

    // Table
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(7);
    const headers = ['No.','No. Daftar','Nama','Sekolah Asal','JK','Status','Tgl Daftar'];
    const colW    = [10, 35, 50, 60, 12, 22, 30];
    let y = 38, x = 8;

    // Header row
    pdf.setFillColor(230, 249, 239);
    pdf.rect(x, y - 5, colW.reduce((a,b)=>a+b,0), 8, 'F');
    pdf.setFont(undefined, 'bold');
    headers.forEach((h, i) => {
      pdf.text(h, x + 2, y); x += colW[i];
    });
    y += 6; x = 8;

    pdf.setFont(undefined, 'normal');
    allData.slice(0, 80).forEach((d, idx) => {
      if (y > 185) { pdf.addPage(); y = 15; }
      const cols = [
        String(idx + 1),
        d.noDaftar || '-',
        (d.nama || '-').substring(0, 28),
        (d.sekolahAsal || '-').substring(0, 30),
        d.jk || '-',
        d.status || '-',
        formatTanggal(d.createdAt),
      ];
      if (idx % 2 === 0) { pdf.setFillColor(248, 250, 252); pdf.rect(x, y-4, colW.reduce((a,b)=>a+b,0), 6, 'F'); }
      cols.forEach((c, i) => { pdf.text(c, x + 1, y); x += colW[i]; });
      y += 6; x = 8;
    });

    pdf.save(`Rekap_Mutasi_SMAN68_${Date.now()}.pdf`);
    showToast('PDF berhasil diunduh.', 'success');
  } catch (err) {
    console.error(err);
    showToast('Gagal membuat PDF.', 'error');
  }
  hideLoading();
}

/* ══════════════════════════════════════════════════
   MODAL HELPERS
══════════════════════════════════════════════════ */
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  document.body.style.overflow = '';
}

// Close modals on overlay click
document.addEventListener('click', e => {
  ['modalDetail','modalVerif','modalJadwalPeserta','confirmDialog'].forEach(id => {
    const el = document.getElementById(id);
    if (el && e.target === el) closeModal(id);
  });
});

/* ══════════════════════════════════════════════════
   CONFIRM DIALOG
══════════════════════════════════════════════════ */
let confirmCallback = null;
function openConfirm(title, msg, icon, callback) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').textContent   = msg;
  document.getElementById('confirmIcon').className    = `fa-solid ${icon}`;
  confirmCallback = callback;
  openModal('confirmDialog');
}
function closeConfirm() { closeModal('confirmDialog'); confirmCallback = null; }
document.getElementById('btnConfirmOk').addEventListener('click', () => {
  closeConfirm();
  if (confirmCallback) confirmCallback();
});
