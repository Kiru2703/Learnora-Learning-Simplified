/* ============================================================
   exam.js — Exam Simulator page
   ============================================================ */

const ExamPage = (() => {
  let uploadedFile = null;
  let questions = [];
  let answers = {};
  let score = 0;

  const SAMPLE_QUESTIONS = [
    {
      type: 'mcq',
      text: 'What is the primary goal of supervised learning?',
      options: ['A. Find hidden patterns', 'B. Learn from labeled data', 'C. Reduce dimensionality', 'D. Cluster similar items'],
      correct: 1
    },
    {
      type: 'mcq',
      text: 'Which algorithm is commonly used for classification tasks?',
      options: ['A. K-Means', 'B. PCA', 'C. Random Forest', 'D. DBSCAN'],
      correct: 2
    },
    {
      type: 'short',
      text: 'What does "overfitting" mean in machine learning?',
      answer: 'overfitting',
      hint: 'When a model performs well on training data but poorly on new/unseen data.'
    },
    {
      type: 'mcq',
      text: 'What is a neural network inspired by?',
      options: ['A. Computer circuits', 'B. The human brain', 'C. Statistical models', 'D. Decision trees'],
      correct: 1
    },
    {
      type: 'short',
      text: 'Name one common activation function used in neural networks.',
      answer: 'relu',
      hint: 'Common examples: ReLU, Sigmoid, Tanh, Softmax.'
    }
  ];

  function render() {
    const page = document.getElementById('page-exam');
    if (!page) return;

    page.innerHTML = `
      <div class="exam-page">
        <div class="exam-page-header">
          <h1>⚡ Exam Simulator</h1>
          <p>Type a topic or upload your notes to auto-generate practice questions.</p>
        </div>

        <div style="margin-bottom:16px;">
          <div style="display:flex;gap:8px;">
            <input type="text" id="examTopicInput" placeholder="Enter a topic (e.g. Introduction to Networking)..." style="flex:1;padding:12px 16px;border-radius:8px;border:1px solid var(--border,#444);background:var(--bg-tertiary,#2a2a3e);color:var(--text-primary,#fff);font-size:14px;outline:none;" onkeydown="if(event.key==='Enter')ExamPage.generate()"/>
            <button class="exam-generate-btn" style="margin:0;padding:12px 20px;" onclick="ExamPage.generate()">
              <span>✦</span> Generate
            </button>
          </div>
        </div>

        <div class="upload-zone" id="uploadZone">
          <input type="file" id="fileInput" accept=".pdf,.txt,.docx,.md,.ppt,.pptx" />
          <span class="upload-icon">📄</span>
          <div class="upload-title">Drop your notes here</div>
          <div class="upload-subtitle">Supports PDF, TXT, DOCX, MD — or <span>click to browse</span></div>
        </div>

        <div id="uploadedFileInfo" style="display:none"></div>

        <div id="examQuestionsContainer"></div>
      </div>
    `;

    setupUpload();
  }

  function setupUpload() {
    const zone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');

    if (!zone || !fileInput) return;

    fileInput.addEventListener('change', e => {
      if (e.target.files[0]) handleFile(e.target.files[0]);
    });

    zone.addEventListener('dragover', e => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));

    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
  }

  function handleFile(file) {
    uploadedFile = file;
    const zone = document.getElementById('uploadZone');
    const info = document.getElementById('uploadedFileInfo');

    if (zone) zone.style.display = 'none';
    if (info) {
      info.style.display = 'flex';
      info.className = 'uploaded-file';
      info.innerHTML = `
        <span class="uploaded-file-icon">📄</span>
        <span class="uploaded-file-name">${file.name}</span>
        <button class="uploaded-file-remove" onclick="ExamPage.removeFile()">✕</button>
      `;
    }
  }

  function removeFile() {
    uploadedFile = null;
    const zone = document.getElementById('uploadZone');
    const info = document.getElementById('uploadedFileInfo');
    if (zone) zone.style.display = 'block';
    if (info) info.style.display = 'none';
  }

  function generate() {
    var topicInput = document.getElementById('examTopicInput');
    var topic = topicInput ? topicInput.value.trim() : '';

    // If no topic typed, try to get from uploaded file name
    if (!topic && uploadedFile) {
      topic = uploadedFile.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').replace(/\b(chapter|ch|module|mod|unit|lesson|lec|lecture)\s*\d*/gi, '').replace(/\b(vi|vii|viii|ix|iv|v|i{1,3})\b/gi, '').replace(/\bVE\b/gi, '').replace(/\s+/g, ' ').trim();
    }

    if (!topic) {
      topic = 'General Knowledge';
    }

    // Show loading
    var container = document.getElementById('examQuestionsContainer');
    if (container) {
      container.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-muted);"><div class="exam-loading-spinner"></div><p style="margin-top:1rem;">Generating questions for "' + topic + '"...</p></div>';
    }

    var prompt = 'Generate 5 exam questions for the topic "' + topic + '". Return JSON only in this exact format: [{"type":"mcq","text":"Question?","options":["A. opt1","B. opt2","C. opt3","D. opt4"],"correct":0},{"type":"short","text":"Question?","answer":"keyword","hint":"Hint."}]. Mix 3 MCQ and 2 short-answer. Return JSON array only.';

    fetch(window.LEARNORA_API_URL + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_id: 'global.anthropic.claude-haiku-4-5-20251001-v1:0',
        system: 'You are an exam question generator. Return valid JSON arrays only.',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.5
      })
    })
    .then(function(res) { return res.json(); })
    .then(function(json) {
      var raw = (json.content || '').replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      try {
        var qs = JSON.parse(raw);
        if (!Array.isArray(qs)) { var m = raw.match(/\[[\s\S]*\]/); if (m) qs = JSON.parse(m[0]); }
        questions = qs;
        answers = {};
        score = 0;
        renderQuestions();
      } catch(e) {
        // Fallback to sample questions
        questions = [...SAMPLE_QUESTIONS];
        answers = {};
        score = 0;
        renderQuestions();
      }
    })
    .catch(function(err) {
      questions = [...SAMPLE_QUESTIONS];
      answers = {};
      score = 0;
      renderQuestions();
    });
  }

  function renderQuestions() {
    const container = document.getElementById('examQuestionsContainer');
    if (!container) return;

    const html = questions.map((q, i) => buildQuestionHTML(q, i)).join('');
    container.innerHTML = `<div class="exam-questions">${html}</div>`;
  }

  function buildQuestionHTML(q, i) {
    if (q.type === 'mcq') {
      const optionsHTML = q.options.map((opt, j) => `
        <button class="option-btn" id="opt-${i}-${j}" onclick="ExamPage.selectOption(${i}, ${j})">
          <span class="option-letter">${String.fromCharCode(65 + j)}</span>
          ${opt.slice(3)}
        </button>
      `).join('');

      return `
        <div class="question-card" id="qcard-${i}">
          <div class="question-header">
            <div class="question-num">${i + 1}</div>
            <div class="question-text">${q.text}</div>
          </div>
          <div class="question-options">${optionsHTML}</div>
          <div class="answer-feedback" id="feedback-${i}"></div>
        </div>
      `;
    } else {
      return `
        <div class="question-card" id="qcard-${i}">
          <div class="question-header">
            <div class="question-num">${i + 1}</div>
            <div class="question-text">${q.text}</div>
          </div>
          <div class="answer-input-area">
            <input type="text" class="answer-input" id="answer-${i}" placeholder="Type your answer..." />
            <button class="answer-submit" onclick="ExamPage.submitShort(${i})">Submit</button>
          </div>
          <div class="answer-feedback" id="feedback-${i}"></div>
        </div>
      `;
    }
  }

  function selectOption(qIndex, optIndex) {
    const q = questions[qIndex];
    if (answers[qIndex] !== undefined) return; // Already answered

    answers[qIndex] = optIndex;
    const isCorrect = optIndex === q.correct;

    // Style all options
    q.options.forEach((_, j) => {
      const btn = document.getElementById(`opt-${qIndex}-${j}`);
      if (!btn) return;
      btn.disabled = true;
      if (j === q.correct) btn.classList.add('correct');
      else if (j === optIndex && !isCorrect) btn.classList.add('wrong');
    });

    showFeedback(qIndex, isCorrect, isCorrect ? '✓ Correct!' : `✗ Incorrect. The correct answer was: ${q.options[q.correct]}`);

    const card = document.getElementById(`qcard-${qIndex}`);
    if (card) card.classList.add(isCorrect ? 'answered-correct' : 'answered-wrong');

    if (isCorrect) score++;
    checkAllAnswered();
  }

  function submitShort(qIndex) {
    const q = questions[qIndex];
    const input = document.getElementById(`answer-${qIndex}`);
    if (!input || answers[qIndex] !== undefined) return;

    const userAnswer = input.value.trim().toLowerCase();
    if (!userAnswer) return;

    answers[qIndex] = userAnswer;
    const isCorrect = userAnswer.includes(q.answer.toLowerCase()) || q.answer.toLowerCase().includes(userAnswer);

    input.disabled = true;
    const submitBtn = input.nextElementSibling;
    if (submitBtn) submitBtn.disabled = true;

    showFeedback(qIndex, isCorrect, isCorrect ? `✓ Great answer!` : `✗ Not quite. ${q.hint}`);

    const card = document.getElementById(`qcard-${qIndex}`);
    if (card) card.classList.add(isCorrect ? 'answered-correct' : 'answered-wrong');

    if (isCorrect) score++;
    checkAllAnswered();
  }

  function showFeedback(qIndex, isCorrect, message) {
    const fb = document.getElementById(`feedback-${qIndex}`);
    if (!fb) return;
    fb.className = `answer-feedback show ${isCorrect ? 'correct' : 'wrong'}`;
    fb.textContent = message;
  }

  function checkAllAnswered() {
    if (Object.keys(answers).length === questions.length) {
      setTimeout(showScore, 600);
    }
  }

  function showScore() {
    const container = document.getElementById('examQuestionsContainer');
    if (!container) return;

    const pct = Math.round((score / questions.length) * 100);
    const emoji = pct >= 80 ? '🎉' : pct >= 60 ? '👍' : '📚';
    const msg = pct >= 80 ? 'Excellent work!' : pct >= 60 ? 'Good effort!' : 'Keep studying!';

    const scoreHTML = `
      <div class="exam-score">
        <div class="score-circle">${pct}%</div>
        <div class="score-label">${emoji} ${msg}</div>
        <div class="score-sub">You got ${score} out of ${questions.length} questions correct.</div>
        <br>
        <button class="btn-primary" onclick="ExamPage.generate()" style="margin-top:8px;">Try Again</button>
      </div>
    `;

    container.insertAdjacentHTML('beforeend', scoreHTML);
    container.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return { render, generate, selectOption, submitShort, removeFile };
})();
