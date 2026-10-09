import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  // `npm run dev` has no scoreboard API of its own; forward it to `npm run dev:worker` (port 8787).
  server: { proxy: { '/api': 'http://localhost:8787' } },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: { manualChunks: { phaser: ['phaser'] } },
    },
  },
  test: {
    include: ['tests/sim/**/*.test.ts', 'tests/bot/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
  },
});
