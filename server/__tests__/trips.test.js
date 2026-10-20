import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import pool from '../lib/utils/pool.js';
import setup from '../data/setup.js';
import app from '../lib/app.js';
import AdminUser from '../lib/models/AdminUser.js';
import { signAdminToken } from '../lib/utils/token.js';

// A trip delete purges the KML object and its photos' objects, and no test may
// ever reach S3 — CI has no AWS credentials. Only the client's `send` is
// replaced, so a test can assert on exactly what was purged.
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

// Stats as the client measures them at upload (src/utils/routeStats.js).
const ROUTE_STATS = {
  distanceMiles: 8.82,
  elevationMinFeet: 5184,
  elevationMaxFeet: 6906,
  elevationGainFeet: 2100,
  elevationLossFeet: 2001,
  elevationProfiles: [
    {
      name: 'Obsidian TH to PCT',
      points: [
        [0, 5184],
        [4.412, 6906],
        [8.202, 5282],
      ],
    },
    {
      name: 'Chambers Lake day hike',
      points: [
        [0, 6594],
        [0.621, 6759],
      ],
    },
  ],
};

async function adminToken() {
  const user = await AdminUser.insert({ username: 'kevin', password: 'correct horse' });
  return signAdminToken(user);
}

beforeEach(async () => {
  send.mockClear();
  vi.stubEnv('MEDIA_BASE_URL', 'https://media.example.com');
  vi.stubEnv('MEDIA_BUCKET', 'kevinnail-media-test');
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
        stats: null,
      },
      {
        id: older.id,
        name: 'Older Loop',
        region: 'Cascades',
        url: 'https://media.example.com/kml/older.kml',
        uploadedAt: '2024-01-01T00:00:00.000Z',
        stats: null,
      },
    ]);
  });

  // The map sidebar treats "no trips yet" as an empty list, never an error
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
      .send({
        objectKey: 'kml/loop.kml',
        name: '  Timberline Loop  ',
        region: ' Mt Hood ',
        stats: ROUTE_STATS,
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      name: 'Timberline Loop',
      region: 'Mt Hood',
      url: 'https://media.example.com/kml/loop.kml',
      uploadedAt: expect.any(String),
      stats: ROUTE_STATS,
    });

    const { rows } = await pool.query('SELECT * FROM trips');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: response.body.id,
      name: 'Timberline Loop',
      url: 'https://media.example.com/kml/loop.kml',
      distance_miles: 8.82,
      elevation_gain_feet: 2100,
      elevation_profiles: ROUTE_STATS.elevationProfiles,
    });
  });

  it('stores a KML with no route line as a trip with null stats', async () => {
    const token = await adminToken();

    const response = await request(app)
      .post('/api/v1/trips')
      .set('authorization', `Bearer ${token}`)
      .send({ objectKey: 'kml/camp.kml', name: 'Campsites only', stats: null });

    expect(response.status).toBe(201);
    expect(response.body.stats).toBeNull();

    const { rows } = await pool.query('SELECT distance_miles, elevation_profiles FROM trips');
    expect(rows).toEqual([{ distance_miles: null, elevation_profiles: null }]);
  });

  it('rejects a trip sent without stats with a 400', async () => {
    const token = await adminToken();

    const response = await request(app)
      .post('/api/v1/trips')
      .set('authorization', `Bearer ${token}`)
      .send({ objectKey: 'kml/loop.kml', name: 'Timberline Loop' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('stats is required, or null for a KML with no route');
  });

  it('rejects malformed stats with a 400 and writes nothing', async () => {
    const token = await adminToken();

    const response = await request(app)
      .post('/api/v1/trips')
      .set('authorization', `Bearer ${token}`)
      .send({
        objectKey: 'kml/loop.kml',
        name: 'Timberline Loop',
        stats: {
          ...ROUTE_STATS,
          elevationProfiles: [
            {
              name: 'Out of order',
              points: [
                [100, 1580],
                [50, 1600],
              ],
            },
          ],
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/^stats.elevationProfiles must be/);

    const { rows } = await pool.query('SELECT * FROM trips');
    expect(rows).toHaveLength(0);
  });

  it('defaults an omitted region to an empty string, never null', async () => {
    const token = await adminToken();

    const response = await request(app)
      .post('/api/v1/trips')
      .set('authorization', `Bearer ${token}`)
      .send({ objectKey: 'kml/loop.kml', name: 'Timberline Loop', stats: null });

    expect(response.status).toBe(201);
    expect(response.body.region).toBe('');
  });

  it('rejects a trip with no name with a 400', async () => {
    const token = await adminToken();

    const response = await request(app)
      .post('/api/v1/trips')
      .set('authorization', `Bearer ${token}`)
      .send({ objectKey: 'kml/loop.kml', name: '   ', stats: null });

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
      .send({ name: 'Timberline Loop', stats: null });

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

describe('PUT /api/v1/trips/:id/stats', () => {
  async function insertUnmeasuredTrip() {
    const { rows } = await pool.query(
      `INSERT INTO trips (name, region, url)
       VALUES ('Timberline Loop', 'Mt Hood', 'https://media.example.com/kml/loop.kml')
       RETURNING *`,
    );

    return rows[0];
  }

  it('stores stats on a trip uploaded before they existed', async () => {
    const token = await adminToken();
    const trip = await insertUnmeasuredTrip();

    const response = await request(app)
      .put(`/api/v1/trips/${trip.id}/stats`)
      .set('authorization', `Bearer ${token}`)
      .send({ stats: ROUTE_STATS });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: trip.id,
      name: 'Timberline Loop',
      stats: ROUTE_STATS,
    });

    const listed = await request(app).get('/api/v1/trips');
    expect(listed.body[0].stats).toEqual(ROUTE_STATS);
  });

  it('rejects malformed stats with a 400 and leaves the trip unmeasured', async () => {
    const token = await adminToken();
    const trip = await insertUnmeasuredTrip();

    const response = await request(app)
      .put(`/api/v1/trips/${trip.id}/stats`)
      .set('authorization', `Bearer ${token}`)
      .send({ stats: { ...ROUTE_STATS, distanceMiles: -5 } });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('stats.distanceMiles must be a positive number');

    const { rows } = await pool.query('SELECT distance_miles FROM trips');
    expect(rows).toEqual([{ distance_miles: null }]);
  });

  it('rejects null stats, which only an upload may send', async () => {
    const token = await adminToken();
    const trip = await insertUnmeasuredTrip();

    const response = await request(app)
      .put(`/api/v1/trips/${trip.id}/stats`)
      .set('authorization', `Bearer ${token}`)
      .send({ stats: null });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('stats must be an object');
  });

  it('returns a 404 for an unknown trip', async () => {
    const token = await adminToken();

    const response = await request(app)
      .put('/api/v1/trips/00000000-0000-0000-0000-000000000000/stats')
      .set('authorization', `Bearer ${token}`)
      .send({ stats: ROUTE_STATS });

    expect(response.status).toBe(404);
  });

  it('rejects an unauthenticated request with a 401 and writes nothing', async () => {
    const trip = await insertUnmeasuredTrip();

    const response = await request(app)
      .put(`/api/v1/trips/${trip.id}/stats`)
      .send({ stats: ROUTE_STATS });

    expect(response.status).toBe(401);

    const { rows } = await pool.query('SELECT distance_miles FROM trips');
    expect(rows).toEqual([{ distance_miles: null }]);
  });
});

describe('DELETE /api/v1/trips/:id', () => {
  async function insertTrip(name, objectKey) {
    const { rows } = await pool.query(
      'INSERT INTO trips (name, region, url) VALUES ($1, $2, $3) RETURNING *',
      [name, 'Cascades', `https://media.example.com/${objectKey}`],
    );

    return rows[0];
  }

  async function insertHikePhoto(tripId, objectKey) {
    const { rows } = await pool.query(
      `INSERT INTO photos (gallery, url, thumb_url, trip_id)
       VALUES ('hikes', $1, $2, $3) RETURNING *`,
      [
        `https://media.example.com/${objectKey}.jpg`,
        `https://media.example.com/${objectKey}-thumb.jpg`,
        tripId,
      ],
    );

    return rows[0];
  }

  it('deletes the trip, cascades to its photos, and reports their ids', async () => {
    const token = await adminToken();
    const trip = await insertTrip('Timberline Loop', 'kml/loop.kml');
    const other = await insertTrip('Traverse', 'kml/traverse.kml');
    const first = await insertHikePhoto(trip.id, 'hikes/one');
    const second = await insertHikePhoto(trip.id, 'hikes/two');
    const untouched = await insertHikePhoto(other.id, 'hikes/three');

    const response = await request(app)
      .delete(`/api/v1/trips/${trip.id}`)
      .set('authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.deletedPhotoIds.sort()).toEqual([first.id, second.id].sort());

    const trips = await pool.query('SELECT id FROM trips');
    expect(trips.rows).toEqual([{ id: other.id }]);

    const photos = await pool.query('SELECT id FROM photos');
    expect(photos.rows).toEqual([{ id: untouched.id }]);
  });

  it('purges the KML object plus every assigned photo and thumbnail', async () => {
    const token = await adminToken();
    const trip = await insertTrip('Timberline Loop', 'kml/loop.kml');
    await insertHikePhoto(trip.id, 'hikes/one');

    await request(app).delete(`/api/v1/trips/${trip.id}`).set('authorization', `Bearer ${token}`);

    expect(purgedKeys()).toEqual(['kml/loop.kml', 'hikes/one.jpg', 'hikes/one-thumb.jpg']);
  });

  it('deletes a trip with no photos', async () => {
    const token = await adminToken();
    const trip = await insertTrip('Timberline Loop', 'kml/loop.kml');

    const response = await request(app)
      .delete(`/api/v1/trips/${trip.id}`)
      .set('authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, deletedPhotoIds: [] });
    expect(purgedKeys()).toEqual(['kml/loop.kml']);
  });

  it('returns a 404 for an unknown id and purges nothing', async () => {
    const token = await adminToken();

    const response = await request(app)
      .delete('/api/v1/trips/00000000-0000-0000-0000-000000000000')
      .set('authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(send).not.toHaveBeenCalled();
  });

  it('returns a 404 for a malformed id rather than a database error', async () => {
    const token = await adminToken();

    const response = await request(app)
      .delete('/api/v1/trips/not-a-uuid')
      .set('authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
  });

  it('rejects an unauthenticated delete with a 401 and keeps the trip', async () => {
    const trip = await insertTrip('Timberline Loop', 'kml/loop.kml');

    const response = await request(app).delete(`/api/v1/trips/${trip.id}`);

    expect(response.status).toBe(401);
    expect(send).not.toHaveBeenCalled();

    const { rows } = await pool.query('SELECT id FROM trips');
    expect(rows).toEqual([{ id: trip.id }]);
  });
});
