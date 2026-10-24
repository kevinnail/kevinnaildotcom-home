// Client for the media API + S3.
// Reads (the galleries) are public GETs; writes go through the API with a
// Bearer token. Base URLs come from Vite env vars (non-secret).

const API_URL = import.meta.env.VITE_API_URL;

// Gallery-scoped routes select their target with `?gallery=`. The Lambda
// defaulted an omitted param to astro; the API validates against an allowlist
// and 400s on anything outside it, so the param is always sent.
function galleryQuery(gallery) {
  return `?gallery=${gallery}`;
}

// Thrown when the Lambda rejects a token so the UI can force a re-login.
export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired');
    this.name = 'SessionExpiredError';
  }
}

export class InvalidPasswordError extends Error {
  constructor() {
    super('Invalid username or password');
    this.name = 'InvalidPasswordError';
  }
}

export class NetworkError extends Error {
  constructor(url, cause) {
    super(`Could not reach ${url}`);
    this.name = 'NetworkError';
    this.url = url;
    this.cause = cause;
  }
}

export class NotFoundError extends Error {
  constructor() {
    super('Not found');
    this.name = 'NotFoundError';
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
// exactly once; the API rejects anything else with a 400.
export async function reorderPhotos(token, orderedIds, gallery) {
  const response = await authorizedFetch(`/photos/order${galleryQuery(gallery)}`, token, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ order: orderedIds }),
  });
  return response.json(); // the gallery in its new order
}

export async function deletePhoto(token, id, gallery) {
  await authorizedFetch(`/photos/${id}${galleryQuery(gallery)}`, token, { method: 'DELETE' });
}

// --- KML trips (map trails/campsites) ---

// Record an already-uploaded KML object as a trip. The bytes went straight to S3
// via presign (?gallery=kml) + uploadToS3; this only writes the trip row.
// `stats` is the route's measured distance and elevation (measureKmlRoute), or
// null for a KML with no route line.
export async function saveKml(token, { objectKey, name, region, stats }) {
  const response = await authorizedFetch('/trips', token, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ objectKey, name, region, stats }),
  });
  return response.json(); // the created trip entry
}

// Stats for a trip uploaded before they existed. Returns the updated trip.
export async function saveTripStats(token, id, stats) {
  const response = await authorizedFetch(`/trips/${id}/stats`, token, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ stats }),
  });
  return response.json();
}

// The text of a trip's KML, read from its public URL, for measuring a trip that
// was uploaded before stats existed.
export async function fetchKmlText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`KML request failed: ${response.status}`);
  return response.text();
}

// Deleting a trip cascades to its photos on the server. Returns
// { ok, deletedPhotoIds } so the dashboard can drop those photos from state too.
export async function deleteKml(token, id) {
  const response = await authorizedFetch(`/trips/${id}`, token, { method: 'DELETE' });
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

  if (response.status === 404) throw new NotFoundError();
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

// --- Blog ---

// Every post, drafts included, for the dashboard.
export async function fetchAdminBlogPosts(token) {
  const response = await authorizedFetch('/blog/admin', token);
  return response.json();
}

export async function createBlogPost(token, { title, category }) {
  const response = await authorizedFetch('/blog', token, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title, category }),
  });
  return response.json(); // the created draft
}

// One post, draft or published, for the editor.
export async function fetchAdminBlogPost(token, id) {
  const response = await authorizedFetch(`/blog/admin/${id}`, token);
  return response.json();
}

export async function updateBlogPost(token, id, { title, category, summary, blocks }) {
  const response = await authorizedFetch(`/blog/${id}`, token, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title, category, summary, blocks }),
  });
  return response.json(); // the saved post
}

// Records photos already uploaded to S3 under the blog prefix.
export async function addBlogImages(token, id, objectKeys) {
  const response = await authorizedFetch(`/blog/${id}/images`, token, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ objectKeys }),
  });
  return response.json(); // [{ id, url }]
}

export async function publishBlogPost(token, id) {
  const response = await authorizedFetch(`/blog/${id}/publish`, token, { method: 'PATCH' });
  return response.json(); // the post with its publishedAt
}

// Sets the cover to a picture already uploaded to S3 under the blog prefix,
// replacing any earlier one.
export async function setBlogCover(token, id, objectKey) {
  const response = await authorizedFetch(`/blog/${id}/cover`, token, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ objectKey }),
  });
  return response.json(); // { coverUrl }
}

export async function removeBlogCover(token, id) {
  const response = await authorizedFetch(`/blog/${id}/cover`, token, { method: 'DELETE' });
  return response.json(); // { coverUrl: null }
}

// Deletes the post along with its photos and cover in S3.
export async function deleteBlogPost(token, id) {
  const response = await authorizedFetch(`/blog/${id}`, token, { method: 'DELETE' });
  return response.json(); // the deleted post
}

// Published posts only, newest first, without their blocks.
export function fetchBlogPosts() {
  return publicGet('/blog');
}

// A published post by its slug. A draft or unknown slug rejects with NotFoundError.
export function fetchBlogPost(slug) {
  return publicGet(`/blog/${encodeURIComponent(slug)}`);
}
