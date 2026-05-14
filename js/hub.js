/* ============================================================
   hub.js — Learning Hub page
   ============================================================ */

const HubPage = (() => {
  let activeTab       = 'projects';
  let activeChatRoom  = 'general';
  let calView         = 'month';   // 'month' | 'week'
  let calMonth        = new Date().getMonth();
  let calYear         = new Date().getFullYear();
  let calDate         = new Date(); // used for week navigation

  // ── Storage ────────────────────────────────────────────────
  const GE_KEY = 'learnora_group_events';

  function getGroupEvents() {
    try { return JSON.parse(localStorage.getItem(GE_KEY) || '[]'); }
    catch { return []; }
  }

  function saveGroupEvents(events) {
    localStorage.setItem(GE_KEY, JSON.stringify(events));
    // Sync mini sidebar calendar
    if (window.MiniCalendar) MiniCalendar.refresh();
  }

  function activeGroupEvents() {
    return getGroupEvents().filter(e => !e.done);
  }

  // ── Helpers ────────────────────────────────────────────────
  const CAL_MONTHS = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
  const CAL_DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  function escapeHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function formatTime12(t) {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`;
  }

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function getWeekStart(date) {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }

  const PROJECTS = [
    { id: 1, icon: '🤖', name: 'AI Study Group',       desc: 'Collaborative deep dive into machine learning fundamentals and applications.', status: 'active',   members: ['A','B','C','D'], progress: 65 },
    { id: 2, icon: '📊', name: 'Data Science Project', desc: 'Building a predictive model for student performance analytics.',               status: 'active',   members: ['E','F','G'],     progress: 40 },
    { id: 3, icon: '🌐', name: 'Web Dev Bootcamp',     desc: 'Full-stack web development with React and Node.js.',                          status: 'planning', members: ['H','I'],         progress: 15 },
    { id: 4, icon: '🔬', name: 'Research Paper',       desc: 'Writing a survey paper on transformer architectures in NLP.',                 status: 'active',   members: ['J','K','L','M'], progress: 80 },
  ];

  const PROJECT_NAMES = PROJECTS.map(p => p.name);

  const LEADERBOARD = [
    { name: 'Alex Chen', points: 4820, streak: '32 day streak', avatar: 'AC', color: '#7c3aed' },
    { name: 'Maya Patel', points: 4210, streak: '28 day streak', avatar: 'MP', color: '#2563eb' },
    { name: 'Jordan Lee', points: 3950, streak: '21 day streak', avatar: 'JL', color: '#0d9488' },
    { name: 'Sam Rivera', points: 3400, streak: '15 day streak', avatar: 'SR', color: '#db2777' },
    { name: 'Taylor Kim', points: 2980, streak: '10 day streak', avatar: 'TK', color: '#7c3aed' },
    { name: 'Casey Morgan', points: 2540, streak: '7 day streak', avatar: 'CM', color: '#2563eb' },
    { name: 'Riley Zhang', points: 2100, streak: '5 day streak', avatar: 'RZ', color: '#0d9488' },
  ];

  const EVENTS = [];  // legacy static list replaced by localStorage group events

  const CHAT_ROOMS = [
    { id: 'general',  icon: '💬', name: 'General',        type: 'group', unread: 3 },
    { id: 'ai-group', icon: '🤖', name: 'AI Study Group', type: 'group', unread: 0 },
    { id: 'data-sci', icon: '📊', name: 'Data Science',   type: 'group', unread: 1 },
    { id: 'web-dev',  icon: '🌐', name: 'Web Dev',        type: 'group', unread: 0 },
  ];

  // Direct message contacts — each has a unique id, display name, avatar initials, colour
  const DM_CONTACTS = [
    { id: 'dm-alex',   name: 'Alex Chen',   avatar: 'AC', color: '#7c3aed', unread: 2, online: true  },
    { id: 'dm-maya',   name: 'Maya Patel',  avatar: 'MP', color: '#2563eb', unread: 0, online: true  },
    { id: 'dm-jordan', name: 'Jordan Lee',  avatar: 'JL', color: '#0d9488', unread: 1, online: false },
    { id: 'dm-sam',    name: 'Sam Rivera',  avatar: 'SR', color: '#db2777', unread: 0, online: false },
  ];

  const CHAT_MESSAGES = {
    general: [
      { name: 'Alex Chen', avatar: 'AC', color: '#7c3aed', text: 'Hey everyone! Ready for the study session tomorrow?' },
      { name: 'Maya Patel', avatar: 'MP', color: '#2563eb', text: 'Absolutely! I\'ve been reviewing the neural network chapter.' },
      { name: 'Jordan Lee', avatar: 'JL', color: '#0d9488', text: 'Same here. Should we focus on backpropagation?' },
      { name: 'Alex Chen', avatar: 'AC', color: '#7c3aed', text: 'Great idea. I\'ll prepare some practice problems.' },
    ],
    'ai-group': [
      { name: 'Sam Rivera', avatar: 'SR', color: '#db2777', text: 'Just pushed the updated model to the repo.' },
      { name: 'Taylor Kim', avatar: 'TK', color: '#7c3aed', text: 'Nice! What accuracy did you get?' },
      { name: 'Sam Rivera', avatar: 'SR', color: '#db2777', text: '87% on the validation set. Still tuning hyperparameters.' },
    ],
    'dm-alex': [
      { name: 'Alex Chen', avatar: 'AC', color: '#7c3aed', text: 'Hey! Did you finish the ML assignment?', dm: true },
      { name: 'You',       avatar: 'YO', color: '#0d9488', text: 'Almost done — just the last section.',   dm: true },
      { name: 'Alex Chen', avatar: 'AC', color: '#7c3aed', text: 'Nice, let me know if you need help.',    dm: true },
    ],
    'dm-maya': [
      { name: 'Maya Patel', avatar: 'MP', color: '#2563eb', text: 'Are you joining the study group tonight?', dm: true },
    ],
    'dm-jordan': [
      { name: 'Jordan Lee', avatar: 'JL', color: '#0d9488', text: 'Can you share your notes from yesterday?', dm: true },
    ],
    'dm-sam': [],
  };

  // ── Available users for member selection ──────────────────
  const ALL_USERS = [
    { id: 'alex',   name: 'Alex Chen',    avatar: 'AC', color: '#7c3aed' },
    { id: 'maya',   name: 'Maya Patel',   avatar: 'MP', color: '#2563eb' },
    { id: 'jordan', name: 'Jordan Lee',   avatar: 'JL', color: '#0d9488' },
    { id: 'sam',    name: 'Sam Rivera',   avatar: 'SR', color: '#db2777' },
    { id: 'taylor', name: 'Taylor Kim',   avatar: 'TK', color: '#d97706' },
    { id: 'casey',  name: 'Casey Morgan', avatar: 'CM', color: '#2563eb' },
    { id: 'riley',  name: 'Riley Zhang',  avatar: 'RZ', color: '#0d9488' },
  ];

  // Track selected members in the create-group modal
  let selectedMembers = new Set();

  function render() {
    const page = document.getElementById('page-hub');
    if (!page) return;

    page.innerHTML = `
      <div class="hub-page">
        <div class="hub-page-header">
          <h1>🌐 Learning Hub</h1>
          <p>Collaborate, compete, and grow together.</p>
        </div>

        <div class="hub-tabs">
          <button class="hub-tab active" data-tab="projects" onclick="HubPage.switchTab('projects')">
            📁 Group Projects
          </button>
          <button class="hub-tab" data-tab="leaderboard" onclick="HubPage.switchTab('leaderboard')">
            🏆 Leaderboard
          </button>
          <button class="hub-tab" data-tab="calendar" onclick="HubPage.switchTab('calendar')">
            📅 Shared Calendar
          </button>
          <button class="hub-tab" data-tab="chat" onclick="HubPage.switchTab('chat')">
            💬 Peer Chat
          </button>
        </div>

        <div id="hub-tab-projects"    class="hub-tab-content active">${buildProjectsHTML()}</div>
        <div id="hub-tab-leaderboard" class="hub-tab-content">${buildLeaderboardHTML()}</div>
        <div id="hub-tab-calendar"    class="hub-tab-content">${buildCalendarHTML()}</div>
        <div id="hub-tab-chat"        class="hub-tab-content">${buildChatHTML()}</div>
      </div>
    `;

    // Wire modal backdrop close
    document.getElementById('hubEventModal')?.addEventListener('click', e => {
      if (e.target.id === 'hubEventModal') closeEventModal();
    });
    document.getElementById('createGroupModal')?.addEventListener('click', e => {
      if (e.target.id === 'createGroupModal') closeCreateGroup();
    });

    // Escape key closes any open modal
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        const em = document.getElementById('hubEventModal');
        if (em?.classList.contains('open')) closeEventModal();
        const cm = document.getElementById('createGroupModal');
        if (cm?.classList.contains('open')) closeCreateGroup();
      }
    });
  }

  function buildProjectsHTML() {
    const AVATAR_COLORS = ['#7c3aed','#2563eb','#0d9488','#db2777','#d97706','#059669'];
    const cards = PROJECTS.map(p => {
      const avatarsHTML = p.members.map((m, i) => `
        <div class="member-avatar" style="background:${AVATAR_COLORS[i % AVATAR_COLORS.length]}">${m}</div>
      `).join('');

      return `
        <div class="project-card">
          <div class="project-card-header">
            <div class="project-icon">${p.icon}</div>
            <span class="project-status ${p.status}">${p.status.charAt(0).toUpperCase() + p.status.slice(1)}</span>
          </div>
          <div class="project-name">${p.name}</div>
          <div class="project-desc">${p.desc}</div>
          <div class="project-members">
            <div class="member-avatars">${avatarsHTML}</div>
            <span class="member-count">${p.members.length} members</span>
          </div>
          <div class="project-progress">
            <div class="progress-label">
              <span>Progress</span>
              <span>${p.progress}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width:${p.progress}%"></div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="projects-grid" id="projectsGrid">${cards}</div>
      <button class="btn-primary create-group-btn" onclick="HubPage.openCreateGroup()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Create New Group
      </button>
      ${buildCreateGroupModalHTML()}
    `;
  }

  // ── Create Group Modal ─────────────────────────────────────

  function buildCreateGroupModalHTML() {
    const userChips = ALL_USERS.map(u => `
      <button type="button"
              class="member-chip"
              id="chip-${u.id}"
              onclick="HubPage.toggleMember('${u.id}')"
              aria-pressed="false">
        <span class="member-chip-avatar" style="background:${u.color}">${u.avatar}</span>
        <span class="member-chip-name">${u.name}</span>
        <span class="member-chip-check">✓</span>
      </button>`).join('');

    return `
      <div class="deadline-edit-backdrop" id="createGroupModal">
        <div class="deadline-edit-modal create-group-modal" role="dialog" aria-modal="true" aria-labelledby="createGroupTitle">

          <div class="deadline-edit-modal-header">
            <h3 id="createGroupTitle">Create New Group</h3>
            <button class="deadline-edit-close" onclick="HubPage.closeCreateGroup()" aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div class="deadline-edit-modal-body">

            <!-- Group Name (required) -->
            <div class="form-group">
              <label class="form-label">
                Group Name <span class="cg-required">*</span>
              </label>
              <input type="text" class="form-input" id="cgGroupName"
                     placeholder="e.g. AI Study Group" maxlength="60"
                     oninput="HubPage.updateCreateBtn()" />
            </div>

            <!-- Upload Notes (optional) -->
            <div class="form-group">
              <label class="form-label">Upload Notes <span class="form-label-optional">(optional)</span></label>
              <div class="cg-upload-zone" id="cgUploadZone" onclick="document.getElementById('cgNotesFile').click()">
                <input type="file" id="cgNotesFile" accept=".pdf,.docx,.txt,.md,.ppt,.pptx"
                       style="display:none" onchange="HubPage.handleGroupFile(event)" />
                <div class="cg-upload-idle" id="cgUploadIdle">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted)">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <span>Click to attach notes (PDF, DOCX, TXT, MD)</span>
                </div>
                <div class="cg-upload-preview" id="cgUploadPreview" style="display:none">
                  <span class="cg-file-icon" id="cgFileIcon">📄</span>
                  <span class="cg-file-name" id="cgFileName"></span>
                  <button type="button" class="cg-file-remove"
                          onclick="event.stopPropagation();HubPage.removeGroupFile()"
                          title="Remove">✕</button>
                </div>
              </div>
            </div>

            <!-- Add Members (required — at least one) -->
            <div class="form-group">
              <label class="form-label">
                Add Members <span class="cg-required">*</span>
                <span class="form-label-optional" style="margin-left:4px;">select at least one</span>
              </label>
              <div class="member-chips-grid" id="memberChipsGrid">${userChips}</div>
              <div class="selected-members-summary" id="selectedMembersSummary" style="display:none"></div>
              <div class="cg-field-hint cg-field-hint--error" id="cgMembersError" style="display:none">
                Please select at least one member.
              </div>
            </div>

            <!-- Assignment Toggle -->
            <div class="form-group">
              <div class="cg-toggle-row">
                <div>
                  <div class="form-label" style="margin-bottom:2px;">Assignment</div>
                  <div style="font-size:11px;color:var(--text-muted)">Attach a due date to this group</div>
                </div>
                <label class="cg-toggle" aria-label="Assignment toggle">
                  <input type="checkbox" id="cgAssignmentToggle"
                         onchange="HubPage.onAssignmentToggle()" />
                  <span class="cg-toggle-track">
                    <span class="cg-toggle-thumb"></span>
                  </span>
                </label>
              </div>
            </div>

            <!-- Assignment fields (shown when toggle is ON) -->
            <div class="cg-assignment-fields" id="cgAssignmentFields" style="display:none">
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">
                    Due Date <span class="cg-required">*</span>
                  </label>
                  <input type="date" class="form-input form-input--datetime" id="cgDueDate"
                         onchange="HubPage.updateCreateBtn()" />
                </div>
                <div class="form-group">
                  <label class="form-label">Due Time <span class="form-label-optional">(optional)</span></label>
                  <input type="time" class="form-input form-input--datetime" id="cgDueTime" />
                </div>
              </div>
            </div>

          </div>

          <div class="deadline-edit-modal-footer">
            <button class="deadline-edit-btn-cancel" onclick="HubPage.closeCreateGroup()">Cancel</button>
            <button class="deadline-edit-btn-save cg-create-btn"
                    id="cgCreateBtn"
                    onclick="HubPage.saveCreateGroup()"
                    disabled>Create</button>
          </div>

        </div>
      </div>`;
  }

  function openCreateGroup() {
    selectedMembers = new Set();
    const modal = document.getElementById('createGroupModal');
    if (!modal) return;

    // Reset all fields
    document.getElementById('cgGroupName').value = '';
    document.getElementById('cgGroupName').classList.remove('input-error');
    document.getElementById('cgAssignmentToggle').checked = false;
    document.getElementById('cgAssignmentFields').style.display = 'none';
    document.getElementById('cgDueDate').value  = todayStr();
    document.getElementById('cgDueTime').value  = '';
    document.getElementById('cgMembersError').style.display = 'none';
    removeGroupFile();

    // Reset member chips
    document.querySelectorAll('.member-chip').forEach(chip => {
      chip.classList.remove('selected');
      chip.setAttribute('aria-pressed', 'false');
    });
    document.getElementById('selectedMembersSummary').style.display = 'none';

    // Start with Create disabled
    updateCreateBtn();

    modal.classList.add('open');
    setTimeout(() => document.getElementById('cgGroupName')?.focus(), 80);
  }

  function closeCreateGroup() {
    document.getElementById('createGroupModal')?.classList.remove('open');
  }

  /**
   * Recomputes whether the Create button should be enabled.
   * Rules:
   *   - Group Name must be non-empty
   *   - At least one member must be selected
   *   - If Assignment toggle is ON, Due Date must be filled
   */
  function updateCreateBtn() {
    const btn          = document.getElementById('cgCreateBtn');
    if (!btn) return;

    const name         = document.getElementById('cgGroupName')?.value.trim() || '';
    const hasMembers   = selectedMembers.size > 0;
    const isAssignment = document.getElementById('cgAssignmentToggle')?.checked;
    const dueDate      = document.getElementById('cgDueDate')?.value || '';

    const valid = name.length > 0
               && hasMembers
               && (!isAssignment || dueDate.length > 0);

    btn.disabled = !valid;
  }

  function toggleMember(userId) {
    const chip = document.getElementById(`chip-${userId}`);
    if (!chip) return;

    if (selectedMembers.has(userId)) {
      selectedMembers.delete(userId);
      chip.classList.remove('selected');
      chip.setAttribute('aria-pressed', 'false');
    } else {
      selectedMembers.add(userId);
      chip.classList.add('selected');
      chip.setAttribute('aria-pressed', 'true');
    }
    // Hide the members error once at least one is selected
    if (selectedMembers.size > 0) {
      document.getElementById('cgMembersError').style.display = 'none';
    }
    updateMemberSummary();
    updateCreateBtn();
  }

  function updateMemberSummary() {
    const summary = document.getElementById('selectedMembersSummary');
    if (!summary) return;
    if (selectedMembers.size === 0) {
      summary.style.display = 'none';
      return;
    }
    const names = [...selectedMembers].map(id => ALL_USERS.find(u => u.id === id)?.name).filter(Boolean);
    summary.style.display = 'block';
    summary.textContent   = `${selectedMembers.size} member${selectedMembers.size > 1 ? 's' : ''} selected: ${names.join(', ')}`;
  }

  function handleGroupFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';

    const icons = { pdf: '📕', docx: '📘', txt: '📄', md: '📝' };
    const ext   = file.name.split('.').pop().toLowerCase();

    document.getElementById('cgUploadIdle').style.display    = 'none';
    document.getElementById('cgUploadPreview').style.display = 'flex';
    document.getElementById('cgFileIcon').textContent        = icons[ext] || '📄';
    document.getElementById('cgFileName').textContent        = file.name;
    document.getElementById('cgUploadZone').dataset.file     = file.name;
  }

  function removeGroupFile() {
    document.getElementById('cgUploadIdle').style.display    = 'flex';
    document.getElementById('cgUploadPreview').style.display = 'none';
    document.getElementById('cgFileName').textContent        = '';
    delete document.getElementById('cgUploadZone')?.dataset.file;
  }

  function onAssignmentToggle() {
    const on     = document.getElementById('cgAssignmentToggle')?.checked;
    const fields = document.getElementById('cgAssignmentFields');
    if (fields) fields.style.display = on ? 'block' : 'none';
    updateCreateBtn();
  }

  function saveCreateGroup() {
    const name = document.getElementById('cgGroupName')?.value.trim();

    // Guard: name required
    if (!name) {
      document.getElementById('cgGroupName')?.classList.add('input-error');
      document.getElementById('cgGroupName')?.focus();
      return;
    }
    document.getElementById('cgGroupName')?.classList.remove('input-error');

    // Guard: at least one member required
    if (selectedMembers.size === 0) {
      document.getElementById('cgMembersError').style.display = 'block';
      return;
    }
    document.getElementById('cgMembersError').style.display = 'none';

    const isAssignment = document.getElementById('cgAssignmentToggle')?.checked;
    const dueDate      = isAssignment ? document.getElementById('cgDueDate')?.value  : '';
    const dueTime      = isAssignment ? document.getElementById('cgDueTime')?.value  : '';
    const notesFile    = document.getElementById('cgUploadZone')?.dataset.file || '';

    // Guard: due date required when assignment is ON
    if (isAssignment && !dueDate) {
      document.getElementById('cgDueDate')?.classList.add('input-error');
      document.getElementById('cgDueDate')?.focus();
      return;
    }
    document.getElementById('cgDueDate')?.classList.remove('input-error');

    // Resolve member data
    const memberUsers   = [...selectedMembers].map(id => ALL_USERS.find(u => u.id === id)).filter(Boolean);
    const memberAvatars = memberUsers.map(u => u.avatar);

    // Pick an icon based on name keywords
    const iconMap = [
      [/ai|machine|ml/i, '🤖'], [/data|science|analytics/i, '📊'],
      [/web|dev|react|node/i, '🌐'], [/research|paper|survey/i, '🔬'],
      [/math|calc/i, '📐'], [/physics/i, '⚛️'], [/design/i, '🎨'],
    ];
    const icon = (iconMap.find(([re]) => re.test(name)) || [null, '📁'])[1];

    // Add to PROJECTS
    PROJECTS.push({
      id:       Date.now(),
      icon,
      name,
      desc:     notesFile ? `Shared notes: ${notesFile}` : 'New group — add a description.',
      status:   'active',
      members:  memberAvatars,
      progress: 0,
    });

    // Add a group channel; seed a welcome message
    const channelId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    CHAT_ROOMS.push({ id: channelId, icon, name, type: 'group', unread: 0 });
    CHAT_MESSAGES[channelId] = [
      { name: 'Learnora', avatar: '◈', color: '#7c3aed',
        text: `Welcome to ${name}! ${memberUsers.map(u => u.name).join(', ')} have been added.` },
    ];

    // Add each selected member to DM_CONTACTS if not already present
    memberUsers.forEach(u => {
      const dmId = `dm-${u.id}`;
      if (!DM_CONTACTS.find(c => c.id === dmId)) {
        DM_CONTACTS.push({ id: dmId, name: u.name, avatar: u.avatar, color: u.color, unread: 0, online: false });
        CHAT_MESSAGES[dmId] = [];
      }
    });

    // If assignment is ON, sync to group events calendar AND main deadlines
    if (isAssignment && dueDate) {
      // Group events (shows on hub shared calendar)
      const events = getGroupEvents();
      events.push({ id: Date.now() + 1, title: `${name} — Due`, date: dueDate, time: dueTime, group: name, done: false });
      saveGroupEvents(events);

      // Also add to personal deadlines so it appears on the main sidebar calendar
      try {
        const deadlines = JSON.parse(localStorage.getItem('learnora_deadlines') || '[]');
        deadlines.push({
          id:       Date.now() + 2,
          topic:    `${name} — Due`,
          date:     dueDate,
          time:     dueTime,
          priority: 'medium',
          done:     false,
        });
        localStorage.setItem('learnora_deadlines', JSON.stringify(deadlines));
        if (window.MiniCalendar) MiniCalendar.refresh();
      } catch (_) {}
    }

    closeCreateGroup();

    // Re-render the projects tab
    const tab = document.getElementById('hub-tab-projects');
    if (tab) tab.innerHTML = buildProjectsHTML();

    // Re-wire the new modal's backdrop close
    document.getElementById('createGroupModal')?.addEventListener('click', e => {
      if (e.target.id === 'createGroupModal') closeCreateGroup();
    });
  }

  function buildLeaderboardHTML() {
    // ── Live user data — read from the same sources as Profile Dashboard ──
    const stats = window.UserStats ? UserStats.getStats() : {};

    // Name: prefer the profile-saved name, fall back to onboarding name
    const userName = localStorage.getItem('learnora_username') || 'You';

    // Points and streak — explicit 0 fallback so new users always appear
    const userPoints = Number(stats.points)    || 0;
    const userStreak = Number(stats.streakDays) || 0;

    // Avatar initials from the stored name
    const userInitials = userName.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'YO';

    const userEntry = {
      name:   userName,
      points: userPoints,
      streak: `${userStreak} day streak`,
      avatar: userInitials,
      color:  '#7c3aed',
      isMe:   true,
    };

    // ── Merge static peers with the live user entry ─────────
    const peers = LEADERBOARD.filter(u => !u.isMe);
    const all   = [...peers, userEntry].sort((a, b) => b.points - a.points);

    // ── Render ───────────────────────────────────────────────
    const items = all.map((user, i) => {
      const rank      = i + 1;
      const rankClass = rank <= 3 ? `rank-${rank}` : '';
      const medal     = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
      const meClass   = user.isMe ? ' lb-me' : '';
      const meBadge   = user.isMe ? '<span class="lb-you-badge">You</span>' : '';

      return `
        <div class="leaderboard-item ${rankClass}${meClass}">
          <div class="rank-badge">${medal}</div>
          <div class="lb-avatar" style="background:${user.color}">${user.avatar}</div>
          <div class="lb-info">
            <div class="lb-name">${escapeHtml(user.name)}${meBadge}</div>
            <div class="lb-streak">🔥 ${user.streak}</div>
          </div>
          <div class="lb-points">${user.points.toLocaleString()} pts</div>
        </div>`;
    }).join('');

    // ── Activity breakdown for the current user ──────────────
    const breakdown = `
      <div class="lb-breakdown">
        <span>Your activity: </span>
        <span>🎯 ${stats.focusSessions || 0} focus sessions</span>
        <span>·</span>
        <span>✅ ${stats.deadlinesDone || 0} deadlines done</span>
        <span>·</span>
        <span>🌐 ${stats.groupEvents || 0} group events</span>
      </div>`;

    return `
      <div class="leaderboard-list">${items}</div>
      ${breakdown}`;
  }

  // ── Shared Calendar ────────────────────────────────────────

  function buildCalendarHTML() {
    const today = new Date();
    const ts    = todayStr();

    // Controls row
    const controlsHTML = `
      <div class="shared-cal-header">
        <div class="shared-cal-title" id="hubCalTitle"></div>
        <div class="shared-cal-controls">
          <button class="planner-cal-nav" onclick="HubPage.calPrev()">‹</button>
          <button class="planner-cal-nav" onclick="HubPage.calNext()">›</button>
          <div class="view-toggle">
            <button class="view-toggle-btn${calView==='month'?' active':''}" data-view="month" onclick="HubPage.setCalView('month')">Month</button>
            <button class="view-toggle-btn${calView==='week'?' active':''}"  data-view="week"  onclick="HubPage.setCalView('week')">Week</button>
          </div>
          <button class="btn-secondary" style="font-size:12px;padding:6px 14px;" onclick="HubPage.openAddEvent()">+ Add Event</button>
        </div>
      </div>
      <div class="hub-cal-legend">
        <span class="hub-cal-legend-dot"></span> Group Event
      </div>
    `;

    // Upcoming list (active events sorted by date)
    const upcoming = activeGroupEvents()
      .sort((a,b) => a.date.localeCompare(b.date))
      .slice(0, 8);

    const upcomingHTML = upcoming.length === 0
      ? '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px 0;">No upcoming group events. Add one!</p>'
      : upcoming.map(e => {
          const d    = new Date(e.date + 'T00:00:00');
          const day  = d.getDate();
          const mon  = CAL_MONTHS[d.getMonth()].slice(0,3);
          const time = e.time ? ` · ${formatTime12(e.time)}` : '';
          return `
            <div class="shared-event group-event">
              <div class="event-date-badge event-date-badge--group">
                <div class="event-date-day">${day}</div>
                <div class="event-date-month">${mon}</div>
              </div>
              <div class="event-info">
                <div class="event-name">${escapeHtml(e.title)}</div>
                <div class="event-meta">${escapeHtml(e.group)}${time}</div>
              </div>
              <div class="event-actions">
                <button class="event-action-btn event-edit-btn"  onclick="HubPage.openEditEvent(${e.id})" title="Edit">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="event-action-btn event-done-btn"  onclick="HubPage.markEventDone(${e.id})" title="Mark done">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </button>
                <button class="event-action-btn event-delete-btn" onclick="HubPage.deleteEvent(${e.id})" title="Delete">✕</button>
              </div>
            </div>`;
        }).join('');

    // Completed / history
    const done = getGroupEvents().filter(e => e.done)
      .sort((a,b) => b.date.localeCompare(a.date));

    const historyHTML = done.length === 0 ? '' : `
      <div class="completed-section-header" style="margin-top:16px;">✓ Group History (${done.length})</div>
      ${done.map(e => {
        const d   = new Date(e.date + 'T00:00:00');
        const day = d.getDate();
        const mon = CAL_MONTHS[d.getMonth()].slice(0,3);
        return `
          <div class="shared-event group-event deadline-item--done">
            <div class="event-date-badge event-date-badge--group" style="opacity:0.5">
              <div class="event-date-day">${day}</div>
              <div class="event-date-month">${mon}</div>
            </div>
            <div class="event-info">
              <div class="event-name" style="text-decoration:line-through;color:var(--text-muted)">${escapeHtml(e.title)}</div>
              <div class="event-meta">${escapeHtml(e.group)}</div>
            </div>
            <div class="event-actions">
              <button class="event-action-btn event-delete-btn" onclick="HubPage.deleteEvent(${e.id})" title="Remove">✕</button>
            </div>
          </div>`;
      }).join('')}`;

    return `
      <div class="shared-calendar">
        ${controlsHTML}
        <div id="hubCalGrid" style="margin-bottom:20px;"></div>
        <div class="shared-events" id="hubEventList">${upcomingHTML}${historyHTML}</div>
      </div>
      ${buildEventModalHTML()}
    `;
  }

  function buildEventModalHTML() {
    const groupOptions = PROJECTS.map(p =>
      `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}</option>`
    ).join('');

    return `
      <div class="deadline-edit-backdrop" id="hubEventModal">
        <div class="deadline-edit-modal" role="dialog" aria-modal="true" aria-labelledby="hubEventModalTitle">
          <div class="deadline-edit-modal-header">
            <h3 id="hubEventModalTitle">Add Group Event</h3>
            <button class="deadline-edit-close" onclick="HubPage.closeEventModal()" aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="deadline-edit-modal-body">
            <input type="hidden" id="hubEventId" />
            <div class="form-group">
              <label class="form-label">Event Title</label>
              <input type="text" class="form-input" id="hubEventTitle" placeholder="e.g. Group Study Session" />
            </div>
            <div class="form-group">
              <label class="form-label">Group</label>
              <select class="form-select" id="hubEventGroup">
                ${groupOptions}
                <option value="All Groups">All Groups</option>
              </select>
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Date</label>
                <input type="date" class="form-input form-input--datetime" id="hubEventDate" />
              </div>
              <div class="form-group">
                <label class="form-label">Time <span class="form-label-optional">(optional)</span></label>
                <input type="time" class="form-input form-input--datetime" id="hubEventTime" />
              </div>
            </div>
          </div>
          <div class="deadline-edit-modal-footer">
            <button class="deadline-edit-btn-cancel" onclick="HubPage.closeEventModal()">Cancel</button>
            <button class="deadline-edit-btn-save"   onclick="HubPage.saveEvent()">Save</button>
          </div>
        </div>
      </div>`;
  }

  // ── Calendar grid rendering ────────────────────────────────

  function renderHubCalGrid() {
    const container = document.getElementById('hubCalGrid');
    if (!container) return;
    updateHubCalTitle();
    calView === 'month' ? renderHubMonth(container) : renderHubWeek(container);
  }

  function updateHubCalTitle() {
    const el = document.getElementById('hubCalTitle');
    if (!el) return;
    if (calView === 'month') {
      el.textContent = `${CAL_MONTHS[calMonth]} ${calYear}`;
    } else {
      const ws = getWeekStart(calDate);
      const we = new Date(ws); we.setDate(we.getDate() + 6);
      el.textContent = `${CAL_MONTHS[ws.getMonth()]} ${ws.getDate()} – ${we.getDate()}, ${ws.getFullYear()}`;
    }
  }

  function buildEventMap() {
    const map = {};
    activeGroupEvents().forEach(e => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }

  function renderHubMonth(container) {
    const today    = new Date();
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInM  = new Date(calYear, calMonth + 1, 0).getDate();
    const daysInP  = new Date(calYear, calMonth, 0).getDate();
    const evMap    = buildEventMap();

    const dayNamesHTML = CAL_DAYS.map(d => `<span>${d}</span>`).join('');
    let daysHTML = '';

    for (let i = firstDay - 1; i >= 0; i--)
      daysHTML += `<div class="planner-day-cell other-month"><div class="planner-day-num">${daysInP - i}</div></div>`;

    for (let d = 1; d <= daysInM; d++) {
      const ds      = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isToday = d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
      const evs     = evMap[ds] || [];
      const dotsHTML = evs.slice(0,3).map(e =>
        `<div class="deadline-dot group-event-dot" title="${escapeHtml(e.title)} — ${escapeHtml(e.group)}">${e.title.slice(0,10)}</div>`
      ).join('');
      daysHTML += `<div class="planner-day-cell${isToday?' today':''}"><div class="planner-day-num">${d}</div>${dotsHTML}</div>`;
    }

    const total = Math.ceil((firstDay + daysInM) / 7) * 7;
    for (let d = 1; d <= total - firstDay - daysInM; d++)
      daysHTML += `<div class="planner-day-cell other-month"><div class="planner-day-num">${d}</div></div>`;

    container.innerHTML = `
      <div class="planner-month-grid">
        <div class="planner-day-names">${dayNamesHTML}</div>
        <div class="planner-days-grid">${daysHTML}</div>
      </div>`;
  }

  function renderHubWeek(container) {
    const today     = new Date();
    const weekStart = getWeekStart(calDate);
    const evMap     = buildEventMap();
    let colsHTML    = '';

    for (let i = 0; i < 7; i++) {
      const day     = new Date(weekStart); day.setDate(day.getDate() + i);
      const ds      = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
      const isToday = day.toDateString() === today.toDateString();
      const evs     = evMap[ds] || [];
      const dotsHTML = evs.map(e =>
        `<div class="deadline-dot group-event-dot" style="margin-bottom:4px;" title="${escapeHtml(e.title)}">${e.title.slice(0,12)}</div>`
      ).join('');
      colsHTML += `
        <div class="week-day-col${isToday?' today':''}">
          <div class="week-day-header">
            <div class="week-day-name">${CAL_DAYS[day.getDay()]}</div>
            <div class="week-day-num">${day.getDate()}</div>
          </div>
          ${dotsHTML}
        </div>`;
    }
    container.innerHTML = `<div class="planner-week-grid">${colsHTML}</div>`;
  }

  // ── Calendar navigation ────────────────────────────────────

  function setCalView(view) {
    calView = view;
    document.querySelectorAll('#hub-tab-calendar .view-toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    renderHubCalGrid();
  }

  function calPrev() {
    if (calView === 'month') {
      calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; }
    } else {
      calDate.setDate(calDate.getDate() - 7);
      calMonth = calDate.getMonth(); calYear = calDate.getFullYear();
    }
    renderHubCalGrid();
  }

  function calNext() {
    if (calView === 'month') {
      calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; }
    } else {
      calDate.setDate(calDate.getDate() + 7);
      calMonth = calDate.getMonth(); calYear = calDate.getFullYear();
    }
    renderHubCalGrid();
  }

  // ── Event CRUD ─────────────────────────────────────────────

  function openAddEvent() {
    const modal = document.getElementById('hubEventModal');
    if (!modal) return;
    document.getElementById('hubEventModalTitle').textContent = 'Add Group Event';
    document.getElementById('hubEventId').value    = '';
    document.getElementById('hubEventTitle').value = '';
    document.getElementById('hubEventDate').value  = todayStr();
    document.getElementById('hubEventTime').value  = '';
    document.getElementById('hubEventGroup').selectedIndex = 0;
    modal.classList.add('open');
    setTimeout(() => document.getElementById('hubEventTitle')?.focus(), 80);
  }

  function openEditEvent(id) {
    const e = getGroupEvents().find(ev => ev.id === id);
    if (!e) return;
    const modal = document.getElementById('hubEventModal');
    if (!modal) return;
    document.getElementById('hubEventModalTitle').textContent = 'Edit Group Event';
    document.getElementById('hubEventId').value    = id;
    document.getElementById('hubEventTitle').value = e.title;
    document.getElementById('hubEventDate').value  = e.date;
    document.getElementById('hubEventTime').value  = e.time || '';
    document.getElementById('hubEventGroup').value = e.group;
    modal.classList.add('open');
    setTimeout(() => document.getElementById('hubEventTitle')?.focus(), 80);
  }

  function closeEventModal() {
    document.getElementById('hubEventModal')?.classList.remove('open');
  }

  function saveEvent() {
    const title = document.getElementById('hubEventTitle')?.value.trim();
    const date  = document.getElementById('hubEventDate')?.value;
    const time  = document.getElementById('hubEventTime')?.value || '';
    const group = document.getElementById('hubEventGroup')?.value;
    const idVal = document.getElementById('hubEventId')?.value;

    if (!title || !date) { alert('Please fill in the title and date.'); return; }

    const events = getGroupEvents();
    if (idVal) {
      const id = parseInt(idVal, 10);
      const idx = events.findIndex(e => e.id === id);
      if (idx !== -1) events[idx] = { ...events[idx], title, date, time, group };
    } else {
      events.push({ id: Date.now(), title, date, time, group, done: false });
    }

    saveGroupEvents(events);
    closeEventModal();
    refreshCalendarTab();
  }

  function markEventDone(id) {
    const events = getGroupEvents().map(e => e.id === id ? { ...e, done: true } : e);
    saveGroupEvents(events);
    // Record activity for leaderboard
    if (window.UserStats) UserStats.recordGroupEvent();
    refreshCalendarTab();
  }

  function deleteEvent(id) {
    saveGroupEvents(getGroupEvents().filter(e => e.id !== id));
    refreshCalendarTab();
  }

  function refreshCalendarTab() {
    const tab = document.getElementById('hub-tab-calendar');
    if (!tab) return;
    tab.innerHTML = buildCalendarHTML();
    renderHubCalGrid();
    // Re-attach modal backdrop listener
    document.getElementById('hubEventModal')?.addEventListener('click', e => {
      if (e.target.id === 'hubEventModal') closeEventModal();
    });
  }

  // ── Peer Chat ──────────────────────────────────────────────

  function buildChatHTML() {
    // Group Channels sidebar section
    const groupChannelsHTML = CHAT_ROOMS.map(r => `
      <div class="chat-room-item${r.id === activeChatRoom ? ' active' : ''}"
           onclick="HubPage.switchRoom('${r.id}')">
        <span class="room-icon">${r.icon}</span>
        <span class="room-name">${r.name}</span>
        ${r.unread > 0 ? `<span class="room-unread">${r.unread}</span>` : ''}
      </div>`).join('');

    // Direct Messages sidebar section
    const dmHTML = DM_CONTACTS.map(c => `
      <div class="chat-room-item chat-dm-item${c.id === activeChatRoom ? ' active' : ''}"
           onclick="HubPage.switchRoom('${c.id}')">
        <div class="dm-avatar-wrap">
          <div class="dm-avatar" style="background:${c.color}">${c.avatar}</div>
          <span class="dm-online-dot${c.online ? '' : ' offline'}"></span>
        </div>
        <span class="room-name">${c.name}</span>
        ${c.unread > 0 ? `<span class="room-unread">${c.unread}</span>` : ''}
      </div>`).join('');

    // Active conversation
    const msgs     = CHAT_MESSAGES[activeChatRoom] || [];
    const isDM     = activeChatRoom.startsWith('dm-');
    const dmContact = isDM ? DM_CONTACTS.find(c => c.id === activeChatRoom) : null;
    const groupRoom = !isDM ? CHAT_ROOMS.find(r => r.id === activeChatRoom) : null;

    const headerTitle = isDM
      ? (dmContact?.name || 'Direct Message')
      : `# ${groupRoom?.name || 'General'}`;

    const headerSub = isDM
      ? `<span class="dm-status-dot${dmContact?.online ? '' : ' offline'}"></span>
         <span class="online-count" style="color:var(--text-muted)">${dmContact?.online ? 'Online' : 'Offline'}</span>`
      : `<span class="online-count">● 4 online</span>`;

    // Linked project badge for group channels
    const linkedProject = !isDM ? PROJECTS.find(p =>
      p.name.toLowerCase().includes((groupRoom?.name || '').toLowerCase()) ||
      (groupRoom?.name || '').toLowerCase().includes(p.name.toLowerCase().split(' ')[0])
    ) : null;
    const linkedBadge = linkedProject
      ? `<span class="chat-linked-badge">${linkedProject.icon} ${linkedProject.name}</span>`
      : '';

    const msgsHTML = msgs.length === 0
      ? `<div class="chat-empty">No messages yet. Say hello! 👋</div>`
      : msgs.map(m => {
          const isYou    = m.name === 'You';
          // System/Copilot messages: role === 'system' OR name === 'Learnora'
          const isSystem = m.role === 'system' || m.name === 'Learnora';

          if (isYou) {
            return `<div class="peer-message peer-message--you">
              <div class="peer-msg-content peer-msg-content--you">
                <div class="peer-msg-text peer-msg-text--you">${escapeHtml(m.text)}</div>
              </div>
              <div class="peer-avatar peer-avatar--you" style="background:#0d9488">YO</div>
            </div>`;
          }

          // System message — no avatar, indented to align with peer bubbles
          if (isSystem) {
            return `<div class="peer-message peer-message--system">
              <div class="peer-msg-content">
                <div class="peer-msg-name peer-msg-name--system">${escapeHtml(m.name)}</div>
                <div class="peer-msg-text">${escapeHtml(m.text)}</div>
              </div>
            </div>`;
          }

          // Regular peer message — avatar + name + bubble
          return `<div class="peer-message">
            <div class="peer-avatar" style="background:${m.color}">${m.avatar}</div>
            <div class="peer-msg-content">
              <div class="peer-msg-name">${escapeHtml(m.name)}</div>
              <div class="peer-msg-text">${escapeHtml(m.text)}</div>
            </div>
          </div>`;
        }).join('');

    const placeholder = isDM
      ? `Message ${dmContact?.name || ''}…`
      : `Message #${groupRoom?.name || 'general'}…`;

    return `
      <div class="peer-chat">
        <div class="chat-rooms">
          <div class="chat-rooms-header">Channels</div>
          <div class="chat-room-list">
            <div class="chat-section-label">Group Channels</div>
            ${groupChannelsHTML}
            <div class="chat-section-label" style="margin-top:12px;">Direct Messages</div>
            ${dmHTML}
          </div>
        </div>
        <div class="peer-chat-window">
          <div class="peer-chat-header">
            <div class="peer-chat-header-left">
              <span class="peer-chat-title">${headerTitle}</span>
              ${linkedBadge}
            </div>
            <div class="peer-chat-header-right">${headerSub}</div>
          </div>
          <div class="peer-chat-messages" id="peerMessages">${msgsHTML}</div>
          <div class="peer-chat-input-row">
            <input type="text" class="peer-chat-input" id="peerInput"
                   placeholder="${placeholder}"
                   onkeydown="HubPage.handleChatKey(event)" />
            <button class="peer-send-btn" onclick="HubPage.sendPeerMessage()">Send</button>
          </div>
        </div>
      </div>`;
  }

  function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.hub-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.hub-tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `hub-tab-${tab}`);
    });
    // Always rebuild leaderboard fresh when switching to it so
    // name/points/streak changes from profile or focus sessions show immediately
    if (tab === 'leaderboard') {
      const lbTab = document.getElementById('hub-tab-leaderboard');
      if (lbTab) lbTab.innerHTML = buildLeaderboardHTML();
    }
    // Render calendar grid when switching to calendar tab
    if (tab === 'calendar') {
      renderHubCalGrid();
      document.getElementById('hubEventModal')?.addEventListener('click', e => {
        if (e.target.id === 'hubEventModal') closeEventModal();
      });
    }
  }

  function switchRoom(roomId) {
    activeChatRoom = roomId;
    // Clear unread for the opened room/DM
    const room = CHAT_ROOMS.find(r => r.id === roomId);
    if (room) room.unread = 0;
    const dm = DM_CONTACTS.find(c => c.id === roomId);
    if (dm) dm.unread = 0;

    const chatContent = document.getElementById('hub-tab-chat');
    if (chatContent) chatContent.innerHTML = buildChatHTML();
    const msgs = document.getElementById('peerMessages');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }

  function sendPeerMessage() {
    const input = document.getElementById('peerInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    const msgs = CHAT_MESSAGES[activeChatRoom] || (CHAT_MESSAGES[activeChatRoom] = []);
    msgs.push({ name: 'You', avatar: 'YO', color: '#0d9488', text });
    input.value = '';

    const container = document.getElementById('peerMessages');
    if (container) {
      const empty = container.querySelector('.chat-empty');
      if (empty) empty.remove();

      const div = document.createElement('div');
      div.className = 'peer-message peer-message--you';
      div.innerHTML = `
        <div class="peer-msg-content peer-msg-content--you">
          <div class="peer-msg-text peer-msg-text--you">${escapeHtml(text)}</div>
        </div>
        <div class="peer-avatar peer-avatar--you" style="background:#0d9488">YO</div>`;
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    }
  }

  function handleChatKey(e) {
    if (e.key === 'Enter') sendPeerMessage();
  }

  return {
    render,
    switchTab,
    switchRoom,
    sendPeerMessage,
    handleChatKey,
    // Calendar
    setCalView,
    calPrev,
    calNext,
    openAddEvent,
    openEditEvent,
    closeEventModal,
    saveEvent,
    markEventDone,
    deleteEvent,
    // Create Group
    openCreateGroup,
    closeCreateGroup,
    saveCreateGroup,
    toggleMember,
    handleGroupFile,
    removeGroupFile,
    onAssignmentToggle,
    updateCreateBtn,
    // Leaderboard (exposed for live refresh)
    buildLeaderboardHTML,
  };
})();
