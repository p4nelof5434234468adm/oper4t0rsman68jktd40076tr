/**
 * ═══════════════════════════════════════════════════════════════
 * OPERATOR DASHBOARD JS — SMAN 68 Jakarta
 * Firebase Firestore + Realtime Database
 * FIX UTAMA: Semua jawaban responden ditampilkan (bukan cuma 5)
 * ═══════════════════════════════════════════════════════════════
 */
'use strict';

/* ══════════════════════════════════════════
   LOGIN GATE — Firebase Auth (Email/Password)
   Operator wajib login dulu lewat Firebase Console
══════════════════════════════════════════ */
function initLoginGate() {
  // Tampilkan login gate, sembunyikan layout utama
  const gate   = document.getElementById('loginGate');
  const layout = document.getElementById('appLayout');
  if (!gate || !layout) return;

  const auth     = firebase.auth();
  const form     = document.getElementById('loginForm');
  const emailInp = document.getElementById('loginEmail');
  const passInp  = document.getElementById('loginPassword');
  const loginBtn = document.getElementById('loginSubmitBtn');
  const errEl    = document.getElementById('loginError');

  // Cek sesi aktif
  auth.onAuthStateChanged(user => {
    if (user) {
      gate.style.display   = 'none';
      layout.style.display = 'flex';
      lucide.createIcons();
      loadSurveys();
    } else {
      gate.style.display   = 'flex';
      layout.style.display = 'none';
    }
  });

  // Submit login
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const email    = emailInp?.value.trim() || '';
      const password = passInp?.value || '';
      if (!email || !password) {
        showLoginError('Email dan password wajib diisi.');
        return;
      }
      loginBtn.classList.add('loading');
      if (errEl) errEl.classList.remove('show');
      try {
        await auth.signInWithEmailAndPassword(email, password);
        // onAuthStateChanged akan handle redirect
      } catch(e) {
        let msg = 'Login gagal. Periksa email dan password.';
        if (e.code === 'auth/user-not-found') msg = 'Akun tidak ditemukan.';
        if (e.code === 'auth/wrong-password')  msg = 'Password salah.';
        if (e.code === 'auth/invalid-email')   msg = 'Format email tidak valid.';
        if (e.code === 'auth/too-many-requests') msg = 'Terlalu banyak percobaan. Coba lagi nanti.';
        showLoginError(msg);
        loginBtn.classList.remove('loading');
      }
    });
  }

  // Enter key
  [emailInp, passInp].forEach(inp => {
    if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') loginBtn?.click(); });
  });

  // Logout button
  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    await auth.signOut();
  });

  function showLoginError(msg) {
    if (!errEl) return;
    errEl.textContent = msg;
    errEl.classList.add('show');
  }
}

/* ── Firebase Config ── */
const firebaseConfig = {
  apiKey:            "AIzaSyDAcKcg3alPOTH3FFGelYmsW7jcMMe2PLI",
  authDomain:        "upnvjdatsystem.firebaseapp.com",
  databaseURL:       "https://upnvjdatsystem-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "upnvjdatsystem",
  storageBucket:     "upnvjdatsystem.firebasestorage.app",
  messagingSenderId: "57095309946",
  appId:             "1:57095309946:web:b0e9f3f86380d549ffc9c3",
};
firebase.initializeApp(firebaseConfig);
const db   = firebase.firestore();
const rtdb = firebase.database();

/* ── App State ── */
let surveys          = [];
let questions        = [];
let responses        = {};
let activeSurveyId   = null;
let publishState     = false;
let oneTimeState     = false;
let qSortable        = null;
let charts           = {};
let importedQuestions= [];
let activeRespListener = null;

/* Pagination state */
let respPage     = 1;
const RESP_PER_PAGE = 10;
let respFiltered = [];

/* ── Helpers ── */
function esc(s) {
  if (!s && s !== 0) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function fmtDate(ts) {
  if (!ts) return '–';
  let d;
  if (ts.toDate)    d = ts.toDate();
  else if (ts.seconds) d = new Date(ts.seconds * 1000);
  else d = new Date(ts);
  return d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
}
function fmtDateTime(ms) {
  if (!ms) return 'Draft';
  return new Date(ms).toLocaleString('id-ID', {
    day:'2-digit', month:'short', year:'numeric',
    hour:'2-digit', minute:'2-digit',
  });
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

/* ══════════════════════════════════════════
   TOAST
══════════════════════════════════════════ */
function opToast(msg, type = 'ok') {
  const icons = { ok:'check-circle', er:'x-circle', wn:'alert-triangle' };
  const el = document.createElement('div');
  el.className = `op-toast ${type}`;
  el.innerHTML = `<i data-lucide="${icons[type]}"></i><span>${esc(msg)}</span>`;
  document.getElementById('opToasts').appendChild(el);
  lucide.createIcons({ nodes:[el] });
  setTimeout(() => {
    el.classList.add('rm');
    el.addEventListener('animationend', () => el.remove());
  }, 3500);
}

/* ══════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════ */
const titles = {
  dashboard:  'Dashboard',
  surveys:    'Survey',
  questions:  'Pertanyaan',
  responses:  'Responden',
  statistics: 'Statistik',
  settings:   'Pengaturan',
};

function switchPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item[data-page]').forEach(b => b.classList.remove('active'));
  const pg = document.getElementById(`page-${id}`);
  if (pg) pg.classList.add('active');
  document.querySelectorAll(`.nav-item[data-page="${id}"]`).forEach(b => b.classList.add('active'));
  document.getElementById('topbarTitle').textContent = titles[id] || id;
  if (window.innerWidth <= 860) document.getElementById('sidebar').classList.remove('open');
}

document.querySelectorAll('.nav-item[data-page]').forEach(b =>
  b.addEventListener('click', () => switchPage(b.dataset.page))
);

/* Sidebar toggle */
document.getElementById('btnToggleSidebar').addEventListener('click', () => {
  const sb = document.getElementById('sidebar');
  if (window.innerWidth <= 860) {
    sb.classList.toggle('open');
  } else {
    sb.classList.toggle('collapsed');
    document.getElementById('mainContent').classList.toggle('expanded');
  }
});

/* ══════════════════════════════════════════
   THEME
══════════════════════════════════════════ */
(function () {
  const root   = document.documentElement;
  const btn    = document.getElementById('btnTheme');
  const ico    = document.getElementById('themeIco');
  const saved  = localStorage.getItem('op68_theme') || 'dark';
  root.setAttribute('data-theme', saved);
  ico.setAttribute('data-lucide', saved === 'dark' ? 'sun' : 'moon');
  document.getElementById('settingTheme').value = saved;
  btn.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('op68_theme', next);
    ico.setAttribute('data-lucide', next === 'dark' ? 'sun' : 'moon');
    lucide.createIcons({ nodes:[btn] });
    document.getElementById('settingTheme').value = next;
  });
})();

document.getElementById('settingFormUrl').value =
  location.origin + location.pathname.replace('operator-kuisioner.html', '') + 'form68.html';

document.getElementById('btnSaveSettings').addEventListener('click', () => {
  const theme = document.getElementById('settingTheme').value;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('op68_theme', theme);
  opToast('Pengaturan disimpan');
});

