/* Multer config — strict file validation + temporary disk storage.
 *
 *   Accepted MIME / extensions:
 *     PDF   .pdf   application/pdf
 *     DOCX  .docx  application/vnd.openxmlformats-officedocument.wordprocessingml.document
 *     DOC   .doc   application/msword
 *     JPG   .jpg   image/jpeg
 *     PNG   .png   image/png
 *
 *   Files land in /uploads with a random filename. error.middleware
 *   guarantees they're cleaned up after the response.
 *   Size limit = PREMIUM cap (highest); plan.middleware enforces the
 *   per-plan cap after upload.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ACCEPT = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'image/jpeg': '.jpg',
  'image/jpg':  '.jpg',
  'image/png':  '.png'
};
const EXT_OK = new Set(['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '';
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  }
});

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!EXT_OK.has(ext)) return cb(new Error(`Unsupported file: ${file.originalname}`));
  if (file.mimetype && !ACCEPT[file.mimetype]) {
    return cb(new Error(`Mime mismatch: ${file.mimetype}`));
  }
  cb(null, true);
}

// No file-size cap (per spec). Count-only cap so merge requests can't
// abuse the server with thousands of attachments.
const upload = multer({
  storage,
  fileFilter,
  limits: { files: 50 }
});

module.exports = {
  single: (field = 'file') => upload.single(field),
  array:  (field = 'files', max = 20) => upload.array(field, max),
  UPLOAD_DIR
};
