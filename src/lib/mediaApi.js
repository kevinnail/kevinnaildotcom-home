// Client for the media Lambda + S3.
// Reads (the gallery) hit the public manifest directly; writes go through the
// Lambda with a Bearer token. Base URLs come from Vite env vars (non-secret).

const API_URL = import.meta.env.VITE_API_URL;
const MEDIA_URL = import.meta.env.VITE_MEDIA_URL;

export const ASTRO_MANIFEST_URL = `${MEDIA_URL}/manifests/astro.json`;
export const HIKES_MANIFEST_URL = `${MEDIA_URL}/manifests/hikes.json`;

// Writes target a gallery via `?gallery=`; astro is the Lambda's default, so we
// only append the param for non-astro galleries (keeps astro URLs unchanged).
function galleryQuery(gallery) {
  return gallery && gallery !== 'astro' ? `?gallery=${gallery}` : '';
}

// Thrown when the Lambda rejects a token so the UI can force a re-login.
export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired');
    this.name = 'SessionExpiredError';
  }
}

export async function login(password) {
  const response = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!response.ok) throw new Error('Login failed');
  const { token } = await response.json();
  return token;
}

async function authorizedFetch(path, token, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...(options.headers ?? {}), authorization: `Bearer ${token}` },
  });
  if (response.status === 401) throw new SessionExpiredError();
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response;
}

// Ask the Lambda for a presigned PUT URL for this file.
export async function requestUpload(token, file, gallery) {
  const response = await authorizedFetch(`/presign${galleryQuery(gallery)}`, token, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ filename: file.name, contentType: file.type }),
  });
  return response.json(); // { uploadUrl, objectKey, publicUrl }
}

// Upload bytes straight to S3 — does NOT go through the Lambda.
export async function uploadToS3(uploadUrl, file) {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': file.type },
    body: file,
  });
  if (!response.ok) throw new Error('Upload to storage failed');
}

export async function savePhoto(token, { objectKey, alt, caption, lat, lng, takenAt }, gallery) {
  const response = await authorizedFetch(`/photos${galleryQuery(gallery)}`, token, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ objectKey, alt, caption, lat, lng, takenAt }),
  });
  return response.json(); // the created entry
}

// Persist many already-uploaded photos in one manifest write (bulk upload). Each
// item is { objectKey, alt?, caption?, lat?, lng?, takenAt? }.
export async function savePhotosBatch(token, items, gallery) {
  const response = await authorizedFetch(`/photos/batch${galleryQuery(gallery)}`, token, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ photos: items }),
  });
  return response.json(); // the created entries
}

export async function updatePhoto(token, id, { alt, caption, lat, lng }, gallery) {
  const response = await authorizedFetch(`/photos/${id}${galleryQuery(gallery)}`, token, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ alt, caption, lat, lng }),
  });
  return response.json(); // the updated entry
}

// Persist a new gallery order. `orderedIds` must list every existing photo id
// exactly once; the Lambda rejects anything else with a 400.
export async function reorderPhotos(token, orderedIds, gallery) {
  const response = await authorizedFetch(`/photos/order${galleryQuery(gallery)}`, token, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ order: orderedIds }),
  });
  return response.json(); // the reordered manifest
}

export async function deletePhoto(token, id, gallery) {
  await authorizedFetch(`/photos/${id}${galleryQuery(gallery)}`, token, { method: 'DELETE' });
}

// Public read of a manifest. Missing manifest (before the first upload) reads as
// an empty gallery rather than an error.
async function fetchManifest(manifestUrl) {
  const response = await fetch(manifestUrl, { cache: 'no-cache' });
  if (response.status === 403 || response.status === 404) return [];
  if (!response.ok) throw new Error('Failed to load gallery');
  return response.json();
}

// Hikes read chronologically by EXIF capture time, falling back to upload time
// when a photo has no timestamp. Ascending (oldest first). Astro keeps its
// hand-curated manifest order.
function sortByCaptureTime(photos) {
  return [...photos].sort(
    (first, second) =>
      Date.parse(first.takenAt ?? first.uploadedAt) -
      Date.parse(second.takenAt ?? second.uploadedAt),
  );
}

export function fetchAstroPhotos() {
  return fetchManifest(ASTRO_MANIFEST_URL);
}

export async function fetchHikePhotos() {
  return sortByCaptureTime(await fetchManifest(HIKES_MANIFEST_URL));
}
