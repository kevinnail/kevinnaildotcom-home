import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import pool from '../lib/utils/pool.js';
import setup from '../data/setup.js';
import app from '../lib/app.js';
import AdminUser from '../lib/models/AdminUser.js';
import { signAdminToken } from '../lib/utils/token.js';

// A save that drops a photo purges its S3 object, and no test may ever reach
// S3. Only the client's `send` is replaced, so a test can assert on exactly
// what was purged.
const { send } = vi.hoisted(() => ({ send: vi.fn(async () => ({})) }));

vi.mock('@aws-sdk/client-s3', async (importOriginal) => ({
  ...(await importOriginal()),
  S3Client: class {
    send = send;
  },
}));

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
  send.mockClear();
  vi.stubEnv('MEDIA_BASE_URL', 'https://media.example.com');
  vi.stubEnv('MEDIA_BUCKET', 'kevinnail-media-test');
  await setup(pool);
});

afterAll(async () => {
  vi.unstubAllEnvs();
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

describe('publishing and the public blog', () => {
  const unknownId = '00000000-0000-4000-8000-000000000000';

  async function createDraft(token, title = 'Ridge Hike') {
    const response = await createPost(token, { title, category: 'Hiking' });
    return response.body;
  }

  async function publish(token, id) {
    return request(app).patch(`/api/v1/blog/${id}/publish`).set('authorization', `Bearer ${token}`);
  }

  // Otherwise half-written drafts show up on the public blog.
  it('hides a draft from the public list and its slug until it is published', async () => {
    const token = await adminToken();
    const draft = await createDraft(token);

    const listBefore = await request(app).get('/api/v1/blog');
    const postBefore = await request(app).get('/api/v1/blog/ridge-hike');
    expect(listBefore.body).toEqual([]);
    expect(postBefore.status).toBe(404);

    const publishResponse = await publish(token, draft.id);
    expect(publishResponse.status).toBe(200);
    expect(publishResponse.body.publishedAt).toEqual(expect.any(String));

    const listAfter = await request(app).get('/api/v1/blog');
    const postAfter = await request(app).get('/api/v1/blog/ridge-hike');
    expect(listAfter.body).toEqual([
      {
        slug: 'ridge-hike',
        title: 'Ridge Hike',
        category: 'Hiking',
        summary: '',
        coverUrl: null,
        publishedAt: publishResponse.body.publishedAt,
      },
    ]);
    expect(postAfter.status).toBe(200);
    expect(postAfter.body).toMatchObject({ id: draft.id, title: 'Ridge Hike', blocks: [] });
  });

  // Otherwise the blog page lists old posts above new ones.
  it('lists published posts newest first', async () => {
    await pool.query(
      `INSERT INTO blog_posts (slug, title, category, published_at) VALUES
        ('older-trip', 'Older trip', 'Hiking', '2026-01-01T00:00:00Z'),
        ('newer-trip', 'Newer trip', 'Hiking', '2026-02-01T00:00:00Z')`,
    );

    const response = await request(app).get('/api/v1/blog');

    expect(response.status).toBe(200);
    expect(response.body.map((post) => post.slug)).toEqual(['newer-trip', 'older-trip']);
  });

  // Otherwise publishing a post a second time moves it to the top of the blog as if it were new.
  it('keeps the original publish date when a post is published again', async () => {
    const token = await adminToken();
    const draft = await createDraft(token);
    await pool.query("UPDATE blog_posts SET published_at = '2026-01-01T00:00:00Z' WHERE id = $1", [
      draft.id,
    ]);

    const response = await publish(token, draft.id);

    expect(response.status).toBe(200);
    expect(response.body.publishedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  // Otherwise publishing a deleted post or a mistyped id shows a server error instead of not found.
  it('returns 404 when publishing an unknown or malformed id', async () => {
    const token = await adminToken();

    const unknown = await publish(token, unknownId);
    const malformed = await publish(token, 'not-a-uuid');

    expect(unknown.status).toBe(404);
    expect(malformed.status).toBe(404);
  });

  // Otherwise anyone can put a draft live.
  it('returns 401 without a token and the post stays a draft', async () => {
    const token = await adminToken();
    const draft = await createDraft(token);

    const response = await request(app).patch(`/api/v1/blog/${draft.id}/publish`);

    expect(response.status).toBe(401);
    const { rows } = await pool.query('SELECT published_at FROM blog_posts WHERE id = $1', [
      draft.id,
    ]);
    expect(rows[0].published_at).toBeNull();
  });
});

describe('blog images', () => {
  const unknownId = '00000000-0000-4000-8000-000000000000';
  const fields = { title: 'Ridge Hike', category: 'Hiking', summary: 'Two days up the ridge.' };

  async function createDraft(token, title = 'Ridge Hike') {
    const response = await createPost(token, { title, category: 'Hiking' });
    return response.body;
  }

  async function addImages(token, postId, objectKeys) {
    return request(app)
      .post(`/api/v1/blog/${postId}/images`)
      .set('authorization', `Bearer ${token}`)
      .send({ objectKeys });
  }

  async function savePost(token, id, blocks) {
    return request(app)
      .put(`/api/v1/blog/${id}`)
      .set('authorization', `Bearer ${token}`)
      .send({ ...fields, blocks });
  }

  async function imageRowsFor(postId) {
    const { rows } = await pool.query(
      'SELECT id, url FROM blog_images WHERE post_id = $1 ORDER BY url',
      [postId],
    );
    return rows;
  }

  async function storedBlocks(postId) {
    const { rows } = await pool.query('SELECT blocks FROM blog_posts WHERE id = $1', [postId]);
    return rows[0].blocks;
  }

  // Otherwise an uploaded photo has no row to reference, or its URL points somewhere S3 never stored it.
  it('records a row per object key with its public URL under the blog prefix', async () => {
    const token = await adminToken();
    const draft = await createDraft(token);

    const response = await addImages(token, draft.id, ['blog/ridge.webp', 'blog/camp.webp']);

    expect(response.status).toBe(201);
    expect(response.body).toEqual([
      { id: expect.any(String), url: 'https://media.example.com/blog/ridge.webp' },
      { id: expect.any(String), url: 'https://media.example.com/blog/camp.webp' },
    ]);
    const rows = await imageRowsFor(draft.id);
    expect(rows.map((row) => row.id).sort()).toEqual(
      response.body.map((image) => image.id).sort(),
    );
  });

  // Otherwise a request with nothing to record is accepted as if photos were added.
  it('returns 400 for an empty or missing list and records nothing', async () => {
    const token = await adminToken();
    const draft = await createDraft(token);

    const empty = await addImages(token, draft.id, []);
    const missing = await addImages(token, draft.id, undefined);

    expect(empty.status).toBe(400);
    expect(empty.body.message).toBe('objectKeys must be a non-empty list of object keys');
    expect(missing.status).toBe(400);
    expect(await imageRowsFor(draft.id)).toEqual([]);
  });

  // Otherwise adding photos to a deleted post or a mistyped id shows a server error instead of not found.
  it('returns 404 for an unknown or malformed post id', async () => {
    const token = await adminToken();

    const unknown = await addImages(token, unknownId, ['blog/ridge.webp']);
    const malformed = await addImages(token, 'not-a-uuid', ['blog/ridge.webp']);

    expect(unknown.status).toBe(404);
    expect(unknown.body.message).toBe('Blog post not found');
    expect(malformed.status).toBe(404);
  });

  // Otherwise saving a deleted post with photos in it says the photos are wrong instead of not found.
  it('returns 404 for an unknown post even when the blocks reference images', async () => {
    const token = await adminToken();

    const response = await savePost(token, unknownId, [
      { id: 'block-a', type: 'images', images: [{ imageId: unknownId, caption: '' }] },
    ]);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Blog post not found');
  });

  // Otherwise one post can show another post's photo, and either post's save deletes it from the other.
  it('returns 400 for a save that uses an image uploaded to a different post', async () => {
    const token = await adminToken();
    const draft = await createDraft(token);
    const otherDraft = await createDraft(token, 'Other Hike');
    const [otherImage] = (await addImages(token, otherDraft.id, ['blog/other.webp'])).body;

    const response = await savePost(token, draft.id, [
      { id: 'block-a', type: 'images', images: [{ imageId: otherImage.id, caption: '' }] },
    ]);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Block 1 image 1 is not an image uploaded to this post');
    expect(await storedBlocks(draft.id)).toEqual([]);
  });

  // Otherwise a photo removed in the editor stays in S3 forever, or a kept one is deleted.
  it('deletes the row and S3 object of an image a save drops, and keeps the rest', async () => {
    const token = await adminToken();
    const draft = await createDraft(token);
    const [keptImage] = (
      await addImages(token, draft.id, ['blog/kept.webp', 'blog/dropped.webp'])
    ).body;

    const response = await savePost(token, draft.id, [
      {
        id: 'block-a',
        type: 'images',
        images: [{ imageId: keptImage.id, caption: 'Kept', url: keptImage.url }],
      },
    ]);

    expect(response.status).toBe(200);
    expect(await imageRowsFor(draft.id)).toEqual([keptImage]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.lastCall[0].input.Delete.Objects).toEqual([{ Key: 'blog/dropped.webp' }]);
    expect(await storedBlocks(draft.id)).toEqual([
      { id: 'block-a', type: 'images', images: [{ imageId: keptImage.id, caption: 'Kept' }] },
    ]);
  });

  // Otherwise readers see broken photos, or photos in a different order than the post was written.
  it('returns each image url in block order on the public post', async () => {
    const token = await adminToken();
    const draft = await createDraft(token);
    const [firstImage, secondImage, thirdImage] = (
      await addImages(token, draft.id, ['blog/one.webp', 'blog/two.webp', 'blog/three.webp'])
    ).body;
    await savePost(token, draft.id, [
      { id: 'block-a', type: 'text', body: 'Trailhead.' },
      {
        id: 'block-b',
        type: 'images',
        images: [
          { imageId: thirdImage.id, caption: 'Summit' },
          { imageId: firstImage.id, caption: '' },
        ],
      },
      { id: 'block-c', type: 'images', images: [{ imageId: secondImage.id, caption: 'Camp' }] },
    ]);
    await request(app)
      .patch(`/api/v1/blog/${draft.id}/publish`)
      .set('authorization', `Bearer ${token}`);

    const response = await request(app).get('/api/v1/blog/ridge-hike');

    expect(response.status).toBe(200);
    expect(response.body.blocks).toEqual([
      { id: 'block-a', type: 'text', body: 'Trailhead.' },
      {
        id: 'block-b',
        type: 'images',
        images: [
          { imageId: thirdImage.id, caption: 'Summit', url: thirdImage.url },
          { imageId: firstImage.id, caption: '', url: firstImage.url },
        ],
      },
      {
        id: 'block-c',
        type: 'images',
        images: [{ imageId: secondImage.id, caption: 'Camp', url: secondImage.url }],
      },
    ]);
  });
});

describe('DELETE /api/v1/blog/:id', () => {
  const unknownId = '00000000-0000-4000-8000-000000000000';

  async function deletePost(token, id) {
    return request(app).delete(`/api/v1/blog/${id}`).set('authorization', `Bearer ${token}`);
  }

  async function imageRowCount() {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM blog_images');
    return rows[0].count;
  }

  // Otherwise a deleted post leaves its photo rows behind and its photos in S3 forever.
  it('deletes the post and its image rows and purges their S3 objects', async () => {
    const token = await adminToken();
    const draft = (await createPost(token, { title: 'Ridge Hike', category: 'Hiking' })).body;
    const keptDraft = (await createPost(token, { title: 'Other Hike', category: 'Hiking' })).body;
    for (const [postId, objectKeys] of [
      [draft.id, ['blog/one.webp', 'blog/two.webp']],
      [keptDraft.id, ['blog/other.webp']],
    ]) {
      await request(app)
        .post(`/api/v1/blog/${postId}/images`)
        .set('authorization', `Bearer ${token}`)
        .send({ objectKeys });
    }

    const response = await deletePost(token, draft.id);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(draft.id);
    expect(await blogRowCount()).toBe(1);
    expect(await imageRowCount()).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(
      send.mock.lastCall[0].input.Delete.Objects.map((object) => object.Key).sort(),
    ).toEqual(['blog/one.webp', 'blog/two.webp']);
  });

  // Otherwise a link shared to a deleted post opens the next post with the same title.
  it('keeps a deleted post slug taken for later posts', async () => {
    const token = await adminToken();
    const draft = (await createPost(token, { title: 'Ridge Hike', category: 'Hiking' })).body;

    await deletePost(token, draft.id);
    const replacement = await createPost(token, { title: 'Ridge Hike', category: 'Hiking' });

    expect(replacement.status).toBe(201);
    expect(replacement.body.slug).toBe('ridge-hike-2');
  });

  // Otherwise deleting an already-deleted post or a mistyped id shows a server error instead of not found.
  it('returns 404 for an unknown or malformed id and purges nothing', async () => {
    const token = await adminToken();

    const unknown = await deletePost(token, unknownId);
    const malformed = await deletePost(token, 'not-a-uuid');

    expect(unknown.status).toBe(404);
    expect(unknown.body.message).toBe('Blog post not found');
    expect(malformed.status).toBe(404);
    expect(send).not.toHaveBeenCalled();
  });

  // Otherwise anyone can delete posts.
  it('returns 401 without a token and keeps the post', async () => {
    const token = await adminToken();
    const draft = (await createPost(token, { title: 'Ridge Hike', category: 'Hiking' })).body;

    const response = await request(app).delete(`/api/v1/blog/${draft.id}`);

    expect(response.status).toBe(401);
    expect(await blogRowCount()).toBe(1);
    expect(send).not.toHaveBeenCalled();
  });
});

describe('blog cover picture', () => {
  const unknownId = '00000000-0000-4000-8000-000000000000';

  async function createDraft(token) {
    const response = await createPost(token, { title: 'Ridge Hike', category: 'Hiking' });
    return response.body;
  }

  async function setCover(token, id, objectKey) {
    return request(app)
      .put(`/api/v1/blog/${id}/cover`)
      .set('authorization', `Bearer ${token}`)
      .send({ objectKey });
  }

  async function removeCover(token, id) {
    return request(app).delete(`/api/v1/blog/${id}/cover`).set('authorization', `Bearer ${token}`);
  }

  async function storedCoverUrl(id) {
    const { rows } = await pool.query('SELECT cover_url FROM blog_posts WHERE id = $1', [id]);
    return rows[0].cover_url;
  }

  function purgedKeys() {
    return send.mock.lastCall[0].input.Delete.Objects.map((object) => object.Key);
  }

  // Otherwise the blog list card has no picture, or one pointing somewhere S3 never stored it.
  it('stores the cover URL and the editor reads it back', async () => {
    const token = await adminToken();
    const draft = await createDraft(token);

    const response = await setCover(token, draft.id, 'blog/cover.webp');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ coverUrl: 'https://media.example.com/blog/cover.webp' });
    expect(await storedCoverUrl(draft.id)).toBe('https://media.example.com/blog/cover.webp');
    expect(send).not.toHaveBeenCalled();
    const getResponse = await request(app)
      .get(`/api/v1/blog/admin/${draft.id}`)
      .set('authorization', `Bearer ${token}`);
    expect(getResponse.body.coverUrl).toBe('https://media.example.com/blog/cover.webp');
  });

  // Otherwise every replaced cover stays in S3 forever.
  it('replaces the cover and purges the previous one from S3', async () => {
    const token = await adminToken();
    const draft = await createDraft(token);
    await setCover(token, draft.id, 'blog/first.webp');

    const response = await setCover(token, draft.id, 'blog/second.webp');

    expect(response.status).toBe(200);
    expect(await storedCoverUrl(draft.id)).toBe('https://media.example.com/blog/second.webp');
    expect(send).toHaveBeenCalledTimes(1);
    expect(purgedKeys()).toEqual(['blog/first.webp']);
  });

  // Otherwise a removed cover still shows on the blog list, or stays in S3 forever.
  it('removes the cover and purges it from S3', async () => {
    const token = await adminToken();
    const draft = await createDraft(token);
    await setCover(token, draft.id, 'blog/cover.webp');

    const response = await removeCover(token, draft.id);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ coverUrl: null });
    expect(await storedCoverUrl(draft.id)).toBeNull();
    expect(purgedKeys()).toEqual(['blog/cover.webp']);
  });

  // Otherwise a cover request with no key stores a URL that points at nothing.
  it('returns 400 for a missing object key and leaves the cover alone', async () => {
    const token = await adminToken();
    const draft = await createDraft(token);

    const response = await setCover(token, draft.id, undefined);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('objectKey is required');
    expect(await storedCoverUrl(draft.id)).toBeNull();
  });

  // Otherwise setting or removing the cover of a deleted post shows a server error instead of not found.
  it('returns 404 for an unknown or malformed post id', async () => {
    const token = await adminToken();

    const unknownSet = await setCover(token, unknownId, 'blog/cover.webp');
    const unknownRemove = await removeCover(token, unknownId);
    const malformedSet = await setCover(token, 'not-a-uuid', 'blog/cover.webp');

    expect(unknownSet.status).toBe(404);
    expect(unknownSet.body.message).toBe('Blog post not found');
    expect(unknownRemove.status).toBe(404);
    expect(malformedSet.status).toBe(404);
    expect(send).not.toHaveBeenCalled();
  });

  // Otherwise anyone can change or remove a post's cover.
  it('returns 401 without a token and leaves the cover alone', async () => {
    const token = await adminToken();
    const draft = await createDraft(token);
    await setCover(token, draft.id, 'blog/cover.webp');

    const setResponse = await request(app)
      .put(`/api/v1/blog/${draft.id}/cover`)
      .send({ objectKey: 'blog/other.webp' });
    const removeResponse = await request(app).delete(`/api/v1/blog/${draft.id}/cover`);

    expect(setResponse.status).toBe(401);
    expect(removeResponse.status).toBe(401);
    expect(await storedCoverUrl(draft.id)).toBe('https://media.example.com/blog/cover.webp');
    expect(send).not.toHaveBeenCalled();
  });

  // Otherwise saving the post's text wipes out its cover.
  it('keeps the cover when the post is saved', async () => {
    const token = await adminToken();
    const draft = await createDraft(token);
    await setCover(token, draft.id, 'blog/cover.webp');

    const response = await request(app)
      .put(`/api/v1/blog/${draft.id}`)
      .set('authorization', `Bearer ${token}`)
      .send({ title: 'Ridge Hike', category: 'Hiking', summary: 'Two days.', blocks: [] });

    expect(response.status).toBe(200);
    expect(response.body.coverUrl).toBe('https://media.example.com/blog/cover.webp');
    expect(send).not.toHaveBeenCalled();
  });

  // Otherwise a deleted post's cover stays in S3 forever.
  it('purges the cover from S3 when the post is deleted', async () => {
    const token = await adminToken();
    const draft = await createDraft(token);
    await setCover(token, draft.id, 'blog/cover.webp');

    const response = await request(app)
      .delete(`/api/v1/blog/${draft.id}`)
      .set('authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(purgedKeys()).toEqual(['blog/cover.webp']);
  });

  // Otherwise the blog list cards have no summary or picture to show.
  it('returns each published post summary and cover on the public list', async () => {
    const token = await adminToken();
    const draft = await createDraft(token);
    await setCover(token, draft.id, 'blog/cover.webp');
    await request(app)
      .put(`/api/v1/blog/${draft.id}`)
      .set('authorization', `Bearer ${token}`)
      .send({ title: 'Ridge Hike', category: 'Hiking', summary: 'Two days.', blocks: [] });
    await request(app)
      .patch(`/api/v1/blog/${draft.id}/publish`)
      .set('authorization', `Bearer ${token}`);

    const response = await request(app).get('/api/v1/blog');

    expect(response.body).toEqual([
      expect.objectContaining({
        summary: 'Two days.',
        coverUrl: 'https://media.example.com/blog/cover.webp',
      }),
    ]);
  });
});
