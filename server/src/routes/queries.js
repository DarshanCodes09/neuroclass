// server/src/routes/queries.js
// Stores every student text query (and AI response) in Supabase.
// This data is used to train AI agents in LangChain / LangGraph.

const express = require('express');
const router  = express.Router();
const supabase = require('../supabase');

// Resolve studentId from Bearer JWT
async function resolveUser(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const { data: { user } } = await supabase.auth.getUser(token);
  return user || null;
}

// ─── POST /api/queries ────────────────────────────────────────────────────
// Save incoming student query
router.post('/', async (req, res) => {
  try {
    const user = await resolveUser(req);
    const {
      queryText,
      courseId,
      context,
      queryType = 'general',
      sessionId,
    } = req.body;

    if (!queryText) return res.status(400).json({ error: 'queryText is required.' });

    const { data, error } = await supabase
      .from('student_queries')
      .insert({
        student_id: user?.id || null,
        course_id:  courseId || null,
        query_text: queryText,
        context:    context  || null,
        query_type: queryType,
        session_id: sessionId || null,
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

// ─── PATCH /api/queries/:id/response ─────────────────────────────────────
// Update a query row with the AI-generated response
router.patch('/:id/response', async (req, res) => {
  const { responseText } = req.body;
  const { id } = req.params;

  if (!responseText) return res.status(400).json({ error: 'responseText is required.' });

  const { data, error } = await supabase
    .from('student_queries')
    .update({ response_text: responseText })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── GET /api/queries/export ──────────────────────────────────────────────
// Export all queries for AI training (service role, used in Colab)
router.get('/export', async (req, res) => {
  const { courseId, limit = 5000 } = req.query;

  let query = supabase
    .from('student_queries')
    .select('id, student_id, course_id, query_text, response_text, context, query_type, session_id, created_at')
    .order('created_at', { ascending: true })
    .limit(Number(limit));

  if (courseId) query = query.eq('course_id', courseId);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ count: data.length, queries: data });
});

module.exports = router;