/* ══════════════════════════════════════════
   LOAD SURVEYS
══════════════════════════════════════════ */
async function loadSurveys() {
  try {
    const snap = await db.collection('surveys').orderBy('createdAt', 'desc').get();
    surveys = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    renderSurveysTable();
    updateAllSelects();
    loadDashboardStats();
    loadRecentResponses();
  } catch(e) {
    opToast('Gagal memuat survey: ' + e.message, 'er');
  }
}

function renderSurveysTable() {
  const tbody = document.getElementById('surveysBody');
  if (!surveys.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-msg">Belum ada survey.</td></tr>';
    return;
  }
  tbody.innerHTML = surveys.map(s => `
    <tr>
      <td style="font-weight:600;color:var(--text-p);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.title)}</td>
      <td>${esc(s.schoolYear || '–')}</td>
      <td>${s.deadline ? fmtDate(s.deadline) : '–'}</td>
      <td><span class="badge badge-gold">${s.responseCount || 0}</span></td>
      <td>${s.oneTimeOnly
        ? '<span class="badge badge-gold"><i data-lucide="shield-check" style="width:10px;height:10px"></i> Ya</span>'
        : '<span class="badge badge-grey">Tidak</span>'}</td>
      <td>${s.isPublished
        ? '<span class="badge badge-green">Aktif</span>'
        : '<span class="badge badge-grey">Draft</span>'}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-icon btn-xs" title="Edit"        onclick="openEditSurvey('${s.id}')"><i data-lucide="pencil"></i></button>
          <button class="btn btn-icon btn-xs" title="${s.isPublished ? 'Unpublish' : 'Publish'}" onclick="togglePublish('${s.id}',${s.isPublished})"><i data-lucide="${s.isPublished ? 'eye-off' : 'eye'}"></i></button>
          <button class="btn btn-danger btn-xs" title="Hapus"     onclick="deleteSurvey('${s.id}')"><i data-lucide="trash-2"></i></button>
          <button class="btn btn-icon btn-xs" title="Buka Form"   onclick="window.open('form68.html?id=${s.id}','_blank')"><i data-lucide="external-link"></i></button>
        </div>
      </td>
    </tr>`).join('');
  lucide.createIcons();
}

