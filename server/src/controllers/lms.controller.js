const path = require('path');
const { getAdmin } = require('../db');
const { uploadToStorage, getSignedUrl, cleanupLocal } = require('../utils/upload');
const { createNotification } = require('../services/notification.service');

// ─── Helpers ────────────────────────────────────────────────────────────────

async function resolveFileUrl(bucket, storagePath) {
  if (!storagePath) return '';
  if (storagePath.startsWith('http')) return storagePath;
  try {
    return await getSignedUrl(bucket, storagePath);
  } catch (_) {
    return '';
  }
}

function sb() { return getAdmin(); }

// ─── Course ──────────────────────────────────────────────────────────────────

async function getCourseById(req, res) {
  const { courseId } = req.params;
  const { data: course, error } = await sb().from('courses').select('*').eq('id', courseId).single();
  if (error || !course) return res.status(404).json({ error: 'Course not found.' });

  // Fetch files from uploaded_files (aligned with new schema)
  const { data: assets } = await sb()
    .from('uploaded_files')
    .select('id, file_name, file_type, storage_path, storage_bucket, metadata')
    .eq('course_id', courseId);

  const assetsWithUrls = await Promise.all(
    (assets || []).map(async (a) => ({
      id: a.id,
      fileName: a.file_name,
      fileType: a.file_type,
      url: a.metadata?.public_url || await resolveFileUrl(a.storage_bucket || 'course-materials', a.storage_path),
    }))
  );

  const mappedCourse = {
    id: course.id,
    courseCode: course.join_code,
    courseName: course.title,
    description: course.description,
    instructorId: course.instructor_id,
    pedagogyStyle: course.pedagogy,
    capacity: 50,
    academicLevel: 'Undergraduate',
    assets: assetsWithUrls,
  };

  return res.json({ course: mappedCourse });
}

async function joinCourse(req, res) {
  const { courseCode, studentId } = req.body;
  if (!courseCode || !studentId) return res.status(400).json({ error: 'courseCode and studentId are required.' });

  const { data: course, error } = await sb().from('courses').select('*').eq('join_code', courseCode.toUpperCase()).single();
  if (error || !course) return res.status(404).json({ error: 'No course found with this code.' });

  const { error: enrollError } = await sb().from('enrollments').upsert(
    { student_id: studentId, course_id: course.id },
    { onConflict: 'student_id,course_id', ignoreDuplicates: true }
  );
  if (enrollError) return res.status(500).json({ error: enrollError.message });

  return res.json({ ok: true, course });
}

// ─── Announcements ───────────────────────────────────────────────────────────

async function listAnnouncements(req, res) {
  const { data, error } = await sb()
    .from('announcements')
    .select('*')
    .eq('course_id', req.params.courseId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ announcements: data || [] });
}

async function postAnnouncement(req, res) {
  const { text, authorId, authorName, authorPhoto } = req.body;
  if (!text || !authorId) return res.status(400).json({ error: 'text and authorId are required.' });

  const { data, error } = await sb().from('announcements').insert({
    course_id: req.params.courseId,
    text,
    author_id: authorId,
    author_name: authorName || 'User',
    author_photo: authorPhoto || null,
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ announcement: data });
}

// ─── Assignments ─────────────────────────────────────────────────────────────

