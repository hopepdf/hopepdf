/* PDF endpoints.
 *
 *   • Buffer-producing tools (merge/split/compress/toJpg) send the
 *     bytes back via res.end(buf).
 *   • LibreOffice produces a real file on disk → we stream it via
 *     fs.createReadStream() (low memory) and unlink the file + its
 *     temp folder once the stream closes.
 *   • Multi-file Word output is concurrent for premium (Promise.all).
 *     Free users can only send 1 file (gated by plan.middleware), so
 *     Promise.all degenerates to a single conversion.
 */
const fs = require('fs');
const path = require('path');
const pdfService = require('../services/pdf.service');
const { safeName } = require('../utils/safeName');
const { cleanupRequest, unlinkSafe } = require('../utils/cleanup');

function sendBuffer(res, buf, filename, mime = 'application/pdf') {
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buf.length);
  res.end(buf);
}

// Stream a file from disk to the client, then delete it (and its
// containing temp dir, if it's a per-job out-XXXX/ folder).
function streamFile(res, filePath, downloadName, mime) {
  res.setHeader('Content-Type', mime);
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

async function merge(req, res, next) {
  try {
    const paths = (req.files || []).map(f => f.path);
    const buf = await pdfService.merge(paths);
    sendBuffer(res, buf, 'hope-merged.pdf');
  } catch (e) { next(e); }
  finally { cleanupRequest(req); }
}

async function split(req, res, next) {
  try {
    const path = req.file.path;
    const parts = await pdfService.split(path);
    if (parts.length === 1) return sendBuffer(res, parts[0].buf, safeName(req.file.originalname, 'split-1'));
    const buf = await pdfService.merge([path]);
    sendBuffer(res, buf, safeName(req.file.originalname, 'split'));
  } catch (e) { next(e); }
  finally { cleanupRequest(req); }
}

async function compress(req, res, next) {
  try {
    const opts = { quality: req.body.quality, scale: req.body.scale };
    const buf = await pdfService.compress(req.file.path, opts);
    sendBuffer(res, buf, safeName(req.file.originalname, 'compressed'));
  } catch (e) { next(e); }
  finally { cleanupRequest(req); }
}

async function toWord(req, res, next) {
  const files = req.files || (req.file ? [req.file] : []);
  try {
    // Premium → parallel conversion. Free is already capped to 1 file
    // by plan.middleware, so Promise.all collapses to a single job.
    const outputs = await Promise.all(files.map(f => pdfService.toWord(f.path)));

    // Single-file path: stream directly.
    if (outputs.length === 1) {
      const out = outputs[0];
      const name = safeName(files[0].originalname, '', 'docx');
      cleanupRequest(req);
      return streamFile(res, out, name,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    }

    // Multi-file path (Premium): pack as base64 manifest so the
    // browser can save N files from one response.
    const manifest = await Promise.all(outputs.map(async (out, i) => ({
      name: safeName(files[i].originalname, '', 'docx'),
      b64:  (await fs.promises.readFile(out)).toString('base64')
    })));
    // cleanup output files + dirs
    outputs.forEach((p) => {
      unlinkSafe(p);
      const dir = path.dirname(p);
      if (/(\\|\/)out-\d+$/.test(dir)) fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
    });
    cleanupRequest(req);
    res.json({ ok: true, files: manifest });
  } catch (e) {
    cleanupRequest(req);
    if (e && e.code === 'NO_TEXT_LAYER') return res.status(422).json({ ok: false, code: e.code, error: e.message });
    if (e && e.code === 'LIBREOFFICE_MISSING') return res.status(503).json({ ok: false, code: e.code, error: e.message });
    next(e);
  }
}

async function toJpg(req, res, next) {
  try {
    const out = await pdfService.toJpg(req.file.path, { scale: Number(req.body.scale) || 2 });
    if (out.length === 1) return sendBuffer(res, out[0].buf, safeName(req.file.originalname, 'page-1', 'jpg'), 'image/jpeg');
    res.json({
      ok: true,
      pages: out.map(p => ({
        name: safeName(req.file.originalname, `page-${p.index}`, 'jpg'),
        b64:  p.buf.toString('base64')
      }))
    });
  } catch (e) { next(e); }
  finally { cleanupRequest(req); }
}

module.exports = { merge, split, compress, toWord, toJpg };
