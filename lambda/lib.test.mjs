import { describe, test, expect } from 'vitest';
import {
  signToken,
  verifyToken,
  hashPassword,
  verifyPassword,
  getBearerToken,
  buildPhotoEntry,
  buildTripEntry,
  addPhoto,
  addPhotos,
  removePhoto,
  updatePhoto,
  reorderPhotos,
  objectKeyFromUrl,
} from './lib.mjs';

const secret = 'test-secret';

describe('signToken / verifyToken', () => {
  test('round-trips the payload', () => {
    const token = signToken({ role: 'admin' }, secret, 60);
    const payload = verifyToken(token, secret);
    expect(payload.role).toBe('admin');
  });

  test('stamps iat and exp claims', () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const token = signToken({ role: 'admin' }, secret, 60);
    const payload = verifyToken(token, secret);
    // iat within a couple seconds of now; exp exactly 60s past iat.
    expect(payload.iat).toBeGreaterThanOrEqual(nowSeconds - 2);
    expect(payload.iat).toBeLessThanOrEqual(nowSeconds + 2);
    expect(payload.exp).toBe(payload.iat + 60);
  });

  test('rejects a tampered signature', () => {
    const token = signToken({ role: 'admin' }, secret, 60);
    const tampered = token.slice(0, -1) + (token.at(-1) === 'a' ? 'b' : 'a');
    expect(() => verifyToken(tampered, secret)).toThrow(/signature/i);
  });

  test('rejects a token signed with a different secret', () => {
    const token = signToken({ role: 'admin' }, secret, 60);
    expect(() => verifyToken(token, 'wrong-secret')).toThrow(/signature/i);
  });

  test('rejects an expired token', () => {
    const token = signToken({ role: 'admin' }, secret, -1);
    expect(() => verifyToken(token, secret)).toThrow(/expired/i);
  });

  test.each([
    ['empty string', ''],
    ['single segment', 'abc'],
    ['two segments', 'abc.def'],
    ['four segments', 'a.b.c.d'],
  ])('rejects a malformed token (%s)', (_label, malformed) => {
    expect(() => verifyToken(malformed, secret)).toThrow(/malformed/i);
  });
});

describe('hashPassword / verifyPassword', () => {
  test('accepts the correct password and rejects a wrong one', () => {
    const stored = hashPassword('correct horse battery');
    expect(verifyPassword('correct horse battery', stored)).toBe(true);
    expect(verifyPassword('wrong password', stored)).toBe(false);
  });

  test('produces a salted "salt:derived" hash that differs per call', () => {
    const first = hashPassword('same password');
    const second = hashPassword('same password');
    expect(first).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    // Random salt means the same password hashes to different stored values.
    expect(first).not.toBe(second);
    expect(verifyPassword('same password', first)).toBe(true);
    expect(verifyPassword('same password', second)).toBe(true);
  });

  test.each([
    ['null', null],
    ['undefined', undefined],
    ['empty string', ''],
    ['missing derived half', 'abcd'],
    ['garbage', 'not-a-real-hash'],
  ])('returns false for a malformed stored hash (%s)', (_label, storedHash) => {
    expect(verifyPassword('any password', storedHash)).toBe(false);
  });
});

describe('getBearerToken', () => {
  test('extracts the token case-insensitively across header casings', () => {
    expect(getBearerToken({ authorization: 'Bearer abc.def.ghi' })).toBe('abc.def.ghi');
    expect(getBearerToken({ Authorization: 'bearer xyz' })).toBe('xyz');
  });

  test.each([
    ['no headers', {}],
    ['null headers', null],
    ['undefined headers', undefined],
    ['non-bearer scheme', { authorization: 'Basic abc123' }],
    ['scheme without token', { authorization: 'Bearer' }],
  ])('returns null when there is no bearer token (%s)', (_label, headers) => {
    expect(getBearerToken(headers)).toBeNull();
  });
});

