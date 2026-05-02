/* Plan limits REMOVED — every authenticated user gets unlimited
 * uploads, no size cap, no count cap. The factory shape is preserved
 * so existing route wiring (`enforcePlanLimits()` /
 * `enforcePlanLimits({ allowMulti: true })`) keeps working.
 *
 * The middleware now only verifies that SOME files were uploaded
 * (otherwise the controllers would crash on req.files[0]).
 */

function getFiles(req) {
  if (Array.isArray(req.files) && req.files.length) return req.files;
  if (req.file) return [req.file];
  return [];
}

function enforcePlanLimits(/* opts */) {
  return function plan(req, res, next) {
    const files = getFiles(req);
    if (!files.length) {
      return res.status(400).json({ ok: false, code: 'NO_FILES', error: 'No files uploaded.' });
    }
    next();
  };
}

module.exports = { enforcePlanLimits };
