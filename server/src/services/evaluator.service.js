// ================================================================
// AI Evaluation Service — 100% Groq-powered
// NO Hardcoded logic, NO Fallbacks, NO Similarity scoring
// ================================================================

const pdfParse = require('pdf-parse');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) {
  console.warn('[evaluator] Warning: GROQ_API_KEY is not set in environment variables.');
}
// Note: llama3-70b-8192 is deprecated, using llama-3.3-70b-versatile as per current Groq standards
const GROQ_MODEL = 'llama-3.3-70b-versatile';

// ----------------------------------------------------------------
// Helper: call Groq API
// ----------------------------------------------------------------
async function callGroq(messages, model = GROQ_MODEL) {
  console.log(`[evaluator] Calling Groq with model: ${model}...`);
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.1, // Fixed low temperature for consistent evaluation
      max_tokens: 2048,
      response_format: { type: "json_object" } // Force JSON mode
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  console.log("[evaluator] Groq Response:", text);
  return text;
}

// ----------------------------------------------------------------
// Utility: Safe JSON parse
// ----------------------------------------------------------------
function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Could not parse valid JSON from AI response.');
  }
}

// ----------------------------------------------------------------
// FEATURE: Extract text from uploaded file
// ----------------------------------------------------------------
async function extractText(file) {
  const { buffer, mimetype, originalname } = file;
  const ext = (originalname || '').split('.').pop().toLowerCase();

  if (mimetype === 'application/pdf' || ext === 'pdf') {
    const data = await pdfParse(buffer);
    return (data.text || '').trim();
  }

  if (mimetype.startsWith('text/') || ext === 'txt' || ext === 'md' || ext === 'csv') {
    return buffer.toString('utf-8').trim();
  }

  if (ext === 'docx' || mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    try {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return (result.value || '').trim();
    } catch {
      throw new Error('Failed to extract text from DOCX. Please use PDF or TXT.');
    }
  }

  throw new Error(`Unsupported file type: ${ext || mimetype}. Use PDF or TXT.`);
}

// ----------------------------------------------------------------
// FEATURE: Handle submission
// ----------------------------------------------------------------
async function handleSubmission({ studentAnswer, file }) {
  if (studentAnswer && studentAnswer.trim().length > 0) {
    return { studentAnswer: studentAnswer.trim(), fileUrl: null };
  }
  if (file) {
    const extracted = await extractText(file);
    if (!extracted || extracted.length < 5) throw new Error('Could not extract readable text from the file.');
    return { studentAnswer: extracted, fileUrl: null };
  }
  throw new Error('No submission provided. Please type an answer or upload a file.');
}

// ----------------------------------------------------------------
// FEATURE: Generate rubric
// ----------------------------------------------------------------
async function generateRubric(rawText, totalMarks = 10) {
  const prompt = `Extract a grading rubric from the following text. Ensure total marks = ${totalMarks}.
Return ONLY valid JSON:
{
  "name": "Generated Rubric",
  "total_marks": ${totalMarks},
  "criteria": [
    { "name": "string", "description": "string", "marks": number }
  ]
}

Text: ${rawText.substring(0, 6000)}`;

  const raw = await callGroq([
    { role: 'system', content: 'You are a rubric generator. Return ONLY valid JSON.' },
    { role: 'user', content: prompt },
  ]);

  return safeParse(raw);
}

// ----------------------------------------------------------------
// FEATURE: Fetch gold samples
// ----------------------------------------------------------------
async function getSamples(db, subjectId) {
  // Fetch high, medium, and low samples
  const { data: samples, error } = await db
    .from('eval_samples')
    .select('*')
    .eq('subject_id', subjectId)
    .in('type', ['high', 'medium', 'low']);
  
  if (error) throw error;
  return samples || [];
}

// ----------------------------------------------------------------
// FEATURE: Core evaluation function (STRICT AI ONLY)
// ----------------------------------------------------------------
async function evaluateAssignment(db, { assignmentId, studentAnswer, studentId }) {
  // 1. Extract and validate student answer
  const answerText = (studentAnswer || '').trim();
  console.log("Student Answer:", answerText);
  if (!answerText) throw new Error('Empty submission');

  // 2. Fetch assignment
  const { data: assignment, error: aErr } = await db
    .from('eval_assignments')
    .select('*')
    .eq('id', assignmentId)
    .single();
  if (aErr || !assignment) throw new Error('Assignment not found.');

  // 3. Fetch rubric for subject (NO DEFAULT FALLBACK ALLOWED)
  const { data: rubricRow } = await db
    .from('eval_rubrics')
    .select('*')
    .eq('subject_id', assignment.subject_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle(); // maybeSingle instead of single() to avoid crash
  
  if (!rubricRow) throw new Error('No rubric found for this subject. AI cannot evaluate without a rubric.');
  const rubricJson = rubricRow.rubric_json;

  // 4. Fetch gold standard samples
  const samples = await getSamples(db, assignment.subject_id);
  if (!samples || samples.length === 0) {
    throw new Error('AI not trained yet. Please add evaluation samples first.');
  }

  // 5. Build Mandatory Strict Prompt
  const samplesText = samples.map((s, i) => `
Example ${i + 1} (${s.type} quality — ${s.marks} marks):
Answer: ${s.answer}
Feedback: ${s.feedback}
`).join('\n');

  const evalPrompt = `You are a strict academic evaluator trained by a teacher.

Rubric:
${JSON.stringify(rubricJson, null, 2)}

Examples:
${samplesText}

Student Answer:
${answerText}

Instructions:
* Evaluate based on rubric and examples
* Be fair and realistic
* Do NOT return random or fixed marks
* Do NOT return 0 unless answer is empty
* Always provide meaningful feedback

Return ONLY JSON:
{
  "total": number (0-100),
  "feedback": "...",
  "confidence": 0-1
}`;

  // 6. Call Groq with Internal Retry Logic (Mandatory)
  let result = null;
  let attempts = 0;
  let lastError = null;

  while (attempts < 2) {
    try {
      attempts++;
      const rawResponse = await callGroq([
        { role: 'user', content: evalPrompt },
      ], GROQ_MODEL);

      result = safeParse(rawResponse);
      if (result && typeof result.total === 'number') {
        break; // Success
      }
      throw new Error('Invalid JSON structure from AI');
    } catch (err) {
      lastError = err.message;
      if (attempts < 2) {
        console.warn(`[evaluator] AI attempt ${attempts} failed, retrying in 2s...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  if (!result) {
    console.error(`[evaluator] AI evaluation failed after 2 attempts. Error: ${lastError}`);
    throw new Error('AI evaluation failed, please retry');
  }

  // 7. Store in DB (NO Similarity or manual scoring)
  const { data: submission, error: sErr } = await db
    .from('eval_submissions')
    .insert({
      assignment_id: assignmentId,
      student_id: studentId || null,
      student_answer: answerText,
      ai_marks: result.marks || {}, // Store sub-marks if provided, else empty
      ai_total: result.total,
      feedback: result.feedback || '',
      confidence: result.confidence || 1.0,
    })
    .select()
    .single();

  if (sErr) console.error('[evaluator] DB save error:', sErr.message);

  return {
    total: result.total,
    feedback: result.feedback || '',
    confidence: result.confidence || 1.0,
    submissionId: submission?.id || null,
  };
}

module.exports = {
  extractText,
  handleSubmission,
  generateRubric,
  getSamples,
  evaluateAssignment,
  callGroq,
};
