const { GoogleGenAI } = require('@google/genai');
const { getAdmin } = require('../db');
const { toTermFreqVector, cosineSimilarity } = require('../utils/vector');
const { createNotification } = require('../services/notification.service');

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
let geminiClient = null;

function getProvider() {
  const configured = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  if (configured) return configured;
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

async function generateText(options) {
  const provider = getProvider();
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
    const { assignmentPrompt, maxScore = 100, submission, textContent, courseId, instructorId, studentId } = req.body;
    const answerText = (submission || textContent || '').trim();
    if (!answerText) return res.status(400).json({ error: 'submission or textContent is required.' });

    const { data: profile } = courseId
      ? await sb().from('ai_training_profiles').select('*').eq('course_id', courseId).single()
      : { data: null };

    const answerVector = toTermFreqVector(answerText);
    let scoredBySimilarity = null;

    if (profile && profile.vector_state) {
      const state = typeof profile.vector_state === 'string' ? JSON.parse(profile.vector_state) : profile.vector_state;
      const samples = state.samples || [];
      if (samples.length) {
        const withSim = samples.map((s) => ({ ...s, similarity: cosineSimilarity(answerVector, s.vector || {}) }));
        withSim.sort((a, b) => b.similarity - a.similarity);
        const top = withSim.slice(0, 3);
        const weightedScore = top.reduce((acc, s) => acc + s.marks * s.similarity, 0);
        const totalWeight = top.reduce((acc, s) => acc + s.similarity, 0);
        const normalized = totalWeight ? weightedScore / totalWeight : 0;
        scoredBySimilarity = {
          score: Math.max(0, Math.min(Number(maxScore), Number(normalized.toFixed(2)))),
          topExamples: top.map((s) => ({ sampleType: s.sampleType, marks: s.marks, similarity: Number(s.similarity.toFixed(3)), feedback: s.feedback })),
        };
      }
    }

    let evaluationData = scoredBySimilarity
      ? { score: scoredBySimilarity.score, feedback: `Similarity-based evaluation.\nTop matches:\n${scoredBySimilarity.topExamples.map((e) => `- ${e.sampleType.toUpperCase()} (${e.similarity}): ${e.feedback}`).join('\n')}` }
      : null;

    if (!evaluationData) {
      const profileContext = profile?.rubric_json ? `\n\nInstructor rubric:\n${JSON.stringify(profile.rubric_json)}` : '';
      const evalPrompt = `You are an Auto-Evaluator for NeuroClass.\nEvaluate the student submission.\n\nAssignment:\n${assignmentPrompt || 'Evaluate for general quality.'}\n\nMax Score: ${maxScore}\n\nStudent Submission:\n${answerText}${profileContext}\n\nRespond with JSON only: {"score": number, "feedback": string}`;
      try {
        const outputText = await generateText({ system: 'You grade student work carefully and return valid JSON only.', prompt: evalPrompt });
        try { evaluationData = JSON.parse(outputText.replace(/```json/g, '').replace(/```/g, '').trim()); }
        catch (_) { evaluationData = { score: 0, feedback: outputText }; }
      } catch (_) {
        evaluationData = { score: Math.round(Number(maxScore) * 0.75), feedback: 'Offline/mock grading. Pending manual review.' };
      }
    }

    if (instructorId) await createNotification(instructorId, `An assignment was AI-graded${studentId ? ` for student ${studentId}` : ''}.`);

    return res.json({ score: Number(evaluationData.score || 0), feedback: evaluationData.feedback || 'No feedback generated.', model: scoredBySimilarity ? 'similarity' : getProvider() });
  } catch (error) {
    console.error('[ai] evaluate error:', error);
    return res.status(500).json({ error: 'Failed to evaluate submission' });
  }
};

module.exports = { chat, evaluate };
