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

describe('PUT /api/v1/blog/:id and GET /api/v1/blog/admin/:id', () => {
  const textBlocks = [
    { id: 'block-a', type: 'text', body: 'Trailhead at dawn.' },
    { id: 'block-b', type: 'text', body: 'The **ridge** above camp.' },
    { id: 'block-c', type: 'text', body: '' },
  ];
  const unknownId = '00000000-0000-4000-8000-000000000000';

  async function createDraft(token, fields = { title: 'Ridge Hike', category: 'Hiking' }) {
    const response = await createPost(token, fields);
    return response.body;
  }

  async function savePost(token, id, fields) {
    return request(app)
      .put(`/api/v1/blog/${id}`)
      .set('authorization', `Bearer ${token}`)
      .send(fields);
  }

  async function storedRow(id) {
    const { rows } = await pool.query('SELECT * FROM blog_posts WHERE id = $1', [id]);
    return rows[0];
  }

  // Otherwise the editor reopens a post with its text blocks lost or shuffled.
  it('saves title, category, summary and blocks, and GET returns blocks in the same order', async () => {
    const token = await adminToken();
    const draft = await createDraft(token);
    const reordered = [textBlocks[2], textBlocks[0], textBlocks[1]];
    await pool.query("UPDATE blog_posts SET updated_at = '2026-01-01' WHERE id = $1", [draft.id]);

    const saveResponse = await savePost(token, draft.id, {
      title: 'Ridge Hike, Day Two',
      category: 'Backpacking',
      summary: '  Two days up the ridge.  ',
      blocks: reordered,
    });

    expect(saveResponse.status).toBe(200);
    expect(saveResponse.body.title).toBe('Ridge Hike, Day Two');
    expect(saveResponse.body.category).toBe('Backpacking');
    expect(saveResponse.body.summary).toBe('Two days up the ridge.');

    const getResponse = await request(app)
      .get(`/api/v1/blog/admin/${draft.id}`)
      .set('authorization', `Bearer ${token}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.blocks).toEqual(reordered);
    expect(getResponse.body.slug).toBe('ridge-hike');
    expect((await storedRow(draft.id)).updated_at.getTime()).toBeGreaterThan(
      new Date('2026-01-01').getTime(),
    );
  });

  // Otherwise fields the client tacks onto a block end up stored in the post.
  it('stores only the id, type and body of each block', async () => {
    const token = await adminToken();
    const draft = await createDraft(token);

    await savePost(token, draft.id, {
      title: 'Ridge Hike',
      category: 'Hiking',
      summary: 'Two days up the ridge.',
      blocks: [{ id: 'block-a', type: 'text', body: 'Trailhead.', isEditing: true }],
    });

    expect((await storedRow(draft.id)).blocks).toEqual([
      { id: 'block-a', type: 'text', body: 'Trailhead.' },
    ]);
  });

  // Otherwise editing a post's category to "hiking" splits it from the other "Hiking" posts, or a post can't fix its own capitalization.
  it('reuses another post category case-insensitively but lets a post fix its own case', async () => {
    const token = await adminToken();
    await createDraft(token, { title: 'Mushroom walk', category: 'Foraging' });
    const draft = await createDraft(token);

    const joined = await savePost(token, draft.id, {
      title: 'Ridge Hike',
      category: 'foraging',
      summary: 'Two days up the ridge.',
      blocks: [],
    });
    expect(joined.body.category).toBe('Foraging');

    const solo = await createDraft(token, { title: 'Telescope', category: 'astro' });
    const recased = await savePost(token, solo.id, {
      title: 'Telescope',
      category: 'Astro',
      summary: 'First light.',
      blocks: [],
    });
    expect(recased.body.category).toBe('Astro');
  });

  // Otherwise a malformed block from the editor overwrites a good post.
  it('returns 400 for a block missing its type and leaves the row unchanged', async () => {
    const token = await adminToken();
    const draft = await createDraft(token);
    await savePost(token, draft.id, {
      title: 'Ridge Hike',
      category: 'Hiking',
      summary: 'Two days up the ridge.',
      blocks: textBlocks,
    });

    const response = await savePost(token, draft.id, {
      title: 'Should not save',
      category: 'Hiking',
      summary: 'Two days up the ridge.',
      blocks: [{ id: 'block-x', body: 'No type' }],
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Block 1 has an unknown type');
    const row = await storedRow(draft.id);
    expect(row.title).toBe('Ridge Hike');
    expect(row.blocks).toEqual(textBlocks);
  });

  // Otherwise a text block with a number or null body is stored and breaks the post page.
  it('returns 400 for a text block whose body is not a string', async () => {
    const token = await adminToken();
    const draft = await createDraft(token);

    const response = await savePost(token, draft.id, {
      title: 'Ridge Hike',
      category: 'Hiking',
      summary: 'Two days up the ridge.',
      blocks: [{ id: 'block-x', type: 'text', body: 42 }],
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Block 1 text must be a string');
    expect((await storedRow(draft.id)).blocks).toEqual([]);
  });

  // Otherwise a save can blank out a post's title, category or summary.
  it('returns 400 for a blank title, category or summary and leaves the row unchanged', async () => {
    const token = await adminToken();
    const draft = await createDraft(token);
    const validFields = {
      title: 'Ridge Hike',
      category: 'Hiking',
      summary: 'Two days up the ridge.',
      blocks: [],
    };

    const blankTitle = await savePost(token, draft.id, { ...validFields, title: '  ' });
    const blankCategory = await savePost(token, draft.id, { ...validFields, category: '' });
    const blankSummary = await savePost(token, draft.id, { ...validFields, summary: '   ' });

    expect(blankTitle.status).toBe(400);
    expect(blankTitle.body.message).toBe('Title is required');
    expect(blankCategory.status).toBe(400);
    expect(blankCategory.body.message).toBe('Category is required');
    expect(blankSummary.status).toBe(400);
    expect(blankSummary.body.message).toBe('Summary is required');
    const row = await storedRow(draft.id);
    expect(row.title).toBe('Ridge Hike');
    expect(row.category).toBe('Hiking');
    expect(row.summary).toBe('');
  });

  // Otherwise opening a deleted post or a mistyped editor URL shows a server error instead of not found.
  it('returns 404 for an unknown or malformed id on GET and PUT', async () => {
    const token = await adminToken();
    const fields = { title: 'Ghost', category: 'General', summary: 'Nothing here.', blocks: [] };

    const unknownGet = await request(app)
      .get(`/api/v1/blog/admin/${unknownId}`)
      .set('authorization', `Bearer ${token}`);
    const unknownPut = await savePost(token, unknownId, fields);
    const malformedGet = await request(app)
      .get('/api/v1/blog/admin/not-a-uuid')
      .set('authorization', `Bearer ${token}`);
    const malformedPut = await savePost(token, 'not-a-uuid', fields);

    expect(unknownGet.status).toBe(404);
    expect(unknownPut.status).toBe(404);
    expect(unknownPut.body.message).toBe('Blog post not found');
    expect(malformedGet.status).toBe(404);
    expect(malformedPut.status).toBe(404);
  });

  // Otherwise anyone can read drafts or rewrite posts.
  it('returns 401 without a token and leaves the row unchanged', async () => {
    const token = await adminToken();
    const draft = await createDraft(token);

    const getResponse = await request(app).get(`/api/v1/blog/admin/${draft.id}`);
    const putResponse = await request(app)
      .put(`/api/v1/blog/${draft.id}`)
      .send({ title: 'Hijacked', category: 'General', blocks: [] });

    expect(getResponse.status).toBe(401);
    expect(putResponse.status).toBe(401);
    expect((await storedRow(draft.id)).title).toBe('Ridge Hike');
  });
});
