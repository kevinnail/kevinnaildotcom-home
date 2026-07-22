// Media Lambda — one function behind a Function URL.
// Endpoints (all photo routes accept an optional `?gallery=astro|hikes`,
// defaulting to astro; an unknown gallery returns 400):
//   POST   /login          { password }                      -> { token }
//   POST   /presign        { filename, contentType }         -> { uploadUrl, objectKey, publicUrl }   (auth)
//   POST   /photos         { objectKey, alt, caption, lat, lng } -> created entry                     (auth)
//   PUT    /photos/order   { order: [id, ...] }              -> reordered manifest                    (auth)
//   PATCH  /photos/{id}    { alt, caption, lat, lng }        -> updated entry                         (auth)
//   DELETE /photos/{id}                                      -> { ok: true }                          (auth)
//
// Image bytes never pass through here: /presign returns a URL the browser PUTs
// straight to S3. Reads (the gallery) fetch the public manifest directly from S3.
//
// The AWS SDK v3 is provided by the Node 20 Lambda runtime — nothing to bundle.

import crypto from 'node:crypto';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  signToken,
  verifyToken,
  verifyPassword,
  getBearerToken,
  buildPhotoEntry,
  addPhoto,
  removePhoto,
  updatePhoto,
  reorderPhotos,
  objectKeyFromUrl,
} from './lib.mjs';

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const MEDIA_BUCKET = process.env.MEDIA_BUCKET;
const MEDIA_BASE_URL = process.env.MEDIA_BASE_URL;

const TOKEN_TTL_SECONDS = 2 * 60 * 60; // 2 hours
const UPLOAD_URL_TTL_SECONDS = 5 * 60; // 5 minutes

// Each gallery is one S3 prefix (for image objects) + one manifest object.
// Astronomy and backpacking share this Lambda + bucket but stay logically
// separate. `?gallery=` selects one; missing/absent defaults to astro so the
// existing astronomy frontend keeps working unchanged.
const GALLERIES = {
  astro: { prefix: 'astro', manifestKey: 'manifests/astro.json' },
  hikes: { prefix: 'hikes', manifestKey: 'manifests/hikes.json' },
};

function resolveGallery(event) {
  const name = event.queryStringParameters?.gallery ?? 'astro';
  return GALLERIES[name] ?? null;
}

const s3 = new S3Client({});

function json(statusCode, data) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  };
}

function requireAuth(headers) {
  const token = getBearerToken(headers);
  if (!token) throw new AuthError('Missing token');
  try {
    return verifyToken(token, JWT_SECRET);
  } catch {
    throw new AuthError('Invalid token');
  }
}

class AuthError extends Error {}

function parseBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function readManifest(key) {
  try {
    const result = await s3.send(new GetObjectCommand({ Bucket: MEDIA_BUCKET, Key: key }));
    const text = await result.Body.transformToString();
    return JSON.parse(text);
  } catch (error) {
    // First write: no manifest yet.
    if (error?.name === 'NoSuchKey') return [];
    throw error;
  }
}

async function writeManifest(key, manifest) {
  await s3.send(
    new PutObjectCommand({
      Bucket: MEDIA_BUCKET,
      Key: key,
      Body: JSON.stringify(manifest, null, 2),
      ContentType: 'application/json',
      CacheControl: 'no-cache',
    }),
  );
}

function fileExtension(filename) {
  const match = /\.([a-zA-Z0-9]+)$/.exec(filename ?? '');
  return match ? match[1].toLowerCase() : 'jpg';
}

async function handleLogin(body) {
  if (!verifyPassword(body.password ?? '', ADMIN_PASSWORD_HASH)) {
    return json(401, { error: 'Invalid password' });
  }
  const token = signToken({ role: 'admin' }, JWT_SECRET, TOKEN_TTL_SECONDS);
  return json(200, { token });
}

async function handlePresign(gallery, body) {
  const objectKey = `${gallery.prefix}/${crypto.randomUUID()}.${fileExtension(body.filename)}`;
  const command = new PutObjectCommand({
    Bucket: MEDIA_BUCKET,
    Key: objectKey,
    ContentType: body.contentType,
  });
  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: UPLOAD_URL_TTL_SECONDS,
    signableHeaders: new Set(['content-type']),
  });
  return json(200, { uploadUrl, objectKey, publicUrl: `${MEDIA_BASE_URL}/${objectKey}` });
}

