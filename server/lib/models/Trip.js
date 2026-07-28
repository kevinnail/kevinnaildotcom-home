import pool from '../utils/pool.js';

export default class Trip {
  constructor(row) {
    this.id = row.id;
    this.name = row.name ?? '';
    this.region = row.region ?? '';
    this.url = row.url;
    this.uploadedAt = row.uploaded_at.toISOString();
  }

  static async getAll() {
    const { rows } = await pool.query('SELECT * FROM trips ORDER BY uploaded_at DESC');

    return rows.map((row) => new Trip(row));
  }
}
