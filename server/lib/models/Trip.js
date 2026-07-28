import pool from '../utils/pool.js';

export default class Trip {
  constructor(row) {
    this.id = row.id;
    this.name = row.name ?? '';
    this.region = row.region ?? '';
    this.url = row.url;
    this.uploadedAt = row.uploaded_at.toISOString();
  }

  static async insert({ name, region, url }) {
    const { rows } = await pool.query(
      'INSERT INTO trips (name, region, url) VALUES ($1, $2, $3) RETURNING *',
      [name, region ?? '', url],
    );

    return new Trip(rows[0]);
  }

  static async getAll() {
    const { rows } = await pool.query('SELECT * FROM trips ORDER BY uploaded_at DESC');

    return rows.map((row) => new Trip(row));
  }

  static async getById(id) {
    const { rows } = await pool.query('SELECT * FROM trips WHERE id = $1', [id]);

    return rows[0] ? new Trip(rows[0]) : null;
  }

  // The trip's photos go with it: photos.trip_id is ON DELETE CASCADE, so this
  // one statement takes the rows too. Their S3 objects are purged by the
  // controller beforehand, while it can still read their URLs.
  static async deleteById(id) {
    const { rows } = await pool.query('DELETE FROM trips WHERE id = $1 RETURNING *', [id]);

    return rows[0] ? new Trip(rows[0]) : null;
  }
}
