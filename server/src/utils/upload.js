const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadRoot = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadRoot)) {
  fs.mkdirSync(uploadRoot, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadRoot);
  },
  filename: (_req, file, cb) => {
    const cleanName = file.originalname.replace(/\s+/g, '_');
    cb(null, `${Date.now()}_${cleanName}`);
  },
});

const allowedTypes = new Set([
  '.pdf',
  '.ppt',
  '.pptx',
  '.doc',
  '.docx',
  '.txt',
  '.zip',
]);

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!allowedTypes.has(ext)) {
    return cb(new Error('Unsupported file type. Use PDF, PPT/PPTX, DOC/DOCX, or TXT.'));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

module.exports = {
  upload,
  uploadRoot,
};
