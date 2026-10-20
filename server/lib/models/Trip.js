import pool from '../utils/pool.js';

function statsFromRow(row) {
  if (row.distance_miles == null) return null;
  return {
    distanceMiles: row.distance_miles,
    elevationMinFeet: row.elevation_min_feet,
    elevationMaxFeet: row.elevation_max_feet,
    elevationGainFeet: row.elevation_gain_feet,
    elevationLossFeet: row.elevation_loss_feet,
    elevationProfiles: row.elevation_profiles,
  };
}

function statsParameters(stats) {
  return [
    stats?.distanceMiles ?? null,
    stats?.elevationMinFeet ?? null,
    stats?.elevationMaxFeet ?? null,
    stats?.elevationGainFeet ?? null,
    stats?.elevationLossFeet ?? null,
    stats ? JSON.stringify(stats.elevationProfiles) : null,
  ];
}

export default class Trip {
  constructor(row) {
    this.id = row.id;
    this.name = row.name ?? '';
    this.region = row.region ?? '';
    this.url = row.url;
    this.uploadedAt = row.uploaded_at.toISOString();
    this.stats = statsFromRow(row);
  }

  static async insert({ name, region, url, stats }) {
    const { rows } = await pool.query(
      `INSERT INTO trips (
         name, region, url,
         distance_miles, elevation_min_feet, elevation_max_feet,
         elevation_gain_feet, elevation_loss_feet, elevation_profiles
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [name, region ?? '', url, ...statsParameters(stats)],
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

  static async updateStats(id, stats) {
    const { rows } = await pool.query(
      `UPDATE trips SET
         distance_miles = $2, elevation_min_feet = $3, elevation_max_feet = $4,
         elevation_gain_feet = $5, elevation_loss_feet = $6, elevation_profiles = $7
       WHERE id = $1
       RETURNING *`,
      [id, ...statsParameters(stats)],
    );

    return rows[0] ? new Trip(rows[0]) : null;
  }

  static async deleteById(id) {
    const { rows } = await pool.query('DELETE FROM trips WHERE id = $1 RETURNING *', [id]);

    return rows[0] ? new Trip(rows[0]) : null;
  }
}
