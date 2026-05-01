/* Auth controllers.
 *
 *   POST /auth/google   { idToken }
 *      → verifies, upserts user, returns { user }
 *
 *   GET  /auth/me       (Authorization: Bearer <id_token>)
 *      → returns the verified, current user (auto-downgrades on expiry)
 */
const googleService = require('../services/google.service');
const userService = require('../services/user.service');

async function login(req, res, next) {
  try {
    const idToken = req.body && req.body.idToken;
    if (!idToken) return res.status(400).json({ ok: false, error: 'Missing idToken.' });
    const profile = await googleService.verifyIdToken(idToken);
    const user = userService.upsert({ email: profile.email, name: profile.name, picture: profile.picture });
    res.json({ ok: true, user });
  } catch (err) {
    next({ status: 401, message: err.message || 'Google verification failed' });
  }
}

async function me(req, res) {
  res.json({ ok: true, user: req.user });
}

module.exports = { login, me };
