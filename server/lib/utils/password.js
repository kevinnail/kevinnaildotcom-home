// Password hashing with Node's built-in scrypt — ported from lambda/lib.mjs.
// No bcrypt: it is a native module, and this implementation is already in
// production here. Stored form: "<saltHex>:<derivedHex>".

import crypto from 'node:crypto';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password, storedHash) {
  const [salt, derivedHex] = (storedHash ?? '').split(':');
  if (!salt || !derivedHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const stored = Buffer.from(derivedHex, 'hex');
  return derived.length === stored.length && crypto.timingSafeEqual(derived, stored);
}