function updateAllSelects() {
  const opts = '<option value="">– Pilih Survey –</option>' +
    surveys.map(s => `<option value="${s.id}">${esc(s.title)}</option>`).join('');
  ['qSurveySelect','respSurveyFilter','statSurveySelect'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
}

/* ══════════════════════════════════════════
   DASHBOARD STATS
══════════════════════════════════════════ */
async function loadDashboardStats() {
  document.getElementById('stTotal').textContent  = surveys.length;
  document.getElementById('stActive').textContent = surveys.filter(s => s.isPublished).length;
  let total = 0, today = 0;
  const todayMs = new Date().setHours(0, 0, 0, 0);
  try {
    const snap = await rtdb.ref('responses').once('value');
    const data = snap.val() || {};
    Object.values(data).forEach(sr =>
      Object.values(sr).forEach(r => {
        total++;
        if ((r.submittedAt || 0) > todayMs) today++;
      })
    );
  } catch(e) {}
  document.getElementById('stResp').textContent  = total;
  document.getElementById('stToday').textContent = today;
}

async function loadRecentResponses() {
  const tbody = document.getElementById('recentBody');
  try {
    const snap = await rtdb.ref('responses').once('value');
    const data = snap.val() || {};
    const rows = [];
    Object.entries(data).forEach(([sid, users]) => {
      const sv = surveys.find(s => s.id === sid);
      Object.values(users).forEach(r => rows.push({ ...r, surveyTitle: sv?.title || sid }));
    });
    rows.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
    const recent = rows.slice(0, 8);
    if (!recent.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">Belum ada respons.</td></tr>';
      return;
    }
    tbody.innerHTML = recent.map(r => `<tr>
      <td style="font-weight:600;color:var(--text-p)">${esc(r.userName || '–')}</td>
      <td><span class="chip-role">${esc(r.role || '–')}</span></td>
      <td>${esc(r.surveyTitle)}</td>
      <td style="font-family:var(--font-m);font-size:.72rem">${fmtDateTime(r.submittedAt)}</td>
      <td>${r.status === 'submitted'
        ? '<span class="badge badge-green">Selesai</span>'
        : '<span class="badge badge-grey">Draft</span>'}</td>
    </tr>`).join('');
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">Gagal memuat.</td></tr>';
  }
}

/* ══════════════════════════════════════════
   SURVEY CRUD
══════════════════════════════════════════ */
document.getElementById('btnNewSurvey').addEventListener('click', () => openSurveyModal());
document.getElementById('btnCloseSurveyModal').addEventListener('click', closeSurveyModal);
document.getElementById('btnCancelSurvey').addEventListener('click', closeSurveyModal);

document.getElementById('fPublishToggle').addEventListener('click', function () {
  publishState = !publishState;
  this.classList.toggle('on', publishState);
  document.getElementById('fPublishLabel').textContent = publishState ? 'Aktif' : 'Draft';
});
document.getElementById('fOneTimeToggle').addEventListener('click', function () {
  oneTimeState = !oneTimeState;
  this.classList.toggle('on', oneTimeState);
  document.getElementById('fOneTimeLabel').textContent = oneTimeState ? 'Ya' : 'Tidak';
});
document.getElementById('fBannerUrl').addEventListener('input', function () {
  const prev = document.getElementById('bannerPreview');
  if (this.value.trim()) {
    prev.src = this.value.trim();
    prev.style.display = 'block';
    prev.onerror = () => prev.style.display = 'none';
  } else {
    prev.style.display = 'none';
  }
});

function openSurveyModal(s = null) {
  const isEdit = !!s;
  document.getElementById('surveyModalTitle').textContent = isEdit ? 'Edit Survey' : 'Buat Survey Baru';
  document.getElementById('editingSurveyId').value = isEdit ? s.id : '';
  document.getElementById('fTitle').value      = s?.title || '';
  document.getElementById('fDesc').value       = s?.description || '';
  document.getElementById('fSchoolYear').value = s?.schoolYear || '';
  document.getElementById('fRespLimit').value  = s?.responseLimit || '';
  document.getElementById('fBannerUrl').value  = s?.bannerImage || '';
  if (s?.deadline) {
    const dl = s.deadline.toDate ? s.deadline.toDate() : new Date(s.deadline.seconds * 1000);
    document.getElementById('fDeadline').value = dl.toISOString().slice(0, 16);
  } else {
    document.getElementById('fDeadline').value = '';
  }
  publishState = s?.isPublished || false;
  document.getElementById('fPublishToggle').classList.toggle('on', publishState);
  document.getElementById('fPublishLabel').textContent = publishState ? 'Aktif' : 'Draft';
  oneTimeState = s?.oneTimeOnly || false;
  document.getElementById('fOneTimeToggle').classList.toggle('on', oneTimeState);
  document.getElementById('fOneTimeLabel').textContent = oneTimeState ? 'Ya' : 'Tidak';
  const prev = document.getElementById('bannerPreview');
  if (s?.bannerImage) { prev.src = s.bannerImage; prev.style.display = 'block'; }
  else prev.style.display = 'none';
  document.getElementById('surveyModal').style.display = 'flex';
  lucide.createIcons();
}

function closeSurveyModal() {
  document.getElementById('surveyModal').style.display = 'none';
}

document.getElementById('btnSaveSurvey').addEventListener('click', async () => {
  const id    = document.getElementById('editingSurveyId').value;
  const title = document.getElementById('fTitle').value.trim();
  if (!title) return opToast('Judul wajib diisi', 'wn');
  const dl = document.getElementById('fDeadline').value;
  const payload = {
    title,
    description:   document.getElementById('fDesc').value.trim(),
    schoolYear:    document.getElementById('fSchoolYear').value.trim(),
    bannerImage:   document.getElementById('fBannerUrl').value.trim(),
    responseLimit: Number(document.getElementById('fRespLimit').value) || 0,
    isPublished:   publishState,
    oneTimeOnly:   oneTimeState,
    updatedAt:     firebase.firestore.FieldValue.serverTimestamp(),
    deadline:      dl ? firebase.firestore.Timestamp.fromDate(new Date(dl)) : null,
  };
  try {
    if (id) {
      await db.collection('surveys').doc(id).update(payload);
      opToast('Survey diperbarui');
    } else {
      payload.createdAt    = firebase.firestore.FieldValue.serverTimestamp();
      payload.createdBy    = 'operator';
      payload.responseCount= 0;
      await db.collection('surveys').add(payload);
      opToast('Survey dibuat');
    }
    closeSurveyModal();
    await loadSurveys();
  } catch(e) {
    opToast('Gagal: ' + e.message, 'er');
  }
});

function openEditSurvey(id) {
  const s = surveys.find(s => s.id === id);
  if (s) openSurveyModal(s);
}

async function togglePublish(id, cur) {
  try {
    await db.collection('surveys').doc(id).update({
      isPublished: !cur,
      updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
    });
    opToast(cur ? 'Survey dinonaktifkan' : 'Survey dipublikasikan');
    await loadSurveys();
  } catch(e) {
    opToast('Gagal: ' + e.message, 'er');
  }
}

async function deleteSurvey(id) {
  if (!confirm('Hapus survey ini beserta semua pertanyaannya?')) return;
  try {
    const qSnap = await db.collection('surveys').doc(id).collection('questions').get();
    const batch = db.batch();
    qSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(db.collection('surveys').doc(id));
    await batch.commit();
    await rtdb.ref(`responses/${id}`).remove();
    opToast('Survey dihapus');
    await loadSurveys();
  } catch(e) {
    opToast('Gagal hapus: ' + e.message, 'er');
  }
}

/* ══════════════════════════════════════════
   QUESTION BUILDER
══════════════════════════════════════════ */
document.getElementById('qSurveySelect').addEventListener('change', async function () {
  activeSurveyId = this.value;
  if (activeSurveyId) await loadQuestions(activeSurveyId);
  else renderQList([]);
});

document.getElementById('btnAddQ').addEventListener('click', async () => {
  if (!activeSurveyId) return opToast('Pilih survey terlebih dahulu', 'wn');
  const type = document.getElementById('newQType').value;
  const defaultQ = {
    type,
    title:       type === 'section' ? 'Nama Bagian Baru' : 'Pertanyaan baru',
    description: '', required: false,
    order:       questions.length,
    imageUrl:    '', placeholder: '',
    options:     ['multiple_choice','checkbox','dropdown'].includes(type)
                   ? [{ label:'Pilihan 1', value:'pilihan_1', imageUrl:'' }] : [],
    scaleMin: 1, scaleMax: 5, ratingMax: 5,
    rows: type.startsWith('matrix') ? ['Baris 1'] : [],
    cols: type.startsWith('matrix') ? ['Kolom A', 'Kolom B'] : [],
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  try {
    const ref = await db.collection('surveys').doc(activeSurveyId).collection('questions').add(defaultQ);
    defaultQ.id = ref.id;
    questions.push(defaultQ);
    renderQList(questions);
    opToast('Pertanyaan ditambahkan');
  } catch(e) {
    opToast('Gagal: ' + e.message, 'er');
  }
});

async function loadQuestions(sid) {
  try {
    const snap = await db.collection('surveys').doc(sid).collection('questions').orderBy('order').get();
    questions = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    renderQList(questions);
  } catch(e) {
    opToast('Gagal memuat pertanyaan', 'er');
  }
}

const TYPE_LABELS = {
  short:'Short Answer', paragraph:'Paragraf', multiple_choice:'Multiple Choice',
  checkbox:'Checkbox', dropdown:'Dropdown', date:'Date', time:'Time',
  linear_scale:'Linear Scale', rating:'Rating ⭐', matrix:'Matrix Radio',
  matrix_checkbox:'Matrix Checkbox', email:'Email', phone:'Telepon',
  number:'Number', url:'URL', signature:'Tanda Tangan',
  image_url:'Gambar URL', captcha:'CAPTCHA', section:'📌 Section',
};

function renderQList(qs) {
  const container = document.getElementById('questionsList');
  if (!qs.length) {
    container.innerHTML = '<div class="empty-msg glass" style="border-radius:var(--r-md)"><i data-lucide="plus-circle"></i><p>Belum ada pertanyaan. Klik Tambah atau Import File.</p></div>';
    lucide.createIcons({ nodes:[container] });
    return;
  }
  container.innerHTML = qs.map((q, idx) => buildQCardHtml(q, idx)).join('');
  lucide.createIcons({ nodes:[container] });
  qs.forEach(q => attachQListeners(q));

  if (qSortable) qSortable.destroy();
  qSortable = new Sortable(container, {
    handle: '.q-drag',
    animation: 180,
    onEnd: async ({ oldIndex, newIndex }) => {
      if (oldIndex === newIndex) return;
      const [moved] = questions.splice(oldIndex, 1);
      questions.splice(newIndex, 0, moved);
      const batch = db.batch();
      questions.forEach((q, i) =>
        batch.update(db.collection('surveys').doc(activeSurveyId).collection('questions').doc(q.id), { order: i })
      );
      await batch.commit().catch(() => opToast('Gagal simpan urutan', 'er'));
    },
  });
}

function buildQCardHtml(q) {
  const isSection = q.type === 'section';
  let optsHtml = '';
  if (['multiple_choice','checkbox','dropdown'].includes(q.type)) {
    optsHtml = `<div class="opts-editor" id="opts-${q.id}">
      ${(q.options || []).map((o, oi) => `
        <div class="opt-row" data-oi="${oi}">
          <input class="opt-inp" placeholder="Label" value="${esc(o.label||'')}" data-field="label"/>
          <input class="opt-inp opt-img-url" placeholder="URL gambar (opsional)" value="${esc(o.imageUrl||'')}" data-field="imageUrl"/>
          <button class="btn btn-danger btn-xs" onclick="removeOption('${q.id}',${oi})"><i data-lucide="x"></i></button>
        </div>`).join('')}
      <button class="add-opt" onclick="addOption('${q.id}')">+ Tambah pilihan</button>
    </div>`;
  }
  if (q.type.startsWith('matrix')) {
    optsHtml = `<div class="matrix-editor">
      <div>
        <div class="matrix-col-label">Baris</div>
        <div class="matrix-rows" id="mrows-${q.id}">
          ${(q.rows || []).map((r, i) => `<div style="display:flex;gap:.3rem"><input class="opt-inp" value="${esc(r)}" data-mi="${i}" data-mtype="row"/><button class="btn btn-danger btn-xs" onclick="removeMatrixItem('${q.id}','row',${i})"><i data-lucide="x"></i></button></div>`).join('')}
          <button class="add-opt" onclick="addMatrixItem('${q.id}','row')">+ Baris</button>
        </div>
      </div>
      <div>
        <div class="matrix-col-label">Kolom</div>
        <div class="matrix-cols" id="mcols-${q.id}">
          ${(q.cols || []).map((c, i) => `<div style="display:flex;gap:.3rem"><input class="opt-inp" value="${esc(c)}" data-mi="${i}" data-mtype="col"/><button class="btn btn-danger btn-xs" onclick="removeMatrixItem('${q.id}','col',${i})"><i data-lucide="x"></i></button></div>`).join('')}
          <button class="add-opt" onclick="addMatrixItem('${q.id}','col')">+ Kolom</button>
        </div>
      </div>
    </div>`;
  }
  return `
  <div class="q-card glass${isSection ? ' is-section' : ''}" data-qid="${q.id}">
    <span class="q-drag" title="Seret"><i data-lucide="grip-vertical"></i></span>
    <div class="q-body">
      <div class="q-type-tag">${TYPE_LABELS[q.type] || q.type}</div>
      <input class="q-title-inp" value="${esc(q.title)}" placeholder="Judul pertanyaan…" data-qid="${q.id}"/>
      ${!isSection ? `<input class="q-sub-inp" value="${esc(q.description||'')}" placeholder="Deskripsi (opsional)…" data-qid="${q.id}" data-field="description"/>` : ''}
      ${!isSection ? `<div>
        <input type="url" class="q-img-inp opt-inp" placeholder="URL Gambar Pertanyaan (opsional)" value="${esc(q.imageUrl||'')}" data-qid="${q.id}" data-field="imageUrl"/>
        ${q.imageUrl ? `<img src="${esc(q.imageUrl)}" class="q-img-prev" onclick="window.open(this.src,'_blank')" onerror="this.style.display='none'"/>` : ''}
      </div>` : ''}
      ${optsHtml}
    </div>
    <div class="q-actions">
      ${!isSection ? `<div class="q-toggle"><button class="toggle-sw${q.required ? ' on' : ''}" id="req-${q.id}" onclick="toggleRequired('${q.id}',this)"></button><span>Wajib</span></div>` : ''}
      <button class="btn btn-icon btn-xs" title="Duplikat" onclick="duplicateQ('${q.id}')"><i data-lucide="copy"></i></button>
      <button class="btn btn-danger btn-xs" title="Hapus"   onclick="deleteQ('${q.id}')"><i data-lucide="trash-2"></i></button>
    </div>
  </div>`;
}

function attachQListeners(q) {
  const ti = document.querySelector(`.q-title-inp[data-qid="${q.id}"]`);
  if (ti) ti.addEventListener('change', () => saveQF(q.id, 'title', ti.value));

  const di = document.querySelector(`.q-sub-inp[data-qid="${q.id}"][data-field="description"]`);
  if (di) di.addEventListener('change', () => saveQF(q.id, 'description', di.value));

  const ii = document.querySelector(`.q-img-inp[data-qid="${q.id}"][data-field="imageUrl"]`);
  if (ii) ii.addEventListener('change', () => {
    saveQF(q.id, 'imageUrl', ii.value);
    let prev = ii.nextElementSibling;
    if (ii.value) {
      if (!prev || !prev.classList.contains('q-img-prev')) {
        const img = document.createElement('img');
        img.className = 'q-img-prev';
        img.onclick   = () => window.open(img.src, '_blank');
        img.onerror   = () => img.style.display = 'none';
        ii.after(img);
        prev = img;
      }
      prev.src = ii.value; prev.style.display = 'block';
    } else if (prev && prev.classList.contains('q-img-prev')) {
      prev.remove();
    }
  });

  const oc = document.getElementById(`opts-${q.id}`);
  if (oc) oc.querySelectorAll('.opt-inp').forEach(inp => inp.addEventListener('change', () => saveOptions(q.id)));
  const mr = document.getElementById(`mrows-${q.id}`);
  const mc = document.getElementById(`mcols-${q.id}`);
  if (mr) mr.querySelectorAll('input').forEach(inp => inp.addEventListener('change', () => saveMatrix(q.id)));
  if (mc) mc.querySelectorAll('input').forEach(inp => inp.addEventListener('change', () => saveMatrix(q.id)));
}

async function saveQF(qid, field, value) {
  try {
    await db.collection('surveys').doc(activeSurveyId).collection('questions').doc(qid)
      .update({ [field]: value, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    const q = questions.find(q => q.id === qid);
    if (q) q[field] = value;
  } catch(e) { opToast('Gagal simpan', 'er'); }
}

async function saveOptions(qid) {
  const c = document.getElementById(`opts-${qid}`);
  if (!c) return;
  const opts = [...c.querySelectorAll('.opt-row')].map(row => ({
    label:    row.querySelector('[data-field="label"]')?.value || '',
    value:    (row.querySelector('[data-field="label"]')?.value || '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
    imageUrl: row.querySelector('[data-field="imageUrl"]')?.value || '',
  }));
  await saveQF(qid, 'options', opts);
}

async function saveMatrix(qid) {
  const mr   = document.getElementById(`mrows-${qid}`);
  const mc   = document.getElementById(`mcols-${qid}`);
  const rows = mr ? [...mr.querySelectorAll('input[data-mtype="row"]')].map(i => i.value) : [];
  const cols = mc ? [...mc.querySelectorAll('input[data-mtype="col"]')].map(i => i.value) : [];
  await saveQF(qid, 'rows', rows);
  await saveQF(qid, 'cols', cols);
}

function addOption(qid) {
  const q = questions.find(q => q.id === qid);
  if (!q) return;
  q.options = q.options || [];
  const idx = q.options.length;
  q.options.push({ label:`Pilihan ${idx+1}`, value:`pilihan_${idx+1}`, imageUrl:'' });
  const c = document.getElementById(`opts-${qid}`);
  const ab = c.querySelector('.add-opt');
  const row = document.createElement('div');
  row.className = 'opt-row';
  row.dataset.oi = idx;
  row.innerHTML = `<input class="opt-inp" placeholder="Label" value="Pilihan ${idx+1}" data-field="label"/>
    <input class="opt-inp opt-img-url" placeholder="URL gambar" value="" data-field="imageUrl"/>
    <button class="btn btn-danger btn-xs" onclick="removeOption('${qid}',${idx})"><i data-lucide="x"></i></button>`;
  c.insertBefore(row, ab);
  row.querySelectorAll('.opt-inp').forEach(i => i.addEventListener('change', () => saveOptions(qid)));
  lucide.createIcons({ nodes:[row] });
  saveOptions(qid);
}

function removeOption(qid, oi) {
  const q = questions.find(q => q.id === qid);
  if (!q) return;
  q.options.splice(oi, 1);
  const rows = document.getElementById(`opts-${qid}`)?.querySelectorAll('.opt-row');
  if (rows && rows[oi]) rows[oi].remove();
  saveOptions(qid);
}

function addMatrixItem(qid, type) {
  const q = questions.find(q => q.id === qid);
  if (!q) return;
  if (type === 'row') {
    q.rows = q.rows || [];
    const idx = q.rows.length;
    q.rows.push(`Baris ${idx+1}`);
    const c = document.getElementById(`mrows-${qid}`);
    const ab = c.querySelector('.add-opt');
    const d = document.createElement('div');
    d.style.cssText = 'display:flex;gap:.3rem';
    d.innerHTML = `<input class="opt-inp" value="Baris ${idx+1}" data-mi="${idx}" data-mtype="row"/><button class="btn btn-danger btn-xs" onclick="removeMatrixItem('${qid}','row',${idx})"><i data-lucide="x"></i></button>`;
    c.insertBefore(d, ab);
    d.querySelector('input').addEventListener('change', () => saveMatrix(qid));
    lucide.createIcons({ nodes:[d] });
  } else {
    q.cols = q.cols || [];
    const idx = q.cols.length;
    q.cols.push(`Kolom ${String.fromCharCode(65 + idx)}`);
    const c = document.getElementById(`mcols-${qid}`);
    const ab = c.querySelector('.add-opt');
    const d = document.createElement('div');
    d.style.cssText = 'display:flex;gap:.3rem';
    d.innerHTML = `<input class="opt-inp" value="${q.cols[idx]}" data-mi="${idx}" data-mtype="col"/><button class="btn btn-danger btn-xs" onclick="removeMatrixItem('${qid}','col',${idx})"><i data-lucide="x"></i></button>`;
    c.insertBefore(d, ab);
    d.querySelector('input').addEventListener('change', () => saveMatrix(qid));
    lucide.createIcons({ nodes:[d] });
  }
  saveMatrix(qid);
}

function removeMatrixItem(qid, type, idx) {
  const q = questions.find(q => q.id === qid);
  if (!q) return;
  if (type === 'row') q.rows.splice(idx, 1);
  else q.cols.splice(idx, 1);
  saveMatrix(qid);
  renderQList(questions);
}

async function toggleRequired(qid, btn) {
  const q = questions.find(q => q.id === qid);
  if (!q) return;
  q.required = !q.required;
  btn.classList.toggle('on', q.required);
  await saveQF(qid, 'required', q.required);
}

async function duplicateQ(qid) {
  const q = questions.find(q => q.id === qid);
  if (!q || !activeSurveyId) return;
  const { id:_, ...copy } = q;
  copy.title += ' (Salinan)';
  copy.order  = questions.length;
  copy.createdAt = firebase.firestore.FieldValue.serverTimestamp();
  try {
    const ref = await db.collection('surveys').doc(activeSurveyId).collection('questions').add(copy);
    copy.id = ref.id;
    questions.push(copy);
    renderQList(questions);
    opToast('Duplikat dibuat');
  } catch(e) {
    opToast('Gagal duplikat', 'er');
  }
}

async function deleteQ(qid) {
  if (!confirm('Hapus pertanyaan ini?')) return;
  try {
    await db.collection('surveys').doc(activeSurveyId).collection('questions').doc(qid).delete();
    questions = questions.filter(q => q.id !== qid);
    renderQList(questions);
    opToast('Pertanyaan dihapus');
  } catch(e) {
    opToast('Gagal hapus', 'er');
  }
}

/* ══════════════════════════════════════════
   FILE IMPORT SYSTEM
══════════════════════════════════════════ */
document.getElementById('btnImportFile').addEventListener('click', () => {
  if (!activeSurveyId) return opToast('Pilih survey terlebih dahulu', 'wn');
  document.getElementById('importModal').style.display = 'flex';
  lucide.createIcons();
});
document.getElementById('btnCloseImport').addEventListener('click', () => closeImportModal());
document.getElementById('btnCancelImport').addEventListener('click', () => closeImportModal());

function closeImportModal() {
  document.getElementById('importModal').style.display = 'none';
  document.getElementById('importPreviewWrap').style.display = 'none';
  document.getElementById('importPreview').innerHTML = '';
  document.getElementById('btnConfirmImport').disabled = true;
  importedQuestions = [];
}

const dropZone  = document.getElementById('importDropZone');
const fileInput = document.getElementById('importFileInput');
dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f) handleImportFile(f);
});
fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleImportFile(fileInput.files[0]); fileInput.value = ''; });

