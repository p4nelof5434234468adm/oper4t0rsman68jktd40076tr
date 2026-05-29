// ============================================
// OPERATOR PANEL SMAN 68 JAKARTA - COMPLETE
// ============================================

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
const db = firebase.firestore();

// ============================================
// GLOBAL VARIABLES
// ============================================
let currentUser = null;
let currentPage = 'dashboard';
let notifications = [];
let selectedKelas = '';
let selectedMapel = '';

// ============================================
// DOM ELEMENTS
// ============================================
const $ = (id) => document.getElementById(id);
const preloader = $('preloader');
const loginOverlay = $('loginOverlay');
const mainPanel = $('mainPanel');
const loginForm = $('loginForm');
const logoutBtn = $('logoutBtn');
const menuToggle = $('menuToggle');
const sidebar = $('sidebar');
const pageContainer = $('pageContainer');
const pageTitle = $('pageTitle');
const userInfo = $('userInfo');
const datetime = $('datetime');
const notifBell = $('notifBell');
const notifCount = $('notifCount');
const notifDropdown = $('notifDropdown');
const notifList = $('notifList');
const clearNotif = $('clearNotif');
const modalOverlay = $('modalOverlay');
const modalCard = $('modalCard');
const toastContainer = $('toastContainer');

// ============================================
// AUTH
// ============================================
auth.onAuthStateChanged(async (user) => {
    setTimeout(() => preloader?.classList.add('hide'), 500);
    if (user) {
        const opDoc = await db.collection('operators').doc(user.uid).get();
        if (opDoc.exists || user.email === 'operator@sman68jkt.sch.id') {
            currentUser = user;
            showMainPanel();
        } else {
            await auth.signOut();
            showToast('Akses ditolak', 'error');
        }
    } else {
        showLogin();
    }
});

function showLogin() {
    loginOverlay.style.display = 'flex';
    mainPanel.style.display = 'none';
}
function showMainPanel() {
    loginOverlay.style.display = 'none';
    mainPanel.style.display = 'flex';
    userInfo.innerHTML = `<i class="fas fa-user-circle"></i><span>${currentUser.email}</span>`;
    initOperator();
}

// ============================================
// LOGIN
// ============================================
loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('loginEmail').value.trim();
    const password = $('loginPassword').value;
    try {
        await auth.signInWithEmailAndPassword(email, password);
        showToast('Login berhasil!', 'success');
    } catch (error) {
        showToast('Email atau password salah!', 'error');
    }
});

$('loginPassToggle')?.addEventListener('click', function() {
    const input = $('loginPassword');
    input.type = input.type === 'password' ? 'text' : 'password';
    this.classList.toggle('fa-eye');
    this.classList.toggle('fa-eye-slash');
});

logoutBtn?.addEventListener('click', async () => {
    await auth.signOut();
    showToast('Logout berhasil', 'success');
});

// ============================================
// INITIALIZE
// ============================================
function initOperator() {
    updateDateTime();
    setInterval(updateDateTime, 1000);
    loadDashboard();
    setupNav();
    setupNotif();
    setupRealtime();
}

function updateDateTime() {
    if (!datetime) return;
    const now = new Date();
    datetime.textContent = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ============================================
// NAVIGATION
// ============================================
function setupNav() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            loadPage(item.dataset.page);
        });
    });
    menuToggle?.addEventListener('click', () => sidebar?.classList.toggle('active'));
}

function loadPage(page) {
    currentPage = page;
    const titles = {
        dashboard: 'Dashboard',
        'siswa-pending': 'Pendaftaran Siswa',
        'guru-pending': 'Pendaftaran Guru',
        mutasi: 'Pendaftaran Mutasi',
        'absensi-siswa': 'Absensi Siswa',
        'absensi-guru': 'Absensi Guru',
        'data-siswa': 'Data Siswa Aktif',
        'data-guru': 'Data Guru Aktif'
    };
    if (pageTitle) pageTitle.textContent = titles[page] || page;
    
    switch(page) {
        case 'dashboard': loadDashboard(); break;
        case 'siswa-pending': loadSiswaPending(); break;
        case 'guru-pending': loadGuruPending(); break;
        case 'mutasi': loadMutasiPage(); break;
        case 'absensi-siswa': loadAbsensiSiswa(); break;
        case 'absensi-guru': loadAbsensiGuru(); break;
        case 'data-siswa': loadDataSiswa(); break;
        case 'data-guru': loadDataGuru(); break;
    }
}

