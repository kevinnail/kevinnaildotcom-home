import pool from '../utils/pool.js';
import { hashPassword } from '../utils/password.js';

export default class AdminUser {
  constructor(row) {
    this.id = row.id;
    this.username = row.username;
    // Carried on the instance only so the login controller can verify a
    // submitted password against it. No route ever serializes an AdminUser —
    // login responds with `{ token }`.
    this.passwordHash = row.password_hash;
  }

  static async findByUsername(username) {
    const { rows } = await pool.query('SELECT * FROM users_admin WHERE username = $1', [username]);

    return rows[0] ? new AdminUser(rows[0]) : null;
  }

  static async insert({ username, password }) {
    const { rows } = await pool.query(
      'INSERT INTO users_admin (username, password_hash) VALUES ($1, $2) RETURNING *',
      [username, hashPassword(password)],
    );

    return new AdminUser(rows[0]);
  }
}
