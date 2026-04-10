// server/src/services/storage.service.js
// Central service for all Supabase Storage operations.
// Systematic file path convention:
//   course-materials  → {courseId}/teacher/{timestamp}_{filename}
//   course-videos     → {courseId}/teacher/{timestamp}_{filename}
//   student-submissions → {courseId}/students/{studentId}/{timestamp}_{filename}
//   profile-avatars   → {userId}/{timestamp}_{filename}

const supabase = require('../supabase');
const { supabaseAdmin } = require('../supabase');

// ─── Bucket names ──────────────────────────────────────────────────────────
const BUCKETS = {
  MATERIALS:    'course-materials',
  VIDEOS:       'course-videos',
  AVATARS:      'profile-avatars',
  SUBMISSIONS:  'student-submissions',
};

// ─── Resolve bucket from fileType + uploader role ─────────────────────────
function resolveBucket(fileType, isInstructor) {
  if (fileType === 'video')  return BUCKETS.VIDEOS;
  if (fileType === 'avatar') return BUCKETS.AVATARS;
  if (isInstructor)          return BUCKETS.MATERIALS;
  return BUCKETS.SUBMISSIONS;
}

// ─── Build systematic storage path ────────────────────────────────────────
function buildPath({ courseId, userId, isInstructor, fileType, filename }) {
  const safe = filename.replace(/[^a-zA-Z0-9._\-]/g, '_');
  const ts   = Date.now();

  if (fileType === 'avatar') {
    return `${userId}/${ts}_${safe}`;
  }
  const folder = isInstructor ? 'teacher' : `students/${userId}`;
  return `${courseId}/${folder}/${ts}_${safe}`;
}

// ─── Upload a file buffer ──────────────────────────────────────────────────
async function uploadFile({ buffer, mimetype, filename, courseId, userId, fileType = 'document', isInstructor = false, isPublic = false }) {
  const bucket      = resolveBucket(fileType, isInstructor);
  const storagePath = buildPath({ courseId, userId, isInstructor, fileType, filename });

  const { error: storageError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, buffer, { contentType: mimetype, upsert: false });

  if (storageError) throw storageError;

  // Record in DB
  const { data: fileRecord, error: dbError } = await supabase
    .from('uploaded_files')
    .insert({
      course_id:       courseId,
      uploader_id:     userId,
      uploader_role:   isInstructor ? 'INSTRUCTOR' : 'STUDENT',
      file_name:       filename,
      file_type:       fileType,
      storage_bucket:  bucket,
      storage_path:    storagePath,
      file_size_bytes: buffer.length,
      is_public:       isPublic,
      metadata:        { mimetype },
    })
    .select()
    .single();

  if (dbError) throw dbError;
  return fileRecord;
}

// ─── Get signed download URL ───────────────────────────────────────────────
async function getSignedUrl(fileId, expiresIn = 3600) {
  const { data: file, error } = await supabase
    .from('uploaded_files')
    .select('storage_bucket, storage_path, file_name')
    .eq('id', fileId)
    .single();

  if (error || !file) throw new Error('File not found');

  const { data, error: urlError } = await supabase.storage
    .from(file.storage_bucket)
    .createSignedUrl(file.storage_path, expiresIn);

  if (urlError) throw urlError;
  return { url: data.signedUrl, filename: file.file_name, expiresIn };
}

// ─── Delete a file from storage + DB ──────────────────────────────────────
async function deleteFile(fileId) {
  const { data: file, error } = await supabase
    .from('uploaded_files')
    .select('storage_bucket, storage_path')
    .eq('id', fileId)
    .single();

  if (error || !file) throw new Error('File not found');

  const { error: storageErr } = await supabase.storage
    .from(file.storage_bucket)
    .remove([file.storage_path]);
  if (storageErr) throw storageErr;

  const { error: dbErr } = await supabase
    .from('uploaded_files')
    .delete()
    .eq('id', fileId);
  if (dbErr) throw dbErr;

  return { success: true };
}

// ─── Download file bytes (for AI pipeline) ─────────────────────────────────
async function downloadFileBytes(storageBucket, storagePath) {
  const client = supabaseAdmin || supabase;
  const { data, error } = await client.storage
    .from(storageBucket)
    .download(storagePath);
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}

module.exports = { BUCKETS, resolveBucket, buildPath, uploadFile, getSignedUrl, deleteFile, downloadFileBytes };
