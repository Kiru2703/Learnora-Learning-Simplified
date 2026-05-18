/* ============================================================
   app.js — Main application controller
   ============================================================ */

// ── App Theme — runs immediately to avoid flash of wrong theme ─
const AppTheme = (() => {
  const KEY = 'learnora_theme';

  function get() {
    return localStorage.getItem(KEY) || 'dark';
  }

  function apply(theme) {
    // 1. Set/remove the data-theme attribute on <html>
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    // 2. Persist
    localStorage.setItem(KEY, theme);

    // 3. Sync radio inputs
    const darkRadio  = document.getElementById('themeRadioDark');
    const lightRadio = document.getElementById('themeRadioLight');
    if (darkRadio)  darkRadio.checked  = (theme === 'dark');
    if (lightRadio) lightRadio.checked = (theme === 'light');

    // 4. Sync selected class on the label cards
    const darkCard  = document.getElementById('themeOptDark');
    const lightCard = document.getElementById('themeOptLight');
    if (darkCard)  darkCard.classList.toggle('selected',  theme === 'dark');
    if (lightCard) lightCard.classList.toggle('selected', theme === 'light');
  }

  function toggle(theme) {
    apply(theme);
  }

  // Apply immediately on script load — before DOM is fully ready —
  // so there is never a flash of the wrong theme.
  apply(get());

  return { get, apply, toggle };
})();

// ── Page routing ──────────────────────────────────────────────
const PAGES = ['chat', 'exam', 'planner', 'hub', 'profile'];
let currentPage = 'chat';

function navigateTo(page) {
  if (!PAGES.includes(page)) return;

  // Hide all pages
  PAGES.forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) el.classList.remove('active');
  });

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  // Show target page
  const target = document.getElementById(`page-${page}`);
  if (target) {
    target.classList.add('active');
    currentPage = page;
  }

  // Render page content if needed
  switch (page) {
    case 'exam':    ExamPage.render();    break;
    case 'planner': PlannerPage.render(); break;
    case 'hub':     HubPage.render();     break;
    case 'profile':
      ProfilePage.render();
      // Re-sync theme selector cards after the profile page re-renders
      AppTheme.apply(AppTheme.get());
      break;
    case 'chat': {
      // Clear messages for a fresh chat
      const cc = document.getElementById('chatContainer');
      const msgs = document.getElementById('chatMessages');
      if (cc && msgs) {
        msgs.innerHTML = '';
        cc.classList.remove('has-messages');
      }
      break;
    }
  }

  // Close mobile sidebar
  closeSidebar();
}

// ── Pathway viewer ────────────────────────────────────────────

// ── Pathway data — grouped by pathway ────────────────────────
// Using var so these are accessible from other scripts (chat.js) via window scope
var PATHWAYS = [];
// Pathways are dynamically generated when you upload notes or ask the chat.

// Track which pathway groups are open and which topic/pathway is active
const pathwayState = {
  openGroups:    new Set(),   // all collapsed by default
  activeTopic:   null,
  activePathway: null,        // which pathway roadmap is currently open
};

// Recent topics opened (most recent first, max 5)
const recentTopics = [];

function renderPathways() {
  const container = document.getElementById('pathwayList');
  if (!container) return;

  // Sidebar shows only pathway names — clicking opens the full roadmap screen
  const groupsHTML = PATHWAYS.map(pw => {
    // Highlight when this pathway's roadmap is open, OR when a topic inside it is open
    const isActive = pw.id === pathwayState.activePathway
                  || pw.topics.some(t => t.id === pathwayState.activeTopic);
    const doneCount = pw.topics.filter(t => t.status === 'Completed').length;
    const total     = pw.topics.length;
    return `
      <div class="pathway-group" id="pg-${pw.id}">
        <div class="pathway-group-header${isActive ? ' open' : ''}"
             onclick="openPathwayRoadmap('${pw.id}')"
             aria-label="Open ${pw.name} pathway"
             aria-current="${isActive ? 'page' : 'false'}">
          <span class="pathway-group-icon">${pw.icon}</span>
          <span class="pathway-group-name">${pw.name}</span>
          <span class="pathway-group-count">${doneCount}/${total}</span>
        </div>
      </div>`;
  }).join('');

  // Recent topics section
  let recentHTML = '';
  if (recentTopics.length > 0) {
    const items = recentTopics.map(r => `
      <div class="recent-topic-item" onclick="openPathway('${r.topicId}')">
        <span class="recent-topic-dot"></span>
        <div style="flex:1;min-width:0;">
          <span class="recent-topic-context">${r.pathwayName}</span>
          <span class="recent-topic-name">${r.topicTitle}</span>
        </div>
      </div>`).join('');
    recentHTML = `
      <div class="recent-chats-divider">Recent</div>
      ${items}`;
  }

  container.innerHTML = groupsHTML + recentHTML;
}
var PATHWAY_DATA = {};
// Topic content is generated dynamically by Bedrock when you open a topic.

