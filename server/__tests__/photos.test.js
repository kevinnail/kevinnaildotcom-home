import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import pool from '../lib/utils/pool.js';
import setup from '../data/setup.js';
import app from '../lib/app.js';
import AdminUser from '../lib/models/AdminUser.js';
import { signAdminToken } from '../lib/utils/token.js';

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
  // The row stores the full public URL, built from the object key the client
  // got back from presign.
  vi.stubEnv('MEDIA_BASE_URL', 'https://media.example.com');
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
