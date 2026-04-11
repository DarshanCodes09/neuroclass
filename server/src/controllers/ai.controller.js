const { GoogleGenAI } = require('@google/genai');
const { getAdmin } = require('../db');
const { toTermFreqVector, cosineSimilarity } = require('../utils/vector');
const { createNotification } = require('../services/notification.service');

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
let geminiClient = null;

function getProvider() {
  if (process.env.COLAB_AGENT_URL) return 'colab';
  const configured = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  if (configured) return configured;
  if (process.env.GROQ_API_KEY) return 'groq';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return 'gemini';
  return 'offline';
}

function getGeminiClient() {
  if (geminiClient !== null) return geminiClient;
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  if (!apiKey) { geminiClient = undefined; return geminiClient; }
  try { geminiClient = new GoogleGenAI({ apiKey }); } catch (err) {
    console.warn('Gemini init failed:', err.message); geminiClient = undefined;
  }
  return geminiClient;
}

function sb() { return getAdmin(); }

async function getCourseContext(courseId, message, limit = 3) {
  if (!courseId || !message) return [];
  const { data: contentRows } = await sb()
    .from('course_contents')
    .select('content_chunk, vector_json')
    .eq('course_id', courseId);
  if (!contentRows || !contentRows.length) return [];
  const queryVector = toTermFreqVector(message);
  return contentRows
    .map((row) => ({
      chunk: row.content_chunk,
      similarity: cosineSimilarity(queryVector, row.vector_json || {}),
    }))
    .filter((r) => r.chunk)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
    .map((r) => r.chunk);
}

function mapHistoryToText(history = []) {
  return history
    .map((entry) => {
      const role = entry.role === 'model' || entry.role === 'ai' ? 'Assistant' : 'User';
      return `${role}: ${entry.content || entry.text || ''}`;
    })
    .filter(Boolean)
    .join('\n');
}

async function generateWithAnthropic({ system, prompt }) {
  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) throw new Error('Anthropic API key is missing');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 1200, system, messages: [{ role: 'user', content: prompt }] }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `Anthropic error (${response.status})`);
  const text = Array.isArray(data.content)
    ? data.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n')
    : '';
  return text.trim();
}

async function generateWithGemini({ system, prompt, history = [] }) {
  const ai = getGeminiClient();
  if (!ai) throw new Error('Gemini client unavailable');
  const contents = [];
  if (system) {
    contents.push({ role: 'user', parts: [{ text: `SYSTEM CONTEXT: ${system}` }] });
    contents.push({ role: 'model', parts: [{ text: 'Understood.' }] });
  }
  contents.push(...history.map((msg) => ({ role: msg.role === 'model' ? 'model' : 'user', parts: [{ text: msg.content || msg.text || '' }] })));
  contents.push({ role: 'user', parts: [{ text: prompt }] });
  const response = await ai.models.generateContent({ model: GEMINI_MODEL, contents });
  return (response.text || '').trim();
}

