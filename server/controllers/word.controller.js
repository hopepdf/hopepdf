/* Word → PDF.
 *  - LibreOffice: returns a path; we stream from disk.
 *  - Fallback (no soffice): returns a buffer; we send via res.end.
 *  - Premium → parallel via Promise.all; Free → single file (gated).
 */
const fs = require('fs');
const path = require('path');
const wordService = require('../services/word.service');
const { safeName } = require('../utils/safeName');
const { cleanupRequest, unlinkSafe } = require('../utils/cleanup');

function streamFile(res, filePath, downloadName) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
  const cleanup = () => {
    unlinkSafe(filePath);
    const dir = path.dirname(filePath);
    if (/(\\|\/)out-\d+$/.test(dir)) fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
  };
  stream.on('close', cleanup);
  stream.on('error', cleanup);
}

function sendBuffer(res, buf, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buf.length);
  res.end(buf);
}

async function toPdf(req, res, next) {
  const files = req.files || (req.file ? [req.file] : []);
  try {
    const results = await Promise.all(files.map(f => wordService.toPdf(f.path)));

    if (results.length === 1) {
      const r = results[0];
      const name = safeName(files[0].originalname, '', 'pdf');
      cleanupRequest(req);
      return r.path ? streamFile(res, r.path, name) : sendBuffer(res, r.buffer, name);
    }

    // Multi-file (premium) → base64 manifest
    const manifest = await Promise.all(results.map(async (r, i) => ({
      name: safeName(files[i].originalname, '', 'pdf'),
      b64:  (r.path ? await fs.promises.readFile(r.path) : r.buffer).toString('base64')
    })));
    results.forEach((r) => {
      if (r.path) {
        unlinkSafe(r.path);
        const dir = path.dirname(r.path);
        if (/(\\|\/)out-\d+$/.test(dir)) fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
      }
    });
    cleanupRequest(req);
    res.json({ ok: true, files: manifest });
  } catch (e) {
    cleanupRequest(req);
    next(e);
  }
}

module.exports = { toPdf };
