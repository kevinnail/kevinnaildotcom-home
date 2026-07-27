import app from './lib/app.js';
import pool from './lib/utils/pool.js';

const API_URL = process.env.API_URL || 'http://localhost';
const PORT = process.env.PORT || 7891;

app.listen(PORT, () => {
  console.info(`✅  Server started on ${API_URL}:${PORT}`);
});

process.on('exit', () => {
  console.info('👋  Goodbye!');
  pool.end();
});
