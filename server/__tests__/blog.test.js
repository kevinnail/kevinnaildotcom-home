import { describe, it, expect, beforeEach, afterAll } from 'vitest';
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

async function blogRowCount() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM blog_posts');
  return rows[0].count;
}

async function createPost(token, fields) {
  return request(app).post('/api/v1/blog').set('authorization', `Bearer ${token}`).send(fields);
}

beforeEach(async () => {
  await setup(pool);
});

afterAll(async () => {
  await pool.end();
});

describe('POST /api/v1/blog', () => {
  // Otherwise a new post is missing its URL, or goes live before it is written.
  it('creates a draft with a slug built from the trimmed title', async () => {
    const token = await adminToken();

    const response = await createPost(token, {
      title: '  Sunrise on the Ridge!  ',
      category: 'Hiking',
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(String),
      slug: 'sunrise-on-the-ridge',
      title: 'Sunrise on the Ridge!',
      category: 'Hiking',
      summary: '',
      coverUrl: null,
      blocks: [],
      publishedAt: null,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });

    const { rows } = await pool.query('SELECT * FROM blog_posts WHERE id = $1', [response.body.id]);
    expect(rows[0].slug).toBe('sunrise-on-the-ridge');
    expect(rows[0].published_at).toBeNull();
  });

  // Otherwise a second post with the same title fails the unique slug and can't be created.
  it('suffixes the slug when the title is already taken', async () => {
    const token = await adminToken();

    const first = await createPost(token, { title: 'Ridge Hike', category: 'Hiking' });
    const second = await createPost(token, { title: 'Ridge Hike', category: 'Hiking' });
    const third = await createPost(token, { title: 'ridge hike', category: 'Astronomy' });

    expect(first.body.slug).toBe('ridge-hike');
    expect(second.body.slug).toBe('ridge-hike-2');
    expect(third.body.slug).toBe('ridge-hike-3');
  });

  // Otherwise a post titled "Admin" gets a URL that the admin list route answers instead.
  it('never gives a post the slug "admin"', async () => {
    const token = await adminToken();

    const response = await createPost(token, { title: 'Admin', category: 'Coding' });

    expect(response.status).toBe(201);
    expect(response.body.slug).toBe('admin-2');
  });

  // Otherwise a category typed with stray spaces shows up as its own filter.
  it('accepts any new category, trimmed', async () => {
    const token = await adminToken();

    const response = await createPost(token, { title: 'New album', category: '  Music  ' });

    expect(response.status).toBe(201);
    expect(response.body.category).toBe('Music');
  });

  // Otherwise "hiking" and "Hiking" become two separate filters on the blog page.
  it('reuses an existing category when the new one differs only in case', async () => {
    const token = await adminToken();
    await createPost(token, { title: 'First hike', category: 'Hiking' });

    const response = await createPost(token, { title: 'Second hike', category: 'hiking' });

    expect(response.body.category).toBe('Hiking');
    const { rows } = await pool.query('SELECT DISTINCT category FROM blog_posts');
    expect(rows).toEqual([{ category: 'Hiking' }]);
  });

  // Otherwise a post with no category is saved and can never be filtered to.
  it('returns 400 for a missing or blank category and creates nothing', async () => {
    const token = await adminToken();

    const missing = await createPost(token, { title: 'Mushroom walk' });
    const blank = await createPost(token, { title: 'Mushroom walk', category: '   ' });

    expect(missing.status).toBe(400);
    expect(blank.status).toBe(400);
    expect(blank.body.message).toBe('Category is required');
    expect(await blogRowCount()).toBe(0);
  });

  // Otherwise a post is saved with an empty slug and has no URL.
  it('returns 400 for a missing title and for a title with no letters or numbers', async () => {
    const token = await adminToken();

    const missing = await createPost(token, { category: 'Coding' });
    const punctuationOnly = await createPost(token, { title: '!!! ???', category: 'Coding' });

    expect(missing.status).toBe(400);
    expect(punctuationOnly.status).toBe(400);
    expect(punctuationOnly.body.message).toBe('Title must contain letters or numbers');
    expect(await blogRowCount()).toBe(0);
  });

  // Otherwise anyone on the internet can create posts.
  it('returns 401 without a token and creates nothing', async () => {
    const response = await request(app)
      .post('/api/v1/blog')
      .send({ title: 'Sneaky', category: 'Coding' });

    expect(response.status).toBe(401);
    expect(await blogRowCount()).toBe(0);
  });
});

describe('GET /api/v1/blog/admin', () => {
  // Otherwise unfinished drafts get buried under published posts in the dashboard.
  it('lists drafts first, then published posts newest first', async () => {
    const token = await adminToken();
    await pool.query(
      `INSERT INTO blog_posts (slug, title, category, published_at) VALUES
        ('older-trip', 'Older trip', 'Hiking', '2026-01-01T00:00:00Z'),
        ('newer-trip', 'Newer trip', 'Hiking', '2026-02-01T00:00:00Z'),
        ('unfinished', 'Unfinished', 'Coding', NULL)`,
    );

    const response = await request(app)
      .get('/api/v1/blog/admin')
      .set('authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.map((post) => [post.slug, post.publishedAt])).toEqual([
      ['unfinished', null],
      ['newer-trip', '2026-02-01T00:00:00.000Z'],
      ['older-trip', '2026-01-01T00:00:00.000Z'],
    ]);
  });

  // Otherwise drafts, which aren't public yet, can be read by anyone.
  it('returns 401 without a token', async () => {
    const response = await request(app).get('/api/v1/blog/admin');

    expect(response.status).toBe(401);
  });
});
