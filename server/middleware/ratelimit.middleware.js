/* Two-tier rate limit:
 *   global:  120 requests / 15 min  per IP (DOS shield)
 *   process: 30 file-processing calls / hour per IP (Free) or
 *            300 / hour for Premium (looked up off req.user if set).
 */
const rateLimit = require('express-rate-limit');

const global = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many requests. Slow down.' }
});

const processing = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: (req) => (req.user && req.user.plan && req.user.plan !== 'free') ? 300 : 30,
  keyGenerator: (req) => (req.user && req.user.email) || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Hourly processing limit reached. Try later or upgrade.' }
});

module.exports = { global, processing };
