/* Auth routes — three flows live side by side:
 *
 *   POST /auth/google              ← existing GIS ID-token flow (kept)
 *   GET  /auth/me                  ← existing whoami (kept)
 *   GET  /auth/google              ← NEW redirect to Google
 *   GET  /auth/google/callback     ← NEW Google → JWT → frontend
 */
const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const passport = require('../services/google.service');
const jwt = require('jsonwebtoken');

// ── existing token-based flow (don't break) ─────────────────────────
router.post('/google', ctrl.login);
router.get('/me', requireAuth, ctrl.me);

// ── new server-side OAuth redirect flow ─────────────────────────────
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/auth/failed' }),
  (req, res) => {
    const secret = process.env.JWT_SECRET || 'dev_only_change_me';
    const token  = jwt.sign(req.user, secret, { expiresIn: '7d' });
    const fe     = process.env.FRONTEND_URL || '/';
    const sep    = fe.includes('?') ? '&' : '?';
    res.redirect(`${fe}${sep}token=${encodeURIComponent(token)}`);
  }
);

router.get('/failed', (_req, res) =>
  res.status(401).json({ ok: false, error: 'Google login failed' })
);

module.exports = router;
