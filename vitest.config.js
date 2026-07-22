import { defineConfig } from 'vitest/config';

// The lambda helpers and the pure frontend utils (e.g. concurrency) are plain
// Node-compatible code, so tests run in the node environment with no jsdom or
// Vite frontend plugins. Components/hooks are covered by manual E2E, not unit tests.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lambda/**/*.test.mjs', 'src/**/*.test.js'],
  },
});
