import pool from '../utils/pool.js';
import { slugify, toStoredBlocks } from '../utils/blogBlocks.js';

// GET /api/v1/blog/admin is declared above GET /:slug, so a post slugged
// "admin" could never be read.
const RESERVED_SLUGS = ['admin'];

// A deleted post's slug stays taken, so a link already shared never opens a different post.
const uniqueSlug = async (title) => {
  const baseSlug = slugify(title);
  const { rows } = await pool.query(
    `SELECT slug FROM (
       SELECT slug FROM blog_posts
       UNION ALL
       SELECT slug FROM blog_retired_slugs
     ) AS used_slugs
     WHERE slug = $1 OR slug ~ ('^' || $1 || '-[0-9]+$')`,
    [baseSlug],
  );
  const takenSlugs = new Set([...RESERVED_SLUGS, ...rows.map((row) => row.slug)]);

  let slug = baseSlug;
  let suffix = 2;
  while (takenSlugs.has(slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
  return slug;
};

// A category that differs from an existing one only in case reuses the existing
// spelling, so readers never get two filters for one category. The post being
// saved is left out, so it can fix the case of a category only it uses.
const matchExistingCategory = async (category, excludedPostId = null) => {
  const { rows } = await pool.query(
    `SELECT category FROM blog_posts
     WHERE LOWER(category) = LOWER($1) AND id IS DISTINCT FROM $2
     LIMIT 1`,
    [category, excludedPostId],
  );
  return rows[0]?.category ?? category;
};

// Images blocks store only each image's id; reads add its url beside it.
const withImageUrls = async (post) => {
  const { rows } = await pool.query('SELECT id, url FROM blog_images WHERE post_id = $1', [
    post.id,
  ]);
  const urlsById = new Map(rows.map((row) => [row.id, row.url]));

  post.blocks = post.blocks.map((block) => {
    if (block.type !== 'images') return block;
    const images = block.images.map((image) => ({ ...image, url: urlsById.get(image.imageId) }));
    return { ...block, images };
  });
  return post;
};

export default class BlogPost {
  constructor(row) {
    this.id = row.id;
    this.slug = row.slug;
    this.title = row.title;
    this.category = row.category;
    this.summary = row.summary;
    this.coverUrl = row.cover_url;
    this.blocks = row.blocks;
    this.publishedAt = row.published_at?.toISOString() ?? null;
    this.createdAt = row.created_at.toISOString();
    this.updatedAt = row.updated_at.toISOString();
  }

  static async insert({ title, category }) {
    const slug = await uniqueSlug(title);
    const storedCategory = await matchExistingCategory(category);

    const { rows } = await pool.query(
      `INSERT INTO blog_posts (slug, title, category)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [slug, title, storedCategory],
    );

    return new BlogPost(rows[0]);
  }

  // Drafts first, then newest published.
  static async getAllForAdmin() {
    const { rows } = await pool.query(
      `SELECT * FROM blog_posts
       ORDER BY published_at DESC NULLS FIRST, created_at DESC`,
    );

    return rows.map((row) => new BlogPost(row));
  }

  static async getById(id) {
    const { rows } = await pool.query('SELECT * FROM blog_posts WHERE id = $1', [id]);

    return rows[0] ? withImageUrls(new BlogPost(rows[0])) : null;
  }

  static async getImageIds(postId) {
    const { rows } = await pool.query('SELECT id FROM blog_images WHERE post_id = $1', [postId]);

    return new Set(rows.map((row) => row.id));
  }

  // The bytes are already in S3; this records one row per uploaded photo.
  static async insertImages(postId, urls) {
    const { rows } = await pool.query(
      `INSERT INTO blog_images (post_id, url)
       SELECT $1, url FROM unnest($2::text[]) AS uploaded(url)
       RETURNING id, url`,
      [postId, urls],
    );

    return rows;
  }

  // The slug is left alone so links already shared keep working after a title edit.
  // Images the new blocks no longer use are deleted in the same transaction, and
  // their URLs are returned so the caller can purge them from S3 after commit.
  static async update(id, { title, category, summary, blocks }) {
    const storedCategory = await matchExistingCategory(category, id);
    const storedBlocks = toStoredBlocks(blocks);
    const keptImageIds = storedBlocks
      .filter((block) => block.type === 'images')
      .flatMap((block) => block.images.map((image) => image.imageId));

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `UPDATE blog_posts
         SET title = $2, category = $3, summary = $4, blocks = $5, updated_at = now()
         WHERE id = $1
         RETURNING *`,
        // pg sends a JS array as a Postgres array, not JSON, so it is stringified.
        [id, title, storedCategory, summary, JSON.stringify(storedBlocks)],
      );
      const { rows: removedRows } = await client.query(
        `DELETE FROM blog_images
         WHERE post_id = $1 AND NOT (id = ANY($2::uuid[]))
         RETURNING url`,
        [id, keptImageIds],
      );

      await client.query('COMMIT');
      if (!rows[0]) return null;

      return {
        post: await withImageUrls(new BlogPost(rows[0])),
        removedUrls: removedRows.map((row) => row.url),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Sets the cover, or clears it with a null `coverUrl`. Returns the replaced
  // URL (null when there was no cover) for the caller to purge from S3, or null
  // when the post doesn't exist.
  static async setCover(id, coverUrl) {
    const { rows } = await pool.query(
      `WITH previous AS (SELECT cover_url FROM blog_posts WHERE id = $1)
       UPDATE blog_posts SET cover_url = $2
       WHERE id = $1
       RETURNING (SELECT cover_url FROM previous) AS previous_url`,
      [id, coverUrl],
    );

    return rows[0] ? { previousUrl: rows[0].previous_url } : null;
  }

  // The image rows are deleted first so their URLs come back for the caller to
  // purge from S3 after commit, along with the cover's.
  static async deleteById(id) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { rows: imageRows } = await client.query(
        'DELETE FROM blog_images WHERE post_id = $1 RETURNING url',
        [id],
      );
      const { rows } = await client.query(
        `WITH deleted AS (DELETE FROM blog_posts WHERE id = $1 RETURNING *),
         retired AS (INSERT INTO blog_retired_slugs (slug) SELECT slug FROM deleted)
         SELECT * FROM deleted`,
        [id],
      );

      await client.query('COMMIT');
      if (!rows[0]) return null;

      return {
        post: new BlogPost(rows[0]),
        removedUrls: [...imageRows.map((row) => row.url), rows[0].cover_url],
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Publishing again keeps the first publish date.
  static async publish(id) {
    const { rows } = await pool.query(
      `UPDATE blog_posts SET published_at = COALESCE(published_at, now())
       WHERE id = $1
       RETURNING *`,
      [id],
    );

    return rows[0] ? withImageUrls(new BlogPost(rows[0])) : null;
  }

  // The list page needs no blocks, so they are left out of every visitor's download.
  static async getPublishedList() {
    const { rows } = await pool.query(
      `SELECT slug, title, category, summary, cover_url, published_at
       FROM blog_posts
       WHERE published_at IS NOT NULL
       ORDER BY published_at DESC`,
    );

    return rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      category: row.category,
      summary: row.summary,
      coverUrl: row.cover_url,
      publishedAt: row.published_at.toISOString(),
    }));
  }

  static async getPublishedBySlug(slug) {
    const { rows } = await pool.query(
      'SELECT * FROM blog_posts WHERE slug = $1 AND published_at IS NOT NULL',
      [slug],
    );

    return rows[0] ? withImageUrls(new BlogPost(rows[0])) : null;
  }
}
