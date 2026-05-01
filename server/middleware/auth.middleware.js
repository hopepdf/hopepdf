/* Authentication middleware.
 *
 * Frontend sends:  Authorization: Bearer <google_id_token>
 *
 * We verify the Google ID token (no client_secret needed) and upsert the
 * user into the local store. The verified user is exposed on req.user
 * for downstream middleware/controllers.
 *
 * requireAuth → 401 if missing/invalid
 * optionalAuth → never blocks; populates req.user when possible
 */
const googleService = require('../services/google.service');
const userService = require('../services/user.service');

async function resolveUser(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) return null;
  const profile = await googleService.verifyIdToken(m[1]);
  // Refresh local user record + auto-downgrade on expiry.
  return userService.upsert({ email: profile.email, name: profile.name, picture: profile.picture });
}

async function requireAuth(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ ok: false, error: 'Sign in with Google to continue.' });
    req.user = user;
    next();
  } catch (err) {
    next({ status: 401, message: err.message || 'Invalid auth token' });
  }
}

async function optionalAuth(req, _res, next) {
  try { req.user = await resolveUser(req); } catch (_) { req.user = null; }
  next();
}

module.exports = { requireAuth, optionalAuth };
