/* ============================================================
   chat.js — Chat page: onboarding, voice input, file attach,
              greeting, pathway generation
   ============================================================ */

const ChatPage = (() => {

  // ── State ──────────────────────────────────────────────────
  let attachedFile = null;
  let recognition   = null;   // SpeechRecognition instance
  let micActive     = false;

  // ── Onboarding ─────────────────────────────────────────────
  function checkOnboarding() {
    const name = localStorage.getItem('learnora_username');
    if (name) {
      // Already set — hide overlay immediately, apply greeting
      const overlay = document.getElementById('onboardingOverlay');
      if (overlay) overlay.style.display = 'none';
      applyGreeting(name);
    } else {
      // Show overlay; focus the input
      const overlay = document.getElementById('onboardingOverlay');
      if (overlay) overlay.style.display = 'flex';
      setTimeout(() => document.getElementById('onboardingName')?.focus(), 300);
    }
  }

  function submitOnboarding() {
    const input = document.getElementById('onboardingName');
    const name  = input?.value.trim();

    if (!name) {
      input?.classList.add('shake');
      input?.addEventListener('animationend', () => input.classList.remove('shake'), { once: true });
      input?.focus();
      return;
    }

    localStorage.setItem('learnora_username', name);

    const overlay = document.getElementById('onboardingOverlay');
    if (overlay) {
      overlay.classList.add('hidden');
      overlay.addEventListener('animationend', () => {
        overlay.style.display = 'none';
        overlay.classList.remove('hidden');
      }, { once: true });
    }

    applyGreeting(name);
  }

  function applyGreeting(name) {
    const el = document.getElementById('chatGreeting');
    if (el) {
      el.textContent = `Hello ${name}, what do you want to learn today?`;
    }
    // Also update the user avatar initials in messages
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    ChatPage._userInitials = initials;
  }

  // ── File attachment + drag-and-drop ───────────────────────
  // Max file size — no hard limit since we extract topic from filename for binary files
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB (only text files are sent to API; binary files use filename)
  const ALLOWED_TYPES = ['.pdf', '.docx', '.txt', '.md', '.ppt', '.pptx'];
  const FILE_ICONS = { pdf: '📕', docx: '📘', doc: '📘', txt: '📄', md: '📝', ppt: '📙', pptx: '📙' };

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    return FILE_ICONS[ext] || '📄';
  }

  function validateFile(file) {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_TYPES.includes(ext)) {
      return `File type not supported. Use PDF, DOCX, PPT, PPTX, TXT, or MD.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large (${formatBytes(file.size)}). Max 50 MB.`;
    }
    return null;
  }

  function handleFileSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    processFile(file);
    event.target.value = '';
  }

  function processFile(file) {
    const error = validateFile(file);
    if (error) { showFileError(error); return; }
    attachFile(file);
  }

  function attachFile(file) {
    attachedFile = file;

    // Show inline preview
    const preview = document.getElementById('chatFilePreview');
    const icon    = document.getElementById('cfpIcon');
    const name    = document.getElementById('cfpName');
    const size    = document.getElementById('cfpSize');
    if (icon)    icon.textContent    = getFileIcon(file.name);
    if (name)    name.textContent    = file.name;
    if (size)    size.textContent    = formatBytes(file.size);
    if (preview) preview.style.display = 'flex';

    // Tint the attach button to signal a file is ready
    document.getElementById('chatFileBtn')?.classList.add('file-attached');

    // Hide any error
    hideFileError();
  }

  function removeFile() {
    attachedFile = null;

    const preview = document.getElementById('chatFilePreview');
    if (preview) preview.style.display = 'none';

    document.getElementById('chatFileBtn')?.classList.remove('file-attached');
    hideFileError();
  }

  function showFileError(message) {
    const el   = document.getElementById('chatFileError');
    const text = document.getElementById('chatFileErrorText');
    if (text) text.textContent = message;
    if (el)   el.style.display = 'flex';
    setTimeout(hideFileError, 4000);
  }

  function hideFileError() {
    const el = document.getElementById('chatFileError');
    if (el) el.style.display = 'none';
  }

  function initDropZone() {
    const wrapper  = document.getElementById('chatInputWrapper');
    const overlay  = document.getElementById('chatDragOverlay');
    const pageDrop = document.getElementById('page-chat'); // whole page is a drop target
    if (!wrapper || !pageDrop) return;

    // dragDepth tracks nested dragenter/dragleave so the overlay
    // doesn't flicker when the cursor moves over child elements.
    let dragDepth = 0;

    // ── Page-level listeners: highlight wrapper on any drag into the page ──
    pageDrop.addEventListener('dragenter', e => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
      dragDepth++;
      wrapper.classList.add('drag-over');
    });

    pageDrop.addEventListener('dragover', e => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    pageDrop.addEventListener('dragleave', e => {
      dragDepth--;
      if (dragDepth <= 0) {
        dragDepth = 0;
        wrapper.classList.remove('drag-over');
      }
    });

    pageDrop.addEventListener('drop', e => {
      e.preventDefault();
      dragDepth = 0;
      wrapper.classList.remove('drag-over');
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    });
  }

  // ── Voice input ────────────────────────────────────────────
  function toggleMic() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      showMicStatus('Voice input is not supported in this browser.', true);
      return;
    }

    if (micActive) {
      stopMic();
    } else {
      startMic();
    }
  }

  function startMic() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang        = 'en-US';
    recognition.interimResults = true;
    recognition.continuous  = false;

    recognition.onstart = () => {
      micActive = true;
      document.getElementById('chatMicBtn')?.classList.add('active');
      showMicStatus('Listening… speak now');
    };

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      // Place transcribed text into the input — user can edit before sending
      const input = document.getElementById('chatInput');
      if (input) {
        input.value = transcript;
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        input.focus();
      }
    };

    recognition.onerror = (event) => {
      const msgs = {
        'not-allowed':  'Microphone access denied. Please allow mic permissions.',
        'no-speech':    'No speech detected. Try again.',
        'network':      'Network error during voice recognition.',
      };
      showMicStatus(msgs[event.error] || `Error: ${event.error}`, true);
      stopMic(false);
    };

    recognition.onend = () => {
      stopMic(false);
    };

    recognition.start();
  }

  function stopMic(abort = true) {
    micActive = false;
    document.getElementById('chatMicBtn')?.classList.remove('active');
    hideMicStatus();
    if (abort && recognition) {
      try { recognition.abort(); } catch (_) {}
    }
    recognition = null;
  }

  function showMicStatus(text, isError = false) {
    const bar  = document.getElementById('micStatus');
    const span = document.getElementById('micStatusText');
    if (!bar || !span) return;
    span.textContent   = text;
    bar.style.display  = 'flex';
    bar.style.borderColor = isError
      ? 'rgba(239,68,68,0.4)'
      : 'rgba(239,68,68,0.25)';
    if (isError) setTimeout(hideMicStatus, 3500);
  }

  function hideMicStatus() {
    const bar = document.getElementById('micStatus');
    if (bar) bar.style.display = 'none';
  }

  // ── Pathway data (fallback when Bedrock is not configured) ──
  const RESPONSES = [
    "Great question! Let me build a learning pathway for you.",
    "I'll create a structured plan to help you master this topic.",
    "Excellent choice! Here's your personalized learning pathway."
  ];

  // Conversation history for multi-turn chat context
  const _chatHistory = [];

  // Note: Global PATHWAYS array and PATHWAY_DATA are defined in app.js
  // We access them via window scope in addToPathwayList

  function getPathwayForQuery(query, topicHint) {
    // Use topicHint (from filename) if available, otherwise extract from query
    let topic;
    if (topicHint) {
      topic = topicHint;
    } else {
      const words = query.split(' ').filter(w => w.length > 3);
      topic = words.slice(0, 3).join(' ') || 'Your Topic';
    }
    return {
      title: `${topic} Learning Pathway`,
      steps: [
        { topic: 'Topic 1', name: `Introduction to ${topic}` },
        { topic: 'Topic 2', name: `Core Concepts of ${topic}` },
        { topic: 'Topic 3', name: `Practical Applications` },
        { topic: 'Topic 4', name: `Advanced ${topic}` },
        { topic: 'Topic 5', name: `Projects & Review` },
      ]
    };
  }

  // ── Message rendering ──────────────────────────────────────
  function addMessage(role, content, isHTML = false) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    const initials = ChatPage._userInitials || 'You';
    const avatarText = role === 'assistant' ? '◈' : initials;

    const div = document.createElement('div');
    div.className = `message ${role}`;
    div.innerHTML = `
      <div class="message-avatar">${avatarText}</div>
      <div class="message-bubble">${isHTML ? content : escapeHtml(content)}</div>
    `;

    container.appendChild(div);

    // Switch to active (has-messages) layout on first message
    const chatContainer = document.getElementById('chatContainer');
    if (chatContainer && !chatContainer.classList.contains('has-messages')) {
      chatContainer.classList.add('has-messages');
    }

    container.scrollTop = container.scrollHeight;
  }

  function showTyping() {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'message assistant';
    div.id = 'typingIndicator';
    div.innerHTML = `
      <div class="message-avatar">◈</div>
      <div class="message-bubble">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    `;
    container.appendChild(div);

    // Ensure layout is in active state
    const chatContainer = document.getElementById('chatContainer');
    if (chatContainer) chatContainer.classList.add('has-messages');

    container.scrollTop = container.scrollHeight;
  }

  function removeTyping() {
    document.getElementById('typingIndicator')?.remove();
  }

  function buildPathwayHTML(pathway, pwId) {
    const stepsHTML = pathway.steps.map((s, i) => {
      const topicId = pwId ? `${pwId}-t${i}` : `step-${i}`;
      return `
      <div class="pathway-step" onclick="openPathway('${topicId}')">
        <div class="step-num">${i + 1}</div>
        <div class="step-info">
          <div class="step-label">${s.topic}</div>
          <div class="step-name">${s.name}</div>
        </div>
        <span style="color:var(--text-muted);font-size:12px;">→</span>
      </div>
    `;
    }).join('');

    return `
      <div class="pathway-card">
        <div class="pathway-card-title">📚 ${pathway.title}</div>
        <div class="pathway-steps">${stepsHTML}</div>
      </div>
    `;
  }

  // ── Send ───────────────────────────────────────────────────
  async function sendMessage() {
    const input = document.getElementById('chatInput');
    if (!input) return;

    const text = input.value.trim();
    if (!text && !attachedFile) return;

    if (micActive) stopMic();

    let userContent = '';
    if (attachedFile) {
      userContent += `<div class="message-file-badge">📄 ${escapeHtml(attachedFile.name)}</div>`;
    }
    if (text) userContent += escapeHtml(text);

    addMessage('user', userContent || `<em>Sent a file: ${escapeHtml(attachedFile?.name || '')}</em>`, true);

    const fileForQuery = attachedFile;
    input.value = '';
    input.style.height = 'auto';
    removeFile();

    showTyping();

    const query = text || 'Generate a learning pathway from my notes';

    if (window.BedrockAI && BedrockAI.isConfigured()) {
      let fileTopic = null;
      try {
        let fileContent = null;
        const isDocumentFile = fileForQuery && [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword'
        ].includes(fileForQuery.type);

        if (fileForQuery && !isDocumentFile) {
          // Text-based files (.txt, .md): read content directly and send to AI
          try { fileContent = await fileForQuery.text(); } catch (_) {}
        }

        if (isDocumentFile) {
          // Binary files (PDF, PPTX, DOCX): extract topic from filename
          const cleanName = fileForQuery.name
            .replace(/\.[^.]+$/, '')           // remove extension
            .replace(/[-_]/g, ' ')             // replace dashes/underscores with spaces
            .replace(/\b(chapter|ch|module|mod|unit|lesson|lec|lecture)\s*\d*/gi, '') // remove chapter/module prefixes
            .replace(/\b(vi|vii|viii|ix|iv|v|i{1,3})\b/gi, '') // remove roman numerals
            .replace(/\bVE\b/gi, '')           // remove common suffixes
            .replace(/\bMQF\b/gi, '')
            .replace(/\s+/g, ' ')              // collapse whitespace
            .trim();
          fileTopic = cleanName || fileForQuery.name.replace(/\.[^.]+$/, '');
          fileContent = `The student uploaded a lecture file: "${fileForQuery.name}". The topic is: "${fileTopic}". Generate a detailed learning pathway for this topic based on your knowledge of the subject.`;
        }

        const isPathwayRequest = /pathway|plan|roadmap|learn|study|course|curriculum|teach me|how to learn|guide|make/i.test(query);

        if (isPathwayRequest || fileContent) {
          const pathway = await BedrockAI.generatePathway(query, fileContent);
          removeTyping();
          const pwId = addToPathwayList(pathway, fileTopic);
          const intro = fileForQuery
            ? `I've analysed "<strong>${escapeHtml(fileForQuery.name)}</strong>" and built a learning pathway for <strong>${escapeHtml(fileTopic)}</strong>. Click any topic to start studying!`
            : "I've built a personalised learning pathway for you. Click any topic to start studying!";
          addMessage('assistant', `${intro}<br><br>${buildPathwayHTML(pathway, pwId)}`, true);
        } else {
          _chatHistory.push({ role: 'user', content: query });
          const reply = await BedrockAI.chat(query, { history: _chatHistory.slice(-10) });
          _chatHistory.push({ role: 'assistant', content: reply });
          removeTyping();
          addMessage('assistant', _formatMarkdown(reply), true);
        }
      } catch (err) {
        console.error('Bedrock error:', err);
        removeTyping();
        // Extract topic from filename for fallback
        if (fileForQuery && !fileTopic) {
          const cleanName = fileForQuery.name
            .replace(/\.[^.]+$/, '')
            .replace(/[-_]/g, ' ')
            .replace(/\b(chapter|ch|module|mod|unit|lesson|lec|lecture)\s*\d*/gi, '')
            .replace(/\b(vi|vii|viii|ix|iv|v|i{1,3})\b/gi, '')
            .replace(/\bVE\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
          fileTopic = cleanName || fileForQuery.name.replace(/\.[^.]+$/, '');
        }
        const fallbackPathway = getPathwayForQuery(query, fileTopic);
        const fallbackPwId = addToPathwayList(fallbackPathway, fileTopic);
        addMessage('assistant', `⚠️ AI error: ${escapeHtml(err.message)}<br><br>Falling back to offline mode.<br><br>${buildPathwayHTML(fallbackPathway, fallbackPwId)}`, true);
      }
    } else {
      setTimeout(() => {
        removeTyping();
        const pathway = getPathwayForQuery(query);
        const pwId = addToPathwayList(pathway, null);
        const responseText = RESPONSES[Math.floor(Math.random() * RESPONSES.length)];
        addMessage('assistant', `${responseText}<br><br>${buildPathwayHTML(pathway, pwId)}`, true);
      }, 1000);
    }
  }

  function _formatMarkdown(text) {
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,     '<em>$1</em>')
      .replace(/`(.+?)`/g,       '<code>$1</code>')
      .replace(/\n\n/g,          '<br><br>')
      .replace(/\n/g,            '<br>');
  }

    function addToPathwayList(pathway, sourceTopic) {
    // Generate a unique ID for this pathway
    const pwId = 'pw-' + Date.now();

    // Build topics array for the global PATHWAYS structure (defined in app.js)
    const topics = pathway.steps.map((step, i) => {
      const topicId = `${pwId}-t${i}`;
      return {
        id: topicId,
        num: `${i + 1}`,
        title: step.name || step.topic,
        status: 'Not Started',
      };
    });

    // Register in the global PATHWAYS array (defined in app.js)
    if (typeof window.PATHWAYS !== 'undefined' && Array.isArray(window.PATHWAYS)) {
      const pwEntry = {
        id: pwId,
        name: pathway.title.replace(' Learning Pathway', '').replace(' Pathway', ''),
        icon: '📚',
        topics: topics,
        sourceTopic: sourceTopic || null,  // Store the extracted topic name for note generation context
      };
      window.PATHWAYS.push(pwEntry);

      // Initialize PATHWAY_DATA for each topic (content generated on open)
      topics.forEach(t => {
        window.PATHWAY_DATA[t.id] = {
          title: t.title,
          subtitle: '',
          progress: 0,
          content: null,
        };
      });

      // Re-render the sidebar pathway list
      if (typeof window.renderPathways === 'function') {
        window.renderPathways();
      }
    }

    return pwId;
  }

  // ── Helpers ────────────────────────────────────────────────
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ── Init ───────────────────────────────────────────────────
  function init() {
    // Textarea auto-resize + Enter to send
    const input = document.getElementById('chatInput');
    if (input) {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      });
    }

    // Onboarding: Enter key on name field
    const nameInput = document.getElementById('onboardingName');
    if (nameInput) {
      nameInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') submitOnboarding();
      });
    }

    // Drag-and-drop zone
    initDropZone();

    // Check first-time flow
    checkOnboarding();
  }

  // Public surface
  return {
    init,
    sendMessage,
    submitOnboarding,
    handleFileSelect,
    removeFile,
    toggleMic,
    _userInitials: 'You',
  };
})();

// ── Global wrappers (called from HTML onclick) ─────────────
function sendMessage() { ChatPage.sendMessage(); }
