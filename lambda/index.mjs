// Media Lambda — one function behind a Function URL.
// Endpoints (all photo routes accept an optional `?gallery=astro|hikes`,
// defaulting to astro; an unknown gallery returns 400):
//   POST   /login          { password }                      -> { token }
//   POST   /presign        { filename, contentType }         -> { uploadUrl, objectKey, publicUrl }   (auth)
//   POST   /photos         { objectKey, alt, caption, lat, lng, tripId } -> created entry             (auth)
//   POST   /photos/batch   { photos: [{ objectKey, ..., tripId }] } -> created entries               (auth)
//   PUT    /photos/order   { order: [id, ...] }              -> reordered manifest                    (auth)
//   PATCH  /photos/{id}    { alt, caption, lat, lng, tripId } -> updated entry                        (auth)
//   DELETE /photos/{id}                                      -> { ok: true }                          (auth)
//   POST   /kml            { objectKey, name, region }       -> created trip entry                    (auth)
//   DELETE /kml/{id}                                         -> { ok: true }                          (auth)
//
// KML trips reuse /presign (with ?gallery=kml) but have their own metadata
// endpoints because a trip's shape ({ name, region }) is not a photo's.
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
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  signToken,
  verifyToken,
  verifyPassword,
  getBearerToken,
  buildPhotoEntry,
  buildTripEntry,
  addPhoto,
  addPhotos,
  removePhoto,
  partitionPhotosByTrip,
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
const MAX_BATCH = 500; // most photos one bulk-upload request may add at once

// Object keys are content-immutable UUIDs, so the bytes at a key never change.
// Bake a one-year immutable Cache-Control into every upload so browsers serve
// repeat views (dashboard revisits, map thumbnails) from disk without
// revalidating. Set at upload time because the browser PUTs straight to S3 — the
// Lambda never touches the bytes. The client must echo this exact value on the
// PUT (see /presign response + uploadToS3), since it's part of the signature.
const UPLOAD_CACHE_CONTROL = 'public, max-age=31536000, immutable';

// Each gallery is one S3 prefix (for image objects) + one manifest object.
// Astronomy and backpacking share this Lambda + bucket but stay logically
// separate. `?gallery=` selects one; missing/absent defaults to astro so the
// existing astronomy frontend keeps working unchanged.
const GALLERIES = {
  astro: { prefix: 'astro', manifestKey: 'manifests/astro.json' },
  hikes: { prefix: 'hikes', manifestKey: 'manifests/hikes.json' },
  // KML is not a photo gallery, but it reuses /presign — `requiredExtension`
  // makes presign reject anything but a .kml filename for this prefix.
  kml: { prefix: 'kml', manifestKey: 'manifests/kml.json', requiredExtension: 'kml' },
};

const KML_GALLERY = GALLERIES.kml;

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
  if (gallery.requiredExtension && fileExtension(body.filename) !== gallery.requiredExtension) {
    return json(400, { error: `Filename must end in .${gallery.requiredExtension}` });
  }
  const objectKey = `${gallery.prefix}/${crypto.randomUUID()}.${fileExtension(body.filename)}`;
  const command = new PutObjectCommand({
    Bucket: MEDIA_BUCKET,
    Key: objectKey,
    ContentType: body.contentType,
    CacheControl: UPLOAD_CACHE_CONTROL,
  });
  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: UPLOAD_URL_TTL_SECONDS,
    signableHeaders: new Set(['content-type', 'cache-control']),
  });
  // `cacheControl` is echoed back so the client sends the identical value on the
  // PUT — a mismatch (or omission) fails the signature.
  return json(200, {
    uploadUrl,
    objectKey,
    publicUrl: `${MEDIA_BASE_URL}/${objectKey}`,
    cacheControl: UPLOAD_CACHE_CONTROL,
  });
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
    tripId: body.tripId,
    mediaBaseUrl: MEDIA_BASE_URL,
  });
  await writeManifest(gallery.manifestKey, addPhoto(manifest, entry));
  return json(201, entry);
}

async function handleAddPhotosBatch(gallery, body) {
  const photos = body.photos;
  if (!Array.isArray(photos) || photos.length === 0) {
    return json(400, { error: 'photos must be a non-empty array' });
  }
  if (photos.length > MAX_BATCH) {
    return json(400, { error: `photos exceeds the ${MAX_BATCH} per-batch limit` });
  }
  const entries = photos.map((photo) =>
    buildPhotoEntry({
      objectKey: photo.objectKey,
      thumbObjectKey: photo.thumbObjectKey,
      alt: photo.alt,
      caption: photo.caption,
      lat: photo.lat,
      lng: photo.lng,
      takenAt: photo.takenAt,
      tripId: photo.tripId,
      mediaBaseUrl: MEDIA_BASE_URL,
    }),
  );
  const manifest = await readManifest(gallery.manifestKey);
  await writeManifest(gallery.manifestKey, addPhotos(manifest, entries));
  return json(201, entries);
}

