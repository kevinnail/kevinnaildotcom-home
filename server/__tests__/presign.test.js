import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import pool from '../lib/utils/pool.js';
import setup from '../data/setup.js';
import app from '../lib/app.js';
import AdminUser from '../lib/models/AdminUser.js';
import { signAdminToken } from '../lib/utils/token.js';

// CI has no AWS credentials and no test may ever reach S3, so the signer itself
// is mocked. What is under test is the key, the URL, and the signed headers we
// hand it — not the SDK's signature maths.
const { getSignedUrl } = vi.hoisted(() => ({
  getSignedUrl: vi.fn(async () => 'https://bucket.s3.amazonaws.com/signed?X-Amz-Signature=stub'),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl }));

async function adminToken() {
  const user = await AdminUser.insert({ username: 'kevin', password: 'correct horse' });
  return signAdminToken(user);
}

// The most recent command handed to the signer, so a test can assert on what
// was actually signed.
function signedCommandInput() {
  return getSignedUrl.mock.lastCall[1].input;
}

describe('POST /api/v1/presign', () => {
  beforeEach(async () => {
    getSignedUrl.mockClear();
    vi.stubEnv('MEDIA_BUCKET', 'kevinnail-media-test');
    vi.stubEnv('MEDIA_BASE_URL', 'https://media.example.com');
    await setup(pool);
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await pool.end();
  });

  it('signs a PUT into the gallery prefix and returns the upload triple', async () => {
    const token = await adminToken();

    const response = await request(app)
      .post('/api/v1/presign?gallery=astro')
      .set('authorization', `Bearer ${token}`)
      .send({ filename: 'Orion.JPG', contentType: 'image/jpeg' });

    expect(response.status).toBe(200);
    expect(response.body.objectKey).toMatch(
      /^astro\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/,
    );
    expect(response.body.uploadUrl).toBe(
      'https://bucket.s3.amazonaws.com/signed?X-Amz-Signature=stub',
    );
    expect(response.body.publicUrl).toBe(`https://media.example.com/${response.body.objectKey}`);
    // Echoed back so the client can send the identical header on the PUT.
    expect(response.body.cacheControl).toBe('public, max-age=31536000, immutable');
  });

  it('signs the content-type and cache-control headers into the URL', async () => {
    const token = await adminToken();

    await request(app)
      .post('/api/v1/presign?gallery=astro')
      .set('authorization', `Bearer ${token}`)
      .send({ filename: 'orion.jpg', contentType: 'image/jpeg' });

    expect(signedCommandInput()).toMatchObject({
      Bucket: 'kevinnail-media-test',
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=31536000, immutable',
    });
    expect(getSignedUrl.mock.lastCall[2]).toEqual({
      expiresIn: 5 * 60,
      signableHeaders: new Set(['content-type', 'cache-control']),
    });
  });

  it('uses the hikes prefix for the hikes gallery', async () => {
    const token = await adminToken();

    const response = await request(app)
      .post('/api/v1/presign?gallery=hikes')
      .set('authorization', `Bearer ${token}`)
      .send({ filename: 'ridge.jpeg', contentType: 'image/jpeg' });

    expect(response.body.objectKey).toMatch(/^hikes\/[0-9a-f-]{36}\.jpeg$/);
  });

  it('accepts a .kml file under the kml prefix', async () => {
    const token = await adminToken();

    const response = await request(app)
      .post('/api/v1/presign?gallery=kml')
      .set('authorization', `Bearer ${token}`)
      .send({ filename: 'three-sisters.kml', contentType: 'application/vnd.google-earth.kml+xml' });

    expect(response.status).toBe(200);
    expect(response.body.objectKey).toMatch(/^kml\/[0-9a-f-]{36}\.kml$/);
  });

  it('rejects a non-kml filename for the kml prefix with a 400', async () => {
    const token = await adminToken();

    const response = await request(app)
      .post('/api/v1/presign?gallery=kml')
      .set('authorization', `Bearer ${token}`)
      .send({ filename: 'three-sisters.jpg', contentType: 'image/jpeg' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Filename must end in .kml');
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it('rejects an unknown gallery with a 400', async () => {
    const token = await adminToken();

    const response = await request(app)
      .post('/api/v1/presign?gallery=bogus')
      .set('authorization', `Bearer ${token}`)
      .send({ filename: 'orion.jpg', contentType: 'image/jpeg' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('gallery must be one of: astro, hikes, kml');
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated request with a 401 and signs nothing', async () => {
    const response = await request(app)
      .post('/api/v1/presign?gallery=astro')
      .send({ filename: 'orion.jpg', contentType: 'image/jpeg' });

    expect(response.status).toBe(401);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });
});
