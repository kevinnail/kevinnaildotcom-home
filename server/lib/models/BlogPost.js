import pool from '../utils/pool.js';
import { slugify } from '../utils/blogBlocks.js';

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
// spelling, so readers never get two filters for one category.
const matchExistingCategory = async (category) => {
  const { rows } = await pool.query(
    'SELECT category FROM blog_posts WHERE LOWER(category) = LOWER($1) LIMIT 1',
    [category],
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
}
