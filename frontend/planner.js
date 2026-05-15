/* ============================================================
   planner.js — Deadline Planner page
   ============================================================ */

const PlannerPage = (() => {
  let currentView  = 'month';
  let currentDate  = new Date();
  let currentMonth = currentDate.getMonth();
  let currentYear  = currentDate.getFullYear();

  const MONTHS     = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
  const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  // ── Storage ────────────────────────────────────────────────

  function getDeadlines() {
    try { return JSON.parse(localStorage.getItem('learnora_deadlines') || '[]'); }
    catch { return []; }
  }

  function saveDeadlines(deadlines) {
    localStorage.setItem('learnora_deadlines', JSON.stringify(deadlines));
    MiniCalendar.refresh();
  }

  // ── Add ────────────────────────────────────────────────────

  function addDeadline() {
    const topic    = document.getElementById('deadlineTopic')?.value.trim();
    const date     = document.getElementById('deadlineDate')?.value;
    const time     = document.getElementById('deadlineTime')?.value || '';   // optional
    const priority = document.getElementById('deadlinePriority')?.value;

    if (!topic || !date) {
      alert('Please fill in the topic and date.');
      return;
    }

    const deadlines = getDeadlines();
    deadlines.push({ id: Date.now(), topic, date, time, priority, done: false });
    saveDeadlines(deadlines);

    document.getElementById('deadlineTopic').value = '';
    document.getElementById('deadlineDate').value  = '';
    document.getElementById('deadlineTime').value  = '';

    renderCalendar();
    renderDeadlineList();
  }

  // ── Delete ─────────────────────────────────────────────────

  function deleteDeadline(id) {
    saveDeadlines(getDeadlines().filter(d => d.id !== id));
    renderCalendar();
    renderDeadlineList();
  }

  // ── Mark as done ───────────────────────────────────────────

  function markDone(id) {
    const deadlines = getDeadlines().map(d =>
      d.id === id ? { ...d, done: true } : d
    );
    saveDeadlines(deadlines);
    // Record activity for leaderboard
    if (window.UserStats) UserStats.recordDeadlineDone();
    renderCalendar();
    renderDeadlineList();
  }

  // ── Edit modal ─────────────────────────────────────────────

  function openEditModal(id) {
    const d = getDeadlines().find(dl => dl.id === id);
    if (!d) return;

    const modal = document.getElementById('deadlineEditModal');
    if (!modal) return;

    document.getElementById('editDeadlineId').value       = id;
    document.getElementById('editDeadlineTopic').value    = d.topic;
    document.getElementById('editDeadlineDate').value     = d.date;
    document.getElementById('editDeadlineTime').value     = d.time || '';
    document.getElementById('editDeadlinePriority').value = d.priority;

    modal.classList.add('open');
    document.getElementById('editDeadlineTopic')?.focus();
  }

  function closeEditModal() {
    document.getElementById('deadlineEditModal')?.classList.remove('open');
  }

  function saveEdit() {
    const id       = parseInt(document.getElementById('editDeadlineId')?.value, 10);
    const topic    = document.getElementById('editDeadlineTopic')?.value.trim();
    const date     = document.getElementById('editDeadlineDate')?.value;
    const time     = document.getElementById('editDeadlineTime')?.value || '';
    const priority = document.getElementById('editDeadlinePriority')?.value;

    if (!topic || !date) {
      alert('Please fill in the topic and date.');
      return;
    }

    const deadlines = getDeadlines().map(d =>
      d.id === id ? { ...d, topic, date, time, priority } : d
    );
    saveDeadlines(deadlines);
    closeEditModal();
    renderCalendar();
    renderDeadlineList();
  }

  // ── Calendar helpers ───────────────────────────────────────

  function setView(view) {
    currentView = view;
    document.querySelectorAll('.view-toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    renderCalendar();
  }

  function prevPeriod() {
    if (currentView === 'month') {
      currentMonth--;
      if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    } else {
      currentDate.setDate(currentDate.getDate() - 7);
      currentMonth = currentDate.getMonth();
      currentYear  = currentDate.getFullYear();
    }
    updateCalTitle();
    renderCalendar();
  }

  function nextPeriod() {
    if (currentView === 'month') {
      currentMonth++;
      if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    } else {
      currentDate.setDate(currentDate.getDate() + 7);
      currentMonth = currentDate.getMonth();
      currentYear  = currentDate.getFullYear();
    }
    updateCalTitle();
    renderCalendar();
  }

  function updateCalTitle() {
    const el = document.getElementById('plannerCalTitle');
    if (!el) return;
    if (currentView === 'month') {
      el.textContent = `${MONTHS[currentMonth]} ${currentYear}`;
    } else {
      const ws  = getWeekStart(currentDate);
      const we  = new Date(ws); we.setDate(we.getDate() + 6);
      el.textContent = `${MONTHS[ws.getMonth()]} ${ws.getDate()} – ${we.getDate()}, ${ws.getFullYear()}`;
    }
  }

  function getWeekStart(date) {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }

  function renderCalendar() {
    const container = document.getElementById('plannerCalBody');
    if (!container) return;
    currentView === 'month' ? renderMonthView(container) : renderWeekView(container);
  }

  // Only active (not done) deadlines appear on the calendar
  function activeDeadlines() {
    return getDeadlines().filter(d => !d.done);
  }

  function formatTimeDisplay(time) {
    if (!time) return 'All day';
    const [h, m] = time.split(':').map(Number);
    const ampm   = h >= 12 ? 'PM' : 'AM';
    const hour   = h % 12 || 12;
    return `${hour}:${String(m).padStart(2,'0')} ${ampm}`;
  }

  function renderMonthView(container) {
    const deadlines  = activeDeadlines();
    const today      = new Date();
    const firstDay   = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth= new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrev = new Date(currentYear, currentMonth, 0).getDate();

    const dlMap = {};
    deadlines.forEach(d => {
      if (!dlMap[d.date]) dlMap[d.date] = [];
      dlMap[d.date].push(d);
    });

    const dayNamesHTML = DAYS_SHORT.map(d => `<span>${d}</span>`).join('');
    let daysHTML = '';

    for (let i = firstDay - 1; i >= 0; i--) {
      daysHTML += `<div class="planner-day-cell other-month"><div class="planner-day-num">${daysInPrev - i}</div></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr     = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isToday     = d === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
      const dayDeadlines= dlMap[dateStr] || [];

      const dotsHTML = dayDeadlines.slice(0, 3).map(dl => {
        const timeLabel = dl.time ? ` · ${formatTimeDisplay(dl.time)}` : '';
        return `<div class="deadline-dot ${dl.priority}" title="${dl.topic}${timeLabel}">${dl.topic.slice(0,10)}</div>`;
      }).join('');

      daysHTML += `
        <div class="planner-day-cell${isToday ? ' today' : ''}" id="pday-${dateStr}">
          <div class="planner-day-num">${d}</div>
          ${dotsHTML}
        </div>`;
    }

    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
    for (let d = 1; d <= totalCells - firstDay - daysInMonth; d++) {
      daysHTML += `<div class="planner-day-cell other-month"><div class="planner-day-num">${d}</div></div>`;
    }

    container.innerHTML = `
      <div class="planner-month-grid">
        <div class="planner-day-names">${dayNamesHTML}</div>
        <div class="planner-days-grid">${daysHTML}</div>
      </div>`;
  }

  function renderWeekView(container) {
    const deadlines = activeDeadlines();
    const today     = new Date();
    const weekStart = getWeekStart(currentDate);

    const dlMap = {};
    deadlines.forEach(d => {
      if (!dlMap[d.date]) dlMap[d.date] = [];
      dlMap[d.date].push(d);
    });

    let colsHTML = '';
    for (let i = 0; i < 7; i++) {
      const day     = new Date(weekStart); day.setDate(day.getDate() + i);
      const dateStr = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
      const isToday = day.toDateString() === today.toDateString();
      const dayDls  = dlMap[dateStr] || [];

      const dotsHTML = dayDls.map(dl => {
        const timeLabel = dl.time ? ` · ${formatTimeDisplay(dl.time)}` : '';
        return `<div class="deadline-dot ${dl.priority}" style="margin-bottom:4px;" title="${dl.topic}${timeLabel}">${dl.topic.slice(0,12)}</div>`;
      }).join('');

      colsHTML += `
        <div class="week-day-col${isToday ? ' today' : ''}">
          <div class="week-day-header">
            <div class="week-day-name">${DAYS_SHORT[day.getDay()]}</div>
            <div class="week-day-num">${day.getDate()}</div>
          </div>
          ${dotsHTML}
        </div>`;
    }

    container.innerHTML = `<div class="planner-week-grid">${colsHTML}</div>`;
  }

  // ── Deadline list ──────────────────────────────────────────

  function renderDeadlineList() {
    const container = document.getElementById('deadlineListContainer');
    if (!container) return;

    const all       = getDeadlines().sort((a, b) => new Date(a.date) - new Date(b.date));
    const active    = all.filter(d => !d.done);
    const completed = all.filter(d => d.done);

    if (active.length === 0 && completed.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px 0;">No deadlines yet. Add one above!</p>';
      return;
    }

    const renderItem = (d, isDone) => {
      const dateObj   = new Date(d.date + 'T00:00:00');
      const formatted = dateObj.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' });
      const timeStr   = d.time ? ` · ${formatTimeDisplay(d.time)}` : ' · All day';
      const doneClass = isDone ? ' deadline-item--done' : '';

      const actions = isDone
        ? `<button class="deadline-action-btn deadline-delete-btn" onclick="PlannerPage.deleteDeadline(${d.id})" title="Remove">✕</button>`
        : `
          <button class="deadline-action-btn deadline-edit-btn"  onclick="PlannerPage.openEditModal(${d.id})" title="Edit">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="deadline-action-btn deadline-done-btn"  onclick="PlannerPage.markDone(${d.id})" title="Mark as done">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </button>
          <button class="deadline-action-btn deadline-delete-btn" onclick="PlannerPage.deleteDeadline(${d.id})" title="Delete">✕</button>`;

      return `
        <div class="deadline-item${doneClass}">
          <div class="deadline-priority-bar ${d.priority}"></div>
          <div class="deadline-info">
            <div class="deadline-topic">${escapeHtml(d.topic)}</div>
            <div class="deadline-date">📅 ${formatted}${timeStr}</div>
          </div>
          <span class="deadline-badge ${d.priority}">${d.priority.charAt(0).toUpperCase() + d.priority.slice(1)}</span>
          <div class="deadline-actions">${actions}</div>
        </div>`;
    };

    let html = active.map(d => renderItem(d, false)).join('');

    if (completed.length > 0) {
      html += `
        <div class="completed-section-header">
          <span>✓ Completed (${completed.length})</span>
        </div>
        ${completed.map(d => renderItem(d, true)).join('')}`;
    }

    container.innerHTML = html;
  }

  function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Highlight ──────────────────────────────────────────────

  function highlightDate(dateStr) {
    const el = document.getElementById(`pday-${dateStr}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.outline = '2px solid var(--accent-primary)';
      setTimeout(() => { el.style.outline = ''; }, 2000);
    }
  }

  // ── Render page ────────────────────────────────────────────

  function render() {
    const page = document.getElementById('page-planner');
    if (!page) return;

    const today    = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    page.innerHTML = `
      <div class="planner-page">
        <div class="planner-page-header">
          <h1>📅 Deadline Planner</h1>
          <p>Track your submissions and stay ahead of deadlines.</p>
        </div>

        <div class="add-deadline-form">
          <h3>Add New Deadline</h3>
          <div class="form-row">
            <div class="form-group form-group--topic">
              <label class="form-label">Topic / Subject</label>
              <input type="text" class="form-input" id="deadlineTopic" placeholder="e.g. Math Assignment 3" />
            </div>
            <div class="form-group">
              <label class="form-label">Due Date</label>
              <input type="date" class="form-input form-input--datetime" id="deadlineDate" value="${todayStr}" />
            </div>
            <div class="form-group">
              <label class="form-label">Due Time <span class="form-label-optional">(optional)</span></label>
              <input type="time" class="form-input form-input--datetime" id="deadlineTime" />
            </div>
            <div class="form-group">
              <label class="form-label">Priority</label>
              <select class="form-select" id="deadlinePriority">
                <option value="low">🟢 Low</option>
                <option value="medium" selected>🟠 Medium</option>
                <option value="high">🔴 High</option>
              </select>
            </div>
            <div class="form-group form-group--btn">
              <label class="form-label">&nbsp;</label>
              <button class="add-btn" onclick="PlannerPage.addDeadline()">+ Add</button>
            </div>
          </div>
        </div>

        <div class="planner-calendar-section">
          <div class="planner-cal-header">
            <div class="planner-cal-title" id="plannerCalTitle">${MONTHS[currentMonth]} ${currentYear}</div>
            <div class="planner-cal-controls">
              <div class="priority-legend">
                <div class="legend-item"><div class="legend-dot low"></div> Low</div>
                <div class="legend-item"><div class="legend-dot medium"></div> Medium</div>
                <div class="legend-item"><div class="legend-dot high"></div> High</div>
              </div>
              <button class="planner-cal-nav" onclick="PlannerPage.prevPeriod()">‹</button>
              <button class="planner-cal-nav" onclick="PlannerPage.nextPeriod()">›</button>
              <div class="view-toggle">
                <button class="view-toggle-btn active" data-view="month" onclick="PlannerPage.setView('month')">Month</button>
                <button class="view-toggle-btn" data-view="week" onclick="PlannerPage.setView('week')">Week</button>
              </div>
            </div>
          </div>
          <div id="plannerCalBody"></div>
        </div>

        <div class="deadlines-list-section">
          <h3>All Deadlines</h3>
          <div class="deadline-list" id="deadlineListContainer"></div>
        </div>
      </div>

      <!-- Edit Deadline Modal -->
      <div class="deadline-edit-backdrop" id="deadlineEditModal">
        <div class="deadline-edit-modal" role="dialog" aria-modal="true" aria-labelledby="editModalTitle">
          <div class="deadline-edit-modal-header">
            <h3 id="editModalTitle">Edit Deadline</h3>
            <button class="deadline-edit-close" onclick="PlannerPage.closeEditModal()" aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="deadline-edit-modal-body">
            <input type="hidden" id="editDeadlineId" />
            <div class="form-group">
              <label class="form-label">Topic / Subject</label>
              <input type="text" class="form-input" id="editDeadlineTopic" placeholder="e.g. Math Assignment 3" />
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Due Date</label>
                <input type="date" class="form-input form-input--datetime" id="editDeadlineDate" />
              </div>
              <div class="form-group">
                <label class="form-label">Due Time <span class="form-label-optional">(optional)</span></label>
                <input type="time" class="form-input form-input--datetime" id="editDeadlineTime" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Priority</label>
              <select class="form-select" id="editDeadlinePriority">
                <option value="low">🟢 Low</option>
                <option value="medium">🟠 Medium</option>
                <option value="high">🔴 High</option>
              </select>
            </div>
          </div>
          <div class="deadline-edit-modal-footer">
            <button class="deadline-edit-btn-cancel" onclick="PlannerPage.closeEditModal()">Cancel</button>
            <button class="deadline-edit-btn-save"   onclick="PlannerPage.saveEdit()">Save Changes</button>
          </div>
        </div>
      </div>
    `;

    // Close edit modal on backdrop click
    document.getElementById('deadlineEditModal')?.addEventListener('click', e => {
      if (e.target.id === 'deadlineEditModal') closeEditModal();
    });

    // Close on Escape
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape') {
        const m = document.getElementById('deadlineEditModal');
        if (m?.classList.contains('open')) closeEditModal();
      }
    });

    renderCalendar();
    renderDeadlineList();
  }

  return {
    render,
    addDeadline,
    deleteDeadline,
    markDone,
    openEditModal,
    closeEditModal,
    saveEdit,
    setView,
    prevPeriod,
    nextPeriod,
    highlightDate,
  };
})();

