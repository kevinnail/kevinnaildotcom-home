// Client for the media API + S3.
// Reads (the galleries) are public GETs; writes go through the API with a
// Bearer token. Base URLs come from Vite env vars (non-secret).

const API_URL = import.meta.env.VITE_API_URL;

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

// Rejected credentials are the only login failure the user can act on, and the
// API signals it with a 401. Everything else — the API URL missing, CORS, a
// 5xx — is our problem, not theirs, and must not be reported as a bad password.
// The server answers an unknown username and a wrong password identically, so
// this can't say which one was wrong.
export class InvalidPasswordError extends Error {
  constructor() {
    super('Invalid username or password');
    this.name = 'InvalidPasswordError';
  }
}

// The request never got a verdict: offline, DNS/CORS failure, or no API_URL.
// The browser deliberately hides *why* a cross-origin request was blocked —
// fetch rejects with a bare "Failed to fetch" and the real reason is printed
// only to the console — so the one useful detail we can still relay is which
// URL we called. A wrong VITE_API_URL (an IP where localhost was expected)
// looks identical to being offline until you can see the target.
export class NetworkError extends Error {
  constructor(url, cause) {
    super(`Could not reach ${url}`);
    this.name = 'NetworkError';
    this.url = url;
    this.cause = cause;
  }
}

export async function login(username, password) {
  const loginUrl = `${API_URL}/users/sessions`;
  if (!API_URL) throw new NetworkError(loginUrl, new Error('VITE_API_URL is not set'));

  let response;
  try {
    response = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  } catch (fetchError) {
    // fetch only rejects when the request itself failed, never on an HTTP error.
    throw new NetworkError(loginUrl, fetchError);
  }

  if (response.status === 401) throw new InvalidPasswordError();
  if (!response.ok) throw new Error(`Login failed: ${response.status}`);
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

// Upload bytes straight to S3 — does NOT go through the Lambda. `cacheControl`
// comes from the presign response and MUST be sent verbatim: the Lambda signed
// it into the URL, so omitting or altering it fails the signature.
export async function uploadToS3(uploadUrl, file, cacheControl) {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'content-type': file.type,
      ...(cacheControl ? { 'cache-control': cacheControl } : {}),
    },
    body: file,
  });
  if (!response.ok) throw new Error('Upload to storage failed');
}

export async function savePhoto(
  token,
  { objectKey, alt, caption, lat, lng, takenAt, tripId },
  gallery,
) {
  const response = await authorizedFetch(`/photos${galleryQuery(gallery)}`, token, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ objectKey, alt, caption, lat, lng, takenAt, tripId }),
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

// `tripId` is only sent when the field is present in `fields` (JSON.stringify
// drops `undefined`), so astro edits never touch it. A hike edit sends the id or
// an explicit `null` to unassign.
export async function updatePhoto(token, id, { alt, caption, lat, lng, tripId }, gallery) {
  const response = await authorizedFetch(`/photos/${id}${galleryQuery(gallery)}`, token, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ alt, caption, lat, lng, tripId }),
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

// --- KML trips (map trails/campsites) ---

// Record an already-uploaded KML object as a trip. The bytes went straight to S3
// via presign (?gallery=kml) + uploadToS3; this only writes the trip manifest.
export async function saveKml(token, { objectKey, name, region }) {
  const response = await authorizedFetch('/kml', token, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ objectKey, name, region }),
  });
  return response.json(); // the created trip entry
}

// Deleting a trip cascades to its photos on the server. Returns
// { ok, deletedPhotoIds } so the dashboard can drop those photos from state too.
export async function deleteKml(token, id) {
  const response = await authorizedFetch(`/kml/${id}`, token, { method: 'DELETE' });
  return response.json();
}

// Public read. The API returns an empty array for an empty gallery, so there is
// no missing-resource case to absorb the way a missing manifest needed.
async function publicGet(path) {
  const url = `${API_URL}${path}`;
  if (!API_URL) throw new NetworkError(url, new Error('VITE_API_URL is not set'));

  let response;
  try {
    response = await fetch(url, { cache: 'no-cache' });
  } catch (fetchError) {
    throw new NetworkError(url, fetchError);
  }

  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

// Astro keeps its hand-curated order and hikes come back sorted by EXIF capture
// time (falling back to upload time) — both are ordered by the server now.
export function fetchAstroPhotos() {
  return publicGet('/photos?gallery=astro');
}

export function fetchHikePhotos() {
  return publicGet('/photos?gallery=hikes');
}

// Public read of the KML trips (drives the map sidebar).
export function fetchTrips() {
  return publicGet('/trips');
}
