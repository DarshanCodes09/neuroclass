// server/src/routes/queries.js
// Student text query logging — stores every query + AI response for training
const express  = require('express');
const router   = express.Router();
const supabase = require('../supabase');

// Helper: extract user from Bearer token
async function getUserFromReq(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  const { data: { user } } = await supabase.auth.getUser(auth.split(' ')[1]);
  return user || null;
}

// ─── POST /api/queries ────────────────────────────────────────────────────────────
// Save a new student query (before AI responds)
router.post('/', async (req, res) => {
  try {
    const { queryText, courseId, context, queryType, sessionId, metadata } = req.body;
    if (!queryText?.trim()) return res.status(400).json({ error: 'queryText is required.' });

    const user = await getUserFromReq(req);

    const { data, error } = await supabase
      .from('student_queries')
      .insert({
        student_id:  user?.id || null,
        course_id:   courseId  || null,
        query_text:  queryText.trim(),
        context:     context   || null,
        query_type:  queryType || 'general',
        session_id:  sessionId || null,
        metadata:    metadata  || {},
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, query: data });
  } catch (err) {
    console.error('[queries/post]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/queries/:id/response ──────────────────────────────────────────────────
// Update a query row with the AI's response
router.patch('/:id/response', async (req, res) => {
  const { responseText } = req.body;
  if (!responseText) return res.status(400).json({ error: 'responseText is required.' });

  const { data, error } = await supabase
    .from('student_queries')
    .update({ response_text: responseText })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── GET /api/queries/session/:sessionId ──────────────────────────────────────────────
router.get('/session/:sessionId', async (req, res) => {
  const { data, error } = await supabase
    .from('student_queries')
    .select('*')
    .eq('session_id', req.params.sessionId)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── GET /api/queries/all ───────────────────────────────────────────────────────────────
// Service-level: returns all queries for AI training (use service role key)
router.get('/all', async (req, res) => {
  const limit  = parseInt(req.query.limit  || '2000', 10);
  const offset = parseInt(req.query.offset || '0',    10);

  const { data, error, count } = await supabase
    .from('student_queries')
    .select('id, query_text, response_text, context, course_id, query_type, created_at', { count: 'exact' })
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ total: count, offset, limit, data });
});

module.exports = router;
