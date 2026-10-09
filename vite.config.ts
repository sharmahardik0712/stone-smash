import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
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