async function handleUpdatePhoto(gallery, id, body) {
  const manifest = await readManifest(gallery.manifestKey);
  if (!manifest.some((photo) => photo.id === id)) return json(404, { error: 'Not found' });

  const updated = updatePhoto(manifest, id, {
    alt: body.alt,
    caption: body.caption,
    lat: body.lat,
    lng: body.lng,
    tripId: body.tripId,
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

  // Remove the original and its thumbnail (backpacking photos have both; astronomy
  // has a null thumbUrl). One DeleteObjects call covers both keys.
  const objectKeys = [target.url, target.thumbUrl]
    .map((url) => objectKeyFromUrl(url ?? '', MEDIA_BASE_URL))
    .filter(Boolean);
  if (objectKeys.length > 0) {
    await deleteObjects(objectKeys);
  }
  await writeManifest(gallery.manifestKey, removePhoto(manifest, id));
  return json(200, { ok: true });
}

async function handleAddKml(body) {
  if (!body.objectKey || !body.name) {
    return json(400, { error: 'objectKey and name are required' });
  }
  const manifest = await readManifest(KML_GALLERY.manifestKey);
  const entry = buildTripEntry({
    objectKey: body.objectKey,
    name: body.name,
    region: body.region,
    mediaBaseUrl: MEDIA_BASE_URL,
  });
  await writeManifest(KML_GALLERY.manifestKey, addPhoto(manifest, entry));
  return json(201, entry);
}

// Delete many S3 objects in as few requests as possible. DeleteObjectsCommand
// takes up to 1000 keys at a time, so a trip with hundreds of photos is one or a
// handful of calls instead of one DeleteObjectCommand per object.
const S3_DELETE_BATCH = 1000;
async function deleteObjects(keys) {
  for (let start = 0; start < keys.length; start += S3_DELETE_BATCH) {
    const chunk = keys.slice(start, start + S3_DELETE_BATCH);
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: MEDIA_BUCKET,
        Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }
}

async function handleDeleteKml(id) {
  const tripManifest = await readManifest(KML_GALLERY.manifestKey);
  const target = tripManifest.find((trip) => trip.id === id);
  if (!target) return json(404, { error: 'Not found' });

  // Cascade: hike photos belong to a trip via photo.tripId. Deleting the trip
  // must delete its photos too — otherwise their S3 objects and manifest entries
  // are orphaned (invisible in the UI, still stored, still billed).
  const photoManifest = await readManifest(GALLERIES.hikes.manifestKey);
  const { assigned, remaining } = partitionPhotosByTrip(photoManifest, id);

  // Delete the KML object plus every assigned photo's object AND thumbnail in one
  // pass. The trip itself has no thumbUrl; each photo has both a full-res and a
  // thumbnail object to purge.
  const objectKeys = [target, ...assigned]
    .flatMap((entry) => [entry.url, entry.thumbUrl])
    .map((url) => objectKeyFromUrl(url ?? '', MEDIA_BASE_URL))
    .filter(Boolean);
  await deleteObjects(objectKeys);

  await writeManifest(KML_GALLERY.manifestKey, removePhoto(tripManifest, id));
  if (assigned.length > 0) {
    await writeManifest(GALLERIES.hikes.manifestKey, remaining);
  }

  return json(200, { ok: true, deletedPhotoIds: assigned.map((photo) => photo.id) });
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

    if (method === 'POST' && path === '/photos/batch') {
      requireAuth(event.headers);
      const gallery = resolveGallery(event);
      if (!gallery) return json(400, { error: 'Unknown gallery' });
      return await handleAddPhotosBatch(gallery, parseBody(event));
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

    if (method === 'POST' && path === '/kml') {
      requireAuth(event.headers);
      return await handleAddKml(parseBody(event));
    }

    if (method === 'DELETE' && path.startsWith('/kml/')) {
      requireAuth(event.headers);
      return await handleDeleteKml(decodeURIComponent(path.slice('/kml/'.length)));
    }

    return json(404, { error: 'Not found' });
  } catch (error) {
    if (error instanceof AuthError) return json(401, { error: error.message });
    console.error('Unhandled error:', error);
    return json(500, { error: 'Internal error' });
  }
}
