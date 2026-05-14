/* ============================================================
   topic.js — Topic view, Quick Question, Exam Simulator
   ============================================================ */

// ── Quick Question pool (populated dynamically) ──────────────
const QUICK_QUESTIONS = {
  'default': [
    { q: 'No questions available yet. Complete a topic to generate questions.', opts: ['OK'], correct: 0 },
  ],
};

// Per-topic question index (cycles through pool)
const qqIndex = {};

function renderQuickQuestion(topicId) {
  const pool = QUICK_QUESTIONS[topicId] || QUICK_QUESTIONS['default'];
  if (!qqIndex[topicId]) qqIndex[topicId] = 0;
  const q = pool[qqIndex[topicId] % pool.length];
  qqIndex[topicId]++;

  const optsHTML = q.opts.map((o, i) => `
    <button class="qq-option" id="qq-opt-${i}"
            onclick="answerQuickQuestion(${i}, ${q.correct}, '${topicId}')">
      <span class="qq-option-letter">${String.fromCharCode(65+i)}</span>
      ${o}
    </button>`).join('');

  const container = document.getElementById('qqContent');
  if (!container) return;
  container.innerHTML = `
    <div class="qq-question-text">${q.q}</div>
    <div class="qq-options">${optsHTML}</div>
    <div class="qq-feedback" id="qqFeedback"></div>
  `;
}

function answerQuickQuestion(chosen, correct, topicId) {
  const isCorrect = chosen === correct;
  document.querySelectorAll('.qq-option').forEach((btn, i) => {
    btn.disabled = true;
    if (i === correct) btn.classList.add('correct');
    else if (i === chosen && !isCorrect) btn.classList.add('wrong');
  });
  const fb = document.getElementById('qqFeedback');
  if (fb) {
    fb.className = `qq-feedback show ${isCorrect ? 'correct' : 'wrong'}`;
    fb.textContent = isCorrect
      ? '✓ Correct! Well done.'
      : `✗ Not quite. The correct answer was ${String.fromCharCode(65+correct)}.`;
  }
  if (isCorrect) _bumpTopicProgress(topicId, 5);
}

function _bumpTopicProgress(topicId, delta) {
  const fill = document.getElementById('topicProgressFill');
  const pct  = document.getElementById('topicProgressPct');
  if (!fill || !pct) return;
  const current = parseInt(fill.style.width) || 0;
  const next    = Math.min(100, current + delta);
  fill.style.width = next + '%';
  pct.textContent  = next + '%';
  if (window.PATHWAY_DATA?.[topicId]) PATHWAY_DATA[topicId].progress = next;
}