async function handleImportFile(file) {
  const name = file.name.toLowerCase();
  try {
    if      (name.endsWith('.docx'))                  await parseDocx(file);
    else if (name.endsWith('.xlsx') || name.endsWith('.xls')) await parseXlsx(file);
    else if (name.endsWith('.csv'))                   await parseCsv(file);
    else opToast('Format tidak didukung. Gunakan .docx, .xlsx, .xls, atau .csv', 'wn');
  } catch(e) {
    opToast('Gagal membaca file: ' + e.message, 'er');
  }
}

async function parseDocx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result      = await mammoth.extractRawText({ arrayBuffer });
  const lines       = result.value.split('\n').map(l => l.trim()).filter(l => l.length);
  const parsed      = [];
  let currentQ      = null;
  lines.forEach(line => {
    if (/^\[section\]/i.test(line)) {
      if (currentQ) parsed.push(currentQ);
      currentQ = null;
      parsed.push({ type:'section', title:line.replace(/^\[section\]\s*/i,''), description:'', required:false, options:[], rows:[], cols:[] });
      return;
    }
    if (/^([-•]\s|[A-Za-z0-9]\.\s)/.test(line)) {
      if (currentQ) {
        if (!['multiple_choice','checkbox'].includes(currentQ.type)) currentQ.type = 'multiple_choice';
        const label = line.replace(/^([-•]\s|[A-Za-z0-9]\.\s)/, '').trim();
        const val   = label.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'').slice(0,40) || `opt_${currentQ.options.length+1}`;
        currentQ.options.push({ label, value:val, imageUrl:'' });
      }
      return;
    }
    if (currentQ) parsed.push(currentQ);
    currentQ = { type:'short', title:line, description:'', required:false, options:[], rows:[], cols:[] };
  });
  if (currentQ) parsed.push(currentQ);
  parsed.forEach(q => { if (q.type === 'short' && q.options?.length > 0) q.type = 'multiple_choice'; });
  showImportPreview(parsed);
}

