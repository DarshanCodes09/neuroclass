// server/src/routes/queries.js
// Stores student text queries and AI responses in Supabase for later AI training

const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

/**
 * Helper: extract user from Bearer token
 */
async function getUser(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

/**
 * POST /api/queries
 * Save a new student query. AI response can be added later via PATCH.
 * Body: { queryText, courseId?, context?, queryType?, sessionId? }
 */
router.post('/', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { queryText, courseId, context, queryType, sessionId } = req.body;
    if (!queryText?.trim()) return res.status(400).json({ error: 'queryText is required' });

    const { data, error } = await supabase
      .from('student_queries')
      .insert({
        student_id: user.id,
        course_id: courseId || null,
        query_text: queryText.trim(),
        // context and session stored in metadata since student_queries uses thread_id & provider
        metadata: {
          context: context || null,
          query_type: queryType || 'general',
          session_id: sessionId || null,
        },
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

/**
 * PATCH /api/queries/:id/response
 * Update a query row with the AI's response text
 * Body: { responseText, provider? }
 */
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
        provider: provider || 'gemini',
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

/**
 * GET /api/queries/my
 * Get all queries for the authenticated student
 */
router.get('/my', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { courseId, limit = 50 } = req.query;

    let query = supabase
      .from('student_queries')
      .select('*')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (courseId) query = query.eq('course_id', courseId);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('[queries/my]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/queries/course/:courseId
 * Instructor-only: get all queries for a course (for AI training oversight)
 */
router.get('/course/:courseId', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // Verify instructor owns this course
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
