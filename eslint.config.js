import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/sim/**/*.ts'],
    rules: {
      // The simulation must stay deterministic and engine-free.
      'no-restricted-globals': ['error', 'window', 'document', 'performance', 'localStorage'],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded RNG in sim/rng.ts.' },
        { object: 'Date', property: 'now', message: 'The sim never reads the clock.' },
      ],
      'no-restricted-imports': ['error', { patterns: ['phaser', '../game/*'] }],
    },
  },
);