async function parseXlsx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const wb  = XLSX.read(arrayBuffer, { type:'array' });
  const ws  = wb.Sheets[wb.SheetNames[0]];
  const rows= XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
  let startRow = 0;
  if (rows[0] && String(rows[0][0] || '').toLowerCase().includes('pertanyaan')) startRow = 1;
  const parsed = [];
  const typeMap = { mc:'multiple_choice',cb:'checkbox',drop:'dropdown',scale:'linear_scale',section:'section',short:'short',paragraph:'paragraph',date:'date',time:'time',rating:'rating',number:'number',url:'url',email:'email',phone:'phone',signature:'signature' };
  rows.slice(startRow).forEach(row => {
    const title   = String(row[0] || '').trim(); if (!title) return;
    const rawType = String(row[1] || 'short').trim().toLowerCase();
    const optsRaw = String(row[2] || '').trim();
    const type    = typeMap[rawType] || 'short';
    const opts    = optsRaw ? optsRaw.split(',').map(o => o.trim()).filter(o => o).map(o => ({ label:o, value:o.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,''), imageUrl:'' })) : [];
    parsed.push({ type, title, description:'', required:false, options:opts, rows:[], cols:[] });
  });
  showImportPreview(parsed);
}

async function parseCsv(file) {
  const text = await file.text();
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  let startRow = 0;
  if (lines[0] && lines[0].toLowerCase().includes('pertanyaan')) startRow = 1;
  const parsed  = [];
  const typeMap = { mc:'multiple_choice',cb:'checkbox',drop:'dropdown',scale:'linear_scale',section:'section',short:'short',paragraph:'paragraph',date:'date',time:'time',rating:'rating',number:'number',url:'url',email:'email',phone:'phone',signature:'signature' };
  lines.slice(startRow).forEach(line => {
    const cols = []; let cur = '', inQ = false;
    for (let c of line) { if (c==='"') inQ=!inQ; else if (c===',' && !inQ) { cols.push(cur); cur=''; } else cur+=c; }
    cols.push(cur);
    const title   = (cols[0] || '').trim(); if (!title) return;
    const rawType = (cols[1] || 'short').trim().toLowerCase();
    const optsRaw = (cols[2] || '').trim();
    const type    = typeMap[rawType] || 'short';
    const opts    = optsRaw ? optsRaw.split(';').map(o => o.trim()).filter(o => o).map(o => ({ label:o, value:o.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,''), imageUrl:'' })) : [];
    parsed.push({ type, title, description:'', required:false, options:opts, rows:[], cols:[] });
  });
  showImportPreview(parsed);
}

