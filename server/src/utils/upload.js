// server/src/utils/upload.js
// Multer + Supabase Storage upload utilities used by lms.controller.js
// Bucket map (aligned with schema & files.js route):
//   course-materials    → course PDFs, docs, slides
//   course-videos       → video lectures
//   student-submissions → assignment file uploads
//   profile-avatars     → user profile pictures (public)

const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const { getAdmin } = require('../db');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }
});

/**
 * Upload a local temp file to a Supabase Storage bucket.
 *
 * @param {string} bucket       - 'course-materials' | 'course-videos' | 'student-submissions' | 'profile-avatars'
 * @param {string} storagePath  - path inside bucket, e.g. 'assignments/uuid/1234.pdf'
 * @param {string} localFilePath - absolute path on disk (from multer)
 * @param {string} mimeType
 * @returns {Promise<{ path: string, publicUrl: string }>}
 */
async function uploadToStorage(bucket, storagePath, fileBuffer, mimeType) {
  const sb = getAdmin();

  const { error } = await sb.storage
    .from(bucket)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType || 'application/octet-stream',
      upsert: true,
    });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data: urlData } = sb.storage.from(bucket).getPublicUrl(storagePath);
  return { path: storagePath, publicUrl: urlData?.publicUrl || '' };
}

/**
 * Generate a short-lived signed URL for private bucket access.
 */
async function getSignedUrl(bucket, storagePath, expiresInSeconds = 3600) {
  const sb = getAdmin();
  const { data, error } = await sb.storage
    .from(bucket)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw new Error(`Signed URL failed: ${error.message}`);
  return data.signedUrl;
}

/**
 * Delete a file from Supabase Storage.
 */
async function deleteFromStorage(bucket, storagePath) {
  const sb = getAdmin();
  const { error } = await sb.storage.from(bucket).remove([storagePath]);
  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}

/**
 * Remove a local temp file after successful upload.
 */
function cleanupLocal(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {}
}

module.exports = {
  upload,
  uploadToStorage,
  getSignedUrl,
  deleteFromStorage,
  cleanupLocal,
};
