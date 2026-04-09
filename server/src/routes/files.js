// server/src/routes/files.js
// Handles systematic file uploads to Supabase Storage + metadata tracking in DB
// Storage path convention: {courseId}/{fileType}/{timestamp}_{sanitizedFilename}

const express = require('express');
const router = express.Router();
const multer = require('multer');
const supabase = require('../supabase');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
});

/**
 * Determine which bucket to use based on file type
 */
function getBucket(fileType) {
  if (fileType === 'video') return 'course-videos';
  if (fileType === 'submission') return 'student-submissions';
  if (fileType === 'avatar') return 'profile-avatars';
  return 'course-materials'; // default: pdf, doc, ppt, txt, md
}

/**
 * Build a clean, collision-free storage path
 * Pattern: {courseId}/{fileType}/{timestamp}_{sanitizedFilename}
 */
function buildStoragePath(courseId, fileType, filename) {
  const ts = Date.now();
  const sanitized = filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-zA-Z0-9._-]/g, '_') // replace special chars
    .toLowerCase();
  return `${courseId}/${fileType}/${ts}_${sanitized}`;
}

/**
 * POST /api/files/upload
 * Body (multipart): file, courseId, fileType?, isPublic?
 * Auth: Bearer token in Authorization header
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { courseId, fileType = 'document', isPublic = 'false' } = req.body;

    // Extract user from Supabase JWT
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file provided' });
    if (!courseId) return res.status(400).json({ error: 'courseId is required' });

    const bucket = getBucket(fileType);
    const storagePath = buildStoragePath(courseId, fileType, file.originalname);

    // 1. Upload to Supabase Storage
    const { error: storageError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (storageError) throw new Error(`Storage upload failed: ${storageError.message}`);

    // 2. Get public URL (for public buckets) or null
    let publicUrl = null;
    if (isPublic === 'true') {
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
      publicUrl = urlData?.publicUrl || null;
    }

    // 3. Record metadata in uploaded_files table
    const { data: fileRecord, error: dbError } = await supabase
      .from('uploaded_files')
      .insert({
        course_id: courseId,
        uploader_id: user.id,
        file_name: file.originalname,
        file_type: fileType,
        storage_bucket: bucket,
        storage_path: storagePath,
        file_size_bytes: file.size,
        is_public: isPublic === 'true',
        metadata: {
          mimetype: file.mimetype,
          public_url: publicUrl,
        },
      })
      .select()
      .single();

    if (dbError) throw new Error(`DB insert failed: ${dbError.message}`);

    res.status(201).json({ success: true, file: fileRecord });
  } catch (err) {
    console.error('[files/upload]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/files/:courseId
 * Returns all files for a course, sorted newest first, grouped by fileType
 */
router.get('/:courseId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { courseId } = req.params;
    const { fileType } = req.query; // optional filter

    let query = supabase
      .from('uploaded_files')
      .select('*')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false });

    if (fileType) query = query.eq('file_type', fileType);

    const { data, error } = await query;
    if (error) throw error;

    // Group by fileType for neat frontend consumption
    const grouped = data.reduce((acc, f) => {
      const key = f.file_type || 'other';
      if (!acc[key]) acc[key] = [];
      acc[key].push(f);
      return acc;
    }, {});

    res.json({ files: data, grouped });
  } catch (err) {
    console.error('[files/list]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/files/download/:fileId
 * Returns a signed URL (1 hour expiry) for secure file download
 */
router.get('/download/:fileId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { data: file, error: fetchError } = await supabase
      .from('uploaded_files')
      .select('storage_bucket, storage_path, file_name, is_public, metadata')
      .eq('id', req.params.fileId)
      .single();

    if (fetchError || !file) return res.status(404).json({ error: 'File not found' });

    // If public, return direct URL
    if (file.is_public && file.metadata?.public_url) {
      return res.json({ url: file.metadata.public_url, filename: file.file_name });
    }

    // Otherwise, create signed URL (1 hour)
    const { data: signedData, error: signError } = await supabase.storage
      .from(file.storage_bucket)
      .createSignedUrl(file.storage_path, 3600);

    if (signError) throw signError;
    res.json({ url: signedData.signedUrl, filename: file.file_name });
  } catch (err) {
    console.error('[files/download]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/files/:fileId
 * Deletes from both Storage and DB
 */
router.delete('/:fileId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { data: file, error: fetchError } = await supabase
      .from('uploaded_files')
      .select('*')
      .eq('id', req.params.fileId)
      .eq('uploader_id', user.id)
      .single();

    if (fetchError || !file) return res.status(404).json({ error: 'File not found or not yours' });

    // Delete from Storage
    const { error: storageError } = await supabase.storage
      .from(file.storage_bucket)
      .remove([file.storage_path]);

    if (storageError) console.warn('[files/delete] storage warn:', storageError.message);

    // Delete from DB
    await supabase.from('uploaded_files').delete().eq('id', file.id);

    res.json({ success: true });
  } catch (err) {
    console.error('[files/delete]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
