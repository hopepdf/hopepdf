/* Verifies Google ID tokens using the official google-auth-library.
 * No client secret needed — verification uses Google's public certs.
 */
const { OAuth2Client } = require('google-auth-library');
const env = require('../config/env');

const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);

async function verifyIdToken(idToken) {
  if (!idToken) throw new Error('Missing Google ID token');
  if (!env.GOOGLE_CLIENT_ID) throw new Error('GOOGLE_CLIENT_ID is not configured on the server');
  const ticket = await client.verifyIdToken({
    idToken,
    audience: env.GOOGLE_CLIENT_ID
  });
  const p = ticket.getPayload();
  if (!p || !p.email_verified) throw new Error('Email not verified by Google');
  return { email: p.email, name: p.name, picture: p.picture, sub: p.sub };
}

module.exports = { verifyIdToken };
