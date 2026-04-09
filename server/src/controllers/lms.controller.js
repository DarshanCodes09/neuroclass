const crypto = require('crypto');
const path = require('path');
const { find, first, insert, update } = require('../store');
const { createNotification } = require('../services/notification.service');

function toUploadUrl(req, filePath) {
  if (!filePath) return '';
  if (String(filePath).startsWith('http://') || String(filePath).startsWith('https://')) {
    return filePath;
  }
  const fileName = path.basename(filePath);
  return `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(fileName)}`;
}

function toCourseDTO(c) {
  return {
    id: c.id,
    courseCode: c.course_code,
    courseName: c.course_name,
    academicLevel: c.academic_level,
    capacity: c.capacity,
    instructorId: c.instructor_id,
    instructorName: c.instructor_name,
    students: c.students || [],
    status: c.status,
    createdAt: c.created_at,
  };
}

async function getCourseById(req, res) {
  const course = first('courses', (c) => c.id === req.params.courseId);
  if (!course) return res.status(404).json({ error: 'Course not found.' });
  const assets = find('course_assets', (asset) => asset.course_id === course.id).map((asset) => ({
    id: asset.id,
    fileName: asset.file_name,
    fileType: asset.file_type,
    url: toUploadUrl(req, asset.file_path),
  }));
  return res.json({
    course: {
      ...toCourseDTO(course),
      assets,
    },
  });
}

async function joinCourse(req, res) {
  const { courseCode, studentId } = req.body;
  if (!courseCode || !studentId) return res.status(400).json({ error: 'courseCode and studentId are required.' });
  const course = first('courses', (c) => (c.course_code || '').toUpperCase() === String(courseCode).toUpperCase());
  if (!course) return res.status(404).json({ error: 'No course found with this code.' });

  update('courses', (c) => c.id === course.id, (c) => {
    const students = Array.isArray(c.students) ? c.students : [];
    if (!students.includes(studentId)) students.push(studentId);
    return { ...c, students };
  });
  return res.json({ ok: true, course: toCourseDTO(first('courses', (c) => c.id === course.id)) });
}

async function listAnnouncements(req, res) {
  const rows = find('announcements', (a) => a.course_id === req.params.courseId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map((a) => ({
      id: a.id,
      text: a.text,
      authorId: a.author_id,
      authorName: a.author_name,
      authorPhoto: a.author_photo,
      createdAt: a.created_at,
    }));
  return res.json({ announcements: rows });
}

async function postAnnouncement(req, res) {
  const { text, authorId, authorName, authorPhoto } = req.body;
  if (!text || !authorId) return res.status(400).json({ error: 'text and authorId are required.' });
  const row = {
    id: crypto.randomUUID(),
    course_id: req.params.courseId,
    text,
    author_id: authorId,
    author_name: authorName || 'User',
    author_photo: authorPhoto || null,
    created_at: new Date().toISOString(),
  };
  insert('announcements', row);
  return res.status(201).json({ announcement: { ...row, createdAt: row.created_at } });
}

async function listAssignments(req, res) {
  const { instructorId, courseId, studentId } = req.query;
  let rows = find('assignments');
  if (instructorId) rows = rows.filter((a) => a.instructor_id === instructorId);
  if (courseId) rows = rows.filter((a) => a.course_id === courseId);
  if (studentId) {
    const studentCourses = new Set(find('courses', (c) => (c.students || []).includes(studentId)).map((c) => c.id));
    rows = rows.filter((a) => studentCourses.has(a.course_id));
  }
  rows = rows.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
  return res.json({
    assignments: rows.map((a) => ({
      id: a.id,
      instructorId: a.instructor_id,
      courseId: a.course_id,
      courseName: a.course_name,
      courseCode: a.course_code,
      title: a.title,
      description: a.description,
      attachmentName: a.attachment_name || null,
      attachmentUrl: a.attachment_url || null,
      dueDate: a.due_date,
      maxScore: a.max_score,
      createdAt: a.created_at,
    })),
  });
}

async function createAssignment(req, res) {
  const {
    instructorId,
    courseId,
    title,
    description,
    dueDate,
    maxScore = 100,
    attachmentName = null,
    attachmentUrl = null,
  } = req.body;
  if (!instructorId || !courseId || !title || !dueDate) return res.status(400).json({ error: 'Missing required fields.' });
  const course = first('courses', (c) => c.id === courseId);
  if (!course) return res.status(404).json({ error: 'Course not found.' });
  const row = {
    id: crypto.randomUUID(),
    instructor_id: instructorId,
    course_id: courseId,
    course_name: course.course_name,
    course_code: course.course_code,
    title,
    description: description || '',
    attachment_name: attachmentName,
    attachment_url: attachmentUrl,
    due_date: dueDate,
    max_score: Number(maxScore),
    created_at: new Date().toISOString(),
  };
  insert('assignments', row);
  return res.status(201).json({ assignment: row });
}

async function uploadAssignmentAttachment(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'file is required.' });
    }
    return res.status(201).json({
      fileName: req.file.originalname,
      fileUrl: toUploadUrl(req, req.file.path),
    });
  } catch (error) {
    console.error('uploadAssignmentAttachment error:', error);
    return res.status(500).json({ error: 'Failed to upload assignment attachment.' });
  }
}

