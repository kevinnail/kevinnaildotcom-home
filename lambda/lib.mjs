// Pure, dependency-free helpers for the media Lambda.
// Kept separate from index.mjs (which touches S3) so these can be unit-tested
// with no AWS mocking. Only Node's built-in `crypto` is used.

import crypto from 'node:crypto';

// --- Signed tokens (a minimal HS256 JWT, hand-rolled to avoid a dependency) ---

function base64UrlEncode(input) {
  return Buffer.from(input).toString('base64url');
}

export function signToken(payload, secret, expiresInSeconds) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const issuedAt = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: issuedAt, exp: issuedAt + expiresInSeconds };
  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(
    JSON.stringify(body),
  )}`;
  const signature = crypto.createHmac('sha256', secret).update(signingInput).digest('base64url');
  return `${signingInput}.${signature}`;
}

// Returns the decoded payload, or throws if the token is malformed, tampered
// with, or expired.
export function verifyToken(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed token');

  const [encodedHeader, encodedPayload, providedSignature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signingInput)
    .digest('base64url');

  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  const signatureMatches =
    providedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(providedBuffer, expectedBuffer);
  if (!signatureMatches) throw new Error('Invalid signature');

  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString());
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
    throw new Error('Token expired');
  }
  return payload;
}

// --- Password hashing (scrypt, built into Node — no bcrypt dependency) ---
// Stored form: "<saltHex>:<derivedHex>".

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

// --- Request auth ---

export function getBearerToken(headers) {
  const authHeader = headers?.authorization ?? headers?.Authorization ?? '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

// --- Manifest transforms (the manifest is a plain array, newest first) ---

export function buildPhotoEntry({ objectKey, alt, caption, mediaBaseUrl }) {
  return {
    id: crypto.randomUUID(),
    url: `${mediaBaseUrl}/${objectKey}`,
    alt: alt ?? '',
    caption: caption ?? '',
    uploadedAt: new Date().toISOString(),
  };
}

export function addPhoto(manifest, entry) {
  return [entry, ...manifest];
}

export function removePhoto(manifest, id) {
  return manifest.filter((photo) => photo.id !== id);
}

// Replace alt/caption on the matching entry; other fields and other entries
// untouched. Pure — returns a new array, does not mutate. Unknown id: unchanged.
export function updatePhoto(manifest, id, { alt, caption }) {
  return manifest.map((photo) =>
    photo.id === id
      ? { ...photo, alt: alt ?? photo.alt, caption: caption ?? photo.caption }
      : photo,
  );
}

// Reorder the manifest so its entries follow `orderedIds`. Returns null when
// `orderedIds` is not an exact permutation of the manifest's ids (wrong length,
// an unknown id, or a duplicate), so the caller can reject the request rather
// than silently drop or duplicate entries. Pure — returns a new array, never
// mutates. The manifest's array order IS the gallery's display order.
export function reorderPhotos(manifest, orderedIds) {
  if (!Array.isArray(orderedIds) || orderedIds.length !== manifest.length) return null;
  const entryById = new Map(manifest.map((photo) => [photo.id, photo]));
  const reordered = [];
  const seenIds = new Set();
  for (const id of orderedIds) {
    if (!entryById.has(id) || seenIds.has(id)) return null;
    seenIds.add(id);
    reordered.push(entryById.get(id));
  }
  return reordered;
}

// Derive the S3 object key from an entry's public URL, so deletes don't need a
// separately stored key.
export function objectKeyFromUrl(url, mediaBaseUrl) {
  return url.startsWith(`${mediaBaseUrl}/`) ? url.slice(mediaBaseUrl.length + 1) : null;
}
