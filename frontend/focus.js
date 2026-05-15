/* ============================================================
   focus.js — Two-phase Focus + Break timer
              Customizable durations, persisted in localStorage
   ============================================================ */

const FocusTimer = (() => {

  // ── Storage keys & defaults ────────────────────────────────
  const KEY_FOCUS = 'learnora_focus_minutes';
  const KEY_BREAK = 'learnora_break_minutes';

  const DEFAULT_FOCUS = 25;
  const DEFAULT_BREAK = 5;
  const MIN_FOCUS = 1;
  const MAX_FOCUS = 180;
  const MIN_BREAK = 1;
  const MAX_BREAK = 30;

  // ── Phase enum ─────────────────────────────────────────────
  const PHASE = { FOCUS: 'focus', BREAK: 'break' };

  // ── Runtime state ──────────────────────────────────────────
  let focusMinutes = loadFocusMinutes();
  let breakMinutes = loadBreakMinutes();
  let phase        = PHASE.FOCUS;
  let totalSeconds = focusMinutes * 60;
  let remaining    = totalSeconds;
  let interval     = null;
  let running      = false;

  // ── Persistence ────────────────────────────────────────────

  function loadFocusMinutes() {
    const v = parseInt(localStorage.getItem(KEY_FOCUS), 10);
    return (v >= MIN_FOCUS && v <= MAX_FOCUS) ? v : DEFAULT_FOCUS;
  }

  function loadBreakMinutes() {
    const v = parseInt(localStorage.getItem(KEY_BREAK), 10);
    return (v >= MIN_BREAK && v <= MAX_BREAK) ? v : DEFAULT_BREAK;
  }

  function persist() {
    localStorage.setItem(KEY_FOCUS, String(focusMinutes));
    localStorage.setItem(KEY_BREAK, String(breakMinutes));
  }

  // ── Display helpers ────────────────────────────────────────

  function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function updateDisplay() {
    const el = document.getElementById('focusDisplay');
    if (el) el.textContent = formatTime(remaining);
  }

  function setPhaseUI(p) {
    phase = p;
    const timerEl  = document.querySelector('.focus-timer');
    const iconEl   = document.querySelector('.focus-icon');
    const labelEl  = document.getElementById('focusPhaseLabel');

    if (p === PHASE.BREAK) {
      timerEl?.classList.add('break-mode');
      if (iconEl)  iconEl.textContent  = '☕';
      if (labelEl) labelEl.textContent = 'Break Time';
    } else {
      timerEl?.classList.remove('break-mode');
      if (iconEl)  iconEl.textContent  = '🎯';
      if (labelEl) labelEl.textContent = 'Focus Session';
    }
  }

  function resetStartBtn(label = 'Start') {
    const btn = document.getElementById('focusStart');
    if (btn) { btn.textContent = label; btn.classList.remove('running'); }
  }

  // ── Timer core ─────────────────────────────────────────────

  function start() {
    if (running) {
      // Pause
      clearInterval(interval);
      interval = null;
      running  = false;
      resetStartBtn('Resume');
      return;
    }

    running = true;
    const btn = document.getElementById('focusStart');
    if (btn) { btn.textContent = 'Pause'; btn.classList.add('running'); }

    interval = setInterval(() => {
      remaining--;
      updateDisplay();

      if (remaining <= 0) {
        clearInterval(interval);
        interval  = null;
        running   = false;
        remaining = 0;
        updateDisplay();

        if (phase === PHASE.FOCUS) {
          onFocusComplete();
        } else {
          onBreakComplete();
        }
      }
    }, 1000);
  }

  function reset() {
    clearInterval(interval);
    interval  = null;
    running   = false;

    // Always reset to the start of the focus phase
    setPhaseUI(PHASE.FOCUS);
    totalSeconds = focusMinutes * 60;
    remaining    = totalSeconds;
    updateDisplay();
    resetStartBtn('Start');
  }

  // ── Phase transitions ──────────────────────────────────────

  function onFocusComplete() {
    resetStartBtn('Start');

    // Record activity for leaderboard
    if (window.UserStats) UserStats.recordFocusSession();

    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Learnora — Focus complete! 🎉', {
        body: `Great work! Starting your ${breakMinutes}-minute break.`,
      });
    }

    // Flash green briefly
    const display = document.getElementById('focusDisplay');
    if (display) {
      display.style.color = '#10b981';
      setTimeout(() => { display.style.color = ''; }, 1800);
    }

    // Auto-start break after a short pause so the user sees the flash
    setTimeout(() => {
      setPhaseUI(PHASE.BREAK);
      totalSeconds = breakMinutes * 60;
      remaining    = totalSeconds;
      updateDisplay();
      start(); // auto-start break
    }, 2000);
  }

  function onBreakComplete() {
    resetStartBtn('Start');

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Learnora — Break over! ⚡', {
        body: 'Ready for another focus session?',
      });
    }

    // Flash teal briefly then return to focus phase (idle, not auto-started)
    const display = document.getElementById('focusDisplay');
    if (display) {
      display.style.color = '#2dd4bf';
      setTimeout(() => { display.style.color = ''; }, 1800);
    }

    setTimeout(() => {
      setPhaseUI(PHASE.FOCUS);
      totalSeconds = focusMinutes * 60;
      remaining    = totalSeconds;
      updateDisplay();
      // Do NOT auto-start — user decides when to begin the next focus session
    }, 2000);
  }

  // ── Apply new durations (called after modal save) ──────────

  function applyDurations(fMins, bMins) {
    clearInterval(interval);
    interval  = null;
    running   = false;

    focusMinutes = fMins;
    breakMinutes = bMins;

    // Always reset to focus phase with new duration
    setPhaseUI(PHASE.FOCUS);
    totalSeconds = focusMinutes * 60;
    remaining    = totalSeconds;
    updateDisplay();
    resetStartBtn('Start');
  }

  // ── Modal ──────────────────────────────────────────────────

  function openModal() {
    const backdrop  = document.getElementById('focusModalBackdrop');
    const focusInp  = document.getElementById('focusMinutesInput');
    const breakInp  = document.getElementById('breakMinutesInput');
    if (!backdrop) return;

    // Always pre-fill with current values so fields are never empty
    if (focusInp) focusInp.value = focusMinutes;
    if (breakInp) breakInp.value = breakMinutes;

    // Clear any previous error states
    clearFieldError('focusMinutesInput');
    clearFieldError('breakMinutesInput');

    backdrop.classList.add('open');
    backdrop.setAttribute('aria-hidden', 'false');
    setTimeout(() => focusInp?.focus(), 80);
  }

  function closeModal() {
    const backdrop = document.getElementById('focusModalBackdrop');
    if (!backdrop) return;
    backdrop.classList.remove('open');
    backdrop.setAttribute('aria-hidden', 'true');
  }

  function saveModal() {
    const focusInp = document.getElementById('focusMinutesInput');
    const breakInp = document.getElementById('breakMinutesInput');
    if (!focusInp || !breakInp) return;

    // Parse values — fall back to defaults if empty or out of range
    let fMins = parseInt(focusInp.value, 10);
    let bMins = parseInt(breakInp.value, 10);

    if (!fMins || fMins < MIN_FOCUS || fMins > MAX_FOCUS) fMins = DEFAULT_FOCUS;
    if (!bMins || bMins < MIN_BREAK || bMins > MAX_BREAK) bMins = DEFAULT_BREAK;

    // Reflect the resolved values back into the inputs before closing
    focusInp.value = fMins;
    breakInp.value = bMins;

    // Clear any stale error states
    clearFieldError('focusMinutesInput');
    clearFieldError('breakMinutesInput');

    persist();
    applyDurations(fMins, bMins);
    closeModal();
  }

  // ── Field helpers ──────────────────────────────────────────

  function clearFieldError(inputId) {
    const inp = document.getElementById(inputId);
    if (!inp) return;
    inp.classList.remove('input-error');

    const hintId = inputId === 'focusMinutesInput' ? 'focusMinutesHint' : 'breakMinutesHint';
    const hint   = document.getElementById(hintId);
    if (hint) {
      hint.classList.remove('hint-error');
      hint.textContent = inputId === 'focusMinutesInput'
        ? 'How long to focus before a break (1–180 min).'
        : 'Break length after each focus session (1–30 min).';
    }
  }

  // ── Init ───────────────────────────────────────────────────

  function init() {
    updateDisplay();

    // Backdrop click → close
    const backdrop = document.getElementById('focusModalBackdrop');
    if (backdrop) {
      backdrop.addEventListener('click', e => {
        if (e.target === backdrop) closeModal();
      });
    }

    // Escape → close
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        const bd = document.getElementById('focusModalBackdrop');
        if (bd?.classList.contains('open')) closeModal();
      }
    });

    // Enter in either input → save
    ['focusMinutesInput', 'breakMinutesInput'].forEach(id => {
      document.getElementById(id)?.addEventListener('keydown', e => {
        if (e.key === 'Enter') saveModal();
      });
    });
  }

  // ── Public surface ─────────────────────────────────────────
  return {
    init,
    start,
    reset,
    openModal,
    closeModal,
    saveModal,
    clearFieldError,
  };
})();

// Global wrappers called from HTML onclick attributes
function startFocus() { FocusTimer.start(); }
function resetFocus() { FocusTimer.reset(); }