describe('buildPhotoEntry', () => {
  test('produces the expected shape', () => {
    const entry = buildPhotoEntry({
      objectKey: 'astro/abc.jpg',
      alt: 'Moon',
      caption: 'The moon',
      mediaBaseUrl: 'https://media.example.com',
    });
    expect(entry.url).toBe('https://media.example.com/astro/abc.jpg');
    expect(entry.alt).toBe('Moon');
    expect(entry.caption).toBe('The moon');
    expect(entry.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(Number.isNaN(Date.parse(entry.uploadedAt))).toBe(false);
  });

  test('defaults alt and caption to empty strings when omitted', () => {
    const entry = buildPhotoEntry({ objectKey: 'astro/x.jpg', mediaBaseUrl: 'x' });
    expect(entry.alt).toBe('');
    expect(entry.caption).toBe('');
  });

  test('stores lat/lng when provided (backpacking photos)', () => {
    const entry = buildPhotoEntry({
      objectKey: 'hikes/x.jpg',
      lat: 44.2706,
      lng: -71.3033,
      mediaBaseUrl: 'x',
    });
    expect(entry.lat).toBe(44.2706);
    expect(entry.lng).toBe(-71.3033);
  });

  test('defaults lat/lng to null when omitted (astronomy photos)', () => {
    const entry = buildPhotoEntry({ objectKey: 'astro/x.jpg', mediaBaseUrl: 'x' });
    expect(entry.lat).toBeNull();
    expect(entry.lng).toBeNull();
  });

  test('stores takenAt (EXIF capture time) when provided', () => {
    const entry = buildPhotoEntry({
      objectKey: 'hikes/x.jpg',
      takenAt: '2015-08-14T10:32:00.000Z',
      mediaBaseUrl: 'x',
    });
    expect(entry.takenAt).toBe('2015-08-14T10:32:00.000Z');
  });

  test('defaults takenAt to null when omitted', () => {
    const entry = buildPhotoEntry({ objectKey: 'astro/x.jpg', mediaBaseUrl: 'x' });
    expect(entry.takenAt).toBeNull();
  });

  test('assigns a unique id to each entry', () => {
    const first = buildPhotoEntry({ objectKey: 'astro/1.jpg', mediaBaseUrl: 'x' });
    const second = buildPhotoEntry({ objectKey: 'astro/2.jpg', mediaBaseUrl: 'x' });
    expect(first.id).not.toBe(second.id);
  });
});

describe('buildTripEntry', () => {
  test('sets name, region, and url, with a uuid id and iso uploadedAt', () => {
    const entry = buildTripEntry({
      objectKey: 'kml/abc.kml',
      name: 'Cascade Ridge',
      region: 'Cascades, WA',
      mediaBaseUrl: 'https://media.example.com',
    });
    expect(entry.name).toBe('Cascade Ridge');
    expect(entry.region).toBe('Cascades, WA');
    expect(entry.url).toBe('https://media.example.com/kml/abc.kml');
    expect(entry.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(Number.isNaN(Date.parse(entry.uploadedAt))).toBe(false);
  });

  test('defaults name and region to empty strings when omitted', () => {
    const entry = buildTripEntry({ objectKey: 'kml/x.kml', mediaBaseUrl: 'x' });
    expect(entry.name).toBe('');
    expect(entry.region).toBe('');
  });

  test('assigns a unique id to each entry', () => {
    const first = buildTripEntry({ objectKey: 'kml/1.kml', mediaBaseUrl: 'x' });
    const second = buildTripEntry({ objectKey: 'kml/2.kml', mediaBaseUrl: 'x' });
    expect(first.id).not.toBe(second.id);
  });

  test('round-trips its url back to the object key (delete path)', () => {
    const base = 'https://media.example.com';
    const entry = buildTripEntry({ objectKey: 'kml/trip.kml', name: 'T', mediaBaseUrl: base });
    expect(objectKeyFromUrl(entry.url, base)).toBe('kml/trip.kml');
  });
});

// The KML routes reuse the generic list transforms; this covers them on trip
// entries (deleting the matching trip, leaving the rest) as slice 5 relies on.
describe('trip manifest transforms (addPhoto / removePhoto on trips)', () => {
  test('addPhoto prepends a trip; removePhoto drops the matching id only', () => {
    const first = buildTripEntry({ objectKey: 'kml/1.kml', name: 'First', mediaBaseUrl: 'x' });
    const second = buildTripEntry({ objectKey: 'kml/2.kml', name: 'Second', mediaBaseUrl: 'x' });
    const manifest = addPhoto(addPhoto([], first), second);
    expect(manifest.map((trip) => trip.name)).toEqual(['Second', 'First']);

    const afterRemove = removePhoto(manifest, second.id);
    expect(afterRemove.map((trip) => trip.name)).toEqual(['First']);
    // Input untouched (pure).
    expect(manifest).toHaveLength(2);
  });
});

describe('addPhoto / removePhoto', () => {
  test('addPhoto prepends (newest first) without mutating the input', () => {
    const first = buildPhotoEntry({ objectKey: 'astro/1.jpg', mediaBaseUrl: 'x' });
    const second = buildPhotoEntry({ objectKey: 'astro/2.jpg', mediaBaseUrl: 'x' });
    const afterFirst = addPhoto([], first);
    const manifest = addPhoto(afterFirst, second);
    expect(manifest.map((photo) => photo.url)).toEqual(['x/astro/2.jpg', 'x/astro/1.jpg']);
    // Prior manifest is untouched (transforms are pure).
    expect(afterFirst).toHaveLength(1);
  });

  test('removePhoto removes by id and leaves the rest, without mutating', () => {
    const first = buildPhotoEntry({ objectKey: 'astro/1.jpg', mediaBaseUrl: 'x' });
    const second = buildPhotoEntry({ objectKey: 'astro/2.jpg', mediaBaseUrl: 'x' });
    const manifest = addPhoto(addPhoto([], first), second);
    const afterRemove = removePhoto(manifest, first.id);
    expect(afterRemove.map((photo) => photo.id)).toEqual([second.id]);
    expect(manifest).toHaveLength(2);
  });

  test('removePhoto is a no-op when the id is not present', () => {
    const only = buildPhotoEntry({ objectKey: 'astro/1.jpg', mediaBaseUrl: 'x' });
    const manifest = addPhoto([], only);
    expect(removePhoto(manifest, 'no-such-id')).toEqual(manifest);
  });
});

describe('addPhotos (bulk)', () => {
  test('prepends all new entries ahead of the existing manifest, without mutating', () => {
    const existing = buildPhotoEntry({ objectKey: 'hikes/0.jpg', mediaBaseUrl: 'x' });
    const manifest = addPhoto([], existing);
    const first = buildPhotoEntry({ objectKey: 'hikes/1.jpg', mediaBaseUrl: 'x' });
    const second = buildPhotoEntry({ objectKey: 'hikes/2.jpg', mediaBaseUrl: 'x' });

    const result = addPhotos(manifest, [first, second]);

    expect(result.map((photo) => photo.url)).toEqual([
      'x/hikes/1.jpg',
      'x/hikes/2.jpg',
      'x/hikes/0.jpg',
    ]);
    // Input untouched (pure).
    expect(manifest).toHaveLength(1);
  });

  test('is a no-op returning the manifest contents when entries is empty', () => {
    const only = buildPhotoEntry({ objectKey: 'hikes/0.jpg', mediaBaseUrl: 'x' });
    const manifest = addPhoto([], only);
    expect(addPhotos(manifest, [])).toEqual(manifest);
  });
});

describe('updatePhoto', () => {
  test('updates alt + caption on the matching id, preserving id/url/uploadedAt', () => {
    const entry = buildPhotoEntry({
      objectKey: 'astro/1.jpg',
      alt: 'old alt',
      caption: 'old caption',
      mediaBaseUrl: 'x',
    });
    const manifest = addPhoto([], entry);
    const [updated] = updatePhoto(manifest, entry.id, { alt: 'new alt', caption: 'new caption' });
    expect(updated.alt).toBe('new alt');
    expect(updated.caption).toBe('new caption');
    expect(updated.id).toBe(entry.id);
    expect(updated.url).toBe(entry.url);
    expect(updated.uploadedAt).toBe(entry.uploadedAt);
  });

  test('leaves other entries untouched', () => {
    const first = buildPhotoEntry({
      objectKey: 'astro/1.jpg',
      caption: 'first',
      mediaBaseUrl: 'x',
    });
    const second = buildPhotoEntry({
      objectKey: 'astro/2.jpg',
      caption: 'second',
      mediaBaseUrl: 'x',
    });
    const manifest = addPhoto(addPhoto([], first), second);
    const result = updatePhoto(manifest, first.id, { caption: 'edited' });
    expect(result.find((photo) => photo.id === second.id).caption).toBe('second');
    expect(result.find((photo) => photo.id === first.id).caption).toBe('edited');
  });

  test('does not mutate the input array', () => {
    const entry = buildPhotoEntry({
      objectKey: 'astro/1.jpg',
      caption: 'original',
      mediaBaseUrl: 'x',
    });
    const manifest = addPhoto([], entry);
    updatePhoto(manifest, entry.id, { caption: 'changed' });
    expect(manifest[0].caption).toBe('original');
  });

  test('is a no-op when the id is not present', () => {
    const entry = buildPhotoEntry({ objectKey: 'astro/1.jpg', mediaBaseUrl: 'x' });
    const manifest = addPhoto([], entry);
    expect(updatePhoto(manifest, 'no-such-id', { caption: 'x' })).toEqual(manifest);
  });

  test('omitting caption keeps the prior caption', () => {
    const entry = buildPhotoEntry({
      objectKey: 'astro/1.jpg',
      alt: 'old alt',
      caption: 'keep me',
      mediaBaseUrl: 'x',
    });
    const manifest = addPhoto([], entry);
    const [updated] = updatePhoto(manifest, entry.id, { alt: 'new alt' });
    expect(updated.alt).toBe('new alt');
    expect(updated.caption).toBe('keep me');
  });

  test('updates lat/lng on the matching id', () => {
    const entry = buildPhotoEntry({
      objectKey: 'hikes/1.jpg',
      lat: 44.27,
      lng: -71.3,
      mediaBaseUrl: 'x',
    });
    const manifest = addPhoto([], entry);
    const [updated] = updatePhoto(manifest, entry.id, { lat: 45.9, lng: -68.9 });
    expect(updated.lat).toBe(45.9);
    expect(updated.lng).toBe(-68.9);
  });

  test('omitting lat/lng keeps the prior coordinates', () => {
    const entry = buildPhotoEntry({
      objectKey: 'hikes/1.jpg',
      caption: 'summit',
      lat: 44.27,
      lng: -71.3,
      mediaBaseUrl: 'x',
    });
    const manifest = addPhoto([], entry);
    const [updated] = updatePhoto(manifest, entry.id, { caption: 'summit view' });
    expect(updated.caption).toBe('summit view');
    expect(updated.lat).toBe(44.27);
    expect(updated.lng).toBe(-71.3);
  });
});

describe('reorderPhotos', () => {
  const buildThree = () => {
    const first = buildPhotoEntry({
      objectKey: 'astro/1.jpg',
      caption: 'first',
      mediaBaseUrl: 'x',
    });
    const second = buildPhotoEntry({
      objectKey: 'astro/2.jpg',
      caption: 'second',
      mediaBaseUrl: 'x',
    });
    const third = buildPhotoEntry({
      objectKey: 'astro/3.jpg',
      caption: 'third',
      mediaBaseUrl: 'x',
    });
    return { first, second, third, manifest: [first, second, third] };
  };

  test('reorders entries to match orderedIds', () => {
    const { first, second, third, manifest } = buildThree();
    const result = reorderPhotos(manifest, [third.id, first.id, second.id]);
    expect(result.map((photo) => photo.caption)).toEqual(['third', 'first', 'second']);
  });

  test('preserves each entry unchanged (only order changes)', () => {
    const { first, second, third, manifest } = buildThree();
    const result = reorderPhotos(manifest, [second.id, third.id, first.id]);
    expect(result[0]).toEqual(second);
    expect(result[2]).toEqual(first);
  });

  test('does not mutate the input array', () => {
    const { first, second, third, manifest } = buildThree();
    reorderPhotos(manifest, [third.id, second.id, first.id]);
    expect(manifest.map((photo) => photo.caption)).toEqual(['first', 'second', 'third']);
  });

  test('returns null when an id is missing from orderedIds (wrong length)', () => {
    const { first, second, manifest } = buildThree();
    expect(reorderPhotos(manifest, [first.id, second.id])).toBeNull();
  });

  test('returns null when orderedIds contains an unknown id', () => {
    const { first, second, manifest } = buildThree();
    expect(reorderPhotos(manifest, [first.id, second.id, 'no-such-id'])).toBeNull();
  });

  test('returns null when orderedIds duplicates an id', () => {
    const { first, second, manifest } = buildThree();
    expect(reorderPhotos(manifest, [first.id, second.id, first.id])).toBeNull();
  });

  test('returns null when orderedIds is not an array', () => {
    const { manifest } = buildThree();
    expect(reorderPhotos(manifest, undefined)).toBeNull();
  });
});

describe('objectKeyFromUrl', () => {
  const base = 'https://media.example.com';

  test('derives the key from a matching url', () => {
    expect(objectKeyFromUrl(`${base}/astro/abc.jpg`, base)).toBe('astro/abc.jpg');
  });

  test('returns null for a url on a different host', () => {
    expect(objectKeyFromUrl('https://elsewhere.com/x.jpg', base)).toBeNull();
  });

  test('returns null when the url is the base with no trailing key', () => {
    expect(objectKeyFromUrl(base, base)).toBeNull();
  });

  test('round-trips with buildPhotoEntry', () => {
    const entry = buildPhotoEntry({ objectKey: 'astro/round-trip.jpg', mediaBaseUrl: base });
    expect(objectKeyFromUrl(entry.url, base)).toBe('astro/round-trip.jpg');
  });
});