async function listAssignments(req, res) {
  const { instructorId, courseId, studentId } = req.query;
  let query = sb().from('assignments').select('*');

  if (instructorId) query = query.eq('instructor_id', instructorId);
  if (courseId) query = query.eq('course_id', courseId);
  if (studentId) {
    const { data: enrollments } = await sb().from('enrollments').select('course_id').eq('student_id', studentId);
    const courseIds = (enrollments || []).map((e) => e.course_id);
    if (!courseIds.length) return res.json({ assignments: [] });
    query = query.in('course_id', courseIds);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const mappedAssignments = (data || []).map(a => ({
    id: a.id,
    courseId: a.course_id,
    instructorId: a.instructor_id,
    title: a.title,
    description: a.description,
    maxScore: a.max_score,
    dueDate: a.due_date,
    createdAt: a.created_at
  }));

  return res.json({ assignments: mappedAssignments });
}

async function createAssignment(req, res) {
  const { instructorId, courseId, title, description, dueDate, maxScore = 100 } = req.body;
  if (!instructorId || !courseId || !title || !dueDate)
    return res.status(400).json({ error: 'Missing required fields.' });

  const { data, error } = await sb().from('assignments').insert({
    instructor_id: instructorId,
    course_id: courseId,
    title,
    description: description || '',
    due_date: dueDate,
    max_score: Number(maxScore),
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ assignment: data });
}

async function uploadAssignmentAttachment(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required.' });
    const assignmentId = req.body.assignmentId || req.query.assignmentId || 'misc';
    const ext = path.extname(req.file.originalname);
    const storagePath = `assignments/${assignmentId}/${Date.now()}${ext}`;

    // Uses 'course-materials' bucket (aligned with schema)
    const { path: sp, publicUrl } = await uploadToStorage(
      'course-materials', storagePath, req.file.buffer, req.file.mimetype
    );

    return res.status(201).json({
      fileName: req.file.originalname,
      storagePath: sp,
      fileUrl: publicUrl,
    });
  } catch (err) {
    console.error('uploadAssignmentAttachment error:', err);
    return res.status(500).json({ error: 'Failed to upload assignment attachment.' });
  }
}

async function uploadSubmissionFile(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required.' });
    const studentId = req.body.studentId || req.query.studentId || 'unknown';
    const ext = path.extname(req.file.originalname);
    const storagePath = `submissions/${studentId}/${Date.now()}${ext}`;

    // Uses 'student-submissions' bucket (aligned with schema)
    const { path: sp, publicUrl } = await uploadToStorage(
      'student-submissions', storagePath, req.file.buffer, req.file.mimetype
    );

    return res.status(201).json({
      fileName: req.file.originalname,
      storagePath: sp,
      fileUrl: publicUrl,
    });
  } catch (err) {
    console.error('uploadSubmissionFile error:', err);
    return res.status(500).json({ error: 'Failed to upload submission file.' });
  }
}

