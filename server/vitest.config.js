import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['dotenv/config'],
    // Every test file rebuilds the same test database in beforeEach, so files
    // must not run concurrently (equivalent to jest --runInBand).
    fileParallelism: false,
  },
});