// ============================================
// DASHBOARD
// ============================================
async function loadDashboard() {
    pageContainer.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat...</p></div>';
    try {
        const [siswaSnap, guruSnap, mutasiSnap, absensiSnap] = await Promise.all([
            db.collection('siswa').where('status','==','pending').get(),
            db.collection('guru').where('status','==','pending').get(),
            db.collection('pendaftaranMutasi').where('status','==','pending').get(),
            db.collection('absensiSiswa').get()
        ]);
        pageContainer.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-icon green"><i class="fas fa-user-graduate"></i></div><div class="stat-info"><h3>${siswaSnap.size}</h3><p>Pendaftaran Siswa</p></div></div>
                <div class="stat-card"><div class="stat-icon blue"><i class="fas fa-chalkboard-user"></i></div><div class="stat-info"><h3>${guruSnap.size}</h3><p>Pendaftaran Guru</p></div></div>
                <div class="stat-card"><div class="stat-icon orange"><i class="fas fa-exchange-alt"></i></div><div class="stat-info"><h3>${mutasiSnap.size}</h3><p>Pendaftaran Mutasi</p></div></div>
                <div class="stat-card"><div class="stat-icon teal"><i class="fas fa-clipboard-list"></i></div><div class="stat-info"><h3>${absensiSnap.size}</h3><p>Total Absensi</p></div></div>
            </div>
        `;
    } catch (e) { pageContainer.innerHTML = '<div class="empty-state"><p>Gagal memuat dashboard</p></div>'; }
}

// ============================================
// SISWA PENDING
// ============================================
async function loadSiswaPending() {
    pageContainer.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat...</p></div>';
    try {
        const snapshot = await db.collection('siswa').where('status','==','pending').orderBy('createdAt','desc').get();
        if (snapshot.empty) { pageContainer.innerHTML = '<div class="empty-state"><i class="fas fa-user-graduate"></i><p>Tidak ada pendaftaran siswa</p></div>'; return; }
        let html = '<div class="table-wrapper"><table><thead><tr><th>Nama</th><th>NISN</th><th>Kelas</th><th>Jurusan</th><th>Tanggal</th><th>Aksi</th></tr></thead><tbody>';
        snapshot.forEach(doc => {
            const d = doc.data();
            html += `<tr><td>${d.nama}</td><td>${d.nisn}</td><td>${d.kelas}</td><td>${d.jurusan}</td><td>${d.createdAt?.toDate().toLocaleDateString('id-ID')||'-'}</td><td><button class="btn btn-approve" onclick="approveItem('siswa','${doc.id}')"><i class="fas fa-check"></i></button><button class="btn btn-reject" onclick="rejectItem('siswa','${doc.id}')"><i class="fas fa-times"></i></button></td></tr>`;
        });
        html += '</tbody></table></div>';
        pageContainer.innerHTML = html;
    } catch (e) { pageContainer.innerHTML = '<div class="empty-state"><p>Gagal memuat data</p></div>'; }
}

// ============================================
// GURU PENDING (UPDATE - DATA DARI DAFTAR-GURU)
// ============================================
async function loadGuruPending() {
    pageContainer.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat...</p></div>';
    try {
        const snapshot = await db.collection('guru').where('status','==','pending').orderBy('createdAt','desc').get();
        if (snapshot.empty) { pageContainer.innerHTML = '<div class="empty-state"><i class="fas fa-chalkboard-user"></i><p>Tidak ada pendaftaran guru</p></div>'; return; }
        let html = '<div class="table-wrapper"><table><thead><tr><th>Nama</th><th>NIP/NIPY</th><th>NUPTK</th><th>Jabatan</th><th>Tanggal</th><th>Aksi</th></tr></thead><tbody>';
        snapshot.forEach(doc => {
            const d = doc.data();
            const date = d.createdAt?.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) || '-';
            html += `<tr>
                <td><strong>${d.nama}</strong></td>
                <td>${d.nip || '-'}</td>
                <td>${d.nuptk}</td>
                <td>${d.jabatan}</td>
                <td>${date}</td>
                <td>
                    <button class="btn btn-approve" onclick="approveItem('guru','${doc.id}')"><i class="fas fa-check"></i> Setujui</button>
                    <button class="btn btn-reject" onclick="rejectItem('guru','${doc.id}')"><i class="fas fa-times"></i> Tolak</button>
                    <button class="btn btn-view" onclick="viewGuruDetail('${doc.id}')"><i class="fas fa-eye"></i></button>
                </td></tr>`;
        });
        html += '</tbody></table></div>';
        pageContainer.innerHTML = html;
    } catch (e) { pageContainer.innerHTML = '<div class="empty-state"><p>Gagal memuat data</p></div>'; }
}

// ============================================
// DATA GURU AKTIF (UPDATE - DATA DARI DAFTAR-GURU)
// ============================================
async function loadDataGuru() {
    pageContainer.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat...</p></div>';
    try {
        const jabatanList = ['Kepala Sekolah','Wakil Kepala Sekolah','Guru Matematika','Guru Bahasa Indonesia','Guru Bahasa Inggris','Guru Fisika','Guru Kimia','Guru Biologi','Guru Sejarah','Guru Geografi','Guru Ekonomi','Guru Sosiologi','Guru PJOK','Guru Seni Budaya','Guru Informatika','Guru Pendidikan Agama','Guru PKN','Guru BK','Kesiswaan','Tata Usaha','Lainnya'];
        
        let filterHtml = '<div class="subject-groups">';
        jabatanList.forEach(m => { filterHtml += `<button class="subject-btn" data-mapel="${m}" onclick="filterGuru('${m}')">${m}</button>`; });
        filterHtml += '<button class="subject-btn active" data-mapel="" onclick="filterGuru(\'\')">Semua</button></div>';
        
        const snapshot = await db.collection('guru').where('status','==','approved').orderBy('jabatan').orderBy('nama').get();
        if (snapshot.empty) { pageContainer.innerHTML = filterHtml + '<div class="empty-state"><p>Tidak ada guru aktif</p></div>'; return; }
        
        let html = filterHtml + '<div class="table-wrapper"><table><thead><tr><th>Nama</th><th>NIP/NIPY</th><th>NUPTK</th><th>Jabatan</th><th>Tgl Disetujui</th></tr></thead><tbody id="guruTableBody">';
        snapshot.forEach(doc => {
            const d = doc.data();
            const approvedDate = d.approvedAt?.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) || '-';
            html += `<tr data-mapel="${d.jabatan}"><td><strong>${d.nama}</strong></td><td>${d.nip || '-'}</td><td>${d.nuptk}</td><td>${d.jabatan}</td><td>${approvedDate}</td></tr>`;
        });
        html += '</tbody></table></div>';
        pageContainer.innerHTML = html;
    } catch (e) { pageContainer.innerHTML = '<div class="empty-state"><p>Gagal memuat</p></div>'; }
}

function filterGuru(mapel) {
    document.querySelectorAll('.subject-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.subject-btn[data-mapel="${mapel}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    else document.querySelector('.subject-btn[data-mapel=""]')?.classList.add('active');
    
    document.querySelectorAll('#guruTableBody tr').forEach(row => {
        row.style.display = !mapel || row.dataset.mapel === mapel ? '' : 'none';
    });
}

// ============================================
// VIEW GURU DETAIL
// ============================================
async function viewGuruDetail(id) {
    try {
        const doc = await db.collection('guru').doc(id).get();
        if (!doc.exists) { showToast('Data tidak ditemukan', 'error'); return; }
        const d = doc.data();
        
        modalCard.innerHTML = `
            <div class="modal-header">
                <h3>Detail Guru: ${d.nama}</h3>
                <button class="modal-close" onclick="closeModal()">&times;</button>
            </div>
            <div style="padding:20px;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
                    <div style="background:#f8fafc;padding:15px;border-radius:10px;"><h4 style="font-size:0.8rem;color:#64748b;margin-bottom:5px;">Nama Lengkap</h4><p style="font-size:1rem;font-weight:700;">${d.nama}</p></div>
                    <div style="background:#f8fafc;padding:15px;border-radius:10px;"><h4 style="font-size:0.8rem;color:#64748b;margin-bottom:5px;">NIP/NIPY</h4><p style="font-size:1rem;font-weight:700;">${d.nip || '-'}</p></div>
                    <div style="background:#f8fafc;padding:15px;border-radius:10px;"><h4 style="font-size:0.8rem;color:#64748b;margin-bottom:5px;">NUPTK</h4><p style="font-size:1rem;font-weight:700;">${d.nuptk}</p></div>
                    <div style="background:#f8fafc;padding:15px;border-radius:10px;"><h4 style="font-size:0.8rem;color:#64748b;margin-bottom:5px;">Jabatan</h4><p style="font-size:1rem;font-weight:700;">${d.jabatan}</p></div>
                    <div style="background:#f8fafc;padding:15px;border-radius:10px;"><h4 style="font-size:0.8rem;color:#64748b;margin-bottom:5px;">Status</h4><p><span class="badge-status ${d.status}">${d.status === 'approved' ? 'Disetujui' : d.status === 'pending' ? 'Pending' : 'Ditolak'}</span></p></div>
                    <div style="background:#f8fafc;padding:15px;border-radius:10px;"><h4 style="font-size:0.8rem;color:#64748b;margin-bottom:5px;">Tanggal Daftar</h4><p style="font-size:1rem;font-weight:700;">${d.createdAt?.toDate().toLocaleString('id-ID') || '-'}</p></div>
                </div>
            </div>`;
        modalOverlay.classList.add('active');
    } catch (e) { showToast('Gagal memuat detail', 'error'); }
}

// ============================================
// MUTASI PAGE
// ============================================
async function loadMutasiPage() {
    pageContainer.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat...</p></div>';
    try {
        const snapshot = await db.collection('pendaftaranMutasi').orderBy('createdAt','desc').get();
        if (snapshot.empty) { pageContainer.innerHTML = '<div class="empty-state"><i class="fas fa-exchange-alt"></i><p>Tidak ada pendaftaran mutasi</p></div>'; return; }
        
        let html = '<div class="table-wrapper"><table><thead><tr><th>No.Daftar</th><th>Nama</th><th>Sekolah Asal</th><th>Status</th><th>Dokumen</th><th>Tanggal</th><th>Aksi</th></tr></thead><tbody>';
        snapshot.forEach(doc => {
            const d = doc.data();
            const date = d.createdAt?.toDate().toLocaleDateString('id-ID')||'-';
            const statusBadge = `<span class="badge-status ${d.status}">${d.status === 'pending' ? 'Pending' : d.status === 'proses' ? 'Diproses' : d.status === 'diterima' ? 'Diterima' : 'Ditolak'}</span>`;
            html += `<tr>
                <td><strong>${d.noDaftar}</strong></td>
                <td>${d.nama}</td>
                <td>${d.sekolahAsal}</td>
                <td>${statusBadge}</td>
                <td><button class="btn btn-view" onclick="viewMutasiDocs('${doc.id}')"><i class="fas fa-eye"></i> Lihat</button></td>
                <td>${date}</td>
                <td>
                    <button class="btn btn-proses" onclick="prosesMutasi('${doc.id}')"><i class="fas fa-spinner"></i></button>
                    <button class="btn btn-approve" onclick="approveMutasi('${doc.id}')"><i class="fas fa-check"></i></button>
                    <button class="btn btn-reject" onclick="rejectMutasi('${doc.id}')"><i class="fas fa-times"></i></button>
                </td></tr>`;
        });
        html += '</tbody></table></div>';
        pageContainer.innerHTML = html;
    } catch (e) { pageContainer.innerHTML = '<div class="empty-state"><p>Gagal memuat data</p></div>'; }
}

// ============================================
// VIEW MUTASI DOCUMENTS
// ============================================
async function viewMutasiDocs(id) {
    try {
        const doc = await db.collection('pendaftaranMutasi').doc(id).get();
        if (!doc.exists) { showToast('Data tidak ditemukan', 'error'); return; }
        const d = doc.data();
        
        let docsHtml = '';
        const docLabels = {
            nilaiRapor: 'Nilai Rapor', pasFoto: 'Pas Foto 3x4', aktaLahir: 'Akta Kelahiran',
            kartuKeluarga: 'Kartu Keluarga', ktpOrKia: 'KTP/KIA/Kartu Pelajar',
            suratBaik: 'Surat Keterangan Baik', suratSehat: 'Surat Kesehatan',
            suratPindahOrtu: 'Surat Pindah Ortu', suratPindahSekolah: 'Surat Pindah Sekolah'
        };
        
        if (d.dokumen) {
            for (const [key, url] of Object.entries(d.dokumen)) {
                if (url && url !== '-') {
                    const gdriveId = extractGDriveId(url);
                    docsHtml += `<div class="doc-preview-item"><h5>${docLabels[key] || key}</h5>
                        ${gdriveId ? `<iframe src="https://drive.google.com/file/d/${gdriveId}/preview" allow="autoplay"></iframe><a href="${url}" target="_blank" class="file-link"><i class="fab fa-google-drive"></i> Buka di Google Drive</a>` : `<a href="${url}" target="_blank" class="file-link"><i class="fas fa-external-link-alt"></i> Lihat Dokumen</a>`}
                    </div>`;
                }
            }
        }
        
        if (d.linkSuratPernyataan && d.linkSuratPernyataan !== '-') {
            const gdriveId = extractGDriveId(d.linkSuratPernyataan);
            docsHtml += `<div class="doc-preview-item"><h5>Surat Pernyataan Siap Pindah</h5>
                ${gdriveId ? `<iframe src="https://drive.google.com/file/d/${gdriveId}/preview" allow="autoplay"></iframe><a href="${d.linkSuratPernyataan}" target="_blank" class="file-link"><i class="fab fa-google-drive"></i> Buka di Google Drive</a>` : `<a href="${d.linkSuratPernyataan}" target="_blank" class="file-link"><i class="fas fa-external-link-alt"></i> Lihat Dokumen</a>`}
            </div>`;
        }
        
        modalCard.innerHTML = `
            <div class="modal-header"><h3>Dokumen ${d.nama}</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
            <p><strong>No. Pendaftaran:</strong> ${d.noDaftar}</p>
            <p><strong>Sekolah Asal:</strong> ${d.sekolahAsal}</p>
            <p><strong>Alasan Pindah:</strong> ${d.alasanPindah}</p>
            <p><strong>Status:</strong> <span class="badge-status ${d.status}">${d.status}</span></p>
            ${d.catatanOperator ? `<p><strong>Catatan:</strong> ${d.catatanOperator}</p>` : ''}
            <div class="doc-preview-grid">${docsHtml || '<p>Tidak ada dokumen</p>'}</div>`;
        modalOverlay.classList.add('active');
    } catch (e) { showToast('Gagal memuat dokumen', 'error'); }
}

function extractGDriveId(url) {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
}

// ============================================
// MUTASI ACTIONS
// ============================================
async function prosesMutasi(id) {
    try { await db.collection('pendaftaranMutasi').doc(id).update({ status: 'proses', updatedAt: firebase.firestore.FieldValue.serverTimestamp() }); showToast('Status diubah menjadi Diproses', 'success'); loadMutasiPage(); } catch (e) { showToast('Gagal', 'error'); }
}
async function approveMutasi(id) {
    try { await db.collection('pendaftaranMutasi').doc(id).update({ status: 'diterima', updatedAt: firebase.firestore.FieldValue.serverTimestamp() }); showToast('Pendaftaran disetujui!', 'success'); loadMutasiPage(); } catch (e) { showToast('Gagal', 'error'); }
}
function rejectMutasi(id) {
    modalCard.innerHTML = `<div class="modal-header"><h3>Alasan Penolakan</h3><button class="modal-close" onclick="closeModal()">&times;</button></div><div class="form-group" style="margin-bottom:15px;"><label>Tulis alasan penolakan:</label><textarea id="alasanTolak" class="form-input" rows="4" placeholder="Jelaskan alasan penolakan..."></textarea></div><button class="btn btn-reject" onclick="confirmRejectMutasi('${id}')" style="width:100%;padding:12px;">Tolak Pendaftaran</button>`;
    modalOverlay.classList.add('active');
}
async function confirmRejectMutasi(id) {
    const alasan = document.getElementById('alasanTolak')?.value.trim();
    if (!alasan) { showToast('Alasan wajib diisi!', 'error'); return; }
    try { await db.collection('pendaftaranMutasi').doc(id).update({ status: 'ditolak', catatanOperator: alasan, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }); closeModal(); showToast('Pendaftaran ditolak', 'success'); loadMutasiPage(); } catch (e) { showToast('Gagal', 'error'); }
}

// ============================================
// APPROVE/REJECT ITEMS
// ============================================
async function approveItem(collection, id) {
    try { await db.collection(collection).doc(id).update({ status: 'approved', approvedAt: firebase.firestore.FieldValue.serverTimestamp() }); showToast('Disetujui!', 'success'); loadPage(currentPage); } catch (e) { showToast('Gagal', 'error'); }
}
async function rejectItem(collection, id) {
    if (!confirm('Tolak pendaftaran ini?')) return;
    try { await db.collection(collection).doc(id).update({ status: 'rejected' }); showToast('Ditolak', 'success'); loadPage(currentPage); } catch (e) { showToast('Gagal', 'error'); }
}

// ============================================
// ABSENSI SISWA
// ============================================
async function loadAbsensiSiswa() {
    pageContainer.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat...</p></div>';
    try {
        const snapshot = await db.collection('absensiSiswa').orderBy('timestamp','desc').limit(50).get();
        if (snapshot.empty) { pageContainer.innerHTML = '<div class="empty-state"><i class="fas fa-clipboard-list"></i><p>Tidak ada data absensi</p></div>'; return; }
        let html = '<div class="table-wrapper"><table><thead><tr><th>Nama</th><th>Kelas</th><th>Tanggal</th><th>Status</th><th>Bukti</th></tr></thead><tbody>';
        snapshot.forEach(doc => {
            const d = doc.data();
            const tgl = d.timestamp?.toDate().toLocaleDateString('id-ID')||'-';
            html += `<tr><td>${d.nama}</td><td>${d.kelas}</td><td>${tgl}</td><td><span class="badge-status ${d.status}">${d.status}</span></td><td><a href="${d.buktiUrl}" target="_blank" class="file-link"><i class="fab fa-google-drive"></i> Bukti</a></td></tr>`;
        });
        html += '</tbody></table></div>';
        pageContainer.innerHTML = html;
    } catch (e) { pageContainer.innerHTML = '<div class="empty-state"><p>Gagal memuat</p></div>'; }
}

// ============================================
// ABSENSI GURU
// ============================================
async function loadAbsensiGuru() {
    pageContainer.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat...</p></div>';
    try {
        const snapshot = await db.collection('absensiGuru').orderBy('timestamp','desc').limit(50).get();
        if (snapshot.empty) { pageContainer.innerHTML = '<div class="empty-state"><i class="fas fa-clipboard-check"></i><p>Tidak ada data absensi</p></div>'; return; }
        let html = '<div class="table-wrapper"><table><thead><tr><th>Nama</th><th>Jabatan</th><th>Tanggal</th><th>Status</th><th>Bukti</th></tr></thead><tbody>';
        snapshot.forEach(doc => {
            const d = doc.data();
            const tgl = d.timestamp?.toDate().toLocaleDateString('id-ID')||'-';
            html += `<tr><td>${d.nama}</td><td>${d.jabatan || '-'}</td><td>${tgl}</td><td><span class="badge-status ${d.status}">${d.status}</span></td><td><a href="${d.buktiUrl}" target="_blank" class="file-link"><i class="fab fa-google-drive"></i> Bukti</a></td></tr>`;
        });
        html += '</tbody></table></div>';
        pageContainer.innerHTML = html;
    } catch (e) { pageContainer.innerHTML = '<div class="empty-state"><p>Gagal memuat</p></div>'; }
}

// ============================================
// DATA SISWA
// ============================================
async function loadDataSiswa() {
    pageContainer.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat...</p></div>';
    try {
        const kelasList = [];
        for (let i=10; i<=12; i++) for (let j=1; j<=8; j++) kelasList.push(`${i}.${j}`);
        
        let filterHtml = '<div class="class-groups">';
        kelasList.forEach(k => { filterHtml += `<button class="class-btn" data-kelas="${k}" onclick="filterSiswa('${k}')">${k}</button>`; });
        filterHtml += '<button class="class-btn active" data-kelas="" onclick="filterSiswa(\'\')">Semua</button></div>';
        
        const snapshot = await db.collection('siswa').where('status','==','approved').orderBy('kelas').orderBy('nama').get();
        if (snapshot.empty) { pageContainer.innerHTML = filterHtml + '<div class="empty-state"><p>Tidak ada data siswa</p></div>'; return; }
        
        let html = filterHtml + '<div class="table-wrapper"><table><thead><tr><th>Nama</th><th>NISN</th><th>Kelas</th><th>Jurusan</th></tr></thead><tbody id="siswaTableBody">';
        snapshot.forEach(doc => {
            const d = doc.data();
            html += `<tr data-kelas="${d.kelas}"><td>${d.nama}</td><td>${d.nisn}</td><td>${d.kelas}</td><td>${d.jurusan}</td></tr>`;
        });
        html += '</tbody></table></div>';
        pageContainer.innerHTML = html;
    } catch (e) { pageContainer.innerHTML = '<div class="empty-state"><p>Gagal memuat</p></div>'; }
}

function filterSiswa(kelas) {
    document.querySelectorAll('.class-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.class-btn[data-kelas="${kelas}"]`)?.classList.add('active');
    document.querySelectorAll('#siswaTableBody tr').forEach(row => {
        row.style.display = !kelas || row.dataset.kelas === kelas ? '' : 'none';
    });
}

