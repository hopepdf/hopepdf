const wordService = require('../services/word.service');
const { safeName } = require('../utils/safeName');
const { cleanupRequest } = require('../utils/cleanup');

function sendBuffer(res, buf, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buf.length);
  res.end(buf);
}

async function toPdf(req, res, next) {
  try {
    // Premium gets parallel batch; Free already capped to 1 by plan middleware.
    const files = req.files || (req.file ? [req.file] : []);
    const buffers = await Promise.all(files.map(f => wordService.toPdf(f.path)));
    if (buffers.length === 1) return sendBuffer(res, buffers[0], safeName(files[0].originalname, '', 'pdf'));
    res.json({
      ok: true,
      files: files.map((f, i) => ({
        name: safeName(f.originalname, '', 'pdf'),
        b64:  buffers[i].toString('base64')
      }))
    });
  } catch (e) { next(e); }
  finally { cleanupRequest(req); }
}

module.exports = { toPdf };