function showImportPreview(parsed) {
  if (!parsed.length) { opToast('Tidak ada pertanyaan yang dapat diparse.', 'wn'); return; }
  importedQuestions = parsed;
  const wrap    = document.getElementById('importPreviewWrap');
  const preview = document.getElementById('importPreview');
  document.getElementById('importPreviewCount').textContent = `Ditemukan ${parsed.length} item. Pilih yang ingin ditambahkan:`;
  preview.innerHTML = parsed.map((q, i) => `
    <div class="import-q-row">
      <input type="checkbox" checked data-idx="${i}" id="iq-${i}"/>
      <div class="import-q-info">
        <div class="import-q-text">${esc(q.title)}</div>
        <div class="import-q-type">${TYPE_LABELS[q.type] || q.type}${q.options?.length ? ' · ' + q.options.length + ' pilihan' : ''}</div>
        ${q.options?.length ? `<div class="import-q-opts">${q.options.slice(0,4).map(o => esc(o.label)).join(' · ')}${q.options.length > 4 ? ` +${q.options.length-4} lagi` : ''}</div>` : ''}
      </div>
    </div>`).join('');
  wrap.style.display = 'block';
  document.getElementById('btnConfirmImport').disabled = false;
}

document.getElementById('btnSelectAllImport').addEventListener('click', () => {
  document.querySelectorAll('#importPreview input[type="checkbox"]').forEach(cb => cb.checked = true);
});
document.getElementById('btnDeselectAllImport').addEventListener('click', () => {
  document.querySelectorAll('#importPreview input[type="checkbox"]').forEach(cb => cb.checked = false);
});

document.getElementById('btnConfirmImport').addEventListener('click', async () => {
  if (!activeSurveyId) return;
  const selected = [...document.querySelectorAll('#importPreview input[type="checkbox"]:checked')].map(cb => Number(cb.dataset.idx));
  if (!selected.length) return opToast('Pilih minimal 1 pertanyaan', 'wn');
  const btn = document.getElementById('btnConfirmImport');
  btn.disabled = true; btn.textContent = 'Menyimpan…';
  try {
    const batch = db.batch();
    let order = questions.length;
    selected.forEach(idx => {
      const q   = { ...importedQuestions[idx], order: order++, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
      const ref = db.collection('surveys').doc(activeSurveyId).collection('questions').doc();
      batch.set(ref, q);
    });
    await batch.commit();
    opToast(`${selected.length} pertanyaan berhasil ditambahkan`);
    closeImportModal();
    await loadQuestions(activeSurveyId);
  } catch(e) {
    opToast('Gagal menyimpan: ' + e.message, 'er');
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="check"></i> Tambahkan ke Survey';
    lucide.createIcons({ nodes:[btn] });
  }
});

/* ══════════════════════════════════════════
   RESPONSES — FULLY REBUILT
   FIX: Tampilkan SEMUA jawaban, bukan cuma 5.
   FITUR BARU: Expand/collapse per responden,
   pagination, sort, filter status.
══════════════════════════════════════════ */
document.getElementById('respSurveyFilter').addEventListener('change', function () { loadResponses(this.value); });
document.getElementById('respSearch').addEventListener('input', debounce(function () { filterResp(this.value); }, 280));

// Sort & status filter
document.getElementById('respSortBtn')?.addEventListener('click', () => cycleSort());
document.getElementById('respStatusFilter')?.addEventListener('change', function () { applyRespFilter(); });

let respSortMode = 'newest'; // newest | oldest | name

function cycleSort() {
  const modes  = ['newest','oldest','name'];
  const labels = { newest:'Terbaru', oldest:'Terlama', name:'Nama A–Z' };
  respSortMode = modes[(modes.indexOf(respSortMode) + 1) % modes.length];
  const btn = document.getElementById('respSortBtn');
  if (btn) btn.innerHTML = `<i data-lucide="arrow-up-down"></i> ${labels[respSortMode]}`;
  lucide.createIcons({ nodes:[btn] });
  applyRespFilter();
}

function loadResponses(sid) {
  const container = document.getElementById('responseCards');
  if (!sid) {
    container.innerHTML = '<div class="empty-msg"><i data-lucide="inbox"></i><p>Pilih survey untuk melihat responden.</p></div>';
    lucide.createIcons({ nodes:[container] });
    return;
  }
  if (activeRespListener) activeRespListener();
  container.innerHTML = '<div class="empty-msg"><i data-lucide="loader" style="animation:spin 1s linear infinite"></i><p>Memuat responden…</p></div>';
  lucide.createIcons({ nodes:[container] });

  const ref = rtdb.ref(`responses/${sid}`);
  ref.on('value', async snap => {
    const data = snap.val() || {};
    responses[sid] = Object.values(data);

    // Load questions if not yet loaded for this survey
    if (activeSurveyId !== sid || !questions.length) {
      try {
        const qSnap = await db.collection('surveys').doc(sid).collection('questions').orderBy('order').get();
        questions = qSnap.docs.map(d => ({ id:d.id, ...d.data() }));
        activeSurveyId = sid;
      } catch(e) {}
    }

    respPage = 1;
    applyRespFilter();
  });
  activeRespListener = () => ref.off();
}

function applyRespFilter() {
  const sid         = document.getElementById('respSurveyFilter').value;
  const searchTerm  = (document.getElementById('respSearch')?.value || '').toLowerCase().trim();
  const statusFilter= document.getElementById('respStatusFilter')?.value || 'all';
  let all           = responses[sid] || [];

  // Filter by search
  if (searchTerm) {
    all = all.filter(r =>
      (r.userName || '').toLowerCase().includes(searchTerm) ||
      (r.email    || '').toLowerCase().includes(searchTerm) ||
      (r.role     || '').toLowerCase().includes(searchTerm) ||
      (r.kelas    || '').toLowerCase().includes(searchTerm)
    );
  }

  // Filter by status
  if (statusFilter === 'submitted') all = all.filter(r => r.status === 'submitted');
  if (statusFilter === 'draft')     all = all.filter(r => r.status !== 'submitted');

  // Sort
  if (respSortMode === 'newest') all = [...all].sort((a,b) => (b.submittedAt||0) - (a.submittedAt||0));
  if (respSortMode === 'oldest') all = [...all].sort((a,b) => (a.submittedAt||0) - (b.submittedAt||0));
  if (respSortMode === 'name')   all = [...all].sort((a,b) => (a.userName||'').localeCompare(b.userName||''));

  respFiltered = all;
  renderRespCards();
}

function filterResp(term) { applyRespFilter(); }

function renderRespCards() {
  const container = document.getElementById('responseCards');
  const total     = respFiltered.length;

  if (!total) {
    container.innerHTML = '<div class="empty-msg"><i data-lucide="inbox"></i><p>Belum ada responden yang sesuai.</p></div>';
    lucide.createIcons({ nodes:[container] });
    return;
  }

  const totalPages = Math.ceil(total / RESP_PER_PAGE);
  if (respPage > totalPages) respPage = totalPages;
  const start  = (respPage - 1) * RESP_PER_PAGE;
  const paged  = respFiltered.slice(start, start + RESP_PER_PAGE);

  // Build cards HTML
  const cardsHtml = paged.map((r, idx) => buildRespCard(r, start + idx + 1)).join('');

  // Build pagination HTML
  const pagHtml = totalPages > 1 ? `
    <div class="resp-pagination">
      <span class="resp-pag-info">Menampilkan ${start+1}–${Math.min(start+RESP_PER_PAGE, total)} dari ${total} responden</span>
      <div class="resp-pag-btns">
        <button class="btn btn-ghost btn-sm" onclick="goRespPage(${respPage-1})" ${respPage<=1?'disabled':''}>
          <i data-lucide="chevron-left"></i> Prev
        </button>
        ${buildPagNumbers(respPage, totalPages)}
        <button class="btn btn-ghost btn-sm" onclick="goRespPage(${respPage+1})" ${respPage>=totalPages?'disabled':''}>
          Next <i data-lucide="chevron-right"></i>
        </button>
      </div>
    </div>` : '';

  // Count bar
  const submitted = respFiltered.filter(r => r.status === 'submitted').length;
  const countHtml = `
    <div class="resp-sort-bar">
      <button class="btn btn-ghost btn-sm" id="respSortBtn" onclick="cycleSort()">
        <i data-lucide="arrow-up-down"></i> ${respSortMode === 'newest' ? 'Terbaru' : respSortMode === 'oldest' ? 'Terlama' : 'Nama A–Z'}
      </button>
      <select class="form-control btn-sm" id="respStatusFilter" onchange="applyRespFilter()" style="width:auto">
        <option value="all">Semua Status</option>
        <option value="submitted">Selesai</option>
        <option value="draft">Draft</option>
      </select>
      <span class="resp-count-badge">${submitted} selesai · ${total - submitted} draft · ${total} total</span>
    </div>`;

  container.innerHTML = countHtml + `<div class="resp-cards-grid">${cardsHtml}</div>` + pagHtml;
  lucide.createIcons({ nodes:[container] });

  // Re-attach expand listeners
  container.querySelectorAll('.resp-card-header').forEach(header => {
    header.addEventListener('click', () => {
      const card = header.closest('.resp-card');
      card.classList.toggle('open');
    });
  });
}

function buildPagNumbers(current, total) {
  const pages = [];
  const range = 2;
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - range && i <= current + range)) {
      pages.push(i);
    } else if (pages[pages.length-1] !== '…') {
      pages.push('…');
    }
  }
  return pages.map(p => p === '…'
    ? `<span style="color:var(--text-m);padding:.3rem .4rem">…</span>`
    : `<button class="btn btn-ghost btn-sm${p === current ? ' btn-primary' : ''}" onclick="goRespPage(${p})">${p}</button>`
  ).join('');
}

