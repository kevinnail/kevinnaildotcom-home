import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import pool from '../lib/utils/pool.js';
import setup from '../data/setup.js';
import app from '../lib/app.js';
import AdminUser from '../lib/models/AdminUser.js';
import { signAdminToken } from '../lib/utils/token.js';

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

describe('Trip routes', () => {
  it('GET /api/v1/trips returns every trip newest first, in the manifest shape', async () => {
    const { rows } = await pool.query(
      `INSERT INTO trips (name, region, url, uploaded_at) VALUES
        ('Older Loop', 'Cascades', 'https://media.example.com/kml/older.kml', '2024-01-01T00:00:00Z'),
        ('Newer Loop', 'Olympics', 'https://media.example.com/kml/newer.kml', '2024-02-01T00:00:00Z')
       RETURNING *`,
    );
    const [older, newer] = rows;

    const response = await request(app).get('/api/v1/trips');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: newer.id,
        name: 'Newer Loop',
        region: 'Olympics',
        url: 'https://media.example.com/kml/newer.kml',
        uploadedAt: '2024-02-01T00:00:00.000Z',
      },
      {
        id: older.id,
        name: 'Older Loop',
        region: 'Cascades',
        url: 'https://media.example.com/kml/older.kml',
        uploadedAt: '2024-01-01T00:00:00.000Z',
      },
    ]);
  });

  // The map sidebar treats "no trips yet" as an empty list, never an error —
  // the same way a missing manifest used to read.
  it('returns an empty list when no trips exist', async () => {
    const response = await request(app).get('/api/v1/trips');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('returns a 404 for an unknown trip sub-route', async () => {
    const response = await request(app).get('/api/v1/trips/nope/nope');

    expect(response.status).toBe(404);
  });
});

describe('POST /api/v1/trips', () => {
  it('records an uploaded KML object and returns the manifest entry shape', async () => {
    const token = await adminToken();

    const response = await request(app)
      .post('/api/v1/trips')
      .set('authorization', `Bearer ${token}`)
      .send({ objectKey: 'kml/loop.kml', name: '  Timberline Loop  ', region: ' Mt Hood ' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      name: 'Timberline Loop',
      region: 'Mt Hood',
      url: 'https://media.example.com/kml/loop.kml',
      uploadedAt: expect.any(String),
    });

    const { rows } = await pool.query('SELECT * FROM trips');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: response.body.id,
      name: 'Timberline Loop',
      url: 'https://media.example.com/kml/loop.kml',
    });
  });

  it('defaults an omitted region to an empty string, never null', async () => {
    const token = await adminToken();

    const response = await request(app)
      .post('/api/v1/trips')
      .set('authorization', `Bearer ${token}`)
      .send({ objectKey: 'kml/loop.kml', name: 'Timberline Loop' });

    expect(response.status).toBe(201);
    expect(response.body.region).toBe('');
  });

  it('rejects a trip with no name with a 400', async () => {
    const token = await adminToken();

    const response = await request(app)
      .post('/api/v1/trips')
      .set('authorization', `Bearer ${token}`)
      .send({ objectKey: 'kml/loop.kml', name: '   ' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('name is required');

    const { rows } = await pool.query('SELECT * FROM trips');
    expect(rows).toHaveLength(0);
  });

  it('rejects a trip with no objectKey with a 400', async () => {
    const token = await adminToken();

    const response = await request(app)
      .post('/api/v1/trips')
      .set('authorization', `Bearer ${token}`)
      .send({ name: 'Timberline Loop' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('objectKey is required');
  });

  it('rejects an unauthenticated request with a 401 and writes nothing', async () => {
    const response = await request(app)
      .post('/api/v1/trips')
      .send({ objectKey: 'kml/loop.kml', name: 'Timberline Loop' });

    expect(response.status).toBe(401);

    const { rows } = await pool.query('SELECT * FROM trips');
    expect(rows).toHaveLength(0);
  });
});
