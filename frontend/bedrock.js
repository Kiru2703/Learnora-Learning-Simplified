/* ============================================================
   bedrock.js — AWS Bedrock AI client
   ============================================================
   All AI calls in Learnora route through this module.
   It POSTs to a configurable API Gateway endpoint which
   proxies to AWS Lambda → Bedrock (Claude 3 Haiku).

   SETUP:
     1. Deploy backend/template.yaml with AWS SAM.
     2. Copy the API Gateway URL into BEDROCK_API_URL below,
        OR set window.LEARNORA_API_URL before this script loads.
   ============================================================ */

const BedrockAI = (() => {

  // ── Configuration ─────────────────────────────────────────
  // Replace with your deployed API Gateway invoke URL.
  // e.g. "https://abc123.execute-api.ap-southeast-1.amazonaws.com/prod"
  const API_URL = window.LEARNORA_API_URL || 'https://egufrsd9ae.execute-api.ap-southeast-5.amazonaws.com/prod';

  // Model to use — Claude Haiku 4.5 via Bedrock Converse API
  // Supports text + image input
  const MODEL_ID = 'global.anthropic.claude-haiku-4-5-20251001-v1:0';

  // System prompt shared across all Learnora AI features
  const SYSTEM_PROMPT = `You are Learnora Copilot, an expert AI tutor built into
the Learnora learning platform. You help students understand topics, answer doubts,
generate learning pathways, create quiz questions, and provide feedback on answers.
Always be concise, encouraging, and pedagogically sound. Format responses clearly.
When generating structured data (pathways, questions), respond with valid JSON only.`;

  // ── Core fetch wrapper ────────────────────────────────────
  async function _call(messages, { maxTokens = 1024, temperature = 0.7 } = {}) {
    if (!API_URL || API_URL === 'YOUR_API_GATEWAY_URL_HERE') {
      throw new Error('BEDROCK_NOT_CONFIGURED');
    }

    const response = await fetch(`${API_URL}/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_id:    MODEL_ID,
        system:      SYSTEM_PROMPT,
        messages,
        max_tokens:  maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => response.statusText);
      throw new Error(`Bedrock API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    // Lambda returns { content: "..." }
    return data.content || '';
  }

  // ── Helper: convert a File/Blob to base64 ─────────────────
  async function _fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // result is "data:image/jpeg;base64,XXXX" — strip the prefix
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ── Public API ────────────────────────────────────────────

  /**
   * Chat — general learning assistant (text only).
   */
  async function chat(userMessage, { history = [] } = {}) {
    const messages = [
      ...history,
      { role: 'user', content: userMessage },
    ];
    return _call(messages, { maxTokens: 1024, temperature: 0.7 });
  }

  /**
   * Chat with an image — sends text + image to the model.
   * @param {string} text - User's text message
   * @param {File|Blob} imageFile - Image file (jpeg, png, gif, webp)
   * @param {Array} history - Previous messages
   */
  async function chatWithImage(text, imageFile, { history = [] } = {}) {
    const base64 = await _fileToBase64(imageFile);
    const mediaType = imageFile.type || 'image/jpeg';

    const content = [
      { type: 'image', data: base64, media_type: mediaType },
      { type: 'text',  text: text || 'What is in this image?' },
    ];

    const messages = [
      ...history,
      { role: 'user', content },
    ];
    return _call(messages, { maxTokens: 1024, temperature: 0.7 });
  }

  /**
   * Generate a learning pathway from a topic or uploaded notes.
   * Returns a parsed pathway object: { title, steps: [{topic, name, description}] }
   */
  async function generatePathway(query, fileContent = null) {
    const jsonFormat = `Return JSON only in this exact format:
{
  "title": "Topic Name Learning Pathway",
  "steps": [
    { "topic": "Topic 1", "name": "Step name", "description": "One sentence description" },
    { "topic": "Topic 2", "name": "Step name", "description": "One sentence description" }
  ]
}
Include 4-6 steps. Return JSON only, no other text.`;

    let userMsg;
    if (fileContent) {
      userMsg = `Generate a structured learning pathway based on the following context:\n\n${fileContent.slice(0, 4000)}\n\nThe user asked: "${query}"\n\n${jsonFormat}`;
    } else {
      userMsg = `Generate a structured learning pathway for: "${query}"\n\n${jsonFormat}`;
    }

    const raw = await _call(
      [{ role: 'user', content: userMsg }],
      { maxTokens: 800, temperature: 0.4 }
    );

    // Parse JSON — strip any markdown fences if present
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      // Fallback: extract JSON object from response
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error('Failed to parse pathway JSON from Bedrock response');
    }
  }

  /**
   * Answer a doubt question in the context of a topic.
   * Returns a plain-text answer string.
   */
  async function answerDoubt(question, topicTitle) {
    const msg = `The student is studying "${topicTitle}" and asks: "${question}"\n\nProvide a clear, concise explanation in 2-4 sentences. Be specific to the topic.`;
    return _call(
      [{ role: 'user', content: msg }],
      { maxTokens: 400, temperature: 0.6 }
    );
  }

  /**
   * Generate MCQ + short-answer questions for a topic.
   * Returns parsed array of question objects.
   */
  async function generateQuestions(topicTitle, count = 4) {
    const msg = `Generate ${count} exam questions for the topic "${topicTitle}".
Return JSON only in this exact format:
[
  {
    "type": "mcq",
    "text": "Question text?",
    "opts": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0
  },
  {
    "type": "short",
    "text": "Short answer question?",
    "answer": "keyword",
    "hint": "Hint for the student."
  }
]
Mix MCQ and short-answer questions. Return JSON array only.`;

    const raw = await _call(
      [{ role: 'user', content: msg }],
      { maxTokens: 1000, temperature: 0.5 }
    );

    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (match) return JSON.parse(match[0]);
      throw new Error('Failed to parse questions JSON');
    }
  }

  /**
   * Evaluate a short-answer response and return feedback + score.
   * Returns { correct: bool, score: 0|1, feedback: string }
   */
  async function evaluateAnswer(question, studentAnswer, topicTitle) {
    const msg = `Topic: "${topicTitle}"
Question: "${question}"
Student answer: "${studentAnswer}"

Evaluate this answer. Return JSON only:
{ "correct": true/false, "score": 1 or 0, "feedback": "Brief encouraging feedback in one sentence." }`;

    const raw = await _call(
      [{ role: 'user', content: msg }],
      { maxTokens: 200, temperature: 0.3 }
    );

    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      // Safe fallback
      return { correct: false, score: 0, feedback: raw.slice(0, 120) };
    }
  }

  /**
   * Generate topic notes/content for a given topic title.
   * Returns an HTML string suitable for #topicNotes.
   */
  async function generateNotes(topicTitle, pathwayName) {
    const msg = `Generate comprehensive study notes for the topic "${topicTitle}" (part of the "${pathwayName}" pathway).

Format as clean HTML using only: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <code>, <pre><code>.
Include: overview, key concepts, examples, and a summary.
Keep it educational and concise (400-600 words).`;

    return _call(
      [{ role: 'user', content: msg }],
      { maxTokens: 1200, temperature: 0.5 }
    );
  }

  // ── Configured check ──────────────────────────────────────
  function isConfigured() {
    return API_URL && API_URL !== 'YOUR_API_GATEWAY_URL_HERE';
  }

  return {
    chat,
    chatWithImage,
    generatePathway,
    answerDoubt,
    generateQuestions,
    evaluateAnswer,
    generateNotes,
    isConfigured,
  };
})();
