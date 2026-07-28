// Admin session tokens. Signed here on login, verified in
// middleware/authenticate.js — the secret and the lifetime live in one place so
// the two sides can never drift.

import jwt from 'jsonwebtoken';

const TOKEN_LIFETIME = '12h';

// Error names jsonwebtoken uses for a token the *client* got wrong. Anything
// else out of verify() is our own fault (a missing secret, say) and must not be
// laundered into a 401.
export const TOKEN_ERROR_NAMES = ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'];

function requireSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return secret;
}

// `sub` must be a string per the JWT spec; pg already returns BIGINT ids as
// strings, but the cast keeps that from being load-bearing.
export function signAdminToken({ id, username }) {
  return jwt.sign({ sub: String(id), username }, requireSecret(), {
    algorithm: 'HS256',
    expiresIn: TOKEN_LIFETIME,
  });
}

export function verifyAdminToken(token) {
  return jwt.verify(token, requireSecret(), { algorithms: ['HS256'] });
}
