// server/src/routes/files.js
// Supabase Storage: upload, list, download (signed URL), delete
// Storage path convention:
//   Teacher  → course-materials/{courseId}/teacher/{timestamp}_{filename}
//   Student  → student-submissions/{courseId}/students/{studentId}/{timestamp}_{filename}
//   Video    → course-videos/{courseId}/teacher/{timestamp}_{filename}

const express = require('express');
const router = express.Router();
const multer = require('multer');
const supabase = require('../supabase');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB cap
});

// Which bucket to use
function resolveBucket(fileType, isInstructor) {
  if (fileType === 'video') return 'course-videos';
  if (isInstructor) return 'course-materials';
  return 'student-submissions';
}

// ─── POST /api/files/upload ────────────────────────────────────────────────
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const {
      courseId,
      fileType = 'document',
      isPublic = 'false',
      isInstructor = 'false',  // 'true' = teacher, 'false' = student
      uploaderName = '',
    } = req.body;

    // Resolve uploader from JWT
    const authHeader = req.headers.authorization || '';
    let uploaderId = null;
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) uploaderId = user.id;
    }

    if (!req.file) return res.status(400).json({ error: 'No file provided.' });
    if (!courseId) return res.status(400).json({ error: 'courseId is required.' });

    const isTeacher = isInstructor === 'true';
    const bucket = resolveBucket(fileType, isTeacher);

    // Build systematic storage path
    // Teacher:  {courseId}/teacher/{ts}_{name}
    // Student:  {courseId}/students/{studentId}/{ts}_{name}
    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._\-]/g, '_');
    const ts = Date.now();
    const folder = isTeacher
      ? 'teacher'
      : `students/${uploaderId || 'unknown'}`;
    const storagePath = `${courseId}/${folder}/${ts}_${safeName}`;

    // 1. Upload to Supabase Storage
    const { error: storageError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });
    if (storageError) throw storageError;

    // 2. Record metadata in DB
    const { data: fileRecord, error: dbError } = await supabase
      .from('uploaded_files')
      .insert({
        course_id: courseId,
        uploader_id: uploaderId,
        uploader_role: isTeacher ? 'INSTRUCTOR' : 'STUDENT',
        uploader_name: uploaderName,
        file_name: req.file.originalname,
        file_type: fileType,
        storage_bucket: bucket,
        storage_path: storagePath,
        file_size_bytes: req.file.size,
        is_public: isPublic === 'true',
        metadata: { mimetype: req.file.mimetype },
      })
      .select()
      .single();
    if (dbError) throw dbError;

    res.status(201).json({ success: true, file: fileRecord });
  } catch (err) {
    console.error('[files/upload]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/files/course/:courseId ──────────────────────────────────────
// Returns all files for a course, grouped by uploader_role
router.get('/course/:courseId', async (req, res) => {
  const { courseId } = req.params;
  const { role, fileType } = req.query; // optional ?role=INSTRUCTOR or ?role=STUDENT

  let query = supabase
    .from('uploaded_files')
    .select('*')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false });

  if (role) query = query.eq('uploader_role', role.toUpperCase());
  if (fileType) query = query.eq('file_type', fileType);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Optionally group into teacher / students sections
  const grouped = {
    teacher: data.filter(f => f.uploader_role === 'INSTRUCTOR'),
    students: data.filter(f => f.uploader_role === 'STUDENT'),
  };
  res.json({ raw: data, grouped });
});

// ─── GET /api/files/download/:fileId ──────────────────────────────────────
router.get('/download/:fileId', async (req, res) => {
  const { fileId } = req.params;
  const expiresIn = parseInt(req.query.expiresIn || '3600', 10);

  const { data: file, error: fetchErr } = await supabase
    .from('uploaded_files')
    .select('storage_bucket, storage_path, file_name')
    .eq('id', fileId)
    .single();

  if (fetchErr || !file) return res.status(404).json({ error: 'File not found.' });

  const { data, error } = await supabase.storage
    .from(file.storage_bucket)
    .createSignedUrl(file.storage_path, expiresIn);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ url: data.signedUrl, filename: file.file_name, expiresIn });
});

// ─── DELETE /api/files/:fileId ─────────────────────────────────────────────
router.delete('/:fileId', async (req, res) => {
  const { fileId } = req.params;

  const { data: file, error: fetchErr } = await supabase
    .from('uploaded_files')
    .select('storage_bucket, storage_path')
    .eq('id', fileId)
    .single();

  if (fetchErr || !file) return res.status(404).json({ error: 'File not found.' });

  const { error: storageErr } = await supabase.storage
    .from(file.storage_bucket)
    .remove([file.storage_path]);
  if (storageErr) return res.status(500).json({ error: storageErr.message });

  const { error: dbErr } = await supabase
    .from('uploaded_files')
    .delete()
    .eq('id', fileId);
  if (dbErr) return res.status(500).json({ error: dbErr.message });

  res.json({ success: true });
});

// ─── GET /api/files/all ─────────────────────────────────────────────────────
// For admin / AI training pipeline — service role bypasses RLS
router.get('/all', async (_req, res) => {
  const { data, error } = await supabase
    .from('uploaded_files')
    .select('id, file_name, file_type, storage_bucket, storage_path, course_id, uploader_role, uploader_name, created_at')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
