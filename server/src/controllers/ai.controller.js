const { GoogleGenAI } = require('@google/genai');
const { find, first } = require('../store');
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
  if (!apiKey) {
    geminiClient = undefined;
    return geminiClient;
  }

  try {
    geminiClient = new GoogleGenAI({ apiKey });
  } catch (error) {
    console.warn('Gemini client initialization failed. Using fallback mode.', error.message);
    geminiClient = undefined;
  }

  return geminiClient;
}

function getCourseContext(courseId, message, limit = 3) {
  if (!courseId || !message) return [];

  const course = first('courses', (row) => row.id === courseId);
  if (!course) return [];

  const contentRows = find('course_contents', (row) => row.course_id === courseId);
  const queryVector = toTermFreqVector(message);

  return contentRows
    .map((row) => ({
      chunk: row.content_chunk,
      similarity: cosineSimilarity(queryVector, row.vector_json || {}),
    }))
    .filter((row) => row.chunk)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
    .map((row) => row.chunk);
}

function mapHistoryToText(history = []) {
  return history
    .map((entry) => {
      const role = entry.role === 'model' || entry.role === 'ai' ? 'Assistant' : 'User';
      const text = entry.content || entry.text || '';
      return `${role}: ${text}`;
    })
    .filter(Boolean)
    .join('\n');
}

async function generateWithAnthropic({ system, prompt }) {
  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) {
    throw new Error('Anthropic API key is missing');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1200,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || `Anthropic request failed (${response.status})`);
  }

  const text = Array.isArray(data.content)
    ? data.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
    : '';

  return text.trim();
}

async function generateWithGemini({ system, prompt, history = [] }) {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error('Gemini client unavailable');
  }

  const contents = [];
  if (system) {
    contents.push({
      role: 'user',
      parts: [{ text: `SYSTEM CONTEXT: ${system}` }],
    });
    contents.push({
      role: 'model',
      parts: [{ text: 'Understood. I will follow this context.' }],
    });
  }

  contents.push(
    ...history.map((msg) => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content || msg.text || '' }],
    }))
  );

  contents.push({
    role: 'user',
    parts: [{ text: prompt }],
  });

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents,
  });

  return (response.text || '').trim();
}

async function generateText(options) {
  const provider = getProvider();
  if (provider === 'anthropic') {
    return generateWithAnthropic(options);
  }
  if (provider === 'gemini') {
    return generateWithGemini(options);
  }
  throw new Error('No AI provider configured');
}

const chat = async (req, res) => {
  try {
    const { message, courseId, history } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const courseContext = getCourseContext(courseId, message);
    const systemPrompt = `You are a helpful AI tutor for a course platform called NeuroClass. Provide clear, concise, and educational answers focusing on guiding the student rather than just giving away the solution.${courseContext.length ? `\n\nRelevant course context:\n${courseContext.map((chunk, index) => `[${index + 1}] ${chunk}`).join('\n\n')}` : ''}`;

    let reply = "I'm sorry, I couldn't generate a response.";
    try {
      const historyText = mapHistoryToText(history || []);
      reply = await generateText({
        system: systemPrompt,
        prompt: `${historyText ? `${historyText}\n` : ''}User: ${message}\nAssistant:`,
        history: history || [],
      });
      reply = reply || "I'm sorry, I couldn't generate a response.";
    } catch (generationError) {
      console.warn('AI tutor generation failed. Using offline fallback.', generationError.message);
      reply = 'I am currently in offline mode because the AI provider could not be reached. However, I am still here to help you study. What topic would you like to discuss?';
    }

    return res.json({ reply, provider: getProvider() });
  } catch (error) {
    console.error('Error in chat controller:', error);
    return res.status(500).json({ error: 'Failed to communicate with AI Tutor' });
  }
};

