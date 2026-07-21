// Client for the media Lambda + S3.
// Reads (the gallery) hit the public manifest directly; writes go through the
// Lambda with a Bearer token. Base URLs come from Vite env vars (non-secret).

const API_URL = import.meta.env.VITE_API_URL;
const MEDIA_URL = import.meta.env.VITE_MEDIA_URL;

export const ASTRO_MANIFEST_URL = `${MEDIA_URL}/manifests/astro.json`;

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
export async function requestUpload(token, file) {
  const response = await authorizedFetch('/presign', token, {
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

export async function savePhoto(token, { objectKey, alt, caption }) {
  const response = await authorizedFetch('/photos', token, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ objectKey, alt, caption }),
  });
  return response.json(); // the created entry
}

export async function updatePhoto(token, id, { alt, caption }) {
  const response = await authorizedFetch(`/photos/${id}`, token, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ alt, caption }),
  });
  return response.json(); // the updated entry
}

// Persist a new gallery order. `orderedIds` must list every existing photo id
// exactly once; the Lambda rejects anything else with a 400.
export async function reorderPhotos(token, orderedIds) {
  const response = await authorizedFetch('/photos/order', token, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ order: orderedIds }),
  });
  return response.json(); // the reordered manifest
}

export async function deletePhoto(token, id) {
  await authorizedFetch(`/photos/${id}`, token, { method: 'DELETE' });
}

// Public read of the astronomy manifest. Missing manifest (before the first
// upload) reads as an empty gallery rather than an error.
export async function fetchAstroPhotos() {
  const response = await fetch(ASTRO_MANIFEST_URL, { cache: 'no-cache' });
  if (response.status === 403 || response.status === 404) return [];
  if (!response.ok) throw new Error('Failed to load gallery');
  return response.json();
}
