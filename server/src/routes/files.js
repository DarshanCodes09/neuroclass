// server/src/routes/files.js
// Systematic file upload/download/list/delete via Supabase Storage.
//
// Storage path convention (no collisions, easy to browse in Supabase dashboard):
//   {courseId}/{fileType}/{YYYY-MM-DD}_{timestamp}_{sanitizedFilename}
//
// Buckets:
//   course-materials    → PDFs, slides, docs, text  (default)
//   course-videos       → MP4, webm, mov
//   profile-avatars     → JPEG, PNG, WebP            (public bucket)
//   student-submissions → Assignment uploads

const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const supabase = require('../supabase');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
});

/** Pick bucket based on fileType */
function getBucket(fileType) {
  if (fileType === 'video')      return 'course-videos';
  if (fileType === 'submission') return 'student-submissions';
  if (fileType === 'avatar')     return 'profile-avatars';
  return 'course-materials';
}

/** Sanitise filename and build collision-free storage path */
function buildStoragePath(courseId, fileType, filename) {
  const now  = new Date();
  const date = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const ts   = now.getTime();
  const safe = filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .toLowerCase();
  return `${courseId}/${fileType}/${date}_${ts}_${safe}`;
}

/** Extract authenticated Supabase user from Bearer JWT */
async function getUser(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  return error ? null : user;
}

// ── POST /api/files/upload ────────────────────────────────────────────────────
// Multipart body: file (binary), courseId (string), fileType? (string), isPublic? ("true"/"false")
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { courseId, fileType = 'document', isPublic = 'false' } = req.body;
    const file = req.file;

    if (!file)     return res.status(400).json({ error: 'No file provided' });
    if (!courseId) return res.status(400).json({ error: 'courseId is required' });

    const bucket      = getBucket(fileType);
    const storagePath = buildStoragePath(courseId, fileType, file.originalname);

    // 1 — Upload bytes to Supabase Storage
    const { error: storageErr } = await supabase.storage
      .from(bucket)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });
    if (storageErr) throw new Error(`Storage upload failed: ${storageErr.message}`);

    // 2 — Resolve public URL (public buckets only)
    let publicUrl = null;
    if (isPublic === 'true') {
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
      publicUrl = urlData?.publicUrl || null;
    }

    // 3 — Record metadata in uploaded_files
    const { data: fileRecord, error: dbErr } = await supabase
      .from('uploaded_files')
      .insert({
        course_id:       courseId,
        uploader_id:     user.id,
        file_name:       file.originalname,
        file_type:       fileType,
        storage_bucket:  bucket,
        storage_path:    storagePath,
        file_size_bytes: file.size,
        is_public:       isPublic === 'true',
        metadata:        { mimetype: file.mimetype, public_url: publicUrl },
      })
      .select()
      .single();
    if (dbErr) throw new Error(`DB insert failed: ${dbErr.message}`);

    res.status(201).json({ success: true, file: fileRecord });
  } catch (err) {
    console.error('[files/upload]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/files/download/:fileId ──────────────────────────────────────────
// Returns signed URL (1-hr expiry) or direct public URL.
// Must come BEFORE /:courseId to avoid route collision.
router.get('/download/:fileId', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { data: file, error: fetchErr } = await supabase
      .from('uploaded_files')
      .select('storage_bucket, storage_path, file_name, is_public, metadata')
      .eq('id', req.params.fileId)
      .single();
    if (fetchErr || !file) return res.status(404).json({ error: 'File not found' });

    if (file.is_public && file.metadata?.public_url) {
      return res.json({ url: file.metadata.public_url, filename: file.file_name });
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from(file.storage_bucket)
      .createSignedUrl(file.storage_path, 3600);
    if (signErr) throw signErr;

    res.json({ url: signed.signedUrl, filename: file.file_name });
  } catch (err) {
    console.error('[files/download]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/files/:courseId ──────────────────────────────────────────────────
// List all files for a course. Optional ?fileType= filter.
// Returns both a flat list and a grouped-by-type map for easy frontend use.
router.get('/:courseId', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { fileType } = req.query;
    let q = supabase
      .from('uploaded_files')
      .select('id, file_name, file_type, storage_bucket, storage_path, file_size_bytes, is_public, metadata, created_at, uploader_id')
      .eq('course_id', req.params.courseId)
      .order('created_at', { ascending: false });
    if (fileType) q = q.eq('file_type', fileType);

    const { data, error } = await q;
    if (error) throw error;

    const grouped = (data || []).reduce((acc, f) => {
      const key = f.file_type || 'other';
      (acc[key] = acc[key] || []).push(f);
      return acc;
    }, {});

    res.json({ files: data || [], grouped, total: (data || []).length });
  } catch (err) {
    console.error('[files/list]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/files/:fileId ─────────────────────────────────────────────────
// Removes from both Storage and uploaded_files table. Only the uploader can delete.
router.delete('/:fileId', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { data: file, error: fetchErr } = await supabase
      .from('uploaded_files')
      .select('*')
      .eq('id', req.params.fileId)
      .eq('uploader_id', user.id)
      .single();
    if (fetchErr || !file) return res.status(404).json({ error: 'File not found or not yours' });

    const { error: storageErr } = await supabase.storage
      .from(file.storage_bucket)
      .remove([file.storage_path]);
    if (storageErr) console.warn('[files/delete] storage warn:', storageErr.message);

    await supabase.from('uploaded_files').delete().eq('id', file.id);

    res.json({ success: true });
  } catch (err) {
    console.error('[files/delete]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