// ============================================
// MODAL
// ============================================
function closeModal() { modalOverlay.classList.remove('active'); modalCard.innerHTML = ''; }
modalOverlay?.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

// ============================================
// NOTIFICATION
// ============================================
function setupNotif() {
    notifBell?.addEventListener('click', (e) => { e.stopPropagation(); notifBell.classList.toggle('active'); });
    document.addEventListener('click', () => notifBell?.classList.remove('active'));
    clearNotif?.addEventListener('click', () => { notifications = []; updateNotifUI(); });
}
function addNotification(type, msg) { notifications.unshift({ type, message: msg, timestamp: new Date(), read: false }); updateNotifUI(); }
function updateNotifUI() {
    const unread = notifications.filter(n => !n.read).length;
    if (notifCount) { notifCount.textContent = unread; notifCount.style.display = unread > 0 ? 'block' : 'none'; }
    if (notifList) {
        if (notifications.length === 0) { notifList.innerHTML = '<p class="no-notif">Tidak ada notifikasi</p>'; return; }
        notifList.innerHTML = notifications.slice(0,10).map((n,i) => `<div class="notif-item ${n.read?'':'unread'}"><p>${n.message}</p><small>${n.timestamp.toLocaleTimeString('id-ID')}</small></div>`).join('');
    }
}