async function generateWithColab({ system, prompt, history = [] }) {
  const url = process.env.COLAB_AGENT_URL;
  const fullPrompt = system ? `SYSTEM CONTEXT: ${system}\n\nUSER PROMPT: ${prompt}` : prompt;
  
  const response = await fetch(`${url}/api/agent`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Bypass-Tunnel-Reminder': 'true'
    },
    body: JSON.stringify({ prompt: fullPrompt })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Colab API failed with status ${response.status}`);
  return data.reply || '';
}

async function generateWithGroq({ system, prompt, history = [], modelOverride }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('Groq API key is missing. Please set GROQ_API_KEY in your .env file.');
  
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  
  for (const msg of history) {
      messages.push({ role: msg.role === 'model' || msg.role === 'ai' ? 'assistant' : 'user', content: msg.content || msg.text || '' });
  }
  messages.push({ role: 'user', content: prompt });

  const model = modelOverride || process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, max_tokens: 1200 }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `Groq error (${response.status})`);
  return data.choices?.[0]?.message?.content?.trim() || '';
}

const fs = require('fs');
const path = require('path');

function safeParse(text) {
  try {
    // 1. First attempt: Simple parse
    return JSON.parse(text);
  } catch (initialErr) {
    let jsonStr = '';
    try {
      // 2. Extract JSON block (greedy match for the largest {...} structure)
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON block found');
      
      jsonStr = match[0].trim();
      
      // 3. Selective Sanitization
      // We need to escape literal newlines and control characters ONLY inside string literals.
      // Replacing them everywhere (like in the previous version) breaks the structural JSON.
      
      // This regex finds content between double quotes and replaces literal newlines/tabs inside them.
      jsonStr = jsonStr.replace(/"((?:[^"\\]|\\.)*)"/g, (match, p1) => {
        const sanitized = p1
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t')
          .replace(/\x0b/g, '\\v') // vertical tab
          .replace(/\x0c/g, '\\f'); // form feed
        return `"${sanitized}"`;
      });

      // 4. Remove trailing commas (e.g., {"a":1,} -> {"a":1})
      jsonStr = jsonStr.replace(/,\s*([\}\]])/g, '$1');

      // 5. Final attempt to parse the sanitized string
      return JSON.parse(jsonStr);
    } catch (err) {
      // Diagnostic Logging
      try {
        const diagDir = path.join(__dirname, '../../diagnostics');
        if (!fs.existsSync(diagDir)) fs.mkdirSync(diagDir, { recursive: true });
        const fileName = `failed_ai_json_${Date.now()}.log`;
        fs.writeFileSync(path.join(diagDir, fileName), 
          `-- RAW RESPONSE --\n${text}\n\n-- SANITIZED --\n${jsonStr}\n\n-- ERROR --\n${err.message}`
        );
      } catch (logErr) {}

      console.error('[ai] safeParse failed again:', err.message);
      throw new Error('AI evaluation format error: ' + err.message);
    }
  }
}

async function generateText(options) {
  const provider = getProvider();
  if (provider === 'colab') return generateWithColab(options);
  if (provider === 'groq' || process.env.GROQ_API_KEY) return generateWithGroq(options);
  if (provider === 'anthropic') return generateWithAnthropic(options);
  if (provider === 'gemini') return generateWithGemini(options);
  throw new Error('No AI provider configured');
}

/**
 * Persist student query + AI reply to Supabase for LangChain/LangGraph training.
 */
async function persistQuery(studentId, courseId, queryText, aiReply, threadId) {
  try {
    await sb().from('student_queries').insert({
      student_id: studentId,
      course_id: courseId || null,
      thread_id: threadId || undefined,
      query_text: queryText,
      ai_reply: aiReply,
      provider: getProvider(),
    });
  } catch (err) {
    console.warn('[ai] Failed to persist student query:', err.message);
  }
}

const chat = async (req, res) => {
  try {
    const { message, courseId, history, studentId, threadId } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const courseContext = await getCourseContext(courseId, message);
    const systemPrompt = `You are a helpful AI tutor for NeuroClass. Provide clear, educational answers guiding the student rather than giving away solutions.${courseContext.length ? `\n\nRelevant course context:\n${courseContext.map((c, i) => `[${i + 1}] ${c}`).join('\n\n')}` : ''}`;

    let reply = "I'm sorry, I couldn't generate a response.";
    try {
      const historyText = mapHistoryToText(history || []);
      reply = await generateText({
        system: systemPrompt,
        prompt: `${historyText ? `${historyText}\n` : ''}User: ${message}\nAssistant:`,
        history: history || [],
      });
      reply = reply || "I'm sorry, I couldn't generate a response.";
    } catch (genErr) {
      console.warn('[ai] Generation failed, offline fallback:', genErr.message);
      reply = 'I am currently in offline mode. I am still here to help you study — what topic would you like to discuss?';
    }

    // Persist to Supabase for AI agent training
    if (studentId) {
      await persistQuery(studentId, courseId, message, reply, threadId);
    }

    // Also store in interactions table (for LangGraph checkpointing compatibility)
    if (studentId && courseId) {
      const threadUUID = threadId || undefined;
      await sb().from('interactions').insert([
        { user_id: studentId, course_id: courseId, thread_id: threadUUID, role: 'user', content: message },
        { user_id: studentId, course_id: courseId, thread_id: threadUUID, role: 'ai', content: reply },
      ]).then(({ error }) => { if (error) console.warn('[ai] interactions insert error:', error.message); });
    }

    return res.json({ reply, provider: getProvider() });
  } catch (error) {
    console.error('[ai] chat error:', error);
    return res.status(500).json({ error: 'Failed to communicate with AI Tutor' });
  }
};

const evaluate = async (req, res) => {
  try {
    const { assignmentPrompt, maxScore = 100, submission, textContent, courseId, instructorId, studentId, assignmentId } = req.body;
    const answerText = (submission || textContent || '').trim();
    
    // 1. Validation: Empty answer
    console.log("Student Answer:", answerText);
    if (!answerText) return res.status(400).json({ error: 'Empty submission' });

    // 2. Fetch course AI profile (Rubric + Samples)
    const { data: profile } = courseId
      ? await sb().from('ai_training_profiles').select('*').eq('course_id', courseId).single()
      : { data: null };

    if (!profile) return res.status(404).json({ error: 'AI not trained yet. No course profile found.' });

    const rubric = profile.rubric_json;
    const state = typeof profile.vector_state === 'string' ? JSON.parse(profile.vector_state) : profile.vector_state;
    const samples = state?.samples || [];
    
    console.log("Samples:", samples);

    // 3. Peer-to-Peer Plagiarism Check
    let plagiarismScore = 0;
    let matchId = null;
    const currentVector = toTermFreqVector(answerText);

    if (assignmentId) {
      const { data: peers } = await sb()
        .from('submissions')
        .select('id, student_answer, vector_json')
        .eq('assignment_id', assignmentId)
        .not('student_id', 'eq', studentId);

      if (peers && peers.length > 0) {
        for (const peer of peers) {
          const sim = cosineSimilarity(currentVector, peer.vector_json || {});
          if (sim > plagiarismScore) {
            plagiarismScore = sim;
            matchId = peer.id;
          }
        }
      }
    }

    // 4. Validation: AI Training check
    if (!samples.length) {
      return res.status(400).json({ error: 'AI not trained yet. Please add evaluation samples first.' });
    }

    // 5. Build prompt (Strict AI Persona)
    const samplesText = samples.map((s, i) => `
Example ${i + 1} (${s.sampleType} quality — ${s.marks} marks):
Answer: ${s.answer}
Feedback: ${s.feedback}
`).join('\n');

    const evalPrompt = `You are a high-level academic professor and a BRUTALLY HONEST, strict evaluator. 
    Your goal is to provide a GENUINE and AUTHENTIC evaluation. 

    ### EVALUATION POLICIES (NON-NEGOTIABLE):
    1. **Subject Relevancy Gate**: If the student's answer is unrelated to the "Assignment Prompt" or is about a different subject entirely, YOU MUST AWARD EXACTLY 0 TOTAL MARKS.
    2. **Fact-Check First**: If the answer contains major factual hallucinations or incorrect academic concepts, penalize heavily (minimum 50% deduction on Content).
    3. **No Pity Marks**: Do not award marks for effort, grammar, or structure if the core content is wrong or missing.
    4. **Forensic Analysis**: You must prove your score with evidence. Quote the student and compare it to the Rubric/Samples.

    Rubric:
    ${JSON.stringify(rubric, null, 2)}
    
    Gold Standard Samples (Follow these strictly for quality benchmarks):
    ${samplesText}
    
    Student Answer to Critique:
    ${answerText}
    
    Context:
    - Assignment: ${assignmentPrompt || 'General Evaluation'}
    - Peer Similarity: ${Math.round(plagiarismScore * 100)}%
    
    CRITICAL FEEDBACK STRUCTURE:
    - [RELEVANCY CHECK]: State explicitly if the answer is on-topic.
    - [CONTENT GAP ANALYSIS]: List exactly what key concepts from the rubric are MISSING in the student's answer.
    - [CRITERION FEEDBACK]: Forensic justification for every point deducted.
    
    Return ONLY JSON:
    {
      "marks": {"criterion_name": awarded_marks},
      "total": number (total marks 0-100),
      "feedback": "STRUCTURED ANALYSIS:\n\n[RELEVANCY]: {On-topic/Off-topic}\n\n[GAP ANALYSIS]: {missing concepts}\n\n[Criterion-by-Criterion Justification]...",
      "plagiarism_score": 0-100,
      "relevancy_score": 0-1 (0 if wrong subject),
      "confidence": number
    }`;

    // 6. Call AI with Tiered Fallback
    let evaluationData;
    const modelTier = [
      'llama-3.3-70b-versatile', // Confirmed OK
      'llama-3.1-8b-instant'     // Confirmed OK
    ];

    let lastError = null;
    for (const model of modelTier) {
      try {
        console.log(`[ai] Attempting evaluation with model: ${model}`);
        const outputText = await generateWithGroq({ 
          system: 'You are a strict academic evaluator. Return valid JSON only. USE STANDARD JSON ESCAPING for newlines (\\n) and tabs (\\t) inside string values. DO NOT include literal newlines within quotes.', 
          prompt: evalPrompt,
          modelOverride: model
        });
        evaluationData = safeParse(outputText);
        if (evaluationData) {
           evaluationData.model = model;
           break; 
        }
      } catch (err) {
        lastError = err.message;
        console.warn(`[ai] Model ${model} failed:`, lastError);
        // Continue to next model
      }
    }

    if (!evaluationData) {
      console.error('[ai] All AI models failed. Last error:', lastError);
      return res.status(503).json({ 
        error: 'AI Engine Unavailable', 
        reason: lastError || "All configured models failed to respond.",
        suggestion: lastError?.includes('rate limit') ? 'Wait a few minutes and try again.' : 'Check your GROQ_API_KEY or Groq status page.'
      });
    }

    // 7. Dynamic Score Mapping & Relevancy Gate
    let finalScore = Number(evaluationData.total || 0);
    
    // Hard Relevancy Gate: If AI says it's off-topic, force 0
    if (evaluationData.relevancy_score === 0) {
      finalScore = 0;
      evaluationData.feedback = `[OFF-TOPIC REJECTION]: This answer is unrelated to the required subject. Marks have been zeroed.\n\n` + (evaluationData.feedback || '');
    }

    finalScore = Math.min(Math.max(finalScore, 0), 100);

    if (instructorId) await createNotification(instructorId, `An assignment was AI-graded${studentId ? ` for student ${studentId}` : ''}.`);

    return res.json({ 
      score: finalScore, 
      feedback: evaluationData.feedback || 'No feedback generated.',
      marks: evaluationData.marks || {},
      plagiarismScore: Math.max(evaluationData.plagiarism_score || 0, Math.round(plagiarismScore * 100)),
      vector: currentVector,
      model: evaluationData.model || 'Groq AI' 
    });
  } catch (error) {
    const fs = require('fs');
    fs.writeFileSync('last_ai_error.log', error.stack || String(error));
    console.error('[ai] evaluate error:', error);
    return res.status(500).json({ error: 'Evaluation system failure: ' + error.message });
  }
};

module.exports = { chat, evaluate, generateText };
