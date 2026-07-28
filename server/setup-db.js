import pool from './lib/utils/pool.js';
import setup from './data/setup.js';

setup(pool)
  .catch((error) => console.error(error))
  .finally(() => process.exit());
