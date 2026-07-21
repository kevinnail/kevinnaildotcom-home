import { defineConfig } from 'vitest/config';

// The lambda helpers are pure Node code (crypto only), so tests run in the
// node environment with no jsdom or Vite frontend plugins.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lambda/**/*.test.mjs'],
  },
});
