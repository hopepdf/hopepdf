/* Centralised error handler.
 *  - multer LIMIT_FILE_SIZE  → 413
 *  - multer LIMIT_UNEXPECTED → 400
 *  - explicit err.status used if set
 *  - everything else → 500 with sanitised message
 *
 * Cleanup: any uploaded files attached to req are removed before the
 * response is sent so we never leak files to disk on error.
 */
const logger = require('../utils/logger');
const { cleanupRequest } = require('../utils/cleanup');

// 404 fallthrough
function notFound(req, res) {
  res.status(404).json({ ok: false, error: 'Not found' });
}

// final error handler
function errorHandler(err, req, res, _next) {
  cleanupRequest(req);

  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ ok: false, error: 'File too large.', code: 'FILE_TOO_LARGE' });
  }
  if (err && err.code && /LIMIT_/.test(err.code)) {
    return res.status(400).json({ ok: false, error: err.message, code: err.code });
  }
  if (err && err.message && /CORS blocked/.test(err.message)) {
    return res.status(403).json({ ok: false, error: 'Origin not allowed.' });
  }

  const status = err && err.status ? err.status : 500;
  const msg = err && err.message ? err.message : 'Internal error';
  if (status >= 500) logger.error(req.method, req.originalUrl, msg);
  res.status(status).json({ ok: false, error: msg });
}

module.exports = { notFound, errorHandler };