function openPathway(id) {
  const data = PATHWAY_DATA[id];

  // ── Guard: block if topic is locked (cascaded check) ────
  const parentPathwayCheck = PATHWAYS.find(pw => pw.topics.some(t => t.id === id));
  if (parentPathwayCheck) {
    const topicIndex = parentPathwayCheck.topics.findIndex(t => t.id === id);
    // Walk back through all predecessors — if any is not Completed, this topic is locked
    for (let i = 0; i < topicIndex; i++) {
      if (parentPathwayCheck.topics[i].status !== 'Completed') return;
    }
  }

  // ── Update sidebar state ──────────────────────────────────
  pathwayState.activeTopic = id;

  const parentPathway = PATHWAYS.find(pw => pw.topics.some(t => t.id === id));
  if (parentPathway) {
    pathwayState.activePathway = parentPathway.id;
    pathwayState.openGroups.add(parentPathway.id);
    const topicData = parentPathway.topics.find(t => t.id === id);
    if (topicData) {
      const entry = { topicId: id, topicTitle: topicData.title, pathwayName: parentPathway.name };
      const existing = recentTopics.findIndex(r => r.topicId === id);
      if (existing !== -1) recentTopics.splice(existing, 1);
      recentTopics.unshift(entry);
      if (recentTopics.length > 5) recentTopics.pop();

      // Mark topic as In Progress if it was Not Started
      if (topicData.status === 'Not Started') {
        topicData.status = 'In Progress';
      }
    }
  }
  renderPathways();

  // ── Get or create the pathway page ───────────────────────
  let pathwayPage = document.getElementById('page-pathway');
  if (!pathwayPage) {
    pathwayPage = document.createElement('div');
    pathwayPage.id = 'page-pathway';
    pathwayPage.className = 'page';
    document.getElementById('mainContent').appendChild(pathwayPage);
    PAGES.push('pathway');
  }

  PAGES.forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) el.classList.remove('active');
  });
  pathwayPage.classList.add('active');
  currentPage = 'pathway';

  // ── Resolve metadata ──────────────────────────────────────
  const topicMeta  = parentPathway?.topics.find(t => t.id === id);
  const topicNum   = topicMeta?.num   || '';
  const topicTitle = data?.title      || topicMeta?.title || 'Topic';
  const topicSub   = data?.subtitle   || '';
  const progress   = data?.progress   ?? 0;
  const pathName   = parentPathway?.name || 'Pathway';
  const pathId     = parentPathway?.id   || '';

  // ── Render two-panel topic layout ─────────────────────────
  pathwayPage.innerHTML = `
    <div class="topic-page">

      <div class="topic-header">
        <div class="topic-header-left">
          <div class="topic-breadcrumb">
            <a onclick="openPathwayRoadmap('${pathId}')">← Back to ${pathName}</a>
            <span>/</span>
            <span>${topicNum}</span>
          </div>
          <div class="topic-title">${topicTitle}</div>
          <div class="topic-meta">
            <span class="topic-num-badge">${topicNum}</span>
            <span class="topic-subtitle">${topicSub}</span>
          </div>
        </div>
        <div class="topic-header-progress">
          <span class="topic-progress-label">Progress</span>
          <div class="topic-progress-row">
            <div class="topic-progress-bar">
              <div class="topic-progress-fill" id="topicProgressFill" style="width:${progress}%"></div>
            </div>
            <span class="topic-progress-pct" id="topicProgressPct">${progress}%</span>
          </div>
        </div>
      </div>

      <div class="topic-body">

        <div id="topicNotes">
          <div class="topic-notes-content" id="topicNotesContent">
            ${data && data.content ? data.content : '<div style="color:var(--text-muted);padding:2rem;text-align:center;"><p style="font-size:1.5rem;margin-bottom:0.5rem;">📝</p><p>Generating notes for this topic...</p><p style="font-size:0.85rem;opacity:0.7;">This may take a few seconds</p></div>'}
          </div>
        </div>

        <div id="topicQuickQuestion">
          <!-- Scrollable answers history -->
          <div id="quickQuestionAnswers">
            <div class="qq-empty-state" id="qqEmptyState">
              <span>💬</span>
              <span>Ask a doubt about this topic — I'll answer here.</span>
            </div>
          </div>

          <!-- Pinned input bar -->
          <div id="quickQuestionBar">
            <div class="qqbar-input-wrapper" id="qqbarInputWrapper">
              <textarea
                class="qqbar-input"
                id="qqbarInput"
                placeholder="Ask your doubt…"
                rows="1"
                onkeydown="DoubtsBar.handleKey(event)"
                oninput="DoubtsBar.autoResize(this)"
              ></textarea>
              <button
                class="qqbar-btn qqbar-mic"
                id="qqbarMicBtn"
                onclick="DoubtsBar.toggleMic()"
                title="Voice input"
                aria-label="Voice input"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              </button>
              <button
                class="qqbar-btn qqbar-send"
                onclick="DoubtsBar.send('${id}')"
                title="Send"
                aria-label="Send doubt"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
            <div class="qqbar-mic-status" id="qqbarMicStatus" style="display:none;">
              <span class="qqbar-mic-pulse"></span>
              <span id="qqbarMicText">Listening…</span>
            </div>
          </div>
        </div>

      </div>

      <div class="topic-footer">
        <button class="topic-nav-btn" onclick="openPathwayRoadmap('${pathId}')">
          ← Back to ${pathName}
        </button>
        <button class="topic-nav-btn primary" onclick="openTopicExam('${id}')">
          Practice with Exam Simulator →
        </button>
      </div>

    </div>
  `;

  // Init the doubts bar for this topic
  if (window.DoubtsBar) DoubtsBar.init(id);
  closeSidebar();

  // Auto-generate notes directly via fetch (bypasses any closure issues)
  if ((!data || !data.content) && window.LEARNORA_API_URL) {
    var _noteId = id;
    var _noteTitle = topicMeta?.title || topicTitle || 'Topic';
    var _notePw = parentPathway?.name || 'Pathway';
    var _noteSrc = parentPathway?.sourceTopic || null;
    var _notePromptText = _noteSrc
      ? 'Generate brief study notes for "' + _noteTitle + '" (part of a course on "' + _noteSrc + '"). Use HTML h2,p,ul,li,strong tags. 3-4 paragraphs. No markdown code fences. Raw HTML only.'
      : 'Generate brief study notes for "' + _noteTitle + '" (pathway: "' + _notePw + '"). Use HTML h2,p,ul,li,strong tags. 3-4 paragraphs. No markdown code fences. Raw HTML only.';

    fetch(window.LEARNORA_API_URL + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_id: 'global.anthropic.claude-haiku-4-5-20251001-v1:0',
        system: 'You are an expert AI tutor. Generate educational content.',
        messages: [{ role: 'user', content: _notePromptText }],
        max_tokens: 400,
        temperature: 0.5
      })
    })
    .then(function(res) { return res.json(); })
    .then(function(json) {
      var html = (json.content || '').replace(/```html\s*/gi, '').replace(/```\s*/g, '').trim();
      if (!window.PATHWAY_DATA[_noteId]) window.PATHWAY_DATA[_noteId] = {};
      window.PATHWAY_DATA[_noteId].content = html;
      var el = document.getElementById('topicNotesContent');
      if (el) el.innerHTML = html;
    })
    .catch(function(err) {
      var el = document.getElementById('topicNotesContent');
      if (el) el.innerHTML = '<p style="color:var(--text-muted)">Could not generate notes: ' + err.message + '</p>';
    });
  }
}