async function uploadSubmissionFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'file is required.' });
    }
    return res.status(201).json({
      fileName: req.file.originalname,
      fileUrl: toUploadUrl(req, req.file.path),
    });
  } catch (error) {
    console.error('uploadSubmissionFile error:', error);
    return res.status(500).json({ error: 'Failed to upload submission file.' });
  }
}

async function createSubmission(req, res) {
  const {
    assignmentId, courseId, instructorId, studentId, studentName,
    fileName, fileUrl, aiScore = 0, aiFeedback = '', status = 'evaluated', maxScore = 100,
  } = req.body;
  if (!assignmentId || !courseId || !studentId) return res.status(400).json({ error: 'assignmentId, courseId, studentId required.' });
  const row = {
    id: crypto.randomUUID(),
    assignment_id: assignmentId,
    course_id: courseId,
    instructor_id: instructorId,
    student_id: studentId,
    student_name: studentName || 'Student',
    file_url: fileUrl || '',
    file_name: fileName || 'submission',
    submitted_at: new Date().toISOString(),
    status,
    ai_score: Number(aiScore),
    ai_feedback: aiFeedback,
    final_score: null,
    max_score: Number(maxScore),
    instructor_feedback: null,
  };
  insert('submissions', row);
  return res.status(201).json({ submission: row });
}

async function listSubmissions(req, res) {
  const { studentId, instructorId, status } = req.query;
  let rows = find('submissions');
  if (studentId) rows = rows.filter((s) => s.student_id === studentId);
  if (instructorId) rows = rows.filter((s) => s.instructor_id === instructorId);
  if (status) rows = rows.filter((s) => s.status === status);
  rows = rows.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
  return res.json({
    submissions: rows.map((s) => ({
      id: s.id,
      assignmentId: s.assignment_id,
      courseId: s.course_id,
      instructorId: s.instructor_id,
      studentId: s.student_id,
      studentName: s.student_name,
      fileUrl: toUploadUrl(req, s.file_url),
      fileName: s.file_name,
      submittedAt: s.submitted_at,
      status: s.status,
      aiScore: s.ai_score,
      aiFeedback: s.ai_feedback,
      finalScore: s.final_score,
      maxScore: s.max_score,
      instructorFeedback: s.instructor_feedback,
    })),
  });
}

async function reviewSubmission(req, res) {
  const { status, finalScore, instructorFeedback } = req.body;
  const existing = first('submissions', (s) => s.id === req.params.submissionId);
  if (!existing) return res.status(404).json({ error: 'Submission not found.' });
  update('submissions', (s) => s.id === req.params.submissionId, (s) => ({
    ...s,
    status: status || s.status,
    final_score: Number(finalScore ?? s.final_score ?? s.ai_score ?? 0),
    instructor_feedback: instructorFeedback ?? s.instructor_feedback,
  }));
  await createNotification(existing.student_id, `Your assignment "${existing.file_name}" has been graded.`);
  return res.json({ ok: true });
}

async function listGrades(req, res) {
  const { studentId } = req.query;
  if (!studentId) return res.status(400).json({ error: 'studentId required.' });
  const rows = find('submissions', (s) => s.student_id === studentId && ['approved', 'overridden'].includes(s.status))
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
  return res.json({
    grades: rows.map((s) => ({
      id: s.id,
      fileName: s.file_name,
      fileUrl: toUploadUrl(req, s.file_url),
      status: s.status,
      aiFeedback: s.ai_feedback,
      instructorFeedback: s.instructor_feedback,
      finalScore: s.final_score,
    })),
  });
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
};
