import pool from '../utils/pool.js';
import { slugify, toStoredBlocks } from '../utils/blogBlocks.js';

// GET /api/v1/blog/admin is declared above GET /:slug, so a post slugged
// "admin" could never be read.
const RESERVED_SLUGS = ['admin'];

const uniqueSlug = async (title) => {
  const baseSlug = slugify(title);
  const { rows } = await pool.query(
    `SELECT slug FROM blog_posts
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

    return rows[0] ? new BlogPost(rows[0]) : null;
  }

  // The slug is left alone so links already shared keep working after a title edit.
  static async update(id, { title, category, summary, blocks }) {
    const storedCategory = await matchExistingCategory(category, id);

    const { rows } = await pool.query(
      `UPDATE blog_posts
       SET title = $2, category = $3, summary = $4, blocks = $5, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      // pg sends a JS array as a Postgres array, not JSON, so it is stringified.
      [id, title, storedCategory, summary, JSON.stringify(toStoredBlocks(blocks))],
    );

    return rows[0] ? new BlogPost(rows[0]) : null;
  }

  // Publishing again keeps the first publish date.
  static async publish(id) {
    const { rows } = await pool.query(
      `UPDATE blog_posts SET published_at = COALESCE(published_at, now())
       WHERE id = $1
       RETURNING *`,
      [id],
    );

    return rows[0] ? new BlogPost(rows[0]) : null;
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

    return rows[0] ? new BlogPost(rows[0]) : null;
  }
}