async function handleAddPhoto(gallery, body) {
  const manifest = await readManifest(gallery.manifestKey);
  const entry = buildPhotoEntry({
    objectKey: body.objectKey,
    alt: body.alt,
    caption: body.caption,
    lat: body.lat,
    lng: body.lng,
    takenAt: body.takenAt,
    mediaBaseUrl: MEDIA_BASE_URL,
  });
  await writeManifest(gallery.manifestKey, addPhoto(manifest, entry));
  return json(201, entry);
}

async function handleUpdatePhoto(gallery, id, body) {
  const manifest = await readManifest(gallery.manifestKey);
  if (!manifest.some((photo) => photo.id === id)) return json(404, { error: 'Not found' });

  const updated = updatePhoto(manifest, id, {
    alt: body.alt,
    caption: body.caption,
    lat: body.lat,
    lng: body.lng,
  });
  await writeManifest(gallery.manifestKey, updated);
  return json(
    200,
    updated.find((photo) => photo.id === id),
  );
}

async function handleReorderPhotos(gallery, body) {
  const manifest = await readManifest(gallery.manifestKey);
  const reordered = reorderPhotos(manifest, body.order);
  if (reordered === null) {
    return json(400, { error: 'order must be a permutation of the existing photo ids' });
  }
  await writeManifest(gallery.manifestKey, reordered);
  return json(200, reordered);
}

async function handleDeletePhoto(gallery, id) {
  const manifest = await readManifest(gallery.manifestKey);
  const target = manifest.find((photo) => photo.id === id);
  if (!target) return json(404, { error: 'Not found' });

  const objectKey = objectKeyFromUrl(target.url, MEDIA_BASE_URL);
  if (objectKey) {
    await s3.send(new DeleteObjectCommand({ Bucket: MEDIA_BUCKET, Key: objectKey }));
  }
  await writeManifest(gallery.manifestKey, removePhoto(manifest, id));
  return json(200, { ok: true });
}

export async function handler(event) {
  const method = event.requestContext?.http?.method;
  const path = event.rawPath ?? '';

  try {
    if (method === 'POST' && path === '/login') {
      return await handleLogin(parseBody(event));
    }

    if (method === 'POST' && path === '/presign') {
      requireAuth(event.headers);
      const gallery = resolveGallery(event);
      if (!gallery) return json(400, { error: 'Unknown gallery' });
      return await handlePresign(gallery, parseBody(event));
    }

    if (method === 'POST' && path === '/photos') {
      requireAuth(event.headers);
      const gallery = resolveGallery(event);
      if (!gallery) return json(400, { error: 'Unknown gallery' });
      return await handleAddPhoto(gallery, parseBody(event));
    }

    if (method === 'PUT' && path === '/photos/order') {
      requireAuth(event.headers);
      const gallery = resolveGallery(event);
      if (!gallery) return json(400, { error: 'Unknown gallery' });
      return await handleReorderPhotos(gallery, parseBody(event));
    }

    if (method === 'PATCH' && path.startsWith('/photos/')) {
      requireAuth(event.headers);
      const gallery = resolveGallery(event);
      if (!gallery) return json(400, { error: 'Unknown gallery' });
      return await handleUpdatePhoto(
        gallery,
        decodeURIComponent(path.slice('/photos/'.length)),
        parseBody(event),
      );
    }

    if (method === 'DELETE' && path.startsWith('/photos/')) {
      requireAuth(event.headers);
      const gallery = resolveGallery(event);
      if (!gallery) return json(400, { error: 'Unknown gallery' });
      return await handleDeletePhoto(gallery, decodeURIComponent(path.slice('/photos/'.length)));
    }

    return json(404, { error: 'Not found' });
  } catch (error) {
    if (error instanceof AuthError) return json(401, { error: error.message });
    console.error('Unhandled error:', error);
    return json(500, { error: 'Internal error' });
  }
}