async function createSubmission(req, res) {
  const { 
    assignmentId, courseId, instructorId, studentId, studentName, fileName, fileUrl, storagePath, 
    aiScore = 0, aiFeedback = '', status = 'evaluated', maxScore = 100,
    studentAnswer = '', vectorJson = {}, plagiarismScore = 0, aiMarks = {}
  } = req.body;

  if (!assignmentId || !courseId || !studentId)
    return res.status(400).json({ error: 'assignmentId, courseId, studentId required.' });

  // Core payload that always works
  const basePayload = {
    assignment_id: assignmentId,
    course_id: courseId,
    instructor_id: instructorId,
    student_id: studentId,
    file_url: fileUrl || '',
    storage_path: storagePath || null,
    file_name: fileName || 'submission',
    status,
    ai_score: Number(aiScore),
    ai_feedback: aiFeedback,
    max_score: Number(maxScore)
  };

  // Attempt to save with extended columns (Plagiarism/Breakdown)
  try {
    const { data, error } = await sb().from('submissions').insert({
      ...basePayload,
      student_answer: studentAnswer,
      vector_json: vectorJson,
      plagiarism_score: Number(plagiarismScore),
      ai_marks: aiMarks
    }).select().single();
    
    if (!error) return res.status(201).json({ submission: data });
    
    // If column missing error, fall back to base payload
    if (error.code === '42703' || error.message?.includes('column')) {
      console.warn('[lms] New columns missing in DB. Falling back to base submission schema.');
      const { data: fallbackData, error: fallbackError } = await sb().from('submissions').insert(basePayload).select().single();
      if (fallbackError) throw fallbackError;
      return res.status(201).json({ submission: fallbackData });
    }
    
    throw error;
  } catch (err) {
    console.error('[lms] createSubmission error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function listSubmissions(req, res) {
  const { studentId, instructorId, status } = req.query;
  let query = sb().from('submissions').select('*, profiles!student_id(full_name)');
  if (studentId) query = query.eq('student_id', studentId);
  if (instructorId) query = query.eq('instructor_id', instructorId);
  if (status) query = query.eq('status', status);
  query = query.order('submitted_at', { ascending: false });
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  
  const mappedSubmissions = (data || []).map(s => ({
    id: s.id,
    assignmentId: s.assignment_id,
    courseId: s.course_id,
    instructorId: s.instructor_id,
    studentId: s.student_id,
    studentName: s.profiles?.full_name || s.student_name || 'Student',
    fileUrl: s.file_url,
    storagePath: s.storage_path,
    fileName: s.file_name,
    status: s.status,
    aiScore: s.ai_score,
    aiFeedback: s.ai_feedback,
    submittedAt: s.submitted_at,
    maxScore: s.max_score,
    finalScore: s.final_score,
    instructorFeedback: s.instructor_feedback,
    plagiarismScore: s.plagiarism_score,
    aiMarks: s.ai_marks
  }));
  return res.json({ submissions: mappedSubmissions });
}

async function reviewSubmission(req, res) {
  const { status, finalScore, instructorFeedback } = req.body;
  const { data: existing, error: fetchErr } = await sb().from('submissions').select('*').eq('id', req.params.submissionId).single();
  if (fetchErr || !existing) return res.status(404).json({ error: 'Submission not found.' });

  const { error } = await sb().from('submissions').update({
    status: status || existing.status,
    final_score: Number(finalScore ?? existing.final_score ?? existing.ai_score ?? 0),
    instructor_feedback: instructorFeedback ?? existing.instructor_feedback,
  }).eq('id', req.params.submissionId);
  if (error) return res.status(500).json({ error: error.message });

  await createNotification(existing.student_id, `Your assignment "${existing.file_name}" has been graded.`);
  return res.json({ ok: true });
}

async function listGrades(req, res) {
  const { studentId } = req.query;
  if (!studentId) return res.status(400).json({ error: 'studentId required.' });
  const { data, error } = await sb().from('submissions')
    .select('*, assignments(title)')
    .eq('student_id', studentId)
    .in('status', ['approved', 'overridden'])
    .order('submitted_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  
  const mappedSubmissions = (data || []).map(s => ({
    id: s.id,
    assignmentId: s.assignment_id,
    courseId: s.course_id,
    instructorId: s.instructor_id,
    studentId: s.student_id,
    studentName: s.student_name || 'Student',
    fileUrl: s.file_url,
    storagePath: s.storage_path,
    fileName: s.file_name,
    assignmentTitle: s.assignments?.title || s.file_name?.replace(/^[a-zA-Z0-9]+_/, '') || 'Submission',
    aiScore: s.ai_score,
    aiFeedback: s.ai_feedback,
    submittedAt: s.submitted_at,
    maxScore: s.max_score,
    finalScore: s.final_score,
    instructorFeedback: s.instructor_feedback
  }));
  return res.json({ grades: mappedSubmissions });
}

async function deleteAssignment(req, res) {
  try {
    const { error } = await sb().from('assignments').delete().eq('id', req.params.assignmentId);
    if (error) throw error;
    return res.json({ success: true });
  } catch (err) {
    console.error('[lms] deleteAssignment error:', err);
    return res.status(500).json({ error: 'Failed to delete assignment.' });
  }
}

module.exports = {
  getCourseById,
  joinCourse,
  listAnnouncements,
  postAnnouncement,
  listAssignments,
  createAssignment,
  uploadAssignmentAttachment,
  uploadSubmissionFile,
  createSubmission,
  listSubmissions,
  reviewSubmission,
  listGrades,
  deleteAssignment,
};
