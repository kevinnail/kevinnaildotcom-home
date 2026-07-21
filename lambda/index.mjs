// Media Lambda — one function behind a Function URL.
// Endpoints:
//   POST   /login          { password }                 -> { token }
//   POST   /presign        { filename, contentType }    -> { uploadUrl, objectKey, publicUrl }   (auth)
//   POST   /photos         { objectKey, alt, caption }  -> created entry                          (auth)
//   DELETE /photos/{id}                                 -> { ok: true }                          (auth)
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
  objectKeyFromUrl,
} from './lib.mjs';

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const MEDIA_BUCKET = process.env.MEDIA_BUCKET;
const MEDIA_BASE_URL = process.env.MEDIA_BASE_URL;

const TOKEN_TTL_SECONDS = 2 * 60 * 60; // 2 hours
const UPLOAD_URL_TTL_SECONDS = 5 * 60; // 5 minutes
const ASTRO_PREFIX = 'astro';
const ASTRO_MANIFEST_KEY = 'manifests/astro.json';

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

async function handlePresign(body) {
  const objectKey = `${ASTRO_PREFIX}/${crypto.randomUUID()}.${fileExtension(body.filename)}`;
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

async function handleAddPhoto(body) {
  const manifest = await readManifest(ASTRO_MANIFEST_KEY);
  const entry = buildPhotoEntry({
    objectKey: body.objectKey,
    alt: body.alt,
    caption: body.caption,
    mediaBaseUrl: MEDIA_BASE_URL,
  });
  await writeManifest(ASTRO_MANIFEST_KEY, addPhoto(manifest, entry));
  return json(201, entry);
}

async function handleDeletePhoto(id) {
  const manifest = await readManifest(ASTRO_MANIFEST_KEY);
  const target = manifest.find((photo) => photo.id === id);
  if (!target) return json(404, { error: 'Not found' });

  const objectKey = objectKeyFromUrl(target.url, MEDIA_BASE_URL);
  if (objectKey) {
    await s3.send(new DeleteObjectCommand({ Bucket: MEDIA_BUCKET, Key: objectKey }));
  }
  await writeManifest(ASTRO_MANIFEST_KEY, removePhoto(manifest, id));
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
      return await handlePresign(parseBody(event));
    }

    if (method === 'POST' && path === '/photos') {
      requireAuth(event.headers);
      return await handleAddPhoto(parseBody(event));
    }

    if (method === 'DELETE' && path.startsWith('/photos/')) {
      requireAuth(event.headers);
      return await handleDeletePhoto(decodeURIComponent(path.slice('/photos/'.length)));
    }

    return json(404, { error: 'Not found' });
  } catch (error) {
    if (error instanceof AuthError) return json(401, { error: error.message });
    console.error('Unhandled error:', error);
    return json(500, { error: 'Internal error' });
  }
}