const evaluate = async (req, res) => {
  try {
    const {
      assignmentPrompt,
      maxScore = 100,
      submission,
      textContent,
      courseId,
      instructorId,
      studentId,
    } = req.body;

    const answerText = (submission || textContent || '').trim();
    if (!answerText) {
      return res.status(400).json({ error: 'submission or textContent is required.' });
    }

    const profile = courseId
      ? first('ai_training_profiles', (p) => p.course_id === courseId)
      : null;

    const answerVector = toTermFreqVector(answerText);
    let scoredBySimilarity = null;

    if (profile && profile.vector_state) {
      const state = typeof profile.vector_state === 'string'
        ? JSON.parse(profile.vector_state)
        : profile.vector_state;
      const samples = state.samples || [];
      if (samples.length) {
        const withSimilarity = samples.map((sample) => ({
          ...sample,
          similarity: cosineSimilarity(answerVector, sample.vector || {}),
        }));
        withSimilarity.sort((a, b) => b.similarity - a.similarity);
        const top = withSimilarity.slice(0, 3);
        const weightedScore = top.reduce((acc, sample) => acc + (sample.marks * sample.similarity), 0);
        const totalWeight = top.reduce((acc, sample) => acc + sample.similarity, 0);
        const normalized = totalWeight ? weightedScore / totalWeight : 0;
        scoredBySimilarity = {
          score: Math.max(0, Math.min(Number(maxScore), Number(normalized.toFixed(2)))),
          topExamples: top.map((sample) => ({
            sampleType: sample.sampleType,
            marks: sample.marks,
            similarity: Number(sample.similarity.toFixed(3)),
            feedback: sample.feedback,
          })),
        };
      }
    }

    let evaluationData = scoredBySimilarity
      ? {
          score: scoredBySimilarity.score,
          feedback: `Similarity-based evaluation completed.\nTop matching examples:\n${scoredBySimilarity.topExamples.map((entry) => `- ${entry.sampleType.toUpperCase()} (${entry.similarity}): ${entry.feedback}`).join('\n')}`,
        }
      : null;

    if (!evaluationData) {
      const profileContext = profile?.rubric_json
        ? `\n\nInstructor rubric guidance:\n${JSON.stringify(profile.rubric_json)}`
        : '';
      const evaluationPrompt = `You are an expert Auto-Evaluator for NeuroClass.
Evaluate the following student submission based on this assignment prompt/rubric.

Assignment Prompt/Rubric:
${assignmentPrompt || 'Evaluate for general quality.'}

Maximum Possible Score: ${maxScore || 100}

Student Submission:
${answerText}
${profileContext}

Please respond with a JSON object ONLY containing exactly two keys: "score" (a number) and "feedback" (a string formatted in markdown explaining the score). Do not wrap the JSON in code blocks.`;

      try {
        const outputText = await generateText({
          system: 'You grade student work carefully and return valid JSON only.',
          prompt: evaluationPrompt,
        });

        try {
          const cleanText = outputText.replace(/```json/g, '').replace(/```/g, '').trim();
          evaluationData = JSON.parse(cleanText);
        } catch (parseError) {
          console.error('Failed to parse AI JSON output:', parseError, 'Raw output:', outputText);
          evaluationData = { score: 0, feedback: outputText };
        }
      } catch (generationError) {
        console.warn('AI evaluation failed. Falling back to offline scoring.', generationError.message);
        evaluationData = {
          score: Math.round(Number(maxScore) * 0.75),
          feedback: 'Submission received. Auto-grading engine running in offline/mock mode. Pending manual instructor review.',
        };
      }
    }

    if (instructorId) {
      await createNotification(
        instructorId,
        `An assignment was graded by AI${studentId ? ` for student ${studentId}` : ''}.`
      );
    }

    return res.json({
      score: Number(evaluationData.score || 0),
      feedback: evaluationData.feedback || 'No feedback generated.',
      model: scoredBySimilarity ? 'similarity' : getProvider(),
    });
  } catch (error) {
    console.error('Error in evaluate controller:', error);
    return res.status(500).json({ error: 'Failed to evaluate submission' });
  }
};

module.exports = {
  chat,
  evaluate,
};
