/* Google authentication — TWO modes coexist:
 *
 *   (a) ID-token verification  — used by /auth/google (POST) and the
 *       Authorization: Bearer <id_token> middleware. No client_secret
 *       needed; verifies against Google's published JWKs.
 *
 *   (b) OAuth 2.0 redirect flow — passport-google-oauth20 strategy.
 *       Used by GET /auth/google + GET /auth/google/callback.
 *       Requires GOOGLE_CLIENT_SECRET in env.
 *
 *   The module's default export is the configured passport instance so
 *   routes can do `const passport = require('./services/google.service')`.
 *   verifyIdToken is attached to passport so the existing middleware
 *   keeps working without changes.
 */
const { OAuth2Client } = require('google-auth-library');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const env = require('../config/env');
const userService = require('./user.service');

const ADMIN_EMAIL = 'hopepdfofficial@gmail.com';

/* (a) ID-token verifier — kept exactly as before so middleware/auth keeps working. */
const oauthClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);
async function verifyIdToken(idToken) {
  if (!idToken) throw new Error('Missing Google ID token');
  if (!env.GOOGLE_CLIENT_ID) throw new Error('GOOGLE_CLIENT_ID is not configured on the server');
  const ticket = await oauthClient.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
  const p = ticket.getPayload();
  if (!p || !p.email_verified) throw new Error('Email not verified by Google');
  return { email: p.email, name: p.name, picture: p.picture, sub: p.sub };
}

/* (b) Passport strategy — registered only when secrets are present so
 *      a missing GOOGLE_CLIENT_SECRET in dev doesn't crash the server. */
if (env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  // Use the absolute URL when set (recommended on production behind a
  // proxy like Render — relative URLs can resolve to http://… and
  // trigger Google's redirect_uri_mismatch / invalid_client errors).
  const callbackURL = process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback';
  passport.use(new GoogleStrategy(
    {
      clientID:     env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL,
      proxy:        true
    },
    (accessToken, refreshToken, profile, done) => {
      try {
        const email   = profile.emails && profile.emails[0] && profile.emails[0].value;
        const picture = profile.photos && profile.photos[0] && profile.photos[0].value;
        if (!email) return done(new Error('Google account has no email'));
        const isAdmin = email === ADMIN_EMAIL;

        // Persist into our local store so plan/expiry stays in sync with
        // the existing user system (Razorpay, file limits, etc.).
        let stored;
        try { stored = userService.upsert({ email, name: profile.displayName, picture }); }
        catch (_) { stored = { plan: 'free', expiresAt: null }; }

        return done(null, {
          id:        profile.id,
          name:      profile.displayName,
          email,
          picture:   picture || null,
          role:      isAdmin ? 'admin' : 'user',
          plan:      stored.plan,
          expiresAt: stored.expiresAt
        });
      } catch (err) { return done(err); }
    }
  ));
}

// Attach the ID-token verifier so existing callers (auth.middleware.js,
// auth.controller.js) keep working unchanged.
passport.verifyIdToken = verifyIdToken;
passport.ADMIN_EMAIL   = ADMIN_EMAIL;

module.exports = passport;
