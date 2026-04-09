// server/src/routes/queries.js
// Persists every student text query + AI response into student_queries table.
// This data is used for AI agent training in LangChain / LangGraph (Google Colab).

const express  = require('express');
const router   = express.Router();
const supabase = require('../supabase');

async function getUser(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  return error ? null : user;
}

// ── POST /api/queries ─────────────────────────────────────────────────────────
// Save a new student query immediately when sent.
// Body: { queryText, courseId?, context?, queryType?, sessionId?, provider? }
router.post('/', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { queryText, courseId, context, queryType, sessionId, provider } = req.body;
    if (!queryText?.trim()) return res.status(400).json({ error: 'queryText is required' });

    const { data, error } = await supabase
      .from('student_queries')
      .insert({
        student_id: user.id,
        course_id:  courseId  || null,
        query_text: queryText.trim(),
        context:    context   || null,
        thread_id:  sessionId || null,
        provider:   provider  || 'gemini',
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, query: data });
  } catch (err) {
    console.error('[queries/create]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/queries/:id/response ──────────────────────────────────────────
// Store AI reply on an existing query row.
// Body: { responseText, provider? }
router.patch('/:id/response', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { responseText, provider } = req.body;
    if (!responseText?.trim()) return res.status(400).json({ error: 'responseText is required' });

    const { data, error } = await supabase
      .from('student_queries')
      .update({
        ai_reply: responseText.trim(),
        ...(provider && { provider }),
      })
      .eq('id', req.params.id)
      .eq('student_id', user.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, query: data });
  } catch (err) {
    console.error('[queries/response]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/queries/my ───────────────────────────────────────────────────────
// Authenticated student: their own query history.
// Query params: courseId?, limit? (default 50)
router.get('/my', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { courseId, limit = 50 } = req.query;
    let q = supabase
      .from('student_queries')
      .select('id, query_text, ai_reply, provider, created_at, course_id, thread_id')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit, 10));
    if (courseId) q = q.eq('course_id', courseId);

    const { data, error } = await q;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('[queries/my]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/queries/course/:courseId ─────────────────────────────────────────
// Instructor view: all queries for their course (AI training oversight).
router.get('/course/:courseId', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { data: course, error: courseErr } = await supabase
      .from('courses')
      .select('id')
      .eq('id', req.params.courseId)
      .eq('instructor_id', user.id)
      .single();
    if (courseErr || !course) return res.status(403).json({ error: 'Forbidden: not your course' });

    const { data, error } = await supabase
      .from('student_queries')
      .select('*')
      .eq('course_id', req.params.courseId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('[queries/course]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
