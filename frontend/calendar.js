/* ============================================================
   calendar.js — Mini sidebar calendar with deadline markers
                 and rich hover tooltips
   ============================================================ */

const MiniCalendar = (() => {
  let currentDate  = new Date();
  let currentMonth = currentDate.getMonth();
  let currentYear  = currentDate.getFullYear();

  const MONTHS = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  // ── Data helpers ───────────────────────────────────────────

  function getDeadlines() {
    try {
      return JSON.parse(localStorage.getItem('learnora_deadlines') || '[]');
    } catch { return []; }
  }

  function getGroupEvents() {
    try {
      return JSON.parse(localStorage.getItem('learnora_group_events') || '[]');
    } catch { return []; }
  }

  /**
   * Returns a map of { dateStr -> [{ topic, priority, time, isGroup, group }, ...] }
   * Active personal deadlines use priority colours.
   * Active group events use priority 'group' (blue dot).
   */
  function buildDeadlineMap() {
    const map = {};

    // Personal deadlines (active only)
    getDeadlines().filter(d => !d.done).forEach(d => {
      if (!map[d.date]) map[d.date] = [];
      map[d.date].push({ topic: d.topic, priority: d.priority, time: d.time || '', isGroup: false });
    });

    // Group events (active only)
    getGroupEvents().filter(e => !e.done).forEach(e => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push({ topic: e.title, priority: 'group', time: e.time || '', isGroup: true, group: e.group });
    });

    return map;
  }

  /**
   * Returns the highest priority string for a date's item list.
   * 'group' items use a blue dot and rank between medium and high.
   */
  function highestPriority(list) {
    const rank = { low: 1, medium: 2, group: 2.5, high: 3 };
    return list.reduce((best, d) =>
      (rank[d.priority] || 0) > (rank[best] || 0) ? d.priority : best
    , 'low');
  }

  /**
   * Builds the tooltip text for a date.
   * Format per line: "Topic — Medium Priority"
   * Multiple deadlines are separated by newlines.
   */
  function buildTooltipText(list) {
    return list.map(d => {
      const label = d.priority.charAt(0).toUpperCase() + d.priority.slice(1);
      return `${d.topic} — ${label} Priority`;
    }).join('\n');
  }

  // ── Tooltip DOM ────────────────────────────────────────────

  let tooltipEl = null;
  let hideTimer  = null;

  function ensureTooltip() {
    if (tooltipEl) return tooltipEl;
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'cal-tooltip';
    tooltipEl.setAttribute('role', 'tooltip');
    tooltipEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tooltipEl);
    return tooltipEl;
  }

  function showTooltip(dayEl, lines) {
    clearTimeout(hideTimer);
    const tip = ensureTooltip();

    // Build inner HTML — one row per item with a priority/group dot
    tip.innerHTML = lines.map(line => {
      if (line.startsWith('GROUP:')) {
        // Group event: blue dot, format "Title — Group (— time)"
        const text = line.slice(6); // strip prefix
        return `<div class="cal-tooltip-row">
          <span class="cal-tooltip-dot cal-tooltip-dot--group"></span>
          <span class="cal-tooltip-text">${escapeHtml(text)}</span>
        </div>`;
      }
      // Personal deadline
      const match    = line.match(/^(.+) — (Low|Medium|High) Priority(?: — (.+))?$/);
      const priority = match ? match[2].toLowerCase() : 'low';
      const timeStr  = match?.[3] ? ` <span class="cal-tooltip-time">${escapeHtml(match[3])}</span>` : '';
      const topicAndPriority = match
        ? `${escapeHtml(match[1])} — ${escapeHtml(match[2])} Priority`
        : escapeHtml(line);
      return `<div class="cal-tooltip-row">
        <span class="cal-tooltip-dot cal-tooltip-dot--${priority}"></span>
        <span class="cal-tooltip-text">${topicAndPriority}${timeStr}</span>
      </div>`;
    }).join('');

    tip.style.display = 'block';
    tip.setAttribute('aria-hidden', 'false');

    // Position: above the day cell, centred
    positionTooltip(dayEl, tip);
  }

  function positionTooltip(anchor, tip) {
    // Temporarily make visible but off-screen to measure
    tip.style.visibility = 'hidden';
    tip.style.left = '0px';
    tip.style.top  = '0px';

    const aRect = anchor.getBoundingClientRect();
    const tRect = tip.getBoundingClientRect();
    const gap   = 6;

    let left = aRect.left + aRect.width / 2 - tRect.width / 2;
    let top  = aRect.top - tRect.height - gap + window.scrollY;

    // Clamp horizontally so it doesn't bleed off-screen
    const margin = 8;
    left = Math.max(margin, Math.min(left, window.innerWidth - tRect.width - margin));

    // If it would go above the viewport, flip below
    if (top < window.scrollY + margin) {
      top = aRect.bottom + gap + window.scrollY;
    }

    tip.style.left       = `${left}px`;
    tip.style.top        = `${top}px`;
    tip.style.visibility = 'visible';
  }

  function hideTooltip() {
    hideTimer = setTimeout(() => {
      if (tooltipEl) {
        tooltipEl.style.display = 'none';
        tooltipEl.setAttribute('aria-hidden', 'true');
      }
    }, 80); // small delay prevents flicker when moving between cells
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Render ─────────────────────────────────────────────────

  function render() {
    const label         = document.getElementById('calMonthLabel');
    const daysContainer = document.getElementById('calDays');
    if (!label || !daysContainer) return;

    label.textContent = `${MONTHS[currentMonth].slice(0, 3)} ${currentYear}`;

    const firstDay    = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrev  = new Date(currentYear, currentMonth, 0).getDate();
    const today       = new Date();
    const dlMap       = buildDeadlineMap();

    let html = '';

    // Previous-month padding cells
    for (let i = firstDay - 1; i >= 0; i--) {
      html += `<div class="cal-day other-month">${daysInPrev - i}</div>`;
    }

    // Current-month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = d === today.getDate()
                   && currentMonth === today.getMonth()
                   && currentYear  === today.getFullYear();

      const deadlines = dlMap[dateStr];
      let classes = 'cal-day';
      if (isToday)    classes += ' today';

      let tooltipAttr = '';
      if (deadlines && deadlines.length > 0) {
        const top = highestPriority(deadlines);
        classes += ` has-deadline priority-${top}`;
        const lines = deadlines.map(dl => {
          if (dl.isGroup) {
            // Group event: "Title — Group" (+ time if set)
            const timeStr = dl.time ? (() => {
              const [h, m] = dl.time.split(':').map(Number);
              const ampm = h >= 12 ? 'PM' : 'AM';
              return ` — ${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`;
            })() : '';
            return `GROUP:${dl.topic} — ${dl.group}${timeStr}`;
          }
          // Personal deadline
          const priorityLabel = dl.priority.charAt(0).toUpperCase() + dl.priority.slice(1);
          if (dl.time) {
            const [h, m] = dl.time.split(':').map(Number);
            const ampm   = h >= 12 ? 'PM' : 'AM';
            const hour   = h % 12 || 12;
            const timeStr = `${hour}:${String(m).padStart(2,'0')} ${ampm}`;
            return `${dl.topic} — ${priorityLabel} Priority — ${timeStr}`;
          }
          return `${dl.topic} — ${priorityLabel} Priority`;
        });
        tooltipAttr = `data-cal-tooltip='${JSON.stringify(lines)}'`;
      }

      html += `<div class="${classes}" ${tooltipAttr}
                    onclick="MiniCalendar.selectDate('${dateStr}')">${d}</div>`;
    }

    // Next-month padding cells
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
    const remaining  = totalCells - firstDay - daysInMonth;
    for (let d = 1; d <= remaining; d++) {
      html += `<div class="cal-day other-month">${d}</div>`;
    }

    daysContainer.innerHTML = html;

    // Attach tooltip listeners to days that have deadlines
    daysContainer.querySelectorAll('[data-cal-tooltip]').forEach(el => {
      el.addEventListener('mouseenter', () => {
        try {
          const lines = JSON.parse(el.dataset.calTooltip);
          showTooltip(el, lines);
        } catch (_) {}
      });
      el.addEventListener('mouseleave', hideTooltip);
      // Also hide on click (navigates away)
      el.addEventListener('click', () => {
        if (tooltipEl) tooltipEl.style.display = 'none';
      });
    });
  }

  // ── Navigation ─────────────────────────────────────────────

  function prevMonth() {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    render();
  }

  function nextMonth() {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    render();
  }

  function selectDate(dateStr) {
    navigateTo('planner');
    setTimeout(() => {
      if (window.PlannerPage && PlannerPage.highlightDate) {
        PlannerPage.highlightDate(dateStr);
      }
    }, 100);
  }

  function refresh() { render(); }

  function init() {
    document.getElementById('calPrev')?.addEventListener('click', prevMonth);
    document.getElementById('calNext')?.addEventListener('click', nextMonth);
    render();
  }

  return { init, render, refresh, prevMonth, nextMonth, selectDate };
})();
