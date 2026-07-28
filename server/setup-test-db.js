import pg from 'pg';
import setup from './data/setup.js';

const { Pool } = pg;

const TEST_DATABASE_NAME = 'kevinnaildotcom_test';

export const setupTestDatabase = async () => {
  // Connect to postgres database to create test database
  const adminPool = new Pool({
    connectionString: process.env.DATABASE_URL.replace(/\/[^/]+$/, '/postgres'),
    ssl: process.env.PGSSLMODE && { rejectUnauthorized: false },
  });

  try {
    // Check if test database exists
    const result = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      TEST_DATABASE_NAME,
    ]);

    if (result.rows.length === 0) {
      // Create test database
      await adminPool.query(`CREATE DATABASE ${TEST_DATABASE_NAME}`);
      console.info('✅ Test database created successfully');
    } else {
      console.info('✅ Test database already exists');
    }

    // Connect to test database and set up schema
    const testPool = new Pool({
      connectionString: process.env.DATABASE_URL.replace(/\/[^/]+$/, `/${TEST_DATABASE_NAME}`),
      ssl: process.env.PGSSLMODE && { rejectUnauthorized: false },
    });

    // Run setup script on test database
    await setup(testPool);
    console.info('✅ Test database schema set up successfully');

    await testPool.end();
  } catch (error) {
    console.error('❌ Error setting up test database:', error);
    throw error;
  } finally {
    await adminPool.end();
  }
};

setupTestDatabase()
  .then(() => {
    console.info('✅ Test database setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });
