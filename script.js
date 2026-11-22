/* ============================================================
   Smart Study Planner — script.js
   Vanilla JavaScript · LocalStorage · No frameworks
   ============================================================ */

'use strict';

/* ============================================================
   SECTION 1 — DATA LAYER & LOCAL STORAGE HELPERS
   ============================================================ */

/**
 * Ambil array dari localStorage; kembalikan [] jika kosong.
 * @param {string} key - Kunci LocalStorage
 */
function loadData(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}

/**
 * Simpan data ke localStorage sebagai JSON string.
 * @param {string} key
 * @param {any}    data
 */
function saveData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ----- State in-memory (diisi saat halaman load) -----
let tasks     = loadData('ssp_tasks');      // array tugas
let schedules = loadData('ssp_schedules');  // array jadwal
let notes     = loadData('ssp_notes');      // array catatan
let pomodoroCount = parseInt(localStorage.getItem('ssp_pomo') || '0', 10);

// ID task / note yang sedang diedit (null = mode tambah baru)
let editingTaskId = null;
let editingNoteId = null;

// Filter tugas aktif
let activeFilter = 'all';

/* ============================================================
   SECTION 2 — UTILITY HELPERS
   ============================================================ */

/**
 * Buat ID unik berbasis timestamp + random.
 */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/**
 * Format tanggal ISO (YYYY-MM-DD) → tampilan lokal Indonesia.
 * @param {string} dateStr
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Tampilkan toast notifikasi singkat.
 * @param {string}  msg  - Pesan yang ditampilkan
 * @param {string}  icon - Emoji opsional
 */
function showToast(msg, icon = '✅') {
  const t = document.getElementById('toast');
  t.textContent = icon + ' ' + msg;
  t.classList.remove('hidden');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.add('hidden'), 3000);
}

/* ============================================================
   SECTION 3 — DASHBOARD (stat cards + progress bar)
   ============================================================ */

/**
 * Hitung ulang dan render semua angka di dashboard.
 */
function updateDashboard() {
  const total     = tasks.length;
  const done      = tasks.filter(t => t.done).length;
  const pending   = total - done;
  const percent   = total === 0 ? 0 : Math.round((done / total) * 100);

  document.getElementById('statTotal').textContent   = total;
  document.getElementById('statDone').textContent    = done;
  document.getElementById('statPending').textContent = pending;
  document.getElementById('statPercent').textContent = percent + '%';
  document.getElementById('progressLabel').textContent = percent + '%';
  document.getElementById('progressBar').style.width   = percent + '%';
}

/* ============================================================
   SECTION 4 — TASK MANAGEMENT
   ============================================================ */

/** Tambah tugas baru dari form input. */
function addTask() {
  const name     = document.getElementById('taskInput').value.trim();
  const priority = document.getElementById('taskPriority').value;
  const deadline = document.getElementById('taskDeadline').value;
  const subject  = document.getElementById('taskSubject').value.trim();

  if (!name) { showToast('Nama tugas tidak boleh kosong!', '⚠️'); return; }

  const task = { id: uid(), name, priority, deadline, subject, done: false, createdAt: new Date().toISOString() };
  tasks.push(task);
  saveData('ssp_tasks', tasks);

  // Reset form
  document.getElementById('taskInput').value    = '';
  document.getElementById('taskDeadline').value = '';
  document.getElementById('taskSubject').value  = '';

  renderTasks();
  updateDashboard();
  showToast('Tugas berhasil ditambahkan!');
}

/**
 * Toggle status selesai/belum selesai sebuah tugas.
 * @param {string} id - ID tugas
 */
function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.done = !task.done;
  saveData('ssp_tasks', tasks);
  renderTasks();
  updateDashboard();
  showToast(task.done ? 'Tugas ditandai selesai! 🎉' : 'Tugas diaktifkan kembali.', task.done ? '🎉' : '🔄');
}

/**
 * Hapus tugas berdasarkan ID.
 * @param {string} id
 */
function deleteTask(id) {
  if (!confirm('Hapus tugas ini?')) return;
  tasks = tasks.filter(t => t.id !== id);
  saveData('ssp_tasks', tasks);
  renderTasks();
  updateDashboard();
  showToast('Tugas dihapus.', '🗑️');
}

/**
 * Buka modal edit dan isi form dengan data tugas yang dipilih.
 * @param {string} id
 */
function openEditTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  editingTaskId = id;
  document.getElementById('editTaskInput').value    = task.name;
  document.getElementById('editTaskPriority').value = task.priority;
  document.getElementById('editTaskDeadline').value = task.deadline || '';
  document.getElementById('editTaskSubject').value  = task.subject || '';
  document.getElementById('editModal').classList.remove('hidden');
}

/** Simpan perubahan tugas dari modal edit. */
function saveEditTask() {
  const task = tasks.find(t => t.id === editingTaskId);
  if (!task) return;

  const name = document.getElementById('editTaskInput').value.trim();
  if (!name) { showToast('Nama tugas tidak boleh kosong!', '⚠️'); return; }

  task.name     = name;
  task.priority = document.getElementById('editTaskPriority').value;
  task.deadline = document.getElementById('editTaskDeadline').value;
  task.subject  = document.getElementById('editTaskSubject').value.trim();

  saveData('ssp_tasks', tasks);
  closeModal();
  renderTasks();
  updateDashboard();
  showToast('Tugas berhasil diperbarui!', '✏️');
}

/** Tutup modal edit tugas. */
function closeModal() {
  document.getElementById('editModal').classList.add('hidden');
  editingTaskId = null;
}

/**
 * Set filter tampilan tugas ('all' | 'active' | 'completed').
 * @param {string} filter
 */
function setFilter(filter) {
  activeFilter = filter;
  // Update tombol aktif
  ['all', 'active', 'completed'].forEach(f => {
    document.getElementById('filter-' + f).classList.toggle('filter-active', f === filter);
  });
  renderTasks();
}

/** Label prioritas → teks yang ditampilkan. */
const PRIORITY_LABEL = { low: '🟢 Rendah', medium: '🟡 Sedang', high: '🔴 Tinggi' };

/** Render ulang daftar tugas sesuai filter aktif. */
function renderTasks() {
  const container = document.getElementById('taskList');
  const empty     = document.getElementById('emptyTasks');

  // Terapkan filter
  let filtered = tasks;
  if (activeFilter === 'active')    filtered = tasks.filter(t => !t.done);
  if (activeFilter === 'completed') filtered = tasks.filter(t =>  t.done);

  container.innerHTML = '';

  if (filtered.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  // Urutkan: belum selesai dulu, lalu prioritas tinggi → rendah
  const priOrder = { high: 0, medium: 1, low: 2 };
  const sorted = [...filtered].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return priOrder[a.priority] - priOrder[b.priority];
  });

  sorted.forEach(task => {
    const item = document.createElement('div');
    item.className = `task-item priority-${task.priority}${task.done ? ' done' : ''}`;

    const meta = [
      task.subject ? `📖 ${task.subject}` : '',
      task.deadline ? `📅 ${formatDate(task.deadline)}` : '',
      PRIORITY_LABEL[task.priority],
    ].filter(Boolean).join('  ·  ');

    item.innerHTML = `
      <input type="checkbox" class="task-checkbox" ${task.done ? 'checked' : ''}
        onchange="toggleTask('${task.id}')" title="Tandai selesai" />
      <div class="flex-1 min-w-0">
        <p class="task-name">${escapeHtml(task.name)}</p>
        <p class="task-meta">${meta}</p>
      </div>
      <div class="task-actions">
        <button class="task-btn edit"   onclick="openEditTask('${task.id}')">✏️ Edit</button>
        <button class="task-btn delete" onclick="deleteTask('${task.id}')">🗑️ Hapus</button>
      </div>`;
    container.appendChild(item);
  });
}

/* ============================================================
   SECTION 5 — SCHEDULE
   ============================================================ */

/** Tambah jadwal belajar baru dari form. */
function addSchedule() {
  const subject = document.getElementById('schedSubject').value.trim();
  const date    = document.getElementById('schedDate').value;
  const time    = document.getElementById('schedTime').value;
  const note    = document.getElementById('schedNote').value.trim();

  if (!subject || !date || !time) {
    showToast('Mata kuliah, tanggal, dan waktu wajib diisi!', '⚠️');
    return;
  }

  schedules.push({ id: uid(), subject, date, time, note });
  saveData('ssp_schedules', schedules);

  // Reset form
  document.getElementById('schedSubject').value = '';
  document.getElementById('schedDate').value    = '';
  document.getElementById('schedTime').value    = '';
  document.getElementById('schedNote').value    = '';

  renderSchedules();
  showToast('Jadwal belajar ditambahkan!', '📅');
}

/**
 * Hapus jadwal berdasarkan ID.
 * @param {string} id
 */
function deleteSchedule(id) {
  if (!confirm('Hapus jadwal ini?')) return;
  schedules = schedules.filter(s => s.id !== id);
  saveData('ssp_schedules', schedules);
  renderSchedules();
  showToast('Jadwal dihapus.', '🗑️');
}

/** Render daftar jadwal belajar. Jadwal diurutkan berdasarkan tanggal & waktu. */
function renderSchedules() {
  const container = document.getElementById('scheduleList');
  const empty     = document.getElementById('emptySchedule');
  container.innerHTML = '';

  if (schedules.length === 0) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');

  const sorted = [...schedules].sort((a, b) => {
    const da = new Date(a.date + 'T' + a.time);
    const db = new Date(b.date + 'T' + b.time);
    return da - db;
  });

  sorted.forEach(s => {
    const item = document.createElement('div');
    item.className = 'sched-item';
    const dateDisplay = formatDate(s.date);
    item.innerHTML = `
      <div class="sched-date-box">
        ${dateDisplay}<br/><span class="text-xs font-bold">${s.time}</span>
      </div>
      <div class="flex-1 min-w-0">
        <p class="sched-subject">${escapeHtml(s.subject)}</p>
        ${s.note ? `<p class="sched-info">📌 ${escapeHtml(s.note)}</p>` : ''}
      </div>
      <button class="task-btn delete" onclick="deleteSchedule('${s.id}')">🗑️</button>`;
    container.appendChild(item);
  });
}

/* ============================================================
   SECTION 6 — STUDY TIMER (Pomodoro)
   ============================================================ */

const TIMER_MODES = { pomodoro: 25 * 60, short: 5 * 60, long: 15 * 60 };

let timerMode      = 'pomodoro';
let timerDuration  = TIMER_MODES.pomodoro; // detik total mode saat ini
let timerRemaining = TIMER_MODES.pomodoro; // detik tersisa
let timerInterval  = null;                 // referensi setInterval
let timerRunning   = false;

const CIRCUMFERENCE = 2 * Math.PI * 54; // ≈ 339.29

/** Inject gradient SVG defs ke dalam elemen .timer-ring */
function injectTimerGradient() {
  const svg = document.querySelector('.timer-ring');
  if (!svg || svg.querySelector('defs')) return;
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#2563EB"/>
      <stop offset="100%" stop-color="#F97316"/>
    </linearGradient>`;
  svg.prepend(defs);
  document.getElementById('timerCircle').style.stroke = 'url(#timerGradient)';
}

/**
 * Ganti mode timer (pomodoro / short / long).
 * @param {string} mode
 */
function setTimerMode(mode) {
  if (timerRunning) return; // jangan ganti saat berjalan
  timerMode      = mode;
  timerDuration  = TIMER_MODES[mode];
  timerRemaining = timerDuration;

  // Update tab aktif
  ['pomodoro', 'short', 'long'].forEach(m => {
    document.getElementById('mode-' + m).classList.toggle('timer-mode-active', m === mode);
  });

  updateTimerDisplay();
}

/** Perbarui tampilan angka dan ring berdasarkan timerRemaining. */
function updateTimerDisplay() {
  const m = String(Math.floor(timerRemaining / 60)).padStart(2, '0');
  const s = String(timerRemaining % 60).padStart(2, '0');
  document.getElementById('timerDisplay').textContent = `${m}:${s}`;

  // Hitung dashoffset: 0 = penuh, CIRCUMFERENCE = kosong
  const progress = timerRemaining / timerDuration;
  const offset   = CIRCUMFERENCE * (1 - progress);
  document.getElementById('timerCircle').style.strokeDashoffset = offset;
}

/** Mulai timer. */
function startTimer() {
  if (timerRunning) return;
  if (timerRemaining <= 0) resetTimer();

  timerRunning = true;
  document.getElementById('btnStart').classList.add('hidden');
  document.getElementById('btnPause').classList.remove('hidden');

  timerInterval = setInterval(() => {
    timerRemaining--;
    updateTimerDisplay();

    if (timerRemaining <= 0) {
      clearInterval(timerInterval);
      timerRunning = false;
      document.getElementById('btnStart').classList.remove('hidden');
      document.getElementById('btnPause').classList.add('hidden');

      // Tambah sesi pomodoro jika mode pomodoro
      if (timerMode === 'pomodoro') {
        pomodoroCount++;
        localStorage.setItem('ssp_pomo', pomodoroCount);
        document.getElementById('pomodoroCount').textContent = pomodoroCount;
      }
      showToast('⏰ Waktu habis! Istirahat sebentar.', '🎉');
      // Efek visual: flash border ring
      document.getElementById('timerCircle').style.stroke = '#F97316';
      setTimeout(() => { document.getElementById('timerCircle').style.stroke = 'url(#timerGradient)'; }, 1500);
    }
  }, 1000);
}

/** Jeda timer. */
function pauseTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  document.getElementById('btnStart').classList.remove('hidden');
  document.getElementById('btnPause').classList.add('hidden');
  showToast('Timer dijeda.', '⏸');
}

/** Reset timer ke durasi awal mode saat ini. */
function resetTimer() {
  clearInterval(timerInterval);
  timerRunning   = false;
  timerRemaining = timerDuration;
  document.getElementById('btnStart').classList.remove('hidden');
  document.getElementById('btnPause').classList.add('hidden');
  updateTimerDisplay();
}

/* ============================================================
   SECTION 7 — NOTES
   ============================================================ */

/** Tambah catatan baru. */
function addNote() {
  const title   = document.getElementById('noteTitle').value.trim();
  const content = document.getElementById('noteContent').value.trim();

  if (!title && !content) { showToast('Catatan tidak boleh kosong!', '⚠️'); return; }

  notes.push({
    id:        uid(),
    title:     title || 'Tanpa Judul',
    content,
    createdAt: new Date().toISOString(),
  });
  saveData('ssp_notes', notes);

  document.getElementById('noteTitle').value   = '';
  document.getElementById('noteContent').value = '';

  renderNotes();
  showToast('Catatan disimpan!', '📝');
}

/**
 * Hapus catatan berdasarkan ID.
 * @param {string} id
 */
function deleteNote(id) {
  if (!confirm('Hapus catatan ini?')) return;
  notes = notes.filter(n => n.id !== id);
  saveData('ssp_notes', notes);
  renderNotes();
  showToast('Catatan dihapus.', '🗑️');
}

/**
 * Buka modal edit catatan.
 * @param {string} id
 */
function openEditNote(id) {
  const note = notes.find(n => n.id === id);
  if (!note) return;
  editingNoteId = id;
  document.getElementById('editNoteTitle').value   = note.title;
  document.getElementById('editNoteContent').value = note.content;
  document.getElementById('editNoteModal').classList.remove('hidden');
}

/** Simpan perubahan catatan dari modal. */
function saveEditNote() {
  const note = notes.find(n => n.id === editingNoteId);
  if (!note) return;

  const title = document.getElementById('editNoteTitle').value.trim();
  if (!title && !document.getElementById('editNoteContent').value.trim()) {
    showToast('Catatan tidak boleh kosong!', '⚠️'); return;
  }

  note.title   = title || 'Tanpa Judul';
  note.content = document.getElementById('editNoteContent').value.trim();

  saveData('ssp_notes', notes);
  closeNoteModal();
  renderNotes();
  showToast('Catatan diperbarui!', '✏️');
}

/** Tutup modal edit catatan. */
function closeNoteModal() {
  document.getElementById('editNoteModal').classList.add('hidden');
  editingNoteId = null;
}

/** Render semua kartu catatan. */
function renderNotes() {
  const container = document.getElementById('notesList');
  const empty     = document.getElementById('emptyNotes');
  container.innerHTML = '';

  if (notes.length === 0) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');

  // Terbaru di atas
  const sorted = [...notes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  sorted.forEach(note => {
    const card = document.createElement('div');
    card.className = 'note-card';
    const dateStr = new Date(note.createdAt).toLocaleDateString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
    card.innerHTML = `
      <p class="note-title">${escapeHtml(note.title)}</p>
      <p class="note-body">${escapeHtml(note.content)}</p>
      <p class="note-date">${dateStr}</p>
      <div class="note-actions">
        <button class="task-btn edit"   onclick="openEditNote('${note.id}')">✏️ Edit</button>
        <button class="task-btn delete" onclick="deleteNote('${note.id}')">🗑️ Hapus</button>
      </div>`;
    container.appendChild(card);
  });
}

/* ============================================================
   SECTION 8 — SECURITY HELPER
   ============================================================ */

/**
 * Escape karakter HTML berbahaya untuk mencegah XSS.
 * @param {string} str
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ============================================================
   SECTION 9 — NAVIGATION & UI HELPERS
   ============================================================ */

/** Toggle mobile navigation dropdown. */
document.getElementById('navToggle').addEventListener('click', () => {
  document.getElementById('mobileNav').classList.toggle('hidden');
});

/** Tutup mobile nav saat link diklik. */
document.querySelectorAll('#mobileNav a').forEach(a => {
  a.addEventListener('click', () => {
    document.getElementById('mobileNav').classList.add('hidden');
  });
});

/** Tutup modal saat klik di luar modal-box (overlay). */
document.getElementById('editModal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});
document.getElementById('editNoteModal').addEventListener('click', function(e) {
  if (e.target === this) closeNoteModal();
});

/** Tambah tugas / catatan dengan menekan Enter di input. */
document.getElementById('taskInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') addTask();
});
document.getElementById('noteContent').addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.ctrlKey) addNote(); // Ctrl+Enter untuk simpan catatan
});

/* ============================================================
   SECTION 10 — INIT (jalankan saat halaman pertama kali dimuat)
   ============================================================ */

function init() {
  // Inject gradient SVG untuk timer ring
  injectTimerGradient();

  // Set tanggal default input ke hari ini
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('taskDeadline').value = today;
  document.getElementById('schedDate').value    = today;

  // Render semua komponen dari data localStorage
  renderTasks();
  renderSchedules();
  renderNotes();
  updateDashboard();
  updateTimerDisplay();

  // Tampilkan sesi pomodoro yang tersimpan
  document.getElementById('pomodoroCount').textContent = pomodoroCount;
}

// Jalankan init setelah DOM siap
document.addEventListener('DOMContentLoaded', init);

/* ============================================================
   SECTION 11 — STUDY ASSISTANT (Chat Engine)
   ============================================================ */

// ── Motivational quotes pool ──────────────────────────────────
const MOTIVASI = [
  'Belajar hari ini adalah investasi terbaik untuk masa depanmu. 🌟',
  'Setiap halaman yang kamu baca membawamu selangkah lebih dekat ke tujuan. 📖',
  'Kesulitan hari ini adalah kekuatan yang kamu banggakan esok hari. 💪',
  'Jangan bandingkan perjalananmu dengan orang lain — fokus pada progresmu sendiri. 🚀',
  'Istirahat itu bukan kelemahan, tapi bahan bakar untuk sprint berikutnya. ⚡',
  'Konsistensi mengalahkan kecerdasan. Teruslah bergerak meski perlahan. 🐢',
  'Kamu tidak harus merasa siap untuk memulai — mulailah dulu, kesiapan akan datang. 🔥',
  'Setiap tugas yang kamu selesaikan adalah bukti bahwa kamu bisa diandalkan. ✅',
  'Gagal berarti kamu sedang belajar lebih cepat dari orang yang tidak mencoba. 🎯',
  'Pikiranmu adalah senjata terkuat — asah setiap hari! ⚔️',
];

// ── Intent patterns (keyword → intent string) ─────────────────
const INTENT_MAP = [
  { intent: 'priority',    keys: ['dulu', 'duluan', 'prioritas', 'utama', 'pertama', 'mulai dari'] },
  { intent: 'deadline',    keys: ['deadline', 'batas waktu', 'paling dekat', 'terdekat', 'jatuh tempo', 'segera'] },
  { intent: 'pending',     keys: ['belum selesai', 'belum', 'pending', 'aktif', 'sisa tugas', 'berapa tugas'] },
  { intent: 'done',        keys: ['sudah selesai', 'selesai', 'completed', 'sudah dikerjakan', 'tuntas'] },
  { intent: 'progress',    keys: ['progres', 'progress', 'persentase', 'persen', 'ringkasan', 'summary', 'berapa %'] },
  { intent: 'schedule',    keys: ['jadwal', 'schedule', 'hari ini', 'menyusun', 'rencana', 'agenda'] },
  { intent: 'motivation',  keys: ['motivasi', 'semangat', 'motivate', 'inspirasi', 'galau', 'malas', 'lelah', 'capek'] },
  { intent: 'list_all',    keys: ['semua tugas', 'list tugas', 'daftar tugas', 'tampilkan tugas', 'tugas apa saja'] },
  { intent: 'high_prio',   keys: ['prioritas tinggi', 'sangat penting', 'paling penting', 'kritis'] },
  { intent: 'help',        keys: ['bantuan', 'help', 'bisa apa', 'fitur', 'apa yang kamu bisa', 'apa yang bisa'] },
];

/**
 * Deteksi intent dari teks bebas pengguna.
 * Mengembalikan string intent pertama yang cocok, atau 'unknown'.
 * @param {string} text
 */
function detectIntent(text) {
  const lower = text.toLowerCase();
  for (const { intent, keys } of INTENT_MAP) {
    if (keys.some(k => lower.includes(k))) return intent;
  }
  return 'unknown';
}

/**
 * Engine utama asisten — menghasilkan HTML jawaban
 * berdasarkan intent dan data live dari aplikasi.
 * @param {string} userText
 * @returns {string} HTML string
 */
function generateAssistantReply(userText) {
  const intent = detectIntent(userText);
  const today  = new Date().toISOString().split('T')[0];

  // ── Helper: render daftar tugas sebagai <ul> HTML ──
  function taskListHTML(taskArr, emptyMsg) {
    if (!taskArr.length) return `<p>${emptyMsg}</p>`;
    const items = taskArr.map(t => {
      const deadline = t.deadline ? ` · 📅 ${formatDate(t.deadline)}` : '';
      const subject  = t.subject  ? ` · 📖 ${t.subject}` : '';
      const priClass = `pri-${t.priority}`;
      return `<li class="${priClass}">${escapeHtml(t.name)}${subject}${deadline}</li>`;
    }).join('');
    return `<ul class="assistant-task-list">${items}</ul>`;
  }

  switch (intent) {

    // ── Prioritas: tugas aktif diurutkan high → medium → low ──
    case 'priority': {
      const priOrder = { high: 0, medium: 1, low: 2 };
      const active = tasks
        .filter(t => !t.done)
        .sort((a, b) => priOrder[a.priority] - priOrder[b.priority])
        .slice(0, 5);
      if (!active.length) return '<p>Selamat! 🎉 Semua tugasmu sudah selesai. Tidak ada yang perlu dikerjakan sekarang.</p>';
      return `<p>Ini urutan tugas yang sebaiknya kamu kerjakan lebih dulu (berdasarkan prioritas):</p>
              ${taskListHTML(active, '')}
              <p class="mt-2 text-xs opacity-70">Menampilkan maks. 5 tugas aktif.</p>`;
    }

    // ── Deadline terdekat ──
    case 'deadline': {
      const withDeadline = tasks
        .filter(t => !t.done && t.deadline)
        .sort((a, b) => a.deadline.localeCompare(b.deadline))
        .slice(0, 5);
      if (!withDeadline.length) {
        return '<p>Tidak ada tugas aktif yang memiliki deadline. Pastikan kamu mengisi deadline saat menambahkan tugas! 📅</p>';
      }
      const nearest = withDeadline[0];
      const daysLeft = Math.ceil((new Date(nearest.deadline + 'T00:00:00') - new Date()) / 86400000);
      const urgency  = daysLeft <= 1 ? '🚨 Sangat mendesak!' : daysLeft <= 3 ? '⚠️ Segera kerjakan!' : '📌 Perhatikan jadwalmu.';
      return `<p><strong>${urgency}</strong> Berikut tugas dengan deadline terdekat:</p>
              ${taskListHTML(withDeadline, '')}`;
    }

    // ── Tugas yang belum selesai ──
    case 'pending': {
      const pending = tasks.filter(t => !t.done);
      return `<p>Kamu memiliki <strong>${pending.length}</strong> tugas yang belum selesai.</p>
              ${taskListHTML(pending.slice(0, 6), 'Semua tugas sudah selesai! 🎉')}
              ${pending.length > 6 ? `<p class="mt-1 text-xs opacity-70">...dan ${pending.length - 6} tugas lainnya.</p>` : ''}`;
    }

    // ── Tugas yang sudah selesai ──
    case 'done': {
      const done = tasks.filter(t => t.done);
      if (!done.length) return '<p>Belum ada tugas yang selesai. Yuk mulai kerjakan tugasmu! 💪</p>';
      return `<p>Kamu sudah menyelesaikan <strong>${done.length}</strong> tugas. Luar biasa! 🎉</p>
              ${taskListHTML(done.slice(0, 5), '')}`;
    }

    // ── Ringkasan progres ──
    case 'progress': {
      const total   = tasks.length;
      const done    = tasks.filter(t => t.done).length;
      const pending = total - done;
      const pct     = total === 0 ? 0 : Math.round((done / total) * 100);
      const emoji   = pct === 100 ? '🏆' : pct >= 75 ? '🔥' : pct >= 50 ? '👍' : pct >= 25 ? '📈' : '🚀';
      return `<p>${emoji} Ini ringkasan progres belajarmu:</p>
              <ul class="assistant-task-list">
                <li>📋 Total tugas: <strong>${total}</strong></li>
                <li class="pri-low">✅ Selesai: <strong>${done}</strong></li>
                <li class="pri-high">⏳ Belum selesai: <strong>${pending}</strong></li>
                <li class="pri-medium">📊 Persentase progres: <strong>${pct}%</strong></li>
              </ul>
              ${pct === 100 ? '<p class="mt-2">Semua tugas selesai! Kamu luar biasa! 🏆</p>' : ''}`;
    }

    // ── Jadwal hari ini ──
    case 'schedule': {
      const todaySched = schedules
        .filter(s => s.date === today)
        .sort((a, b) => a.time.localeCompare(b.time));
      const todayTasks = tasks.filter(t => !t.done && t.deadline === today);

      let html = '';

      if (!todaySched.length && !todayTasks.length) {
        return '<p>Tidak ada jadwal atau tugas yang tercatat untuk hari ini. Ini saat yang tepat untuk belajar mandiri! 📚</p>';
      }

      if (todaySched.length) {
        const schedItems = todaySched.map(s =>
          `<li>⏰ ${s.time} — <strong>${escapeHtml(s.subject)}</strong>${s.note ? ` (${escapeHtml(s.note)})` : ''}</li>`
        ).join('');
        html += `<p><strong>Jadwal belajar hari ini:</strong></p><ul class="assistant-task-list">${schedItems}</ul>`;
      }

      if (todayTasks.length) {
        html += `<p class="mt-2"><strong>Tugas yang deadline-nya hari ini:</strong></p>
                 ${taskListHTML(todayTasks, '')}`;
      }

      if (!todaySched.length) {
        html += '<p class="mt-2 text-xs opacity-70">Belum ada jadwal kuliah untuk hari ini.</p>';
      }

      return html;
    }

    // ── Motivasi ──
    case 'motivation': {
      const quote = MOTIVASI[Math.floor(Math.random() * MOTIVASI.length)];
      const pending = tasks.filter(t => !t.done).length;
      return `<p class="text-base">💬 <em>"${quote}"</em></p>
              ${pending > 0
                ? `<p class="mt-2">Kamu masih punya <strong>${pending}</strong> tugas — satu langkah kecil sekarang bisa membuat perbedaan besar! 🎯</p>`
                : '<p class="mt-2">Dan kamu sudah menyelesaikan semua tugasmu — kamu memang luar biasa! 🏆</p>'}`;
    }

    // ── Semua tugas ──
    case 'list_all': {
      if (!tasks.length) return '<p>Belum ada tugas yang tersimpan. Tambahkan tugas di menu Manajemen Tugas! ✅</p>';
      return `<p>Ini semua tugas yang ada (${tasks.length} tugas):</p>
              ${taskListHTML(tasks.slice(0, 8), '')}
              ${tasks.length > 8 ? `<p class="mt-1 text-xs opacity-70">...dan ${tasks.length - 8} tugas lainnya. Gunakan filter di menu Tugas untuk melihat semua.</p>` : ''}`;
    }

    // ── Prioritas tinggi ──
    case 'high_prio': {
      const high = tasks.filter(t => t.priority === 'high' && !t.done);
      if (!high.length) return '<p>Tidak ada tugas prioritas tinggi yang belum selesai. 🎉</p>';
      return `<p>Kamu memiliki <strong>${high.length}</strong> tugas prioritas tinggi yang belum selesai:</p>
              ${taskListHTML(high, '')}`;
    }

    // ── Help ──
    case 'help': {
      return `<p>Ini yang bisa saya bantu:</p>
              <ul class="assistant-task-list">
                <li>📋 <strong>Prioritas tugas</strong> — tanyakan: "Tugas apa yang harus saya kerjakan dulu?"</li>
                <li>📅 <strong>Deadline terdekat</strong> — tanyakan: "Tugas mana yang deadlinenya paling dekat?"</li>
                <li>📊 <strong>Ringkasan progres</strong> — tanyakan: "Berapa persen progres saya?"</li>
                <li>🗓️ <strong>Jadwal hari ini</strong> — tanyakan: "Jadwal belajar hari ini apa?"</li>
                <li>💪 <strong>Motivasi</strong> — tanyakan: "Berikan saya motivasi!"</li>
                <li>📝 <strong>Daftar tugas</strong> — tanyakan: "Tampilkan semua tugas saya."</li>
              </ul>`;
    }

    // ── Unknown / fallback ──
    default: {
      const pending = tasks.filter(t => !t.done).length;
      return `<p>Maaf, saya kurang memahami pertanyaanmu. 🤔</p>
              <p>Coba gunakan kata kunci seperti <em>prioritas</em>, <em>deadline</em>, <em>progres</em>, <em>jadwal</em>, atau <em>motivasi</em>.</p>
              ${pending > 0 ? `<p class="mt-1">FYI: Kamu masih punya <strong>${pending}</strong> tugas yang menunggu! 📋</p>` : ''}`;
    }
  }
}

// ── Chat UI helpers ────────────────────────────────────────────

/**
 * Tambahkan gelembung chat ke area pesan.
 * @param {'user'|'assistant'} role
 * @param {string}             html  - Konten HTML bubble
 */
function appendBubble(role, html) {
  const container = document.getElementById('chatMessages');
  const wrap = document.createElement('div');
  wrap.className = `chat-bubble-wrap ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'chat-avatar';
  avatar.textContent = role === 'user' ? '🧑' : '🤖';

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role === 'user' ? 'user-bubble' : 'assistant-bubble'}`;
  bubble.innerHTML = html;

  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  container.appendChild(wrap);

  // Auto-scroll ke bawah
  container.scrollTop = container.scrollHeight;
  return wrap;
}

/**
 * Tampilkan animasi "mengetik" sementara asisten memproses.
 * Mengembalikan fungsi untuk menghapusnya.
 */
function showTypingIndicator() {
  const container = document.getElementById('chatMessages');
  const wrap = document.createElement('div');
  wrap.className = 'chat-bubble-wrap assistant';
  wrap.id = 'typingWrap';
  wrap.innerHTML = `
    <div class="chat-avatar">🤖</div>
    <div class="typing-indicator">
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    </div>`;
  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;
  return () => wrap.remove();
}

/**
 * Kirim pesan dari input textarea utama.
 */
function sendChat() {
  const input = document.getElementById('chatInput');
  const text  = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';
  _processChat(text);
}

/**
 * Kirim pesan dari chip cepat.
 * @param {string} text
 */
function sendQuick(text) {
  _processChat(text);
}

/**
 * Core: tampilkan pesan user → typing → reply asisten.
 * @param {string} text
 */
function _processChat(text) {
  // Tampilkan pesan user
  appendBubble('user', `<p>${escapeHtml(text)}</p>`);

  // Nonaktifkan input sementara
  document.getElementById('chatSendBtn').disabled = true;

  // Tampilkan typing indicator
  const removeTyping = showTypingIndicator();

  // Simulasi jeda berpikir (300–700ms) lalu tampilkan jawaban
  const delay = 300 + Math.random() * 400;
  setTimeout(() => {
    removeTyping();
    const reply = generateAssistantReply(text);
    appendBubble('assistant', reply);
    document.getElementById('chatSendBtn').disabled = false;
  }, delay);
}

// ── Wire up Enter key on chat input ───────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const ci = document.getElementById('chatInput');
  if (!ci) return;
  ci.addEventListener('keydown', e => {
    // Enter tanpa Shift → kirim
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  });
  // Auto-grow textarea height
  ci.addEventListener('input', () => {
    ci.style.height = 'auto';
    ci.style.height = Math.min(ci.scrollHeight, 120) + 'px';
  });
});
