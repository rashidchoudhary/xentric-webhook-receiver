import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    pool: 'forks',
    testTimeout: 30000,
    hookTimeout: 30000
  }
});