function goRespPage(p) {
  const totalPages = Math.ceil(respFiltered.length / RESP_PER_PAGE);
  if (p < 1 || p > totalPages) return;
  respPage = p;
  renderRespCards();
  document.getElementById('page-responses')?.scrollTo({ top:0, behavior:'smooth' });
}

/* Konversi nilai jawaban: hilangkan underscore, cari label asli */
function resolveAnswerLabel(val, question) {
  if (!val || val === 'undefined' || val === 'null') return '';
  // Cari label dari options jika ada
  if (question?.options?.length) {
    const opt = question.options.find(o => o.value === val || o.label === val);
    if (opt?.label) return opt.label;
  }
  // Hapus underscore, kapitalkan kata pertama
  const cleaned = val.replace(/_/g, ' ').trim();
  // Jika semua huruf kecil, kapitalkan pertama
  if (cleaned === cleaned.toLowerCase()) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return cleaned;
}

/**
 * Build satu kartu responden.
 * FIX UTAMA: Tampilkan SEMUA jawaban (bukan hanya 5).
 * Kartu bisa di-klik untuk expand/collapse.
 */
function buildRespCard(r, num) {
  const isSubmitted = r.status === 'submitted';
  const answerEntries = Object.entries(r.answers || {});
  const totalAns = answerEntries.length;
  const totalQ   = questions.filter(q => q.type !== 'section').length;

  // Completion %
  const completion = r.completion ?? (totalQ > 0 ? Math.round((totalAns / totalQ) * 100) : 0);

  // Build ALL answers HTML
  const answersHtml = totalAns === 0
    ? '<div class="empty-msg" style="padding:1.2rem;text-align:center;color:var(--text-faint);font-size:.8rem">Tidak ada jawaban.</div>'
    : answerEntries.map(([qid, ans], i) => {
        const q       = questions.find(q => q.id === qid);
        const qTitle  = q ? q.title : qid;
        // Hilangkan underscore & cari label asli dari options
        let ansText;
        if (Array.isArray(ans)) {
          ansText = ans.map(a => resolveAnswerLabel(String(a), q)).join(', ');
        } else {
          ansText = resolveAnswerLabel(String(ans ?? ''), q);
        }
        const isEmpty = !ansText || ansText === '–';
        return `
        <div class="resp-ans">
          <div class="resp-ans-num">P${i+1}</div>
          <div class="resp-qlabel">${esc(qTitle)}</div>
          <div class="resp-atext${isEmpty ? ' empty' : ''}">${isEmpty ? '(tidak diisi)' : esc(ansText)}</div>
        </div>`;
      }).join('');

  return `
  <div class="resp-card" id="rcard-${num}">
    <div class="resp-card-header">
      <div class="resp-card-left">
        <div class="resp-name">${esc(r.userName || 'Anonim')}</div>
        <div class="resp-meta">
          ${r.email ? `<span class="resp-meta-item"><i data-lucide="mail"></i>${esc(r.email)}</span>` : ''}
          ${r.role  ? `<span class="chip-role">${esc(r.role)}</span>` : ''}
          ${r.kelas ? `<span class="resp-meta-item"><i data-lucide="school"></i>${esc(r.kelas)}</span>` : ''}
        </div>
        <div class="resp-meta">
          <span class="resp-meta-item"><i data-lucide="clock"></i>${fmtDateTime(r.submittedAt)}</span>
          <span class="resp-meta-item"><i data-lucide="message-square"></i>${totalAns} dari ${totalQ || '?'} pertanyaan</span>
        </div>
      </div>
      <div class="resp-card-right">
        ${isSubmitted
          ? '<span class="badge badge-green">Selesai</span>'
          : '<span class="badge badge-grey">Draft</span>'}
        <span class="resp-expand-ico"><i data-lucide="chevron-down"></i></span>
      </div>
    </div>
    <div class="resp-progress-bar">
      <div class="resp-progress-fill" style="width:${completion}%"></div>
    </div>
    <div class="resp-body">
      <div class="resp-answers-grid">
        ${answersHtml}
      </div>
    </div>
  </div>`;
}

