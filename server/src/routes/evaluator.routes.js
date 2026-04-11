const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getAdmin } = require('../db');
const {
  extractText,
  handleSubmission,
  generateRubric,
  evaluateAssignment,
  callGroq,
} = require('../services/evaluator.service');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const ext = file.originalname.split('.').pop().toLowerCase();
    if (allowed.includes(file.mimetype) || ['pdf','txt','docx','md'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOCX, and TXT files are allowed.'));
    }
  },
});
function db() { return getAdmin(); }

// ----------------------------------------------------------------
// POST /api/evaluator/upload-rubric
// Upload PDF → Extract text → Generate rubric JSON via Groq → Store
// ----------------------------------------------------------------
router.post('/upload-rubric', upload.single('file'), async (req, res) => {
  try {
    const { subject_id, total_marks } = req.body;
    if (!req.file || !subject_id) {
      return res.status(400).json({ error: 'file and subject_id are required.' });
    }

    // 1. Extract text — pass full multer file object
    const rawText = await extractText(req.file);
    if (!rawText.trim()) return res.status(400).json({ error: 'Could not extract text from the uploaded file.' });

    // 2. Generate rubric via Groq
    const rubricJson = await generateRubric(rawText, Number(total_marks) || 10);

    // 3. Store in DB
    const { data, error } = await db()
      .from('eval_rubrics')
      .insert({
        subject_id,
        rubric_json: rubricJson,
        raw_text: rawText.substring(0, 10000),
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.status(201).json({ rubric: data, rubric_json: rubricJson });
  } catch (err) {
    console.error('[evaluator] upload-rubric error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------
// POST /api/evaluator/upload-sample
// Store gold standard answer for few-shot learning
// ----------------------------------------------------------------
router.post('/upload-sample', async (req, res) => {
  try {
    const { subject_id, answer, marks, feedback, type } = req.body;
    if (!subject_id || !answer || marks === undefined || !feedback || !type) {
      return res.status(400).json({ error: 'subject_id, answer, marks, feedback, type are required.' });
    }
    if (!['high', 'medium', 'low'].includes(type)) {
      return res.status(400).json({ error: 'type must be high, medium, or low.' });
    }

    const { data, error } = await db()
      .from('eval_samples')
      .insert({ subject_id, answer, marks: Number(marks), feedback, type })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ sample: data });
  } catch (err) {
    console.error('[evaluator] upload-sample error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------
// POST /api/evaluator/create-assignment
// Create an assignment for a subject
// ----------------------------------------------------------------
router.post('/create-assignment', async (req, res) => {
  try {
    const { subject_id, type, question, test_cases, total_marks } = req.body;
    if (!subject_id || !type || !question) {
      return res.status(400).json({ error: 'subject_id, type, and question are required.' });
    }
    if (!['theory', 'coding', 'math'].includes(type)) {
      return res.status(400).json({ error: 'type must be theory, coding, or math.' });
    }

    const { data, error } = await db()
      .from('eval_assignments')
      .insert({
        subject_id,
        type,
        question,
        test_cases: test_cases || null,
        total_marks: Number(total_marks) || 10,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ assignment: data });
  } catch (err) {
    console.error('[evaluator] create-assignment error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------
// POST /api/evaluator/evaluate
// Main AI evaluation endpoint
// ----------------------------------------------------------------
router.post('/evaluate', async (req, res) => {
  try {
    const { assignment_id, student_answer, student_id } = req.body;
    if (!assignment_id || !student_answer) {
      return res.status(400).json({ error: 'assignment_id and student_answer are required.' });
    }

    const result = await evaluateAssignment(db(), {
      assignmentId: assignment_id,
      studentAnswer: student_answer,
      studentId: student_id || null, // Capture student_id for leaderboard
    });

    return res.json(result);
  } catch (err) {
    console.error('[evaluator] evaluate error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------
// POST /api/evaluator/subjects  — Create a subject
// GET  /api/evaluator/subjects  — List all subjects
// ----------------------------------------------------------------
router.post('/subjects', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required.' });
  const { data, error } = await db().from('eval_subjects').insert({ name }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ subject: data });
});

router.get('/subjects', async (req, res) => {
  const { data, error } = await db().from('eval_subjects').select('*').order('created_at');
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ subjects: data || [] });
});

// GET /api/evaluator/subjects/:id/rubric  — Fetch rubric for subject
router.get('/subjects/:id/rubric', async (req, res) => {
  const { data, error } = await db()
    .from('eval_rubrics')
    .select('*')
    .eq('subject_id', req.params.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error) return res.status(404).json({ error: 'No rubric found for this subject.' });
  return res.json({ rubric: data });
});

// GET /api/evaluator/subjects/:id/samples  — List gold samples
router.get('/subjects/:id/samples', async (req, res) => {
  const { data, error } = await db()
    .from('eval_samples')
    .select('*')
    .eq('subject_id', req.params.id)
    .order('created_at');
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ samples: data || [] });
});

// GET /api/evaluator/subjects/:id/assignments  — List assignments
router.get('/subjects/:id/assignments', async (req, res) => {
  const { data, error } = await db()
    .from('eval_assignments')
    .select('*')
    .eq('subject_id', req.params.id)
    .order('created_at');
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ assignments: data || [] });
});

// GET /api/evaluator/submissions/:assignment_id  — List submissions
router.get('/submissions/:assignment_id', async (req, res) => {
  const { data, error } = await db()
    .from('eval_submissions')
    .select('*')
    .eq('assignment_id', req.params.assignment_id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ submissions: data || [] });
});

// ----------------------------------------------------------------
// POST /api/evaluator/assignments/submit
// Unified endpoint: accepts text answer OR file upload, evaluates via Groq
// ----------------------------------------------------------------
router.post('/assignments/submit', upload.single('file'), async (req, res) => {
  try {
    const { assignment_id, student_answer, student_id } = req.body;

    if (!assignment_id) {
      return res.status(400).json({ error: 'assignment_id is required.' });
    }

    // 1. Determine submission text (text or file)
    let submissionText;
    try {
      const resolved = await handleSubmission({
        studentAnswer: student_answer,
        file: req.file || null,
      });
      submissionText = resolved.studentAnswer;
    } catch (inputErr) {
      return res.status(400).json({ error: inputErr.message });
    }

    // 2. Run AI evaluation
    const result = await evaluateAssignment(db(), {
      assignmentId: assignment_id,
      studentAnswer: submissionText,
      studentId: student_id || null, // Link to student
    });

    return res.json({
      message: 'Submission evaluated successfully',
      submissionType: req.file ? 'file' : 'text',
      fileName: req.file?.originalname || null,
      result,
    });
  } catch (err) {
    console.error('[evaluator] submit error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
