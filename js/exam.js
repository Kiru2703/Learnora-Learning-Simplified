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
          <p>Upload your notes and auto-generate practice questions.</p>
        </div>

        <div class="upload-zone" id="uploadZone">
          <input type="file" id="fileInput" accept=".pdf,.txt,.docx,.md,.ppt,.pptx" />
          <span class="upload-icon">📄</span>
          <div class="upload-title">Drop your notes here</div>
          <div class="upload-subtitle">Supports PDF, TXT, DOCX, MD — or <span>click to browse</span></div>
        </div>

        <div id="uploadedFileInfo" style="display:none"></div>

        <button class="exam-generate-btn" id="generateBtn" onclick="ExamPage.generate()">
          <span>✦</span> Generate Questions
        </button>

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
    const btn = document.getElementById('generateBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span> Generating...';
    }

    questions = [...SAMPLE_QUESTIONS];
    answers = {};
    score = 0;

    setTimeout(() => {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>✦</span> Regenerate Questions';
      }
      renderQuestions();
    }, 1500);
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