// ── Pathway roadmap view ──────────────────────────────────────

// AI ratings stored per topic (0–100, derived from quiz performance)
const pathwayRatings = JSON.parse(localStorage.getItem('learnora_ratings') || '{}');

function _saveRatings() {
  localStorage.setItem('learnora_ratings', JSON.stringify(pathwayRatings));
}

function _getRatingMeta(score) {
  if (score === null || score === undefined) return null;
  if (score >= 75) return { cls: 'strong',  label: 'Strong',  color: 'var(--priority-low)' };
  if (score >= 45) return { cls: 'average', label: 'Average', color: 'var(--priority-medium)' };
  return                  { cls: 'weak',    label: 'Needs Work', color: 'var(--priority-high)' };
}

function openPathwayRoadmap(pathwayId) {
  const pw = PATHWAYS.find(p => p.id === pathwayId);
  if (!pw) { navigateTo('chat'); return; }

  pathwayState.openGroups.add(pathwayId);
  pathwayState.activePathway = pathwayId;
  pathwayState.activeTopic   = null;   // viewing roadmap, not a specific topic
  renderPathways();

  let pathwayPage = document.getElementById('page-pathway');
  if (!pathwayPage) {
    pathwayPage = document.createElement('div');
    pathwayPage.id = 'page-pathway';
    pathwayPage.className = 'page';
    document.getElementById('mainContent').appendChild(pathwayPage);
    PAGES.push('pathway');
  }

  PAGES.forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) el.classList.remove('active');
  });
  pathwayPage.classList.add('active');
  currentPage = 'pathway';

  // ── Build topic subtitles map (dynamically from PATHWAY_DATA) ─
  const TOPIC_SUBTITLES = {};
  // Subtitles are populated from PATHWAY_DATA when topics are generated

  // ── Build roadmap items: topics + checkpoints + final exam ─
  //
  // Rules:
  //   Even topic count  → T1,T2,CP(1+2), T3,T4,CP(3+4), …, Final
  //   Odd topic count   → T1,T2,CP(1+2), …, TN,CP(N), Final
  //   (if only 1 topic remains after the last pair, it gets its own checkpoint)
  //
  // This function works for ANY number of topics — including dynamically
  // generated pathways from uploaded notes.
  const items = [];
  pw.topics.forEach((t, idx) => {
    items.push({ kind: 'topic', topic: t, index: idx });

    const isLastTopic   = idx === pw.topics.length - 1;
    const isEvenPair    = (idx + 1) % 2 === 0;          // idx 1, 3, 5 …
    const isOddLeftover = isLastTopic && !isEvenPair;    // last topic with no pair

    if (isEvenPair) {
      // Checkpoint covers this topic and the one before it
      items.push({
        kind:       'checkpoint',
        afterIndex: idx,
        topics:     pw.topics.slice(idx - 1, idx + 1),
      });
    } else if (isOddLeftover && pw.topics.length >= 1) {
      // Single leftover topic — checkpoint covers just this one topic
      items.push({
        kind:       'checkpoint',
        afterIndex: idx,
        topics:     pw.topics.slice(idx, idx + 1),
      });
    }
  });

  items.push({ kind: 'final', topics: pw.topics });

  // ── Progress resolver: status is the source of truth ────────
  // Completed → 100, Not Started → 0, In Progress → stored value (clamped 1–99)
  function _resolveProgress(topic) {
    if (topic.status === 'Completed')   return 100;
    if (topic.status === 'Not Started') return 0;
    // In Progress — use PATHWAY_DATA stored value, clamped to 1–99
    const stored = PATHWAY_DATA[topic.id]?.progress ?? 50;
    return Math.min(99, Math.max(1, stored));
  }

  // ── Compute unlock state for every item ──────────────────
  // Rules:
  //   Topic 0          → always unlocked
  //   Topic N (N > 0)  → locked if the preceding topic is locked OR not Completed
  //   Checkpoint       → locked if any covered topic is locked OR not Completed
  //   Final Exam       → locked unless ALL topics are unlocked+Completed AND
  //                      ALL checkpoints are submitted
  //
  // KEY: we use the COMPUTED locked state of prior items (forward pass),
  // not just the raw status field. This prevents a topic with status='Completed'
  // from unlocking its successor when it is itself locked due to its own
  // predecessor not being done.

  // Build a map: topicId → computed locked state (populated as we iterate)
  const topicLockedMap = {};

  // Pre-build cpDoneMap (checkpoint submission state from localStorage)
  const cpDoneMap = {};
  items.forEach(item => {
    if (item.kind === 'checkpoint') {
      const cpId = `cp-${pathwayId}-${item.afterIndex}`;
      cpDoneMap[cpId] = pathwayRatings[cpId] !== undefined && pathwayRatings[cpId] !== null;
    }
  });

  items.forEach((item, i) => {
    if (item.kind === 'topic') {
      if (item.index === 0) {
        // Topic 1 is always unlocked
        item.locked = false;
      } else {
        const prevTopic     = pw.topics[item.index - 1];
        const prevIsLocked  = topicLockedMap[prevTopic.id] === true;
        const prevNotDone   = prevTopic.status !== 'Completed';
        // Locked if the previous topic is itself locked, OR not yet completed
        item.locked = prevIsLocked || prevNotDone;
      }
      topicLockedMap[item.topic.id] = item.locked;

    } else if (item.kind === 'checkpoint') {
      // Locked if ANY covered topic is locked or not Completed
      // (works for both 2-topic pairs and single-topic checkpoints)
      item.locked = item.topics.some(
        t => topicLockedMap[t.id] === true || t.status !== 'Completed'
      );

    } else {
      // Final exam: every topic must be unlocked+Completed AND every checkpoint submitted
      const allTopicsDone = pw.topics.every(
        t => topicLockedMap[t.id] !== true && t.status === 'Completed'
      );
      const cpIds     = Object.keys(cpDoneMap);
      const allCpDone = cpIds.length === 0
        ? true
        : cpIds.every(id => cpDoneMap[id]);
      item.locked = !(allTopicsDone && allCpDone);
    }
  });

  // ── Render each item ──────────────────────────────────────
  const STATUS_META = {
    'Completed':   { cls: 'completed',   icon: '✓', barCls: 'bar-completed'   },
    'In Progress': { cls: 'in-progress', icon: '…', barCls: 'bar-in-progress' },
    'Not Started': { cls: 'not-started', icon: '○', barCls: 'bar-not-started' },
  };

  const tilesHTML = items.map((item, i) => {
    const isLast = i === items.length - 1;

    // Mark the first unlocked-but-not-yet-completed item for the unlock glow
    const isNextUp = !item.locked && (() => {
      if (item.kind === 'topic')      return item.topic.status === 'Not Started';
      if (item.kind === 'checkpoint') return pathwayRatings[`cp-${pathwayId}-${item.afterIndex}`] == null;
      if (item.kind === 'final')      return pathwayRatings[`final-${pathwayId}`] == null;
      return false;
    })() && items.slice(0, i).every(prev =>
      prev.kind === 'topic'
        ? prev.topic.status === 'Completed'
        : prev.kind === 'checkpoint'
          ? pathwayRatings[`cp-${pathwayId}-${prev.afterIndex}`] != null
          : true
    );

    if (item.kind === 'topic') {
      const t        = item.topic;
      const td       = PATHWAY_DATA[t.id];
      const pct      = _resolveProgress(t);
      const sm       = STATUS_META[t.status] || STATUS_META['Not Started'];
      const rating   = pathwayRatings[t.id] ?? null;
      const rm       = _getRatingMeta(rating);
      const subtitle = TOPIC_SUBTITLES[t.id] || td?.subtitle || '';
      const isActive = pathwayState.activeTopic === t.id;
      const locked   = item.locked;

      const ratingBadge = (t.status === 'Completed' && rm)
        ? `<span class="rm-tile-rating rm-tile-rating--${rm.cls}">${rating}</span>`
        : '';

      const lockOverlay = locked
        ? `<div class="rm-tile-lock-icon" aria-hidden="true">
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
               <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
               <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
             </svg>
           </div>`
        : '';

      const connector = !isLast
        ? `<div class="rm-connector${locked ? ' rm-connector--locked' : ''}"><div class="rm-connector-line"></div><div class="rm-connector-arrow">▼</div></div>`
        : '';

      return `
        <div class="rm-tile rm-tile--topic rm-tile--${sm.cls}${isActive ? ' rm-tile--active' : ''}${locked ? ' rm-tile--locked' : ''}${isNextUp ? ' rm-tile--unlocked-new' : ''}"
             ${locked ? '' : `onclick="openPathway('${t.id}')"`}
             role="${locked ? 'presentation' : 'button'}"
             tabindex="${locked ? '-1' : '0'}"
             aria-disabled="${locked}"
             aria-label="${locked ? 'Locked — complete the previous topic first' : `Open ${t.title}`}">
          ${lockOverlay}
          <div class="rm-tile-left">
            <div class="rm-tile-num">${t.num}</div>
          </div>
          <div class="rm-tile-body">
            <div class="rm-tile-top">
              <div class="rm-tile-title">${t.title}</div>
              <div class="rm-tile-badges">
                ${locked
                  ? `<span class="rm-tile-status rm-tile-status--locked">🔒 Locked</span>`
                  : `${ratingBadge}<span class="rm-tile-status rm-tile-status--${sm.cls}">${sm.icon} ${t.status}</span>`
                }
              </div>
            </div>
            <div class="rm-tile-subtitle">${subtitle}</div>
            ${locked ? '' : `
            <div class="rm-tile-progress-row">
              <div class="rm-tile-progress-bar">
                <div class="rm-tile-progress-fill ${sm.barCls}" style="width:${pct}%"></div>
              </div>
              <span class="rm-tile-progress-pct">${pct}%</span>
            </div>`}
          </div>
        </div>
        ${connector}`;
    }

    if (item.kind === 'checkpoint') {
      const cpTopics  = item.topics.length === 1
        ? item.topics[0].title
        : item.topics.map(t => t.title).join(' + ');
      const cpId      = `cp-${pathwayId}-${item.afterIndex}`;
      const cpRating  = pathwayRatings[cpId] ?? null;
      const rm        = _getRatingMeta(cpRating);
      const done      = cpRating !== null;
      const locked    = item.locked;

      const ratingBadge = done && rm
        ? `<span class="rm-tile-rating rm-tile-rating--${rm.cls}">${cpRating}</span>`
        : '';

      const lockOverlay = locked
        ? `<div class="rm-tile-lock-icon" aria-hidden="true">
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
               <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
               <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
             </svg>
           </div>`
        : '';

      const connector = `<div class="rm-connector${locked ? ' rm-connector--locked' : ''}"><div class="rm-connector-line"></div><div class="rm-connector-arrow">▼</div></div>`;

      return `
        <div class="rm-tile rm-tile--checkpoint${done ? ' rm-tile--done' : ''}${locked ? ' rm-tile--locked' : ''}${isNextUp ? ' rm-tile--unlocked-new' : ''}"
             ${locked ? '' : `onclick="CheckpointQuiz.open('${pathwayId}', ${item.afterIndex}, '${cpId}')"`}
             role="${locked ? 'presentation' : 'button'}"
             tabindex="${locked ? '-1' : '0'}"
             aria-disabled="${locked}"
             aria-label="${locked ? 'Locked — complete both preceding topics first' : `Checkpoint Quiz: ${cpTopics}`}">
          ${lockOverlay}
          <div class="rm-tile-left">
            <div class="rm-tile-cp-icon">🏁</div>
          </div>
          <div class="rm-tile-body">
            <div class="rm-tile-top">
              <div class="rm-tile-title">Checkpoint Quiz</div>
              <div class="rm-tile-badges">
                ${locked
                  ? `<span class="rm-tile-status rm-tile-status--locked">🔒 Locked</span>`
                  : `${ratingBadge}<span class="rm-tile-status rm-tile-status--checkpoint">${done ? '✓ Done' : '○ Pending'}</span>`
                }
              </div>
            </div>
            <div class="rm-tile-subtitle">${locked
              ? (item.topics.length === 1 ? 'Complete the preceding topic to unlock' : 'Complete both preceding topics to unlock')
              : `Covers: ${cpTopics}`}</div>
            ${locked ? '' : `<div class="rm-tile-cp-hint">${item.topics.length === 1 ? 'Auto-loaded questions from the previous topic' : 'Auto-loaded questions from the previous 2 topics'}</div>`}
          </div>
        </div>
        ${connector}`;
    }

    // Final exam
    const feId     = `final-${pathwayId}`;
    const feRating = pathwayRatings[feId] ?? null;
    const rm       = _getRatingMeta(feRating);
    const done     = feRating !== null;
    const locked   = item.locked;

    const ratingBadge = done && rm
      ? `<span class="rm-tile-rating rm-tile-rating--${rm.cls}">${feRating}</span>`
      : '';

    const lockOverlay = locked
      ? `<div class="rm-tile-lock-icon" aria-hidden="true">
           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
             <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
             <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
           </svg>
         </div>`
      : '';

    return `
      <div class="rm-tile rm-tile--final${done ? ' rm-tile--done' : ''}${locked ? ' rm-tile--locked' : ''}${isNextUp ? ' rm-tile--unlocked-new' : ''}"
           ${locked ? '' : `onclick="CheckpointQuiz.open('${pathwayId}', 'final', '${feId}')"`}
           role="${locked ? 'presentation' : 'button'}"
           tabindex="${locked ? '-1' : '0'}"
           aria-disabled="${locked}"
           aria-label="${locked ? 'Locked — complete all topics and checkpoints first' : `Final Exam: ${pw.name}`}">
        ${lockOverlay}
        <div class="rm-tile-left">
          <div class="rm-tile-cp-icon">🎓</div>
        </div>
        <div class="rm-tile-body">
          <div class="rm-tile-top">
            <div class="rm-tile-title">Final Exam</div>
            <div class="rm-tile-badges">
              ${locked
                ? `<span class="rm-tile-status rm-tile-status--locked">🔒 Locked</span>`
                : `${ratingBadge}<span class="rm-tile-status rm-tile-status--final">${done ? '✓ Completed' : '○ Not Taken'}</span>`
              }
            </div>
          </div>
          <div class="rm-tile-subtitle">${locked ? 'Complete all topics and checkpoints to unlock' : `Comprehensive exam covering all ${pw.topics.length} topics`}</div>
          ${locked ? '' : `<div class="rm-tile-cp-hint">All pathway questions combined — earn your pathway rating</div>`}
        </div>
      </div>`;
  }).join('');

  const doneCount = pw.topics.filter(t => t.status === 'Completed').length;
  const pct       = Math.round((doneCount / pw.topics.length) * 100);

  pathwayPage.innerHTML = `
    <div class="topic-page">
      <div class="topic-header">
        <div class="topic-header-left">
          <div class="topic-breadcrumb">
            <a onclick="navigateTo('chat')">← Home</a>
            <span>/</span>
            <span>${pw.name}</span>
          </div>
          <div class="topic-title">${pw.icon} ${pw.name}</div>
          <div class="topic-meta">
            <span class="topic-subtitle">${pw.topics.length} topics · ${doneCount} completed</span>
          </div>
        </div>
        <div class="topic-header-progress">
          <span class="topic-progress-label">Pathway Progress</span>
          <div class="topic-progress-row">
            <div class="topic-progress-bar">
              <div class="topic-progress-fill" style="width:${pct}%"></div>
            </div>
            <span class="topic-progress-pct">${pct}%</span>
          </div>
        </div>
      </div>
      <div class="roadmap-body">
        <div class="roadmap-list">${tilesHTML}</div>
      </div>
    </div>
  `;

  closeSidebar();
}

