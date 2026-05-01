/* Plan-aware request gate (runs AFTER multer).
 *
 *   FREE plan:
 *     • exactly 1 file per request
 *     • EXCEPT routes that opt in with { allowMulti: true } (e.g. merge)
 *
 *   PREMIUM plan:
 *     • multiple files allowed
 *     • parallel processing handled in the controllers
 *
 *   No file-size cap is enforced here — per spec, large files are
 *   accepted. (Multer in upload.middleware.js also leaves size open.)
 *
 *   Usage in routes:
 *     enforcePlanLimits()              // default: free=1, premium=many
 *     enforcePlanLimits({ allowMulti }) // bypass count rule (merge)
 */
const { cleanupRequest } = require('../utils/cleanup');

function getFiles(req) {
  if (Array.isArray(req.files) && req.files.length) return req.files;
  if (req.file) return [req.file];
  return [];
}

function enforcePlanLimits(opts = {}) {
  const { allowMulti = false } = opts;
  return function plan(req, res, next) {
    const user = req.user;
    const isPremium = !!user && user.plan && user.plan !== 'free';
    const files = getFiles(req);

    if (!files.length) {
      return res.status(400).json({ ok: false, error: 'No files uploaded.' });
    }

    // File-count rule (skipped for tools that explicitly opt in, e.g. merge).
    if (!allowMulti && !isPremium && files.length > 1) {
      cleanupRequest(req);
      return res.status(403).json({
        ok: false,
        code: 'PLAN_LIMIT',
        message: 'Free plan allows only 1 file at a time. Upgrade for batch processing.'
      });
    }

    next();
  };
}

module.exports = { enforcePlanLimits };
