/* H🌸PE PDF — Server entry point.
 *
 * Boots the Express app: security headers, CORS, JSON body parser,
 * morgan access log, global rate limit, then mounts the routers.
 *
 *   /healthz          GET   liveness
 *   /auth/*           login + me
 *   /pdf/*            merge | split | compress | to-word | to-jpg
 *   /word/to-pdf      DOCX → PDF
 *   /image/to-pdf     JPG/PNG → PDF
 *   /payment/*        create-order, verify
 */
const env = require('./config/env');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');

const corsMiddleware = require('./config/cors');
const { global: globalLimiter } = require('./middleware/ratelimit.middleware');
const { notFound, errorHandler } = require('./middleware/error.middleware');
const logger = require('./utils/logger');
const passport = require('./services/google.service'); // passport instance + verifyIdToken

const authRoutes    = require('./routes/auth.routes');
const pdfRoutes     = require('./routes/pdf.routes');
const wordRoutes    = require('./routes/word.routes');
const imageRoutes   = require('./routes/image.routes');
const paymentRoutes = require('./routes/payment.routes');

const app = express();
app.disable('x-powered-by');

// security + logging
app.use(helmet({ contentSecurityPolicy: false }));
app.use(corsMiddleware);
app.use(morgan(env.NODE_ENV === 'production' ? 'tiny' : 'dev'));

// global throttle (each route adds its own processing limit on top)
app.use(globalLimiter);

// passport — needed for the Google OAuth redirect flow (no sessions)
app.use(passport.initialize());

// JSON only for routes that don't take multipart uploads.
// (Multer routes parse the body themselves.)
app.use((req, res, next) => {
  if (req.is('multipart/form-data')) return next();
  return express.json({ limit: '1mb' })(req, res, next);
});

// liveness — Render uses this for health checks.
app.get('/healthz', (_req, res) => res.json({ ok: true, t: Date.now() }));

// routes
app.use('/auth',    authRoutes);
app.use('/pdf',     pdfRoutes);
app.use('/word',    wordRoutes);
app.use('/image',   imageRoutes);
app.use('/payment', paymentRoutes);

// 404 + central error handler (also cleans uploaded files)
app.use(notFound);
app.use(errorHandler);

const port = env.PORT;
app.listen(port, async () => {
  logger.info(`H🌸PE server listening on :${port}`);
  // Boot-time converter probe — logs which PDF→Word engines are wired up
  // so a missing pdf2docx install is loud, not silent.
  try {
    const { verifyConverters } = require('./services/libreoffice.service');
    await verifyConverters();
  } catch (e) {
    logger.error('verifyConverters failed:', e.message);
  }
});
