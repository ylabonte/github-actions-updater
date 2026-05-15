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
        // NOTE: src/cli.ts is intentionally NOT excluded — it hosts unit-tested
        // logic (`buildProgram`, `mergeOptions`, `isInvokedDirectly`) that
        // should count toward the threshold. The integration-only parts of the
        // file (`main`, `runCommit`, the bootstrap line) carry `c8 ignore`
        // markers so they don't drag the file's coverage down; see the file
        // itself for the rationale.
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
