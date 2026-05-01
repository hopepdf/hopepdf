// CORS — only allow listed origins (Vercel preview + production + local dev).
const cors = require('cors');
const env = require('./env');

const cfg = {
  origin(origin, cb) {
    // Allow same-origin / curl / health checks (no Origin header).
    if (!origin) return cb(null, true);
    if (env.ALLOWED_ORIGINS.length === 0) return cb(null, true); // dev convenience
    return env.ALLOWED_ORIGINS.includes(origin)
      ? cb(null, true)
      : cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: false,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

module.exports = cors(cfg);
