// Creates an admin login. Hashing can't live in sql/setup.sql, and the schema is
// dropped and recreated on every `npm run setup-db`, so this is re-run after a
// rebuild (and once against production during cutover).
//
//   npm run create-admin -- <username> <password>

import pool from '../lib/utils/pool.js';
import AdminUser from '../lib/models/AdminUser.js';

const [username, password] = process.argv.slice(2);

if (!username || !password) {
  console.error('Usage: npm run create-admin -- <username> <password>');
  process.exit(1);
}

try {
  const user = await AdminUser.insert({ username, password });
  console.info(`✅ Created admin "${user.username}" (id ${user.id})`);
} catch (error) {
  // 23505 = unique_violation on users_admin.username
  if (error.code === '23505') {
    console.error(`❌ An admin named "${username}" already exists.`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
} finally {
  await pool.end();
}