// ── Checkpoint / Final Exam Quiz ──────────────────────────────
const CheckpointQuiz = (() => {
  let _pathwayId = null;
  let _cpId      = null;
  let _questions = [];
  let _answers   = {};
  let _score     = 0;

  // Pull questions from EXAM_QUESTIONS in topic.js via TopicExam internals
  // We replicate the question bank here for checkpoint use
  // Question bank — empty, questions generated by Bedrock on demand
  const QUESTION_BANK = {};

    function open(pathwayId, afterIndexOrFinal, cpId) {
    _pathwayId = pathwayId;
    _cpId      = cpId;
    _answers   = {};
    _score     = 0;

    const pw = PATHWAYS.find(p => p.id === pathwayId);
    if (!pw) return;

    let title, subtitle, topicIds;
    if (afterIndexOrFinal === 'final') {
      title    = '🎓 Final Exam';
      subtitle = `${pw.name} — All Topics`;
      topicIds = pw.topics.map(t => t.id);
    } else {
      const idx = Number(afterIndexOrFinal);
      const covered = pw.topics.slice(Math.max(0, idx - 1), idx + 1);
      title    = '🏁 Checkpoint Quiz';
      subtitle = covered.map(t => t.title).join(' + ');
      topicIds = covered.map(t => t.id);
    }

    // Gather questions from all covered topics
    _questions = [];
    topicIds.forEach(tid => {
      const qs = QUESTION_BANK[tid] || [];
      _questions.push(...qs);
    });
    // Shuffle
    _questions = _questions.sort(() => Math.random() - 0.5);

    _renderModal(title, subtitle);
  }

  function _renderModal(title, subtitle) {
    // Remove existing modal
    document.getElementById('cpQuizModal')?.remove();

    const questionsHTML = _questions.map((q, i) => {
      const optsHTML = q.opts.map((o, j) => `
        <button class="cp-option" id="cp-opt-${i}-${j}"
                onclick="CheckpointQuiz.answer(${i}, ${j})">
          <span class="cp-option-letter">${String.fromCharCode(65+j)}</span>${o}
        </button>`).join('');
      return `
        <div class="cp-question" id="cp-q-${i}">
          <div class="cp-q-header">
            <span class="cp-q-num">${i+1}</span>
            <span class="cp-q-text">${q.text}</span>
          </div>
          <div class="cp-options">${optsHTML}</div>
          <div class="cp-feedback" id="cp-fb-${i}"></div>
        </div>`;
    }).join('');

    const modal = document.createElement('div');
    modal.id = 'cpQuizModal';
    modal.className = 'cp-modal-backdrop';
    modal.innerHTML = `
      <div class="cp-modal" role="dialog" aria-modal="true" aria-labelledby="cpModalTitle">
        <div class="cp-modal-header">
          <div>
            <div class="cp-modal-title" id="cpModalTitle">${title}</div>
            <div class="cp-modal-subtitle">${subtitle}</div>
          </div>
          <div class="cp-modal-header-right">
            <span class="cp-score-badge" id="cpScoreBadge">0 / ${_questions.length}</span>
            <button class="cp-modal-close" onclick="CheckpointQuiz.close()" aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="cp-modal-body" id="cpModalBody">
          ${_questions.length === 0
            ? '<p class="cp-empty">No questions available for this checkpoint yet.</p>'
            : questionsHTML}
        </div>
        <div class="cp-modal-footer">
          <button class="topic-nav-btn" onclick="CheckpointQuiz.close()">← Back to Pathway</button>
          <button class="topic-nav-btn primary" id="cpSubmitBtn"
                  onclick="CheckpointQuiz.submit()"
                  ${_questions.length === 0 ? 'disabled' : ''}>
            Submit &amp; Get Rating
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    // Prevent background scroll
    document.body.style.overflow = 'hidden';
  }

  function answer(qIdx, chosen) {
    if (_answers[qIdx] !== undefined) return;
    const q = _questions[qIdx];
    const isCorrect = chosen === q.correct;
    _answers[qIdx] = chosen;
    if (isCorrect) _score++;

    q.opts.forEach((_, j) => {
      const btn = document.getElementById(`cp-opt-${qIdx}-${j}`);
      if (!btn) return;
      btn.disabled = true;
      if (j === q.correct) btn.classList.add('correct');
      else if (j === chosen && !isCorrect) btn.classList.add('wrong');
    });

    const card = document.getElementById(`cp-q-${qIdx}`);
    if (card) card.classList.add(isCorrect ? 'answered-correct' : 'answered-wrong');

    const fb = document.getElementById(`cp-fb-${qIdx}`);
    if (fb) {
      fb.className = `cp-feedback show ${isCorrect ? 'correct' : 'wrong'}`;
      fb.innerHTML = isCorrect
        ? '&#10003; Correct!'
        : `&#10007; Incorrect. Answer: ${String.fromCharCode(65+q.correct)}.`;
    }

    // Update live score badge
    const badge = document.getElementById('cpScoreBadge');
    if (badge) badge.textContent = `${_score} / ${_questions.length}`;
  }

  function submit() {
    if (_questions.length === 0) { close(); return; }

    // Calculate rating 0–100
    const rating = Math.round((_score / _questions.length) * 100);
    pathwayRatings[_cpId] = rating;
    _saveRatings();

    const rm = _getRatingMeta(rating);

    // Show result overlay inside modal body
    const body = document.getElementById('cpModalBody');
    if (body) {
      body.innerHTML = `
        <div class="cp-result">
          <div class="cp-result-score" style="color:${rm.color}">${rating}</div>
          <div class="cp-result-label" style="color:${rm.color}">${rm.label}</div>
          <div class="cp-result-detail">${_score} correct out of ${_questions.length} questions</div>
          <div class="cp-result-bar">
            <div class="cp-result-fill" style="width:${rating}%;background:${rm.color}"></div>
          </div>
          <p class="cp-result-msg">${_getResultMsg(rating)}</p>
        </div>`;
    }

    // Disable submit, update footer
    const btn = document.getElementById('cpSubmitBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Submitted'; }
  }

  function _getResultMsg(rating) {
    if (rating >= 75) return 'Excellent work! You have a strong grasp of these topics. Keep it up!';
    if (rating >= 45) return 'Good effort! Review the topics you missed and try again to improve your rating.';
    return 'Keep practising! Revisit the topic notes and attempt the checkpoint again.';
  }

  function close() {
    document.getElementById('cpQuizModal')?.remove();
    document.body.style.overflow = '';
    // Refresh roadmap to show updated ratings
    if (_pathwayId) openPathwayRoadmap(_pathwayId);
  }

  return { open, answer, submit, close };
})();

// ── Mobile sidebar ────────────────────────────────────────────
function openSidebar() {
  document.getElementById('sidebar')?.classList.add('open');
  document.getElementById('sidebarOverlay')?.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('active');
  document.body.style.overflow = '';
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Init modules
  MiniCalendar.init();
  FocusTimer.init();
  ChatPage.init();

  // Render the pathway selector
  renderPathways();

  // Mobile hamburger
  document.getElementById('hamburger')?.addEventListener('click', openSidebar);
  document.getElementById('sidebarClose')?.addEventListener('click', closeSidebar);
  document.getElementById('sidebarOverlay')?.addEventListener('click', closeSidebar);

  // Prevent nav link default behavior
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => e.preventDefault());
  });

  // No sample data — app starts clean
});
