/* ============================================================
   profile.js — Profile Dashboard page
   ============================================================ */

const ProfilePage = (() => {

  // ── Static data (badges, courses, friends unchanged) ───────
  const USER = {
    badges: [],
    stats: {
      streak: 0,
      courses: 0,
      hours: 0,
      points: 0
    },
    courses: []
  };

  // ── Friends — persisted in localStorage ───────────────────
  const FRIENDS_KEY = 'learnora_friends';

  // Seed data — empty for clean start
  const FRIENDS_SEED = [];

  // Known users that can be found by name search (populated as you add friends)
  const KNOWN_USERS = [];

  function getFriends() {
    try {
      const raw = localStorage.getItem(FRIENDS_KEY);
      return raw ? JSON.parse(raw) : [...FRIENDS_SEED];
    } catch { return [...FRIENDS_SEED]; }
  }

  function saveFriends(list) {
    localStorage.setItem(FRIENDS_KEY, JSON.stringify(list));
  }

  function buildFriendsHTML() {
    const friends = getFriends();
    if (friends.length === 0) {
      return `<div class="friends-empty">No friends yet. Add someone to get started!</div>`;
    }
    return friends.map((f, i) => `
      <div class="friend-item" id="friend-item-${i}">
        <div class="friend-avatar" style="background:${f.color}">${f.avatar}</div>
        <div class="friend-info">
          <div class="friend-name">${escapeHtml(f.name)}</div>
          <div class="friend-status">${escapeHtml(f.status)}</div>
        </div>
        <div class="friend-online-dot${f.online ? '' : ' offline'}"></div>
        <button class="friend-remove-btn"
                onclick="ProfilePage.removeFriend(${i})"
                title="Remove friend"
                aria-label="Remove ${escapeHtml(f.name)}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>`).join('');
  }

  // ── Profile storage keys ───────────────────────────────────
  const KEYS = {
    name:      'learnora_username',
    username:  'learnora_profile_username',
    email:     'learnora_profile_email',
    phoneCode: 'learnora_profile_phone_code',   // e.g. "+60"
    phoneNum:  'learnora_profile_phone_num',    // local number without code
    age:       'learnora_profile_age',
    school:    'learnora_profile_school',
    pwSet:     'learnora_profile_pw_set',
  };

  // ── Country dial codes ─────────────────────────────────────
  const COUNTRIES = [
    { code: '+1',   flag: '🇺🇸', name: 'United States / Canada', pattern: /^\d{10}$/,          hint: '10 digits'        },
    { code: '+44',  flag: '🇬🇧', name: 'United Kingdom',          pattern: /^\d{10,11}$/,        hint: '10–11 digits'     },
    { code: '+60',  flag: '🇲🇾', name: 'Malaysia',                pattern: /^\d{9,11}$/,         hint: '9–11 digits'      },
    { code: '+91',  flag: '🇮🇳', name: 'India',                   pattern: /^\d{10}$/,           hint: '10 digits'        },
    { code: '+81',  flag: '🇯🇵', name: 'Japan',                   pattern: /^\d{10,11}$/,        hint: '10–11 digits'     },
    { code: '+61',  flag: '🇦🇺', name: 'Australia',               pattern: /^\d{9}$/,            hint: '9 digits'         },
    { code: '+33',  flag: '🇫🇷', name: 'France',                  pattern: /^\d{9}$/,            hint: '9 digits'         },
    { code: '+49',  flag: '🇩🇪', name: 'Germany',                 pattern: /^\d{10,11}$/,        hint: '10–11 digits'     },
    { code: '+65',  flag: '🇸🇬', name: 'Singapore',               pattern: /^\d{8}$/,            hint: '8 digits'         },
    { code: '+971', flag: '🇦🇪', name: 'UAE',                     pattern: /^\d{9}$/,            hint: '9 digits'         },
    { code: '+55',  flag: '🇧🇷', name: 'Brazil',                  pattern: /^\d{10,11}$/,        hint: '10–11 digits'     },
    { code: '+86',  flag: '🇨🇳', name: 'China',                   pattern: /^\d{11}$/,           hint: '11 digits'        },
    { code: '+82',  flag: '🇰🇷', name: 'South Korea',             pattern: /^\d{9,10}$/,         hint: '9–10 digits'      },
    { code: '+62',  flag: '🇮🇩', name: 'Indonesia',               pattern: /^\d{9,12}$/,         hint: '9–12 digits'      },
    { code: '+63',  flag: '🇵🇭', name: 'Philippines',             pattern: /^\d{10}$/,           hint: '10 digits'        },
    { code: '+66',  flag: '🇹🇭', name: 'Thailand',                pattern: /^\d{9}$/,            hint: '9 digits'         },
    { code: '+92',  flag: '🇵🇰', name: 'Pakistan',                pattern: /^\d{10}$/,           hint: '10 digits'        },
    { code: '+880', flag: '🇧🇩', name: 'Bangladesh',              pattern: /^\d{10}$/,           hint: '10 digits'        },
    { code: '+27',  flag: '🇿🇦', name: 'South Africa',            pattern: /^\d{9}$/,            hint: '9 digits'         },
    { code: '+234', flag: '🇳🇬', name: 'Nigeria',                 pattern: /^\d{10}$/,           hint: '10 digits'        },
  ];

  /** Auto-detect best default dial code from browser locale */
  function detectDefaultCode() {
    const saved = localStorage.getItem(KEYS.phoneCode);
    if (saved) return saved;
    // Map common locale regions to dial codes
    const locale = navigator.language || '';
    const region = locale.split('-')[1]?.toUpperCase() || '';
    const map = {
      MY: '+60', US: '+1', GB: '+44', IN: '+91', JP: '+81',
      AU: '+61', FR: '+33', DE: '+49', SG: '+65', AE: '+971',
      BR: '+55', CN: '+86', KR: '+82', ID: '+62', PH: '+63',
      TH: '+66', PK: '+92', BD: '+880', ZA: '+27', NG: '+234',
    };
    return map[region] || '+60'; // default Malaysia
  }

  // ── Helpers ────────────────────────────────────────────────

  function getProfile() {
    const name     = localStorage.getItem(KEYS.name)     || 'Learner';
    const username = localStorage.getItem(KEYS.username) || slugify(name);
    return {
      name,
      username,
      email:     localStorage.getItem(KEYS.email)     || '',
      phoneCode: localStorage.getItem(KEYS.phoneCode) || detectDefaultCode(),
      phoneNum:  localStorage.getItem(KEYS.phoneNum)  || '',
      age:       localStorage.getItem(KEYS.age)       || '',
      school:    localStorage.getItem(KEYS.school)    || '',
    };
  }

  function slugify(str) {
    return str.trim().toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
  }

  function initials(name) {
    return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'LN';
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function getScheduleFromDeadlines() {
    try {
      const deadlines = JSON.parse(localStorage.getItem('learnora_deadlines') || '[]');
      const today     = new Date();
      const upcoming  = deadlines
        .filter(d => new Date(d.date + 'T00:00:00') >= today)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 4);
      if (upcoming.length > 0) return upcoming.map(d => ({
        time:     new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        task:     d.topic,
        priority: d.priority,
      }));
    } catch {}
    return [
      { time: '9:00 AM',  task: 'ML Lecture Review',    priority: 'high'   },
      { time: '11:00 AM', task: 'Python Practice',       priority: 'medium' },
      { time: '2:00 PM',  task: 'Data Science HW',       priority: 'high'   },
      { time: '4:00 PM',  task: 'Group Study Session',   priority: 'low'    },
    ];
  }

  // ── Render ─────────────────────────────────────────────────

  function render() {
    const page = document.getElementById('page-profile');
    if (!page) return;

    const profile     = getProfile();
    const avatarText  = initials(profile.name);
    const handle      = `@${profile.username}`;
    const referralUrl = `learnora.app/invite/${profile.username}`;
    const profileUrl  = `learnora.app/profile/@${profile.username}`;
    const schedule    = getScheduleFromDeadlines();

    const badgesHTML = USER.badges.map(b =>
      `<span class="badge badge-purple">${b}</span>`
    ).join('');

    // Live stats — read from UserStats (same source as leaderboard)
    const liveStats  = window.UserStats ? UserStats.getStats() : {};
    const profilePoints = Number(liveStats.points)    || 0;
    const profileStreak = Number(liveStats.streakDays) || 0;

    const statsHTML = [
      { icon: '🔥', value: profileStreak,                    label: 'Day Streak'    },
      { icon: '📚', value: USER.stats.courses,               label: 'Courses'       },
      { icon: '⏱️', value: USER.stats.hours,                 label: 'Hours Learned' },
      { icon: '⭐', value: profilePoints.toLocaleString(),   label: 'Points'        },
    ].map(s => `
      <div class="stat-card">
        <span class="stat-icon">${s.icon}</span>
        <div class="stat-value">${s.value}</div>
        <div class="stat-label">${s.label}</div>
      </div>`).join('');

    const coursesHTML = USER.courses.map(c => `
      <div class="course-card">
        <span class="course-icon">${c.icon}</span>
        <div class="course-name">${c.name}</div>
        <div class="course-progress-label">${c.progress}% complete</div>
        <div class="course-progress-bar">
          <div class="course-progress-fill" style="width:${c.progress}%"></div>
        </div>
      </div>`).join('');

    const scheduleHTML = schedule.map(s => `
      <div class="schedule-item">
        <span class="schedule-time">${s.time}</span>
        <span class="schedule-task">${s.task}</span>
        <div class="schedule-priority ${s.priority}"></div>
      </div>`).join('');

    const friendsHTML = buildFriendsHTML();

    page.innerHTML = `
      <div class="profile-page">

        <!-- Hero -->
        <div class="profile-hero">
          <div class="profile-hero-inner">
            <div class="profile-avatar" id="profileAvatar">${avatarText}</div>
            <div class="profile-info">
              <div class="profile-name"  id="profileName">${escapeHtml(profile.name)}</div>
              <div class="profile-handle" id="profileHandle">${escapeHtml(handle)}</div>
              <div class="profile-badges">${badgesHTML}</div>
            </div>
            <div class="profile-hero-actions">
              <button class="btn-primary"   style="font-size:13px;padding:8px 18px;"
                      onclick="ProfilePage.openEditModal()">Edit Profile</button>
              <button class="btn-secondary" style="font-size:13px;padding:8px 18px;position:relative;"
                      id="shareBtn"
                      onclick="ProfilePage.shareProfile()">Share
                <span class="share-tooltip" id="shareTooltip">Profile link copied!</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Stats -->
        <div class="stats-row">${statsHTML}</div>

        <!-- Courses -->
        <div class="courses-section">
          <div class="section-header">
            <div>
              <div class="section-title">My Courses</div>
              <div class="section-subtitle">Your active learning tracks</div>
            </div>
            <button class="btn-secondary" style="font-size:12px;padding:6px 14px;"
                    onclick="ProfilePage.openCoursesModal()">View All</button>
          </div>
          <div class="courses-grid">${coursesHTML}</div>
        </div>

        <!-- Bottom row -->
        <div class="profile-bottom-row">

          <div class="schedule-section">
            <h3>📅 Upcoming Schedule
              <button onclick="navigateTo('planner')"
                      style="background:none;border:none;color:var(--text-accent);font-size:11px;cursor:pointer;font-weight:600;margin-left:auto;">
                View Planner →
              </button>
            </h3>
            <div class="schedule-list">${scheduleHTML}</div>
          </div>

          <div class="friends-section">
            <h3>👥 Friends
              <button class="friends-add-btn" onclick="ProfilePage.openAddFriendModal()"
                      title="Add a friend" aria-label="Add friend">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add Friend
              </button>
            </h3>
            <div class="friends-list" id="friendsList">${friendsHTML}</div>
            <div class="referral-box">
              <div class="referral-label">Invite a Friend</div>
              <div class="referral-link-row">
                <input type="text" class="referral-link" id="referralLink"
                       value="${escapeHtml(referralUrl)}" readonly />
                <button class="copy-btn" onclick="ProfilePage.copyReferral()">Copy</button>
              </div>
            </div>
          </div>

        </div>

        <!-- ── App Theme ── -->
        <div class="theme-section">
          <div class="theme-section-header">
            <span class="theme-section-icon">🎨</span>
            <div>
              <div class="theme-section-title">App Theme</div>
              <div class="theme-section-sub">Choose how Learnora looks for you</div>
            </div>
          </div>
          <div class="theme-options">

            <label class="theme-option${window.AppTheme?.get() !== 'light' ? ' selected' : ''}" id="themeOptDark">
              <input type="radio" name="appTheme" id="themeRadioDark" value="dark"
                     ${window.AppTheme?.get() !== 'light' ? 'checked' : ''}
                     onchange="AppTheme.toggle('dark');document.getElementById('themeOptDark').classList.add('selected');document.getElementById('themeOptLight').classList.remove('selected');" />
              <div class="theme-option-preview theme-preview-dark">
                <div class="tp-sidebar"></div>
                <div class="tp-content">
                  <div class="tp-bar tp-bar--accent"></div>
                  <div class="tp-bar"></div>
                  <div class="tp-bar tp-bar--short"></div>
                </div>
              </div>
              <div class="theme-option-label">
                <span class="theme-option-name">Dark</span>
                <span class="theme-option-desc">Deep navy with purple accents</span>
              </div>
              <span class="theme-option-check">✓</span>
            </label>

            <label class="theme-option${window.AppTheme?.get() === 'light' ? ' selected' : ''}" id="themeOptLight">
              <input type="radio" name="appTheme" id="themeRadioLight" value="light"
                     ${window.AppTheme?.get() === 'light' ? 'checked' : ''}
                     onchange="AppTheme.toggle('light');document.getElementById('themeOptLight').classList.add('selected');document.getElementById('themeOptDark').classList.remove('selected');" />
              <div class="theme-option-preview theme-preview-light">
                <div class="tp-sidebar"></div>
                <div class="tp-content">
                  <div class="tp-bar tp-bar--accent"></div>
                  <div class="tp-bar"></div>
                  <div class="tp-bar tp-bar--short"></div>
                </div>
              </div>
              <div class="theme-option-label">
                <span class="theme-option-name">Light</span>
                <span class="theme-option-desc">Clean white with lavender accents</span>
              </div>
              <span class="theme-option-check">✓</span>
            </label>

          </div>
        </div>

      </div>

      <!-- ── Remove Friend Confirmation Modal ── -->
      <div class="profile-modal-backdrop" id="removeFriendModal">
        <div class="profile-modal remove-friend-modal" role="dialog" aria-modal="true"
             aria-labelledby="removeFriendTitle">

          <div class="profile-modal-header">
            <div class="profile-modal-title-row">
              <span style="font-size:20px;line-height:1;">👤</span>
              <h2 class="profile-modal-title" id="removeFriendTitle">Remove Friend</h2>
            </div>
            <button class="profile-modal-close" onclick="ProfilePage.cancelRemoveFriend()" aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div class="remove-friend-body">
            <p class="remove-friend-msg">
              Are you sure you want to remove
              <strong id="removeFriendName"></strong>?
            </p>
            <p class="remove-friend-sub">They will be removed from your friends list.</p>
          </div>

          <div class="profile-modal-footer">
            <button class="profile-modal-cancel" onclick="ProfilePage.cancelRemoveFriend()">Cancel</button>
            <button class="remove-friend-confirm" onclick="ProfilePage.doRemoveFriend()">Confirm</button>
          </div>

        </div>
      </div>

      <!-- ── Add Friend Modal ── -->
      <div class="profile-modal-backdrop" id="addFriendModal">
        <div class="profile-modal add-friend-modal" role="dialog" aria-modal="true" aria-labelledby="addFriendModalTitle">

          <div class="profile-modal-header">
            <div class="profile-modal-title-row">
              <span style="font-size:20px;line-height:1;">👥</span>
              <h2 class="profile-modal-title" id="addFriendModalTitle">Add Friend</h2>
            </div>
            <button class="profile-modal-close" onclick="ProfilePage.closeAddFriendModal()" aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div class="profile-modal-body" style="gap:20px;">

            <!-- Option 1: Search by name -->
            <div class="form-group">
              <label class="form-label">Search by Name</label>
              <div class="af-search-row">
                <input type="text" class="form-input" id="afNameInput"
                       placeholder="e.g. Alex Chen"
                       oninput="ProfilePage.onAfNameInput()"
                       onkeydown="if(event.key==='Enter')ProfilePage.addFriendByName()" />
                <button class="af-add-btn" onclick="ProfilePage.addFriendByName()">Add</button>
              </div>
              <!-- Suggestions dropdown -->
              <div class="af-suggestions" id="afSuggestions" style="display:none;"></div>
              <div class="af-feedback" id="afNameFeedback"></div>
            </div>

            <div class="af-divider"><span>or</span></div>

            <!-- Option 2: Paste invite link -->
            <div class="form-group">
              <label class="form-label">Paste Invite Link</label>
              <div class="af-search-row">
                <input type="text" class="form-input" id="afLinkInput"
                       placeholder="learnora.app/invite/@username"
                       onkeydown="if(event.key==='Enter')ProfilePage.addFriendByLink()" />
                <button class="af-add-btn" onclick="ProfilePage.addFriendByLink()">Add</button>
              </div>
              <div class="af-feedback" id="afLinkFeedback"></div>
            </div>

          </div>

          <div class="profile-modal-footer">
            <button class="profile-modal-save" style="max-width:120px;margin-left:auto;"
                    onclick="ProfilePage.closeAddFriendModal()">Close</button>
          </div>

        </div>
      </div>

      <!-- ── Courses Modal ── -->
      <div class="profile-modal-backdrop" id="coursesModal">
        <div class="profile-modal courses-modal" role="dialog" aria-modal="true" aria-labelledby="coursesModalTitle">

          <div class="profile-modal-header">
            <div class="profile-modal-title-row">
              <span style="font-size:20px;line-height:1;">📚</span>
              <h2 class="profile-modal-title" id="coursesModalTitle">All Courses</h2>
            </div>
            <button class="profile-modal-close" onclick="ProfilePage.closeCoursesModal()" aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div class="courses-modal-body">
            ${buildCoursesModalList()}
          </div>

          <div class="profile-modal-footer">
            <button class="profile-modal-save" style="max-width:140px;margin-left:auto;"
                    onclick="ProfilePage.closeCoursesModal()">Close</button>
          </div>

        </div>
      </div>

      <!-- ── Edit Profile Modal ── -->
      <div class="profile-modal-backdrop" id="profileEditModal">
        <div class="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profileModalTitle">

          <div class="profile-modal-header">
            <div class="profile-modal-title-row">
              <div class="profile-modal-avatar" id="modalAvatar">${avatarText}</div>
              <h2 class="profile-modal-title" id="profileModalTitle">Edit Profile</h2>
            </div>
            <button class="profile-modal-close" onclick="ProfilePage.closeEditModal()" aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div class="profile-modal-body">

            <div class="profile-modal-grid">

              <div class="form-group">
                <label class="form-label">Full Name</label>
                <input type="text" class="form-input" id="editName"
                       value="${escapeHtml(profile.name)}"
                       placeholder="Your full name"
                       oninput="ProfilePage.previewInitials()" />
              </div>

              <div class="form-group">
                <label class="form-label">Username</label>
                <div class="profile-modal-input-prefix">
                  <span class="input-prefix">@</span>
                  <input type="text" class="form-input form-input--prefixed" id="editUsername"
                         value="${escapeHtml(profile.username)}"
                         placeholder="username" />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" class="form-input" id="editEmail"
                       value="${escapeHtml(profile.email)}"
                       placeholder="you@example.com" />
              </div>

              <div class="form-group">
                <label class="form-label">Phone Number</label>
                <div class="phone-field-row">
                  <div class="phone-country-wrap">
                    <select class="phone-country-select" id="editPhoneCode"
                            onchange="ProfilePage.onPhoneCodeChange()">
                      ${COUNTRIES.map(c =>
                        `<option value="${c.code}"${c.code === profile.phoneCode ? ' selected' : ''}>
                          ${c.flag} ${c.code}
                        </option>`
                      ).join('')}
                    </select>
                  </div>
                  <input type="tel" class="form-input phone-number-input" id="editPhoneNum"
                         value="${escapeHtml(profile.phoneNum)}"
                         placeholder="e.g. 123456789"
                         oninput="ProfilePage.onPhoneInput()" />
                </div>
                <div class="phone-hint" id="phoneHint"></div>
              </div>

              <div class="form-group">
                <label class="form-label">New Password <span class="form-label-optional">(leave blank to keep)</span></label>
                <input type="password" class="form-input" id="editPassword"
                       placeholder="••••••••" autocomplete="new-password" />
              </div>

              <div class="form-group">
                <label class="form-label">Age</label>
                <input type="number" class="form-input" id="editAge"
                       value="${escapeHtml(profile.age)}"
                       placeholder="e.g. 20" min="1" max="120" />
              </div>

            </div>

            <div class="form-group" style="margin-top:4px;">
              <label class="form-label">School / University</label>
              <input type="text" class="form-input" id="editSchool"
                     value="${escapeHtml(profile.school)}"
                     placeholder="e.g. MIT, Stanford, Online" />
            </div>

          </div>

          <div class="profile-modal-footer">
            <button class="profile-modal-cancel" onclick="ProfilePage.closeEditModal()">Cancel</button>
            <button class="profile-modal-save"   onclick="ProfilePage.saveProfile()">Save Changes</button>
          </div>

        </div>
      </div>
    `;

    // Close modal on backdrop click
    document.getElementById('profileEditModal')?.addEventListener('click', e => {
      if (e.target.id === 'profileEditModal') closeEditModal();
    });
    document.getElementById('coursesModal')?.addEventListener('click', e => {
      if (e.target.id === 'coursesModal') closeCoursesModal();
    });
    document.getElementById('addFriendModal')?.addEventListener('click', e => {
      if (e.target.id === 'addFriendModal') closeAddFriendModal();
    });
    document.getElementById('removeFriendModal')?.addEventListener('click', e => {
      if (e.target.id === 'removeFriendModal') cancelRemoveFriend();
    });
  }

  // ── Friends management ─────────────────────────────────────

  // Index of the friend pending removal — set when confirmation opens
  let _pendingRemoveIdx = -1;

  function removeFriend(idx) {
    // Show confirmation instead of removing immediately
    const friends = getFriends();
    const friend  = friends[idx];
    if (!friend) return;

    _pendingRemoveIdx = idx;

    // Update the modal message with the friend's name
    const msgEl = document.getElementById('removeFriendName');
    if (msgEl) msgEl.textContent = friend.name;

    document.getElementById('removeFriendModal')?.classList.add('open');
  }

  function cancelRemoveFriend() {
    _pendingRemoveIdx = -1;
    document.getElementById('removeFriendModal')?.classList.remove('open');
  }

  function doRemoveFriend() {
    if (_pendingRemoveIdx < 0) return;
    const friends = getFriends();
    friends.splice(_pendingRemoveIdx, 1);
    saveFriends(friends);
    _pendingRemoveIdx = -1;
    document.getElementById('removeFriendModal')?.classList.remove('open');
    // Re-render just the friends list in-place (no full page re-render)
    const list = document.getElementById('friendsList');
    if (list) list.innerHTML = buildFriendsHTML();
    // Sync hub DM contacts if available
    _syncFriendsToHub(friends);
  }

  function openAddFriendModal() {
    const modal = document.getElementById('addFriendModal');
    if (!modal) return;
    // Clear fields and feedback
    const nameInput = document.getElementById('afNameInput');
    const linkInput = document.getElementById('afLinkInput');
    if (nameInput) nameInput.value = '';
    if (linkInput) linkInput.value = '';
    _setAfFeedback('afNameFeedback', '');
    _setAfFeedback('afLinkFeedback', '');
    const sugg = document.getElementById('afSuggestions');
    if (sugg) sugg.style.display = 'none';
    modal.classList.add('open');
    setTimeout(() => nameInput?.focus(), 80);
  }

  function closeAddFriendModal() {
    document.getElementById('addFriendModal')?.classList.remove('open');
  }

  /** Live suggestion list as the user types a name */
  function onAfNameInput() {
    const val  = document.getElementById('afNameInput')?.value.trim().toLowerCase() || '';
    const sugg = document.getElementById('afSuggestions');
    if (!sugg) return;
    _setAfFeedback('afNameFeedback', '');

    if (val.length < 2) { sugg.style.display = 'none'; return; }

    const existing = getFriends().map(f => f.name.toLowerCase());
    const matches  = KNOWN_USERS.filter(u =>
      u.name.toLowerCase().includes(val) && !existing.includes(u.name.toLowerCase())
    );

    if (matches.length === 0) { sugg.style.display = 'none'; return; }

    sugg.innerHTML = matches.map(u => `
      <div class="af-suggestion-item" onclick="ProfilePage.selectSuggestion('${escapeHtml(u.name)}')">
        <div class="af-sugg-avatar" style="background:${u.color}">${u.avatar}</div>
        <span class="af-sugg-name">${escapeHtml(u.name)}</span>
      </div>`).join('');
    sugg.style.display = 'block';
  }

  function selectSuggestion(name) {
    const input = document.getElementById('afNameInput');
    if (input) input.value = name;
    const sugg = document.getElementById('afSuggestions');
    if (sugg) sugg.style.display = 'none';
  }

  function addFriendByName() {
    const name = document.getElementById('afNameInput')?.value.trim();
    if (!name) {
      _setAfFeedback('afNameFeedback', 'Please enter a name.', true);
      return;
    }

    const friends = getFriends();
    // Check already a friend
    if (friends.some(f => f.name.toLowerCase() === name.toLowerCase())) {
      _setAfFeedback('afNameFeedback', `${name} is already in your friends list.`, true);
      return;
    }

    // Look up in known users (case-insensitive)
    const found = KNOWN_USERS.find(u => u.name.toLowerCase() === name.toLowerCase());
    if (!found) {
      _setAfFeedback('afNameFeedback', `No user found with the name "${name}".`, true);
      return;
    }

    friends.push({ name: found.name, avatar: found.avatar, color: found.color, status: found.status, online: false });
    saveFriends(friends);
    _setAfFeedback('afNameFeedback', `✓ ${found.name} added to your friends!`, false);
    document.getElementById('afNameInput').value = '';
    document.getElementById('afSuggestions').style.display = 'none';
    _refreshFriendsList(friends);
  }

  function addFriendByLink() {
    const raw = document.getElementById('afLinkInput')?.value.trim() || '';
    if (!raw) {
      _setAfFeedback('afLinkFeedback', 'Please paste an invite link.', true);
      return;
    }

    // Parse username from link formats:
    //   learnora.app/invite/@username
    //   learnora.app/invite/username
    //   https://learnora.app/invite/@username
    const match = raw.match(/\/invite\/@?([a-z0-9._-]+)/i);
    if (!match) {
      _setAfFeedback('afLinkFeedback', 'Invalid link format. Expected: learnora.app/invite/@username', true);
      return;
    }

    const slug = match[1].toLowerCase();
    const friends = getFriends();

    // Try to match slug against known users (by slugified name)
    const found = KNOWN_USERS.find(u => {
      const uSlug = u.name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
      return uSlug === slug || u.name.toLowerCase().replace(/\s+/g,'') === slug;
    });

    if (!found) {
      // Accept unknown users from links — create a placeholder entry
      const displayName = slug.replace(/\./g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      if (friends.some(f => f.name.toLowerCase() === displayName.toLowerCase())) {
        _setAfFeedback('afLinkFeedback', `${displayName} is already in your friends list.`, true);
        return;
      }
      const colors = ['#7c3aed','#2563eb','#0d9488','#db2777','#d97706'];
      const color  = colors[Math.floor(Math.random() * colors.length)];
      const av     = displayName.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
      friends.push({ name: displayName, avatar: av, color, status: 'Joined via link', online: false });
      saveFriends(friends);
      _setAfFeedback('afLinkFeedback', `✓ ${displayName} added to your friends!`, false);
    } else {
      if (friends.some(f => f.name.toLowerCase() === found.name.toLowerCase())) {
        _setAfFeedback('afLinkFeedback', `${found.name} is already in your friends list.`, true);
        return;
      }
      friends.push({ name: found.name, avatar: found.avatar, color: found.color, status: found.status, online: false });
      saveFriends(friends);
      _setAfFeedback('afLinkFeedback', `✓ ${found.name} added to your friends!`, false);
    }

    document.getElementById('afLinkInput').value = '';
    _refreshFriendsList(friends);
  }

  function _setAfFeedback(id, msg, isError = false) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent   = msg;
    el.className     = `af-feedback${isError ? ' af-feedback--error' : ' af-feedback--ok'}`;
  }

  function _refreshFriendsList(friends) {
    const list = document.getElementById('friendsList');
    if (list) list.innerHTML = buildFriendsHTML();
    _syncFriendsToHub(friends);
  }

  /** Push friend list into hub DM_CONTACTS so they appear in Peer Chat */
  function _syncFriendsToHub(friends) {
    if (!window.HubPage) return;
    // HubPage exposes DM_CONTACTS via its closure — we can't mutate it directly,
    // but we can trigger a chat tab refresh if it's open
    const chatTab = document.getElementById('hub-tab-chat');
    if (chatTab?.classList.contains('active') && window.HubPage.buildChatHTML) {
      // Re-render is handled by hub.js internally; just signal a refresh
    }
  }

  // ── Courses modal ──────────────────────────────────────────

  function buildCoursesModalList() {
    return USER.courses.map((c, idx) => {
      const status     = c.progress >= 100 ? 'Completed' : 'In Progress';
      const statusClass= c.progress >= 100 ? 'cm-status--done' : 'cm-status--progress';
      const doneCount  = (c.chapters || []).filter(ch => ch.done).length;
      const totalCount = (c.chapters || []).length;

      const chaptersHTML = (c.chapters || []).map(ch => `
        <div class="cm-chapter">
          <span class="cm-chapter-dot${ch.done ? ' done' : ''}"></span>
          <span class="cm-chapter-name${ch.done ? ' done' : ''}">${escapeHtml(ch.name)}</span>
          ${ch.done ? '<span class="cm-chapter-check">✓</span>' : ''}
        </div>`).join('');

      return `
        <div class="cm-course-row" id="cm-row-${idx}">
          <div class="cm-course-header" onclick="ProfilePage.toggleCourseExpand(${idx})">
            <span class="cm-course-icon">${c.icon}</span>
            <div class="cm-course-info">
              <div class="cm-course-name">${escapeHtml(c.name)}</div>
              <div class="cm-course-meta">
                <span class="${statusClass}">${status}</span>
                ${totalCount > 0 ? `<span class="cm-chapter-count">${doneCount}/${totalCount} chapters</span>` : ''}
              </div>
            </div>
            <div class="cm-progress-wrap">
              <div class="cm-progress-bar">
                <div class="cm-progress-fill" style="width:${c.progress}%"></div>
              </div>
              <span class="cm-progress-pct">${c.progress}%</span>
            </div>
            ${totalCount > 0 ? `<span class="cm-expand-icon" id="cm-expand-${idx}">›</span>` : ''}
          </div>
          ${totalCount > 0 ? `
          <div class="cm-chapters-list" id="cm-chapters-${idx}" style="display:none;">
            ${chaptersHTML}
          </div>` : ''}
        </div>`;
    }).join('');
  }

  function openCoursesModal() {
    document.getElementById('coursesModal')?.classList.add('open');
  }

  function closeCoursesModal() {
    document.getElementById('coursesModal')?.classList.remove('open');
  }

  function toggleCourseExpand(idx) {
    const list   = document.getElementById(`cm-chapters-${idx}`);
    const icon   = document.getElementById(`cm-expand-${idx}`);
    if (!list) return;
    const open = list.style.display !== 'none';
    list.style.display = open ? 'none' : 'block';
    if (icon) icon.textContent = open ? '›' : '⌄';
    if (icon) icon.classList.toggle('expanded', !open);
  }

  // ── Edit modal ─────────────────────────────────────────────

  function openEditModal() {
    document.getElementById('profileEditModal')?.classList.add('open');
    setTimeout(() => document.getElementById('editName')?.focus(), 80);
  }

  function closeEditModal() {
    document.getElementById('profileEditModal')?.classList.remove('open');
  }

  /** Live-preview avatar initials as the user types their name */
  function previewInitials() {
    const name = document.getElementById('editName')?.value || '';
    const av   = initials(name) || 'LN';
    const modalAv = document.getElementById('modalAvatar');
    if (modalAv) modalAv.textContent = av;
  }

  function saveProfile() {
    const name      = document.getElementById('editName')?.value.trim()      || '';
    const username  = document.getElementById('editUsername')?.value.trim()  || slugify(name);
    const email     = document.getElementById('editEmail')?.value.trim()     || '';
    const phoneCode = document.getElementById('editPhoneCode')?.value        || detectDefaultCode();
    const phoneNum  = document.getElementById('editPhoneNum')?.value.trim()  || '';
    const age       = document.getElementById('editAge')?.value.trim()       || '';
    const school    = document.getElementById('editSchool')?.value.trim()    || '';
    const pw        = document.getElementById('editPassword')?.value         || '';

    if (!name) {
      document.getElementById('editName')?.classList.add('input-error');
      document.getElementById('editName')?.focus();
      return;
    }
    document.getElementById('editName')?.classList.remove('input-error');

    // Validate phone number if provided
    if (phoneNum) {
      const country = COUNTRIES.find(c => c.code === phoneCode);
      const digits  = phoneNum.replace(/\D/g, '');
      if (country && !country.pattern.test(digits)) {
        const numInput = document.getElementById('editPhoneNum');
        const hint     = document.getElementById('phoneHint');
        numInput?.classList.add('input-error');
        if (hint) { hint.textContent = `Expected format: ${country.hint} for ${country.name}`; hint.classList.add('hint-error'); }
        numInput?.focus();
        return;
      }
    }
    document.getElementById('editPhoneNum')?.classList.remove('input-error');
    const hint = document.getElementById('phoneHint');
    if (hint) { hint.textContent = ''; hint.classList.remove('hint-error'); }

    // Persist to localStorage
    localStorage.setItem(KEYS.name,      name);
    localStorage.setItem(KEYS.username,  username || slugify(name));
    localStorage.setItem(KEYS.email,     email);
    localStorage.setItem(KEYS.phoneCode, phoneCode);
    localStorage.setItem(KEYS.phoneNum,  phoneNum);
    localStorage.setItem(KEYS.age,       age);
    localStorage.setItem(KEYS.school,    school);
    if (pw) localStorage.setItem(KEYS.pwSet, '1');

    closeEditModal();
    render();

    // Always refresh leaderboard so name/username changes appear immediately,
    // regardless of whether the hub page is currently open
    if (window.UserStats) UserStats.refreshLeaderboard();
  }

  // ── Phone field handlers ───────────────────────────────────

  /** Update the placeholder hint when the country code changes */
  function onPhoneCodeChange() {
    const code    = document.getElementById('editPhoneCode')?.value;
    const country = COUNTRIES.find(c => c.code === code);
    const input   = document.getElementById('editPhoneNum');
    const hint    = document.getElementById('phoneHint');
    if (input && country) input.placeholder = `e.g. ${country.hint}`;
    // Clear any previous error when user changes country
    input?.classList.remove('input-error');
    if (hint) { hint.textContent = ''; hint.classList.remove('hint-error'); }
  }

  /** Clear error state while the user is typing the number */
  function onPhoneInput() {
    document.getElementById('editPhoneNum')?.classList.remove('input-error');
    const hint = document.getElementById('phoneHint');
    if (hint) { hint.textContent = ''; hint.classList.remove('hint-error'); }
  }

  // ── Share button ───────────────────────────────────────────

  function shareProfile() {
    const profile    = getProfile();
    const profileUrl = `https://learnora.app/profile/@${profile.username}`;

    // Copy to clipboard
    if (navigator.clipboard) {
      navigator.clipboard.writeText(profileUrl).then(showShareTooltip).catch(() => {
        fallbackCopy(profileUrl);
        showShareTooltip();
      });
    } else {
      fallbackCopy(profileUrl);
      showShareTooltip();
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta);
  }

  function showShareTooltip() {
    const tip = document.getElementById('shareTooltip');
    if (!tip) return;
    tip.classList.add('visible');
    setTimeout(() => tip.classList.remove('visible'), 2200);
  }

  // ── Referral copy ──────────────────────────────────────────

  function copyReferral() {
    const input = document.getElementById('referralLink');
    if (!input) return;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(input.value).catch(() => {
        input.select();
        document.execCommand('copy');
      });
    } else {
      input.select();
      document.execCommand('copy');
    }

    const btn = input.nextElementSibling;
    if (btn) {
      btn.textContent = 'Copied!';
      btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      setTimeout(() => {
        btn.textContent = 'Copy';
        btn.style.background = '';
      }, 2000);
    }
  }

  // ── Public surface ─────────────────────────────────────────
  return {
    render,
    openEditModal,
    closeEditModal,
    previewInitials,
    saveProfile,
    onPhoneCodeChange,
    onPhoneInput,
    shareProfile,
    copyReferral,
    openCoursesModal,
    closeCoursesModal,
    toggleCourseExpand,
    removeFriend,
    cancelRemoveFriend,
    doRemoveFriend,
    openAddFriendModal,
    closeAddFriendModal,
    onAfNameInput,
    selectSuggestion,
    addFriendByName,
    addFriendByLink,
  };
})();
