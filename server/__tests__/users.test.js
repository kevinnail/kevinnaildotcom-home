import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../lib/utils/pool.js';
import setup from '../data/setup.js';
import app from '../lib/app.js';
import AdminUser from '../lib/models/AdminUser.js';
import authenticate from '../lib/middleware/authenticate.js';
import errorHandler from '../lib/middleware/error.js';

const CREDENTIALS = { username: 'kevin', password: 'correct horse battery staple' };

// A minimal app that does nothing but prove the middleware ran: no route is
// protected yet (slice 3 adds the first), and the middleware's whole contract is
// "reject with a 401, or populate req.user".
const protectedApp = express()
  .get('/protected', authenticate, (req, res) => res.json(req.user))
  .use(errorHandler);

beforeEach(() => {
  return setup(pool);
});

afterAll(() => {
  return pool.end();
});

describe('Admin login', () => {
  it('POST /api/v1/users/sessions returns a token identifying the user', async () => {
    const user = await AdminUser.insert(CREDENTIALS);

    const response = await request(app).post('/api/v1/users/sessions').send(CREDENTIALS);

    expect(response.status).toBe(200);
    expect(Object.keys(response.body)).toEqual(['token']);

    const payload = jwt.verify(response.body.token, process.env.JWT_SECRET);
    expect(payload.sub).toBe(String(user.id));
    expect(payload.username).toBe('kevin');
    // 12-hour expiry, allowing a second of slack for test execution.
    expect(payload.exp - payload.iat).toBe(12 * 60 * 60);
  });

  it('stores a salted scrypt hash, never the password', async () => {
    await AdminUser.insert(CREDENTIALS);

    const { rows } = await pool.query('SELECT password_hash FROM users_admin');

    expect(rows[0].password_hash).not.toContain(CREDENTIALS.password);
    expect(rows[0].password_hash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
  });

  it('rejects a wrong password with a 401', async () => {
    await AdminUser.insert(CREDENTIALS);

    const response = await request(app)
      .post('/api/v1/users/sessions')
      .send({ username: 'kevin', password: 'wrong' });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid username or password');
  });

  it('rejects an unknown username with the same 401 — no user enumeration', async () => {
    await AdminUser.insert(CREDENTIALS);

    const response = await request(app)
      .post('/api/v1/users/sessions')
      .send({ username: 'nobody', password: CREDENTIALS.password });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid username or password');
  });

  it('rejects a body with no credentials with a 401', async () => {
    const response = await request(app).post('/api/v1/users/sessions').send({});

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid username or password');
  });
});

describe('authenticate middleware', () => {
  it('populates req.user from a valid token', async () => {
    const user = await AdminUser.insert(CREDENTIALS);
    const { body } = await request(app).post('/api/v1/users/sessions').send(CREDENTIALS);

    const response = await request(protectedApp)
      .get('/protected')
      .set('authorization', `Bearer ${body.token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: String(user.id), username: 'kevin' });
  });

  it('rejects a missing authorization header with a 401', async () => {
    const response = await request(protectedApp).get('/protected');

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Missing bearer token');
  });

  it('rejects a token signed with the wrong secret with a 401', async () => {
    const forged = jwt.sign({ sub: '1', username: 'kevin' }, 'not-the-secret');

    const response = await request(protectedApp)
      .get('/protected')
      .set('authorization', `Bearer ${forged}`);

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid or expired token');
  });

  it('rejects an expired token with a 401', async () => {
    const expired = jwt.sign({ sub: '1', username: 'kevin' }, process.env.JWT_SECRET, {
      expiresIn: '-1s',
    });

    const response = await request(protectedApp)
      .get('/protected')
      .set('authorization', `Bearer ${expired}`);

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid or expired token');
  });
});