// ── Topic Exam Simulator ──────────────────────────────────────
const TopicExam = (() => {
  // Exam questions — populated dynamically by Bedrock
  const EXAM_QUESTIONS = { 'default': [] };

    let currentTopicId = null;
  let answers        = {};
  let score          = 0;
  let history        = [];
  // Pending file attachment (text + file can coexist before sending)
  let _pendingFileName = null;
  let _pendingFileSize = null;

  function getQuestions(topicId) {
    return (EXAM_QUESTIONS[topicId] || EXAM_QUESTIONS['default']).slice();
  }

  function open(topicId) {
    currentTopicId = topicId;
    answers        = {};
    score          = 0;
    history        = [];

    const parentPw   = window.PATHWAYS?.find(pw => pw.topics.some(t => t.id === topicId));
    const topicData  = parentPw?.topics.find(t => t.id === topicId);
    const topicTitle = window.PATHWAY_DATA?.[topicId]?.title || topicData?.title || 'Topic';
    const pathName   = parentPw?.name || 'Pathway';
    const pathId     = parentPw?.id   || '';
    const questions  = getQuestions(topicId);

    let pathwayPage = document.getElementById('page-pathway');
    if (!pathwayPage) {
      pathwayPage = document.createElement('div');
      pathwayPage.id = 'page-pathway';
      pathwayPage.className = 'page';
      document.getElementById('mainContent').appendChild(pathwayPage);
      if (window.PAGES) PAGES.push('pathway');
    }

    (window.PAGES || []).forEach(p => {
      const el = document.getElementById(`page-${p}`);
      if (el) el.classList.remove('active');
    });
    pathwayPage.classList.add('active');
    if (window.currentPage !== undefined) window.currentPage = 'pathway';

    const questionsHTML = questions.map((q, i) => _buildCard(q, i)).join('');

    pathwayPage.innerHTML = `
      <div class="exam-page-wrapper">

        <div class="exam-view-header">
          <div class="exam-view-header-left">
            <div class="exam-view-title">&#9889; Exam Simulator</div>
            <div class="exam-view-meta">${topicTitle} &middot; <span id="examQCount">${questions.length}</span> questions</div>
          </div>
          <div class="exam-view-header-right">
            <button class="exam-gen-btn" onclick="TopicExam.generateMore()">
              &#10022; Generate More
            </button>
            <span class="exam-score-badge" id="examScoreBadge">Score: 0 / ${questions.length}</span>
          </div>
        </div>

        <div class="exam-body">

          <div id="examQuestions">${questionsHTML}</div>

          <div id="examAnswers">
            <div class="exam-answers-label">
              <span>&#128203; Answer Sheet</span>
              <span class="exam-answers-hint" id="examAnswersHint">MCQ: click an option above &nbsp;&bull;&nbsp; Short answer: type below</span>
            </div>

            <div id="examAnswerHistory">
              <div class="exam-ah-empty" id="examAhEmpty">
                <span>&#128221;</span>
                <span>Your submitted answers will appear here with feedback.</span>
              </div>
            </div>

            <div id="examInputBar">

              <div class="exam-ib-drag-overlay" id="examIbDragOverlay" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <span>Drop file to attach</span>
              </div>

              <div class="exam-ib-file-preview" id="examIbFilePreview" style="display:none;">
                <span class="exam-ib-fp-icon">&#128196;</span>
                <div class="exam-ib-fp-info">
                  <span class="exam-ib-fp-name" id="examIbFpName"></span>
                  <span class="exam-ib-fp-size" id="examIbFpSize"></span>
                </div>
                <button class="exam-ib-fp-remove" onclick="TopicExam.clearFile()" title="Remove file" aria-label="Remove file">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <div class="exam-ib-row" id="examIbRow">
                <input type="file" id="examIbFileInput" accept=".pdf,.txt,.md,.ppt,.pptx" style="display:none" onchange="TopicExam.handleFileSelect(event)" />
                <textarea
                  class="exam-ib-textarea"
                  id="examIbTextarea"
                  placeholder="Type your answer..."
                  rows="1"
                  onkeydown="TopicExam.handleKey(event)"
                  oninput="TopicExam.autoResize(this)"
                ></textarea>
                <button class="exam-ib-btn exam-ib-attach" onclick="document.getElementById('examIbFileInput').click()" title="Attach file" aria-label="Attach file">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                </button>
                <button class="exam-ib-btn exam-ib-mic" id="examIbMicBtn" onclick="TopicExam.toggleMic()" title="Voice input" aria-label="Voice input">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                </button>
                <button class="exam-ib-btn exam-ib-send" onclick="TopicExam.submitAnswer()" title="Submit answer" aria-label="Submit answer">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </div>

              <div class="exam-ib-mic-status" id="examIbMicStatus" style="display:none;">
                <span class="exam-ib-mic-pulse"></span>
                <span id="examIbMicText">Listening&#8230;</span>
              </div>

            </div>
          </div>

        </div>

        <div class="exam-footer">
          <button class="topic-nav-btn" onclick="openPathway('${topicId}')">&#8592; Back to Notes</button>
          <button class="topic-nav-btn" onclick="openPathwayRoadmap('${pathId}')">Back to ${pathName}</button>
        </div>

      </div>
    `;

    // Wire drag-and-drop on the whole #examAnswers panel
    const answersPanel = document.getElementById('examAnswers');
    if (answersPanel) {
      answersPanel.addEventListener('dragover', e => {
        e.preventDefault();
        document.getElementById('examIbDragOverlay')?.classList.add('active');
      });
      answersPanel.addEventListener('dragleave', e => {
        if (!answersPanel.contains(e.relatedTarget)) {
          document.getElementById('examIbDragOverlay')?.classList.remove('active');
        }
      });
      answersPanel.addEventListener('drop', e => {
        e.preventDefault();
        document.getElementById('examIbDragOverlay')?.classList.remove('active');
        const f = e.dataTransfer.files?.[0];
        if (f) _attachFile(f);
      });
    }

    // Init mic state
    _examMicActive = false;
    _examMicRecognition = null;
    // Reset pending file state
    _pendingFileName = null;
    _pendingFileSize = null;

    if (window.closeSidebar) closeSidebar();
  }

  function _buildCard(q, i) {
    if (q.type === 'mcq') {
      const optsHTML = q.opts.map((o, j) => `
        <button class="exam-q-option" id="eq-opt-${i}-${j}"
                onclick="TopicExam.answerMCQ(${i}, ${j})">
          <span class="exam-q-option-letter">${String.fromCharCode(65+j)}</span>${o}
        </button>`).join('');
      return `
        <div class="exam-question-card" id="eq-card-${i}">
          <div class="exam-q-header">
            <div class="exam-q-num">${i+1}</div>
            <div class="exam-q-text">${q.text}</div>
          </div>
          <div class="exam-q-options">${optsHTML}</div>
          <div class="exam-q-feedback" id="eq-fb-${i}"></div>
        </div>`;
    }
    // Short answer card — no inline input; user types in the unified bar below
    return `
      <div class="exam-question-card" id="eq-card-${i}">
        <div class="exam-q-header">
          <div class="exam-q-num">${i+1}</div>
          <div class="exam-q-text">${q.text}</div>
        </div>
        <div class="exam-q-short-hint">Short answer &#8212; type in the answer bar below and click Send.</div>
        <div class="exam-q-feedback" id="eq-fb-${i}"></div>
      </div>`;
  }

  function answerMCQ(qIdx, chosen) {
    const questions = getQuestions(currentTopicId);
    const q = questions[qIdx];
    if (answers[qIdx] !== undefined) return;
    answers[qIdx] = chosen;
    const isCorrect = chosen === q.correct;
    if (isCorrect) score++;

    q.opts.forEach((_, j) => {
      const btn = document.getElementById(`eq-opt-${qIdx}-${j}`);
      if (!btn) return;
      btn.disabled = true;
      if (j === q.correct) btn.classList.add('correct');
      else if (j === chosen && !isCorrect) btn.classList.add('wrong');
    });

    const card = document.getElementById(`eq-card-${qIdx}`);
    if (card) card.classList.add(isCorrect ? 'answered-correct' : 'answered-wrong');

    const fb = document.getElementById(`eq-fb-${qIdx}`);
    if (fb) {
      fb.className = `exam-q-feedback show ${isCorrect ? 'correct' : 'wrong'}`;
      fb.innerHTML = isCorrect ? '&#10003; Correct!' : `&#10007; Incorrect. Answer: ${String.fromCharCode(65+q.correct)}.`;
    }

    _updateScore();
    _addHistory(q.text, q.opts[chosen], isCorrect, isCorrect ? 'Correct!' : `Incorrect. Answer was ${String.fromCharCode(65+q.correct)}.`, null, null);
    _bumpProgress(isCorrect);
  }

  // submitAnswer — routes to MCQ (no-op, handled by click) or short answer
  function submitAnswer() {
    const textarea  = document.getElementById('examIbTextarea');
    if (!textarea) return;
    const text = textarea.value.trim();
    // Require at least text OR a file
    if (!text && !_pendingFileName) return;

    // Capture and clear the pending file before any early returns
    const attachedFile = _pendingFileName;
    const attachedSize = _pendingFileSize;

    const questions = getQuestions(currentTopicId);
    // Find next unanswered short-answer question
    const qIdx = questions.findIndex((q, i) => q.type === 'short' && answers[i] === undefined);
    if (qIdx === -1) {
      // All short answers done — log it anyway
      _addHistory(
        '(No pending short-answer questions)',
        text || '(file only)',
        false,
        'All short-answer questions have been answered.',
        attachedFile, attachedSize
      );
      _clearInput(textarea);
      return;
    }

    const q         = questions[qIdx];
    answers[qIdx]   = text || attachedFile;

    // Clear input immediately so UX feels responsive
    _clearInput(textarea);

    // Evaluate with Bedrock if available, otherwise use keyword match
    if (window.BedrockAI && BedrockAI.isConfigured()) {
      const topicTitle = window.PATHWAY_DATA?.[currentTopicId]?.title || currentTopicId;
      BedrockAI.evaluateAnswer(q.text, text || '(file submitted)', topicTitle)
        .then(result => {
          const isCorrect = result.correct === true;
          if (isCorrect) score++;
          const card = document.getElementById(`eq-card-${qIdx}`);
          if (card) card.classList.add(isCorrect ? 'answered-correct' : 'answered-wrong');
          const fb = document.getElementById(`eq-fb-${qIdx}`);
          if (fb) {
            fb.className = `exam-q-feedback show ${isCorrect ? 'correct' : 'wrong'}`;
            fb.innerHTML = isCorrect ? `&#10003; ${result.feedback}` : `&#10007; ${result.feedback}`;
            card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
          _updateScore();
          _addHistory(q.text, text || '(see attached file)', isCorrect, result.feedback, attachedFile, attachedSize);
          _bumpProgress(isCorrect);
        })
        .catch(() => {
          // Fallback to keyword match on error
          const isCorrect = text ? text.toLowerCase().includes(q.answer.toLowerCase()) : false;
          if (isCorrect) score++;
          const card = document.getElementById(`eq-card-${qIdx}`);
          if (card) card.classList.add(isCorrect ? 'answered-correct' : 'answered-wrong');
          const fb = document.getElementById(`eq-fb-${qIdx}`);
          if (fb) {
            fb.className = `exam-q-feedback show ${isCorrect ? 'correct' : 'wrong'}`;
            fb.innerHTML = isCorrect ? '&#10003; Good answer!' : `&#10007; Hint: ${q.hint}`;
            card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
          _updateScore();
          _addHistory(q.text, text || '(see attached file)', isCorrect, isCorrect ? 'Good answer!' : `Hint: ${q.hint}`, attachedFile, attachedSize);
          _bumpProgress(isCorrect);
        });
    } else {
      const isCorrect = text ? text.toLowerCase().includes(q.answer.toLowerCase()) : false;
      if (isCorrect) score++;
      const card = document.getElementById(`eq-card-${qIdx}`);
      if (card) card.classList.add(isCorrect ? 'answered-correct' : 'answered-wrong');
      const fb = document.getElementById(`eq-fb-${qIdx}`);
      if (fb) {
        fb.className = `exam-q-feedback show ${isCorrect ? 'correct' : 'wrong'}`;
        fb.innerHTML = isCorrect ? '&#10003; Good answer!' : `&#10007; Hint: ${q.hint}`;
        card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      _updateScore();
      _addHistory(q.text, text || '(see attached file)', isCorrect, isCorrect ? 'Good answer!' : `Hint: ${q.hint}`, attachedFile, attachedSize);
      _bumpProgress(isCorrect);
    }
  }

  function _clearInput(textarea) {
    textarea.value = '';
    textarea.style.height = 'auto';
    // Clear file attachment
    _pendingFileName = null;
    _pendingFileSize = null;
    const preview = document.getElementById('examIbFilePreview');
    if (preview) preview.style.display = 'none';
    // Reset file input so same file can be re-attached
    const fi = document.getElementById('examIbFileInput');
    if (fi) fi.value = '';
  }

  // Keep old name as alias for any legacy calls
  function submitShortAnswer() { submitAnswer(); }

  function handleKey(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitAnswer();
    }
  }

  function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  function generateMore() {
    const container = document.getElementById('examQuestions');
    if (!container) return;
    const baseIdx = container.querySelectorAll('.exam-question-card').length;
    const extra = [
      { type: 'mcq',   text: 'Which of the following best describes a model?',
        opts: ['A physical replica','A mathematical representation','A dataset','A programming language'], correct: 1 },
      { type: 'short', text: 'What is the purpose of a validation set?',
        answer: 'validation', hint: 'Used to tune hyperparameters and prevent overfitting.' },
    ];
    extra.forEach((q, i) => {
      container.insertAdjacentHTML('beforeend', _buildCard(q, baseIdx + i));
    });
    // Update question count in header
    const countEl = document.getElementById('examQCount');
    if (countEl) countEl.textContent = container.querySelectorAll('.exam-question-card').length;
    _updateScore();
    // Scroll to new questions
    container.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleFileSelect(event) {
    const file = event.target.files?.[0];
    if (file) _attachFile(file);
    event.target.value = '';
  }

  function clearFile() {
    const preview = document.getElementById('examIbFilePreview');
    if (preview) preview.style.display = 'none';
    _pendingFileName = null;
    _pendingFileSize = null;
  }

  function _attachFile(file) {
    const MAX = 50 * 1024 * 1024;
    if (file.size > MAX) { return; }
    _pendingFileName = file.name;
    _pendingFileSize = (file.size / 1024).toFixed(1) + ' KB';
    const nameEl  = document.getElementById('examIbFpName');
    const sizeEl  = document.getElementById('examIbFpSize');
    const preview = document.getElementById('examIbFilePreview');
    if (nameEl)  nameEl.textContent  = file.name;
    if (sizeEl)  sizeEl.textContent  = _pendingFileSize;
    if (preview) preview.style.display = 'flex';
    // Keep the text row visible — user can type + attach simultaneously
    document.getElementById('examIbTextarea')?.focus();
  }

  // ── Mic for exam input bar ────────────────────────────────

  function _updateScore() {
    const questions = getQuestions(currentTopicId);
    const total = document.getElementById('examQuestions')?.querySelectorAll('.exam-question-card').length || questions.length;
    const badge = document.getElementById('examScoreBadge');
    if (badge) badge.textContent = `Score: ${score} / ${total}`;
  }

  function _addHistory(questionText, answerText, isCorrect, feedback, fileName, fileSize) {
    // Remove empty state
    document.getElementById('examAhEmpty')?.remove();

    const container = document.getElementById('examAnswerHistory');
    if (!container) return;

    const now  = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Build optional file chip
    const fileChip = fileName
      ? `<div class="exam-ah-file">
           <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
             <polyline points="14 2 14 8 20 8"/>
           </svg>
           <span class="exam-ah-file-name">${_escapeHtml(fileName)}</span>
           <span class="exam-ah-file-size">${_escapeHtml(fileSize || '')}</span>
         </div>`
      : '';

    const item = document.createElement('div');
    item.className = `exam-ah-item ${isCorrect ? 'correct' : 'wrong'}`;
    item.innerHTML = `
      <div class="exam-ah-meta">
        <span class="exam-ah-dot ${isCorrect ? 'correct' : 'wrong'}"></span>
        <span class="exam-ah-q">${_escapeHtml(questionText)}</span>
        <span class="exam-ah-time">${time}</span>
        <span class="exam-ah-mark ${isCorrect ? 'correct' : 'wrong'}">${isCorrect ? '+1' : '0'}</span>
      </div>
      <div class="exam-ah-answer">${_escapeHtml(String(answerText))}</div>
      ${fileChip}
      <div class="exam-ah-feedback ${isCorrect ? 'correct' : 'wrong'}">${_escapeHtml(feedback)}</div>
    `;
    container.appendChild(item);
    container.scrollTop = container.scrollHeight;
  }

  function _escapeHtml(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _bumpProgress(isCorrect) {
    if (!isCorrect) return;
    _bumpTopicProgress(currentTopicId, 10);
  }

  // ── Mic for exam input bar ────────────────────────────────
  let _examMicActive      = false;
  let _examMicRecognition = null;

  function toggleMic() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      _examShowMicStatus('Voice input not supported in this browser.', true);
      return;
    }
    _examMicActive ? _examStopMic() : _examStartMic();
  }

  function _examStartMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    _examMicRecognition = new SR();
    _examMicRecognition.lang = 'en-US';
    _examMicRecognition.interimResults = true;
    _examMicRecognition.continuous = false;

    _examMicRecognition.onstart = () => {
      _examMicActive = true;
      document.getElementById('examIbMicBtn')?.classList.add('listening');
      _examShowMicStatus('Listening&#8230; speak now');
    };

    _examMicRecognition.onresult = (e) => {
      let transcript = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      const ta = document.getElementById('examIbTextarea');
      if (ta) {
        ta.value = transcript;
        autoResize(ta);
        ta.focus();
      }
    };

    _examMicRecognition.onerror = (e) => {
      const msgs = {
        'not-allowed': 'Microphone access denied.',
        'no-speech':   'No speech detected. Try again.',
        'network':     'Network error during recognition.',
      };
      _examShowMicStatus(msgs[e.error] || `Error: ${e.error}`, true);
      _examStopMic(false);
    };

    _examMicRecognition.onend = () => _examStopMic(false);
    _examMicRecognition.start();
  }

  function _examStopMic(abort = true) {
    _examMicActive = false;
    document.getElementById('examIbMicBtn')?.classList.remove('listening');
    _examHideMicStatus();
    if (abort && _examMicRecognition) {
      try { _examMicRecognition.abort(); } catch (_) {}
    }
    _examMicRecognition = null;
  }

  function _examShowMicStatus(text, isError = false) {
    const bar  = document.getElementById('examIbMicStatus');
    const span = document.getElementById('examIbMicText');
    if (!bar || !span) return;
    span.innerHTML = text;
    bar.style.display = 'flex';
    bar.style.borderColor = isError ? 'rgba(239,68,68,0.4)' : 'rgba(239,68,68,0.2)';
    if (isError) setTimeout(_examHideMicStatus, 3500);
  }

  function _examHideMicStatus() {
    const bar = document.getElementById('examIbMicStatus');
    if (bar) bar.style.display = 'none';
  }

  return {
    open, answerMCQ, submitAnswer, submitShortAnswer,
    generateMore, handleFileSelect, clearFile,
    handleKey, autoResize, toggleMic
  };
})();

function openTopicExam(topicId) {
  TopicExam.open(topicId);
}

// ── Doubts Bar — topic-scoped Q&A chat ───────────────────────
const DoubtsBar = (() => {
  let currentTopicId = null;
  let micRecognition = null;
  let micActive      = false;

  // Canned answers keyed by keyword — fallback to generic
  const ANSWERS = {
    'what':        'Great question! In the context of this topic, "{q}" relates to the core concepts we covered. Let me break it down: the key idea is that AI systems learn from data rather than explicit programming.',
    'how':         'To understand how this works: the process involves multiple steps. First, data is collected and preprocessed. Then an algorithm is applied to find patterns. Finally, the model is evaluated and refined.',
    'why':         'The reason behind this is rooted in the fundamental principles of the topic. The short answer is that it optimises for a specific objective — minimising error or maximising accuracy.',
    'difference':  'The main difference lies in the approach: one method uses labeled data (supervised), while the other discovers structure on its own (unsupervised). Both have distinct use cases.',
    'example':     'A practical example: consider spam detection. The model is trained on thousands of emails labeled "spam" or "not spam", then learns to classify new emails automatically.',
    'define':      'By definition, this concept refers to a system or method that achieves a specific goal through a structured process. In this topic, it specifically means applying mathematical models to real-world data.',
    'default':     'That\'s a thoughtful question about "{q}". Based on this topic\'s content, the answer involves understanding the underlying principles. The key takeaway is that these concepts build on each other — mastering the basics makes advanced topics much clearer.',
  };

  function getAnswer(question) {
    const q   = question.toLowerCase();
    const key = Object.keys(ANSWERS).find(k => k !== 'default' && q.includes(k)) || 'default';
    return ANSWERS[key].replace('{q}', question.slice(0, 60));
  }

  function init(topicId) {
    currentTopicId = topicId;
    // Clear any previous session's messages
    const answers = document.getElementById('quickQuestionAnswers');
    if (answers) {
      answers.innerHTML = `
        <div class="qq-empty-state" id="qqEmptyState">
          <span>💬</span>
          <span>Ask a doubt about this topic — I'll answer here.</span>
        </div>`;
    }
    // Auto-resize listener
    const input = document.getElementById('qqbarInput');
    if (input) {
      input.addEventListener('input', () => autoResize(input));
    }
  }

  function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 100) + 'px';
  }

  function handleKey(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send(currentTopicId);
    }
  }

  async function send(topicId) {
    const input = document.getElementById('qqbarInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    if (micActive) stopMic();

    document.getElementById('qqEmptyState')?.remove();
    _appendUserBubble(text);

    input.value = '';
    input.style.height = 'auto';

    const typingId = _appendTyping();

    // Try Bedrock first, fall back to canned answers
    if (window.BedrockAI && BedrockAI.isConfigured()) {
      try {
        const topicTitle = window.PATHWAY_DATA?.[topicId]?.title || topicId;
        const answer = await BedrockAI.answerDoubt(text, topicTitle);
        _removeTyping(typingId);
        _appendAnswerBubble(answer);
      } catch (err) {
        console.error('Bedrock doubt error:', err);
        _removeTyping(typingId);
        _appendAnswerBubble(getAnswer(text));
      }
    } else {
      setTimeout(() => {
        _removeTyping(typingId);
        _appendAnswerBubble(getAnswer(text));
      }, 900 + Math.random() * 600);
    }
  }

  function _appendUserBubble(text) {
    const container = document.getElementById('quickQuestionAnswers');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'qq-doubt-user';
    div.innerHTML = `<div class="qq-doubt-user-bubble">${_escapeHtml(text)}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function _appendTyping() {
    const container = document.getElementById('quickQuestionAnswers');
    if (!container) return null;
    const id  = 'qq-typing-' + Date.now();
    const div = document.createElement('div');
    div.className = 'qq-doubt-answer';
    div.id = id;
    div.innerHTML = `
      <div class="qq-doubt-avatar">◈</div>
      <div class="qq-doubt-answer-bubble">
        <div class="qq-typing">
          <div class="qq-typing-dot"></div>
          <div class="qq-typing-dot"></div>
          <div class="qq-typing-dot"></div>
        </div>
      </div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return id;
  }

  function _removeTyping(id) {
    document.getElementById(id)?.remove();
  }

  function _appendAnswerBubble(text) {
    const container = document.getElementById('quickQuestionAnswers');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'qq-doubt-answer';
    div.innerHTML = `
      <div class="qq-doubt-avatar">◈</div>
      <div class="qq-doubt-answer-bubble">${_escapeHtml(text)}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function _escapeHtml(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Mic ──────────────────────────────────────────────────
  function toggleMic() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      _showMicStatus('Voice input not supported in this browser.', true);
      return;
    }
    micActive ? stopMic() : startMic();
  }

  function startMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    micRecognition = new SR();
    micRecognition.lang = 'en-US';
    micRecognition.interimResults = true;
    micRecognition.continuous = false;

    micRecognition.onstart = () => {
      micActive = true;
      document.getElementById('qqbarMicBtn')?.classList.add('listening');
      _showMicStatus('Listening… speak now');
    };

    micRecognition.onresult = (e) => {
      let transcript = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      const input = document.getElementById('qqbarInput');
      if (input) {
        input.value = transcript;
        autoResize(input);
        input.focus();
      }
    };

    micRecognition.onerror = (e) => {
      const msgs = {
        'not-allowed': 'Microphone access denied.',
        'no-speech':   'No speech detected. Try again.',
        'network':     'Network error during recognition.',
      };
      _showMicStatus(msgs[e.error] || `Error: ${e.error}`, true);
      stopMic(false);
    };

    micRecognition.onend = () => stopMic(false);
    micRecognition.start();
  }

  function stopMic(abort = true) {
    micActive = false;
    document.getElementById('qqbarMicBtn')?.classList.remove('listening');
    _hideMicStatus();
    if (abort && micRecognition) {
      try { micRecognition.abort(); } catch (_) {}
    }
    micRecognition = null;
  }

  function _showMicStatus(text, isError = false) {
    const bar  = document.getElementById('qqbarMicStatus');
    const span = document.getElementById('qqbarMicText');
    if (!bar || !span) return;
    span.textContent = text;
    bar.style.display = 'flex';
    bar.style.borderColor = isError ? 'rgba(239,68,68,0.4)' : 'rgba(239,68,68,0.2)';
    if (isError) setTimeout(_hideMicStatus, 3500);
  }

  function _hideMicStatus() {
    const bar = document.getElementById('qqbarMicStatus');
    if (bar) bar.style.display = 'none';
  }

  return { init, send, handleKey, autoResize, toggleMic };
})();
