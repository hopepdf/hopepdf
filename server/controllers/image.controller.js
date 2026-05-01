const imageService = require('../services/image.service');
const { cleanupRequest } = require('../utils/cleanup');

async function toPdf(req, res, next) {
  try {
    const paths = (req.files || []).map(f => f.path);
    const buf = await imageService.toPdf(paths);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="hope-images.pdf"');
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  } catch (e) { next(e); }
  finally { cleanupRequest(req); }
}

module.exports = { toPdf };
