/* Plan-aware request gate (runs AFTER multer).
 *
 *   FREE:
 *     • exactly 1 file per request
 *     • each file ≤ FREE_MAX_FILE_MB
 *
 *   PREMIUM:
 *     • multiple files allowed
 *     • each file ≤ PREMIUM_MAX_FILE_MB
 *
 * If a request violates the plan, all uploaded files are deleted
 * before the error response is sent.
 */
const { cleanupRequest } = require('../utils/cleanup');
const env = require('../config/env');

function getFiles(req) {
  if (Array.isArray(req.files) && req.files.length) return req.files;
  if (req.file) return [req.file];
  return [];
}

function enforcePlanLimits(req, res, next) {
  const user = req.user;
  const plan = (user && user.plan) || 'free';
  const isPremium = plan !== 'free';
  const files = getFiles(req);

  if (!files.length) {
    return res.status(400).json({ ok: false, error: 'No files uploaded.' });
  }

  // 1) file-count rule
  if (!isPremium && files.length > 1) {
    cleanupRequest(req);
    return res.status(403).json({
      ok: false,
      code: 'PLAN_LIMIT',
      error: 'Free plan: 1 file per request. Upgrade to Premium for batch processing.'
    });
  }

  // 2) per-file size cap
  const capMB = isPremium ? env.PREMIUM_MAX_FILE_MB : env.FREE_MAX_FILE_MB;
  const cap = capMB * 1024 * 1024;
  const tooBig = files.find(f => f.size > cap);
  if (tooBig) {
    cleanupRequest(req);
    return res.status(413).json({
      ok: false,
      code: 'FILE_TOO_LARGE',
      error: `${tooBig.originalname} exceeds the ${capMB} MB ${plan} limit${!isPremium ? ' — upgrade for 100 MB.' : '.'}`
    });
  }

  next();
}

module.exports = { enforcePlanLimits };
