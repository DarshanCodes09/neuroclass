const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getAdmin } = require('../db');

const uploadRoot = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadRoot)) fs.mkdirSync(uploadRoot, { recursive: true });

/** Multer storage: keep files in /uploads for temporary local use */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 52 * 1024 * 1024 } });

/**
 * Upload a local file to a Supabase Storage bucket.
 *
 * @param {string} bucket - e.g. 'course-assets', 'submissions'
 * @param {string} storagePath - path inside bucket, e.g. 'courses/uuid/filename.pdf'
 * @param {string} localFilePath - absolute path on disk
 * @param {string} mimeType
 * @returns {Promise<{ path: string, publicUrl: string }>}
 */
async function uploadToStorage(bucket, storagePath, localFilePath, mimeType) {
  const sb = getAdmin();
  const fileBuffer = fs.readFileSync(localFilePath);

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
 * Delete a file from storage.
 */
async function deleteFromStorage(bucket, storagePath) {
  const sb = getAdmin();
  const { error } = await sb.storage.from(bucket).remove([storagePath]);
  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}

/**
 * Clean up local temp file after upload.
 */
function cleanupLocal(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {}
}

module.exports = {
  upload,
  uploadRoot,
  uploadToStorage,
  getSignedUrl,
  deleteFromStorage,
  cleanupLocal,
};