// ============================================
// REALTIME LISTENERS
// ============================================
function setupRealtime() {
    db.collection('siswa').where('status','==','pending').onSnapshot(snap => {
        const badge = $('badgeSiswa'); if (badge) { badge.textContent = snap.size; badge.style.display = snap.size > 0 ? 'inline-block' : 'none'; }
        snap.docChanges().forEach(c => { if (c.type === 'added') addNotification('siswa', `Pendaftaran siswa baru: ${c.doc.data().nama}`); });
    });
    db.collection('guru').where('status','==','pending').onSnapshot(snap => {
        const badge = $('badgeGuru'); if (badge) { badge.textContent = snap.size; badge.style.display = snap.size > 0 ? 'inline-block' : 'none'; }
        snap.docChanges().forEach(c => { if (c.type === 'added') addNotification('guru', `Pendaftaran guru baru: ${c.doc.data().nama}`); });
    });
    db.collection('pendaftaranMutasi').where('status','==','pending').onSnapshot(snap => {
        const badge = $('badgeMutasi'); if (badge) { badge.textContent = snap.size; badge.style.display = snap.size > 0 ? 'inline-block' : 'none'; }
        snap.docChanges().forEach(c => { if (c.type === 'added') addNotification('mutasi', `Pendaftaran mutasi baru: ${c.doc.data().nama}`); });
    });
}

// ============================================
// TOAST
// ============================================
function showToast(message, type = 'success') {
    if (!toastContainer) return;
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${icons[type]}"></i><span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => { toast.style.transform = 'translateX(120%)'; setTimeout(() => toast.remove(), 300); }, 4000);
}

// ============================================
// GLOBAL FUNCTIONS
// ============================================
window.approveItem = approveItem;
window.rejectItem = rejectItem;
window.viewMutasiDocs = viewMutasiDocs;
window.prosesMutasi = prosesMutasi;
window.approveMutasi = approveMutasi;
window.rejectMutasi = rejectMutasi;
window.confirmRejectMutasi = confirmRejectMutasi;
window.closeModal = closeModal;
window.filterSiswa = filterSiswa;
window.filterGuru = filterGuru;
window.viewGuruDetail = viewGuruDetail;

console.log('✅ Operator Panel SMAN 68 Jakarta - Loaded Successfully');