/* ══════════════════════════════════════════
   EXPORT
══════════════════════════════════════════ */
document.getElementById('btnExportXLSX').addEventListener('click', () => {
  const sid   = document.getElementById('respSurveyFilter').value;
  const resps = responses[sid] || [];
  if (!resps.length) return opToast('Tidak ada data', 'wn');
  const rows = resps.map(r => {
    const row = {
      Nama:      r.userName || '',
      Email:     r.email    || '',
      Peran:     r.role     || '',
      Kelas:     r.kelas    || '',
      Status:    r.status   || '',
      WaktuKirim:r.submittedAt ? new Date(r.submittedAt).toLocaleString('id-ID') : '',
    };
    Object.entries(r.answers || {}).forEach(([qid, v]) => {
      const q = questions.find(q => q.id === qid);
      row[q ? q.title : qid] = Array.isArray(v) ? v.join('; ') : String(v || '');
    });
    return row;
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Responden');
  XLSX.writeFile(wb, `responden-${sid}-${Date.now()}.xlsx`);
  opToast('Ekspor Excel berhasil');
});

document.getElementById('btnExportJSON').addEventListener('click', () => {
  const sid   = document.getElementById('respSurveyFilter').value;
  const resps = responses[sid] || [];
  if (!resps.length) return opToast('Tidak ada data', 'wn');
  const a = document.createElement('a');
  a.href     = URL.createObjectURL(new Blob([JSON.stringify(resps, null, 2)], { type:'application/json' }));
  a.download = `responden-${sid}-${Date.now()}.json`;
  a.click();
  opToast('Ekspor JSON berhasil');
});

/* ══════════════════════════════════════════
   STATISTICS & CHARTS
══════════════════════════════════════════ */
document.getElementById('statSurveySelect').addEventListener('change', async function () {
  const sid = this.value;
  if (!sid) return;
  let qs = [];
  if (activeSurveyId === sid && questions.length) {
    qs = questions;
  } else {
    try {
      const snap = await db.collection('surveys').doc(sid).collection('questions').orderBy('order').get();
      qs = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    } catch(e) {}
  }
  let resps = responses[sid];
  if (!resps) {
    try {
      const snap = await rtdb.ref(`responses/${sid}`).once('value');
      resps = Object.values(snap.val() || {});
      responses[sid] = resps;
    } catch(e) { resps = []; }
  }
  renderCharts(qs, resps);
});

function renderCharts(qs, resps) {
  const grid = document.getElementById('chartsGrid');
  Object.values(charts).forEach(c => c.destroy && c.destroy());
  charts = {};
  grid.innerHTML = '';

  if (!resps.length) {
    grid.innerHTML = '<div class="empty-msg glass" style="border-radius:var(--r-md);grid-column:1/-1"><i data-lucide="inbox"></i><p>Belum ada respons.</p></div>';
    lucide.createIcons({ nodes:[grid] });
    return;
  }

  // Completion pie
  const sub = resps.filter(r => r.status === 'submitted').length;
  addPie(grid, 'Status Respons', ['Selesai','Draft'], [sub, resps.length - sub], ['#4caf50','#5b7ec5']);

  // Role distribution
  const roleCounts = {};
  resps.forEach(r => { const role = r.role || 'Tidak diketahui'; roleCounts[role] = (roleCounts[role]||0) + 1; });
  if (Object.keys(roleCounts).length > 1) addPie(grid, 'Distribusi Peran', Object.keys(roleCounts), Object.values(roleCounts));

  // Per-question charts
  qs.filter(q => ['multiple_choice','checkbox','dropdown','rating','linear_scale'].includes(q.type)).forEach(q => {
    const ans = resps.map(r => r.answers?.[q.id]).filter(v => v !== undefined && v !== null && v !== '');
    if (!ans.length) return;
    if (['multiple_choice','dropdown'].includes(q.type)) {
      const counts = {};
      ans.forEach(v => { counts[v] = (counts[v]||0) + 1; });
      addBar(grid, q.title, Object.keys(counts), Object.values(counts));
    } else if (q.type === 'checkbox') {
      const counts = {};
      ans.forEach(arr => { (Array.isArray(arr) ? arr : [arr]).forEach(v => { counts[v] = (counts[v]||0) + 1; }); });
      addBar(grid, q.title, Object.keys(counts), Object.values(counts));
    } else {
      const counts = {};
      ans.forEach(v => { counts[v] = (counts[v]||0) + 1; });
      const keys = Object.keys(counts).sort((a,b) => Number(a) - Number(b));
      addBar(grid, q.title + ' (distribusi)', keys, keys.map(k => counts[k]));
    }
  });
  lucide.createIcons({ nodes:[grid] });
}

function chartColors() {
  return ['#f9a825','#3057b5','#4caf50','#e53935','#9c27b0','#00bcd4','#ff9800','#607d8b'];
}
function getComputedVar(v) {
  return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
}

function addPie(grid, title, labels, data, colors) {
  const card = document.createElement('div');
  card.className = 'chart-card glass';
  const cid = 'c_' + Math.random().toString(36).slice(2);
  card.innerHTML = `<div class="chart-title">${esc(title)}</div><div class="chart-wrap"><canvas id="${cid}"></canvas></div>`;
  grid.appendChild(card);
  const ctx = document.getElementById(cid).getContext('2d');
  charts[cid] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors || chartColors(), borderWidth: 2, borderColor: getComputedVar('--bg-card') }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: getComputedVar('--text-s') || '#a0b0d4', font:{ size:11 } } },
      },
    },
  });
}

function addBar(grid, title, labels, data) {
  const card = document.createElement('div');
  card.className = 'chart-card glass';
  const cid = 'c_' + Math.random().toString(36).slice(2);
  card.innerHTML = `<div class="chart-title" title="${esc(title)}">${esc(title.length > 42 ? title.slice(0,42)+'…' : title)}</div><div class="chart-wrap"><canvas id="${cid}"></canvas></div>`;
  grid.appendChild(card);
  const ctx = document.getElementById(cid).getContext('2d');
  const tc  = getComputedVar('--text-s')  || '#a0b0d4';
  const gc  = getComputedVar('--border')  || 'rgba(91,126,197,.22)';
  charts[cid] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data, backgroundColor:'rgba(249,168,37,.75)', borderColor:'#f9a825', borderWidth:1, borderRadius:5 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: data.length > 5 ? 'y' : 'x',
      plugins: { legend:{ display:false } },
      scales: {
        x: { ticks:{ color:tc, font:{size:10} }, grid:{ color:gc } },
        y: { ticks:{ color:tc, font:{size:10} }, grid:{ color:gc } },
      },
    },
  });
}

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  initLoginGate();
});
