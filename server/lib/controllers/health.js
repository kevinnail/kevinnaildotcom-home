import { Router } from 'express';
import pool from '../utils/pool.js';

export default Router().get('/', async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    next(error);
  }
});
