import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import pool from '../lib/utils/pool.js';
import setup from '../data/setup.js';
import app from '../lib/app.js';
import { MAX_BATCH } from '../lib/controllers/photos.js';
import AdminUser from '../lib/models/AdminUser.js';
import { signAdminToken } from '../lib/utils/token.js';

// Deletes purge the stored objects, and no test may ever reach S3 — CI has no
// AWS credentials. Only the client's `send` is replaced, so the commands handed
// to it are the real ones and a test can assert on exactly what was purged.
const { send } = vi.hoisted(() => ({ send: vi.fn(async () => ({})) }));

vi.mock('@aws-sdk/client-s3', async (importOriginal) => ({
  ...(await importOriginal()),
  S3Client: class {
    send = send;
  },
}));

// The keys named by the most recent DeleteObjects call.
function purgedKeys() {
  return send.mock.lastCall[0].input.Delete.Objects.map((object) => object.Key);
}

async function insertPhoto(fields) {
  const columns = Object.keys(fields);
  const placeholders = columns.map((_column, index) => `$${index + 1}`);
  const { rows } = await pool.query(
    `INSERT INTO photos (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
    Object.values(fields),
  );

  return rows[0];
}

async function adminToken() {
  const user = await AdminUser.insert({ username: 'kevin', password: 'correct horse' });
  return signAdminToken(user);
}

beforeEach(async () => {
  send.mockClear();
  // The row stores the full public URL, built from the object key the client
  // got back from presign.
  vi.stubEnv('MEDIA_BASE_URL', 'https://media.example.com');
  vi.stubEnv('MEDIA_BUCKET', 'kevinnail-media-test');
  await setup(pool);
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await pool.end();
});

describe('Photo routes', () => {
  it('GET /api/v1/photos?gallery=astro returns the manifest shape', async () => {
    const inserted = await insertPhoto({
      gallery: 'astro',
      url: 'https://media.example.com/astro/orion.jpg',
      alt: 'Orion',
      caption: 'The hunter',
      sort_order: 0,
    });

    const response = await request(app).get('/api/v1/photos?gallery=astro');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: inserted.id,
        url: 'https://media.example.com/astro/orion.jpg',
        thumbUrl: null,
        alt: 'Orion',
        caption: 'The hunter',
        lat: null,
        lng: null,
        takenAt: null,
        tripId: null,
        uploadedAt: inserted.uploaded_at.toISOString(),
      },
    ]);
  });

  it('orders astro photos by sort_order, unordered ones last by newest upload', async () => {
    await insertPhoto({
      gallery: 'astro',
      url: 'second.jpg',
      sort_order: 1,
      uploaded_at: '2024-01-01T00:00:00Z',
    });
    await insertPhoto({
      gallery: 'astro',
      url: 'first.jpg',
      sort_order: 0,
      uploaded_at: '2024-01-02T00:00:00Z',
    });
    await insertPhoto({ gallery: 'astro', url: 'older.jpg', uploaded_at: '2024-01-03T00:00:00Z' });
    await insertPhoto({ gallery: 'astro', url: 'newer.jpg', uploaded_at: '2024-01-04T00:00:00Z' });

    const response = await request(app).get('/api/v1/photos?gallery=astro');

    expect(response.body.map((photo) => photo.url)).toEqual([
      'first.jpg',
      'second.jpg',
      'newer.jpg',
      'older.jpg',
    ]);
  });

  it('orders hike photos by capture time, falling back to upload time', async () => {
    await insertPhoto({
      gallery: 'hikes',
      url: 'third.jpg',
      taken_at: '2023-06-03T12:00:00Z',
      uploaded_at: '2024-01-01T00:00:00Z',
    });
    await insertPhoto({
      gallery: 'hikes',
      url: 'first.jpg',
      taken_at: '2023-06-01T12:00:00Z',
      uploaded_at: '2024-01-01T00:00:00Z',
    });
    // No EXIF timestamp — sorts by its upload time instead.
    await insertPhoto({ gallery: 'hikes', url: 'second.jpg', uploaded_at: '2023-06-02T12:00:00Z' });

    const response = await request(app).get('/api/v1/photos?gallery=hikes');

    expect(response.body.map((photo) => photo.url)).toEqual([
      'first.jpg',
      'second.jpg',
      'third.jpg',
    ]);
  });

  it('serializes hike coordinates, thumbnail, and trip assignment', async () => {
    const { rows } = await pool.query(
      "INSERT INTO trips (name, region, url) VALUES ('Loop', 'Cascades', 'loop.kml') RETURNING *",
    );
    const trip = rows[0];
    await insertPhoto({
      gallery: 'hikes',
      url: 'ridge.jpg',
      thumb_url: 'ridge-thumb.jpg',
      lat: 44.5,
      lng: -122.25,
      taken_at: '2023-06-01T12:00:00Z',
      trip_id: trip.id,
    });

    const response = await request(app).get('/api/v1/photos?gallery=hikes');

    expect(response.body[0]).toMatchObject({
      thumbUrl: 'ridge-thumb.jpg',
      lat: 44.5,
      lng: -122.25,
      takenAt: '2023-06-01T12:00:00.000Z',
      tripId: trip.id,
    });
  });

  it('excludes photos from other galleries', async () => {
    await insertPhoto({ gallery: 'astro', url: 'astro.jpg' });
    await insertPhoto({ gallery: 'hikes', url: 'hike.jpg' });

    const response = await request(app).get('/api/v1/photos?gallery=hikes');

    expect(response.body.map((photo) => photo.url)).toEqual(['hike.jpg']);
  });

  it('rejects an unknown gallery with a 400', async () => {
    const response = await request(app).get('/api/v1/photos?gallery=bogus');

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/gallery must be one of/);
  });

  it('rejects a missing gallery with a 400', async () => {
    const response = await request(app).get('/api/v1/photos');

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/gallery must be one of/);
  });
});

describe('POST /api/v1/photos', () => {
  it('creates an astro photo and returns the manifest entry shape', async () => {
    const token = await adminToken();

    const response = await request(app)
      .post('/api/v1/photos?gallery=astro')
      .set('authorization', `Bearer ${token}`)
      .send({ objectKey: 'astro/abc.jpg', alt: 'Orion', caption: 'The hunter' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      url: 'https://media.example.com/astro/abc.jpg',
      thumbUrl: null,
      alt: 'Orion',
      caption: 'The hunter',
      lat: null,
      lng: null,
      takenAt: null,
      tripId: null,
      uploadedAt: expect.any(String),
    });

    const { rows } = await pool.query('SELECT * FROM photos');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: response.body.id,
      gallery: 'astro',
      url: 'https://media.example.com/astro/abc.jpg',
      thumb_url: null,
    });
  });

  it('omitted alt and caption default to empty strings, never null', async () => {
    const token = await adminToken();

    const response = await request(app)
      .post('/api/v1/photos?gallery=astro')
      .set('authorization', `Bearer ${token}`)
      .send({ objectKey: 'astro/abc.jpg' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ alt: '', caption: '' });
  });

  it('puts each new astro photo at the front of the curated order', async () => {
    const token = await adminToken();
    await insertPhoto({ gallery: 'astro', url: 'existing.jpg', sort_order: 0 });

    await request(app)
      .post('/api/v1/photos?gallery=astro')
      .set('authorization', `Bearer ${token}`)
      .send({ objectKey: 'astro/first.jpg' });
    await request(app)
      .post('/api/v1/photos?gallery=astro')
      .set('authorization', `Bearer ${token}`)
      .send({ objectKey: 'astro/newest.jpg' });

    const response = await request(app).get('/api/v1/photos?gallery=astro');

    expect(response.body.map((photo) => photo.url)).toEqual([
      'https://media.example.com/astro/newest.jpg',
      'https://media.example.com/astro/first.jpg',
      'existing.jpg',
    ]);
  });

  it('stores a hike photo with its thumbnail, coordinates, capture time and trip', async () => {
    const token = await adminToken();
    const { rows } = await pool.query(
      "INSERT INTO trips (name, region, url) VALUES ('Loop', 'Cascades', 'loop.kml') RETURNING *",
    );

    const response = await request(app)
      .post('/api/v1/photos?gallery=hikes')
      .set('authorization', `Bearer ${token}`)
      .send({
        objectKey: 'hikes/ridge.jpg',
        thumbObjectKey: 'hikes/ridge-thumb.jpg',
        lat: 44.5,
        lng: -122.25,
        takenAt: '2023-06-01T12:00:00.000Z',
        tripId: rows[0].id,
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      url: 'https://media.example.com/hikes/ridge.jpg',
      thumbUrl: 'https://media.example.com/hikes/ridge-thumb.jpg',
      lat: 44.5,
      lng: -122.25,
      takenAt: '2023-06-01T12:00:00.000Z',
      tripId: rows[0].id,
    });

    // Hikes sort chronologically, so they take no curated position.
    const stored = await pool.query('SELECT sort_order FROM photos');
    expect(stored.rows[0].sort_order).toBeNull();
  });

  it('rejects an unauthenticated request with a 401 and writes nothing', async () => {
    const response = await request(app)
      .post('/api/v1/photos?gallery=astro')
      .send({ objectKey: 'astro/abc.jpg' });

    expect(response.status).toBe(401);
    const { rows } = await pool.query('SELECT * FROM photos');
    expect(rows).toHaveLength(0);
  });

  it('rejects an unknown gallery with a 400', async () => {
    const token = await adminToken();

    const response = await request(app)
      .post('/api/v1/photos?gallery=kml')
      .set('authorization', `Bearer ${token}`)
      .send({ objectKey: 'kml/trip.kml' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('gallery must be one of: astro, hikes');
  });

  it('rejects a body with no objectKey with a 400', async () => {
    const token = await adminToken();

    const response = await request(app)
      .post('/api/v1/photos?gallery=astro')
      .set('authorization', `Bearer ${token}`)
      .send({ alt: 'Orion' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('objectKey is required');
  });
});

describe('POST /api/v1/photos/batch', () => {
  async function insertTrip() {
    const { rows } = await pool.query(
      "INSERT INTO trips (name, region, url) VALUES ('Loop', 'Cascades', 'loop.kml') RETURNING *",
    );

    return rows[0];
  }

  it('inserts every hike photo, tied to its trip, with thumbnails preserved', async () => {
    const token = await adminToken();
    const trip = await insertTrip();

    const response = await request(app)
      .post('/api/v1/photos/batch?gallery=hikes')
      .set('authorization', `Bearer ${token}`)
      .send({
        photos: [
          {
            objectKey: 'hikes/one.jpg',
            thumbObjectKey: 'hikes/one-thumb.jpg',
            lat: 44.5,
            lng: -122.25,
            takenAt: '2023-06-01T12:00:00.000Z',
            tripId: trip.id,
          },
          {
            objectKey: 'hikes/two.jpg',
            thumbObjectKey: 'hikes/two-thumb.jpg',
            caption: 'Second morning',
            takenAt: '2023-06-02T12:00:00.000Z',
            tripId: trip.id,
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual([
      {
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        url: 'https://media.example.com/hikes/one.jpg',
        thumbUrl: 'https://media.example.com/hikes/one-thumb.jpg',
        alt: '',
        caption: '',
        lat: 44.5,
        lng: -122.25,
        takenAt: '2023-06-01T12:00:00.000Z',
        tripId: trip.id,
        uploadedAt: expect.any(String),
      },
      {
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        url: 'https://media.example.com/hikes/two.jpg',
        thumbUrl: 'https://media.example.com/hikes/two-thumb.jpg',
        alt: '',
        caption: 'Second morning',
        lat: null,
        lng: null,
        takenAt: '2023-06-02T12:00:00.000Z',
        tripId: trip.id,
        uploadedAt: expect.any(String),
      },
    ]);

    const { rows } = await pool.query('SELECT * FROM photos ORDER BY taken_at');
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.trip_id)).toEqual([trip.id, trip.id]);
    expect(rows.map((row) => row.sort_order)).toEqual([null, null]);
  });

  it('rolls the whole batch back when one item names a trip that does not exist', async () => {
    const token = await adminToken();
    const trip = await insertTrip();

    const response = await request(app)
      .post('/api/v1/photos/batch?gallery=hikes')
      .set('authorization', `Bearer ${token}`)
      .send({
        photos: [
          { objectKey: 'hikes/good.jpg', tripId: trip.id },
          { objectKey: 'hikes/orphan.jpg', tripId: '00000000-0000-0000-0000-000000000000' },
        ],
      });

    expect(response.status).toBe(400);

    // The first item inserted cleanly before the second failed — if the
    // transaction leaked, this row would still be here.
    const { rows } = await pool.query('SELECT * FROM photos');
    expect(rows).toHaveLength(0);
  });

  it('rejects a batch containing a malformed item and inserts nothing', async () => {
    const token = await adminToken();

    const response = await request(app)
      .post('/api/v1/photos/batch?gallery=hikes')
      .set('authorization', `Bearer ${token}`)
      .send({ photos: [{ objectKey: 'hikes/good.jpg' }, { alt: 'no key' }] });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('photos[1].objectKey is required');

    const { rows } = await pool.query('SELECT * FROM photos');
    expect(rows).toHaveLength(0);
  });

  it('rejects an empty or missing photos array with a 400', async () => {
    const token = await adminToken();

    const empty = await request(app)
      .post('/api/v1/photos/batch?gallery=hikes')
      .set('authorization', `Bearer ${token}`)
      .send({ photos: [] });
    const missing = await request(app)
      .post('/api/v1/photos/batch?gallery=hikes')
      .set('authorization', `Bearer ${token}`)
      .send({});

    expect(empty.status).toBe(400);
    expect(empty.body.message).toBe('photos must be a non-empty array');
    expect(missing.status).toBe(400);
    expect(missing.body.message).toBe('photos must be a non-empty array');
  });

  it('rejects a batch over the per-request limit with a 400', async () => {
    const token = await adminToken();
    const photos = Array.from({ length: MAX_BATCH + 1 }, (_item, index) => ({
      objectKey: `hikes/${index}.jpg`,
    }));

    const response = await request(app)
      .post('/api/v1/photos/batch?gallery=hikes')
      .set('authorization', `Bearer ${token}`)
      .send({ photos });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(`photos exceeds the ${MAX_BATCH} per-batch limit`);

    const { rows } = await pool.query('SELECT * FROM photos');
    expect(rows).toHaveLength(0);
  });

  it('rejects an unauthenticated batch with a 401 and writes nothing', async () => {
    const response = await request(app)
      .post('/api/v1/photos/batch?gallery=hikes')
      .send({ photos: [{ objectKey: 'hikes/one.jpg' }] });

    expect(response.status).toBe(401);

    const { rows } = await pool.query('SELECT * FROM photos');
    expect(rows).toHaveLength(0);
  });
});

describe('PATCH /api/v1/photos/:id', () => {
  it('updates the supplied fields and returns the whole entry', async () => {
    const token = await adminToken();
    const photo = await insertPhoto({
      gallery: 'astro',
      url: 'https://media.example.com/astro/orion.jpg',
      alt: 'Orion',
      caption: 'The hunter',
    });

    const response = await request(app)
      .patch(`/api/v1/photos/${photo.id}`)
      .set('authorization', `Bearer ${token}`)
      .send({ caption: 'The hunter, from the driveway' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: photo.id,
      url: 'https://media.example.com/astro/orion.jpg',
      thumbUrl: null,
      alt: 'Orion',
      caption: 'The hunter, from the driveway',
      lat: null,
      lng: null,
      takenAt: null,
      tripId: null,
      uploadedAt: photo.uploaded_at.toISOString(),
    });

    const { rows } = await pool.query('SELECT alt, caption FROM photos WHERE id = $1', [photo.id]);
    expect(rows[0]).toEqual({ alt: 'Orion', caption: 'The hunter, from the driveway' });
  });

  it('updates coordinates without disturbing the rest', async () => {
    const token = await adminToken();
    const photo = await insertPhoto({
      gallery: 'hikes',
      url: 'ridge.jpg',
      caption: 'Ridgeline',
      lat: 44.5,
      lng: -122.25,
    });

    const response = await request(app)
      .patch(`/api/v1/photos/${photo.id}`)
      .set('authorization', `Bearer ${token}`)
      .send({ lat: 45.1 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ lat: 45.1, lng: -122.25, caption: 'Ridgeline' });
  });

  it('an explicit null tripId unassigns the photo from its trip', async () => {
    const token = await adminToken();
    const { rows } = await pool.query(
      "INSERT INTO trips (name, region, url) VALUES ('Loop', 'Cascades', 'loop.kml') RETURNING *",
    );
    const photo = await insertPhoto({ gallery: 'hikes', url: 'ridge.jpg', trip_id: rows[0].id });

    const response = await request(app)
      .patch(`/api/v1/photos/${photo.id}`)
      .set('authorization', `Bearer ${token}`)
      .send({ tripId: null });

    expect(response.status).toBe(200);
    expect(response.body.tripId).toBeNull();

    const stored = await pool.query('SELECT trip_id FROM photos WHERE id = $1', [photo.id]);
    expect(stored.rows[0].trip_id).toBeNull();
  });

  it('an absent tripId keeps the photo on its trip', async () => {
    const token = await adminToken();
    const { rows } = await pool.query(
      "INSERT INTO trips (name, region, url) VALUES ('Loop', 'Cascades', 'loop.kml') RETURNING *",
    );
    const photo = await insertPhoto({ gallery: 'hikes', url: 'ridge.jpg', trip_id: rows[0].id });

    const response = await request(app)
      .patch(`/api/v1/photos/${photo.id}`)
      .set('authorization', `Bearer ${token}`)
      .send({ caption: 'Ridgeline' });

    expect(response.status).toBe(200);
    expect(response.body.tripId).toBe(rows[0].id);
  });

  it('reassigns a photo to a different trip', async () => {
    const token = await adminToken();
    const { rows } = await pool.query(
      `INSERT INTO trips (name, region, url) VALUES
        ('Loop', 'Cascades', 'loop.kml'), ('Traverse', 'Olympics', 'traverse.kml')
       RETURNING *`,
    );
    const [loop, traverse] = rows;
    const photo = await insertPhoto({ gallery: 'hikes', url: 'ridge.jpg', trip_id: loop.id });

    const response = await request(app)
      .patch(`/api/v1/photos/${photo.id}`)
      .set('authorization', `Bearer ${token}`)
      .send({ tripId: traverse.id });

    expect(response.status).toBe(200);
    expect(response.body.tripId).toBe(traverse.id);
  });

  it('rejects a tripId that names no trip with a 400', async () => {
    const token = await adminToken();
    const photo = await insertPhoto({ gallery: 'hikes', url: 'ridge.jpg' });

    const response = await request(app)
      .patch(`/api/v1/photos/${photo.id}`)
      .set('authorization', `Bearer ${token}`)
      .send({ tripId: '00000000-0000-0000-0000-000000000000' });

    expect(response.status).toBe(400);
  });

  it('returns a 404 for an unknown id', async () => {
    const token = await adminToken();

    const response = await request(app)
      .patch('/api/v1/photos/00000000-0000-0000-0000-000000000000')
      .set('authorization', `Bearer ${token}`)
      .send({ caption: 'Nowhere' });

    expect(response.status).toBe(404);
  });

  it('returns a 404 for a malformed id rather than a database error', async () => {
    const token = await adminToken();

    const response = await request(app)
      .patch('/api/v1/photos/not-a-uuid')
      .set('authorization', `Bearer ${token}`)
      .send({ caption: 'Nowhere' });

    expect(response.status).toBe(404);
  });

  it('rejects an unauthenticated edit with a 401 and changes nothing', async () => {
    const photo = await insertPhoto({ gallery: 'astro', url: 'orion.jpg', caption: 'The hunter' });

    const response = await request(app)
      .patch(`/api/v1/photos/${photo.id}`)
      .send({ caption: 'Hijacked' });

    expect(response.status).toBe(401);

    const { rows } = await pool.query('SELECT caption FROM photos WHERE id = $1', [photo.id]);
    expect(rows[0].caption).toBe('The hunter');
  });
});

describe('PUT /api/v1/photos/order', () => {
  async function insertAstroTrio() {
    const first = await insertPhoto({ gallery: 'astro', url: 'first.jpg', sort_order: 0 });
    const second = await insertPhoto({ gallery: 'astro', url: 'second.jpg', sort_order: 1 });
    const third = await insertPhoto({ gallery: 'astro', url: 'third.jpg', sort_order: 2 });

    return [first, second, third];
  }

  it('renumbers the gallery and a re-read returns the new order', async () => {
    const token = await adminToken();
    const [first, second, third] = await insertAstroTrio();

    const response = await request(app)
      .put('/api/v1/photos/order?gallery=astro')
      .set('authorization', `Bearer ${token}`)
      .send({ order: [third.id, first.id, second.id] });

    expect(response.status).toBe(200);
    expect(response.body.map((photo) => photo.url)).toEqual([
      'third.jpg',
      'first.jpg',
      'second.jpg',
    ]);

    const reread = await request(app).get('/api/v1/photos?gallery=astro');
    expect(reread.body.map((photo) => photo.url)).toEqual(['third.jpg', 'first.jpg', 'second.jpg']);

    const { rows } = await pool.query('SELECT url, sort_order FROM photos ORDER BY sort_order');
    expect(rows).toEqual([
      { url: 'third.jpg', sort_order: 0 },
      { url: 'first.jpg', sort_order: 1 },
      { url: 'second.jpg', sort_order: 2 },
    ]);
  });

  it('rejects an order with a duplicate id and leaves every row untouched', async () => {
    const token = await adminToken();
    const [first, , third] = await insertAstroTrio();

    const response = await request(app)
      .put('/api/v1/photos/order?gallery=astro')
      .set('authorization', `Bearer ${token}`)
      .send({ order: [third.id, first.id, first.id] });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('order must be a permutation of the existing photo ids');

    const { rows } = await pool.query('SELECT url, sort_order FROM photos ORDER BY sort_order');
    expect(rows).toEqual([
      { url: 'first.jpg', sort_order: 0 },
      { url: 'second.jpg', sort_order: 1 },
      { url: 'third.jpg', sort_order: 2 },
    ]);
  });

  it('rejects an order naming a photo from another gallery', async () => {
    const token = await adminToken();
    const [first, second] = await insertAstroTrio();
    const hike = await insertPhoto({ gallery: 'hikes', url: 'ridge.jpg' });

    const response = await request(app)
      .put('/api/v1/photos/order?gallery=astro')
      .set('authorization', `Bearer ${token}`)
      .send({ order: [first.id, second.id, hike.id] });

    expect(response.status).toBe(400);

    const { rows } = await pool.query(
      "SELECT sort_order FROM photos WHERE gallery = 'astro' ORDER BY sort_order",
    );
    expect(rows.map((row) => row.sort_order)).toEqual([0, 1, 2]);
  });

  it('rejects an order that omits a photo', async () => {
    const token = await adminToken();
    const [first, second] = await insertAstroTrio();

    const response = await request(app)
      .put('/api/v1/photos/order?gallery=astro')
      .set('authorization', `Bearer ${token}`)
      .send({ order: [second.id, first.id] });

    expect(response.status).toBe(400);
  });

  it('rejects an order that is not an array with a 400', async () => {
    const token = await adminToken();
    await insertAstroTrio();

    const response = await request(app)
      .put('/api/v1/photos/order?gallery=astro')
      .set('authorization', `Bearer ${token}`)
      .send({ order: 'first,second' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('order must be an array of photo ids');
  });

  it('rejects a missing gallery with a 400', async () => {
    const token = await adminToken();
    const [first] = await insertAstroTrio();

    const response = await request(app)
      .put('/api/v1/photos/order')
      .set('authorization', `Bearer ${token}`)
      .send({ order: [first.id] });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/gallery must be one of/);
  });

  it('rejects an unauthenticated reorder with a 401 and leaves the order alone', async () => {
    const [first, second, third] = await insertAstroTrio();

    const response = await request(app)
      .put('/api/v1/photos/order?gallery=astro')
      .send({ order: [third.id, second.id, first.id] });

    expect(response.status).toBe(401);

    const { rows } = await pool.query('SELECT url, sort_order FROM photos ORDER BY sort_order');
    expect(rows.map((row) => row.url)).toEqual(['first.jpg', 'second.jpg', 'third.jpg']);
  });
});

describe('DELETE /api/v1/photos/:id', () => {
  it('removes the row and purges the stored object', async () => {
    const token = await adminToken();
    const photo = await insertPhoto({
      gallery: 'astro',
      url: 'https://media.example.com/astro/orion.jpg',
    });
    const survivor = await insertPhoto({
      gallery: 'astro',
      url: 'https://media.example.com/astro/pleiades.jpg',
    });

    const response = await request(app)
      .delete(`/api/v1/photos/${photo.id}`)
      .set('authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(purgedKeys()).toEqual(['astro/orion.jpg']);

    const { rows } = await pool.query('SELECT id FROM photos');
    expect(rows).toEqual([{ id: survivor.id }]);
  });

  it('purges a hike photo original and its thumbnail together', async () => {
    const token = await adminToken();
    const photo = await insertPhoto({
      gallery: 'hikes',
      url: 'https://media.example.com/hikes/ridge.jpg',
      thumb_url: 'https://media.example.com/hikes/ridge-thumb.jpg',
    });

    const response = await request(app)
      .delete(`/api/v1/photos/${photo.id}`)
      .set('authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(purgedKeys()).toEqual(['hikes/ridge.jpg', 'hikes/ridge-thumb.jpg']);
  });

  it('returns a 404 for an unknown id and purges nothing', async () => {
    const token = await adminToken();

    const response = await request(app)
      .delete('/api/v1/photos/00000000-0000-0000-0000-000000000000')
      .set('authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated delete with a 401 and keeps the row', async () => {
    const photo = await insertPhoto({ gallery: 'astro', url: 'orion.jpg' });

    const response = await request(app).delete(`/api/v1/photos/${photo.id}`);

    expect(response.status).toBe(401);
    expect(send).not.toHaveBeenCalled();

    const { rows } = await pool.query('SELECT id FROM photos');
    expect(rows).toHaveLength(1);
  });
});
