// Best-effort file cleanup — never throws (caller has already responded).
const fs = require('fs');
const logger = require('./logger');

function unlinkSafe(p) {
  if (!p) return;
  fs.promises.unlink(p).catch(err => {
    if (err && err.code !== 'ENOENT') logger.warn('cleanup', p, err.message);
  });
}

// Multer attaches uploaded files to req.files (array) or req.file (single).
function cleanupRequest(req) {
  if (Array.isArray(req.files)) req.files.forEach(f => unlinkSafe(f.path));
  if (req.file) unlinkSafe(req.file.path);
}

module.exports = { unlinkSafe, cleanupRequest };
