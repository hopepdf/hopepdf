/* Google authentication — server-side OAuth 2.0 redirect flow ONLY.
 *
 *   GET  /auth/google           → passport.authenticate('google')
 *   GET  /auth/google/callback  → passport callback → JWT → frontend
 *
 *   All three values come from env vars — nothing is hardcoded:
 *     GOOGLE_CLIENT_ID
 *     GOOGLE_CLIENT_SECRET
 *     GOOGLE_CALLBACK_URL
 *
 *   verifyIdToken is kept attached to the passport export ONLY so that
 *   existing middleware (auth.middleware.js) using
 *   `Authorization: Bearer <id_token>` headers doesn't break for
 *   protected routes. The frontend no longer issues GIS id tokens.
 */
const { OAuth2Client } = require('google-auth-library');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const userService = require('./user.service');

const ADMIN_EMAIL = 'hopepdfofficial@gmail.com';

// ── env-only config (no hardcoded fallback) ──────────────────────────
const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL  = process.env.GOOGLE_CALLBACK_URL;

console.log('[auth] Using Google Client ID:', GOOGLE_CLIENT_ID || '(missing!)');
console.log('[auth] Callback URL          :', GOOGLE_CALLBACK_URL || '(missing!)');

// ── Passport Google strategy (single login flow) ────────────────────
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_CALLBACK_URL) {
  passport.use(new GoogleStrategy(
    {
      clientID:     GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL:  GOOGLE_CALLBACK_URL,
      proxy:        true
    },
    (_accessToken, _refreshToken, profile, done) => {
      try {
        const email   = profile.emails && profile.emails[0] && profile.emails[0].value;
        const picture = profile.photos && profile.photos[0] && profile.photos[0].value;
        if (!email) return done(new Error('Google account has no email'));
        const isAdmin = email === ADMIN_EMAIL;

        // Persist locally so plan/role stay aligned with the rest of the app.
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
} else {
  console.error('[auth] ⚠️  Google strategy NOT registered — set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL.');
}

// ── Legacy ID-token verifier (kept for protected-route middleware) ──
const oauthClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
async function verifyIdToken(idToken) {
  if (!idToken) throw new Error('Missing Google ID token');
  if (!oauthClient) throw new Error('GOOGLE_CLIENT_ID is not configured on the server');
  const ticket = await oauthClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
  const p = ticket.getPayload();
  if (!p || !p.email_verified) throw new Error('Email not verified by Google');
  return { email: p.email, name: p.name, picture: p.picture, sub: p.sub };
}

passport.verifyIdToken = verifyIdToken;
passport.ADMIN_EMAIL   = ADMIN_EMAIL;

module.exports = passport;
