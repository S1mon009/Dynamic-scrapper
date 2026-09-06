import { defineConfig } from 'vitest/config'; // eslint-disable-line

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/cli/index.ts',
        'src/**/index.ts',
        'src/**/*.interface.ts',
        'src/core/types.ts',
      ],
    },
    testTimeout: 15000,
  },
});
