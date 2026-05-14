import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/index.ts',
        'src/core/types.ts', // types-only module, no executable code
        'src/cli.ts', // exercised via integration tests; entrypoint is thin
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        // vitest 4 / @vitest/coverage-v8 4 count branches more granularly than v2 did
        // (optional chains, default parameter values, ternaries inside spreads, etc.),
        // so the realistic floor for hand-written code is closer to 85% than the
        // 90% the previous tool reported. Lines/statements remain at 90%.
        branches: 85,
        statements: 90,
      },
    },
  },
});
