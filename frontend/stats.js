/* ============================================================
   stats.js — User activity stats for leaderboard sync
   Tracks: focus sessions, deadlines done, group events done.
   Persists in localStorage under 'learnora_user_stats'.
   ============================================================ */

const UserStats = (() => {
  const KEY = 'learnora_user_stats';

  // ── Defaults ───────────────────────────────────────────────
  const DEFAULTS = {
    points:        0,
    streakDays:    0,
    lastActiveDate: '',   // YYYY-MM-DD of last activity
    focusSessions: 0,
    deadlinesDone: 0,
    groupEvents:   0,
  };

  // Point values per activity
  const PTS = {
    focusSession: 50,   // per completed focus session
    deadline:     100,  // per deadline marked done
    groupEvent:   75,   // per group event marked done
  };

  // ── Storage ────────────────────────────────────────────────

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
    } catch { return { ...DEFAULTS }; }
  }

  function save(stats) {
    localStorage.setItem(KEY, JSON.stringify(stats));
  }

  // ── Streak logic ───────────────────────────────────────────

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function daysBetween(a, b) {
    // a, b are YYYY-MM-DD strings
    const msA = new Date(a + 'T00:00:00').getTime();
    const msB = new Date(b + 'T00:00:00').getTime();
    return Math.round(Math.abs(msB - msA) / 86400000);
  }

  /**
   * Updates streak based on today's date vs last active date.
   * - Same day  → no change
   * - Yesterday → streak + 1
   * - Older     → streak resets to 1
   */
  function updateStreak(stats) {
    const today = todayStr();
    if (stats.lastActiveDate === today) return stats; // already counted today

    if (stats.lastActiveDate) {
      const gap = daysBetween(stats.lastActiveDate, today);
      stats.streakDays = gap === 1 ? stats.streakDays + 1 : 1;
    } else {
      stats.streakDays = 1;
    }
    stats.lastActiveDate = today;
    return stats;
  }

  // ── Public activity recorders ──────────────────────────────

  function recordFocusSession() {
    let s = load();
    s = updateStreak(s);
    s.points        += PTS.focusSession;
    s.focusSessions += 1;
    save(s);
    _notifyLeaderboard();
  }

  function recordDeadlineDone() {
    let s = load();
    s = updateStreak(s);
    s.points        += PTS.deadline;
    s.deadlinesDone += 1;
    save(s);
    _notifyLeaderboard();
  }

  function recordGroupEvent() {
    let s = load();
    s = updateStreak(s);
    s.points      += PTS.groupEvent;
    s.groupEvents += 1;
    save(s);
    _notifyLeaderboard();
  }

  function getStats() {
    return load();
  }

  /** Formats streak for display: "N day streak" */
  function streakLabel(stats) {
    const n = stats.streakDays || 0;
    return n === 0 ? '0 day streak' : `${n} day streak`;
  }

  /**
   * Refreshes the leaderboard wherever it is visible.
   * Called after any activity is recorded or profile is saved.
   */
  function _notifyLeaderboard() {
    const tab = document.getElementById('hub-tab-leaderboard');
    if (!tab) return;
    // Always re-render the HTML so it's fresh next time the tab is opened
    if (window.HubPage) {
      tab.innerHTML = HubPage.buildLeaderboardHTML();
    }
  }

  /** Public alias — called by profile.js after saving */
  function refreshLeaderboard() {
    _notifyLeaderboard();
  }

  return {
    recordFocusSession,
    recordDeadlineDone,
    recordGroupEvent,
    getStats,
    streakLabel,
    refreshLeaderboard,
  };
})();
