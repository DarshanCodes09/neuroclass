const path = require('path');
const { getAdmin } = require('../db');
const { uploadToStorage, cleanupLocal } = require('../utils/upload');
const { toTermFreqVector } = require('../utils/vector');

function sb() { return getAdmin(); }

async function createCourse(req, res) {
  const { title, description = '', instructorId, pedagogy = 'SOCRATIC' } = req.body;
  if (!title || !instructorId) return res.status(400).json({ error: 'title and instructorId are required.' });

  const { data, error } = await sb().from('courses').insert({
    title, description, instructor_id: instructorId, pedagogy,
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ course: data });
}

async function listCourses(req, res) {
  const { instructorId, studentId } = req.query;
  let query = sb().from('courses').select('*');

  if (instructorId) {
    query = query.eq('instructor_id', instructorId);
  } else if (studentId) {
    const { data: enrollments } = await sb().from('enrollments').select('course_id').eq('user_id', studentId);
    const ids = (enrollments || []).map((e) => e.course_id);
    if (!ids.length) return res.json({ courses: [] });
    query = query.in('id', ids);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ courses: data || [] });
}

async function uploadCourseAsset(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required.' });
    const { courseId } = req.body;
    if (!courseId) return res.status(400).json({ error: 'courseId is required.' });

    const ext = path.extname(req.file.originalname);
    const storagePath = `courses/${courseId}/${Date.now()}${ext}`;

    const { path: sp, publicUrl } = await uploadToStorage(
      'course-assets', storagePath, req.file.path, req.file.mimetype
    );
    cleanupLocal(req.file.path);

    // Insert metadata record
    const { data, error } = await sb().from('course_assets').insert({
      course_id: courseId,
      file_name: req.file.originalname,
      file_type: req.file.mimetype,
      storage_path: sp,
      public_url: publicUrl,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });

    return res.status(201).json({ asset: data });
  } catch (err) {
    console.error('[course] uploadCourseAsset error:', err);
    return res.status(500).json({ error: 'Upload failed.' });
  }
}

module.exports = { createCourse, listCourses, uploadCourseAsset };
