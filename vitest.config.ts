import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    // Importing the router loads src/lib/db/index.ts; keep it off the real db.
    env: { DATABASE_URL: ':memory:' },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
