import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import pool from '../lib/utils/pool.js';
import setup from '../data/setup.js';
import app from '../lib/app.js';

describe('Trip routes', () => {
  beforeEach(() => {
    return setup(pool);
  });

  afterAll(() => {
    return pool.end();
  });

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
