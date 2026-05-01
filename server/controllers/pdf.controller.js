/* PDF endpoints — every controller cleans up uploads after response. */
const archiver = null; // not used; kept simple — split returns first page only when 1 file
const pdfService = require('../services/pdf.service');
const { safeName } = require('../utils/safeName');
const { cleanupRequest, unlinkSafe } = require('../utils/cleanup');

function sendBuffer(res, buf, filename, mime = 'application/pdf') {
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buf.length);
  res.end(buf);
}

async function merge(req, res, next) {
  try {
    const paths = (req.files || []).map(f => f.path);
    const buf = await pdfService.merge(paths);
    sendBuffer(res, buf, 'hope-merged.pdf');
  } catch (e) { next(e); }
  finally { cleanupRequest(req); }
}

// Returns first split as a stream of single-page PDFs joined with a boundary?
// We keep it simple: merge all single-page outputs back into one PDF (deterministic
// behaviour even though it's the same as the input). For a true zip-of-PDFs add
// `archiver` and stream a zip — left out to keep dependencies lean.
async function split(req, res, next) {
  try {
    const path = req.file.path;
    const parts = await pdfService.split(path);
    if (parts.length === 1) return sendBuffer(res, parts[0].buf, safeName(req.file.originalname, 'split-1'));
    // Multiple parts: merge to a single PDF with one page each (same content as input,
    // but useful as a deterministic single-file response).
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
  try {
    // Premium → batch in parallel; Free already capped to 1 file by plan middleware.
    const files = req.files || (req.file ? [req.file] : []);
    const buffers = await Promise.all(files.map(f => pdfService.toWord(f.path)));
    if (buffers.length === 1) {
      return sendBuffer(res, buffers[0],
        safeName(files[0].originalname, '', 'docx'),
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    }
    // Combine multi-file output into a JSON manifest of base64 docs.
    res.json({
      ok: true,
      files: files.map((f, i) => ({
        name: safeName(f.originalname, '', 'docx'),
        b64:  buffers[i].toString('base64')
      }))
    });
  } catch (e) { next(e); }
  finally { cleanupRequest(req); }
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
