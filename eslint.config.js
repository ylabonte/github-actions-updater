// @ts-check
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import unicorn from 'eslint-plugin-unicorn';
import prettierConfig from 'eslint-config-prettier';

export default defineConfig(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'docs/.vitepress/dist/**',
      'docs/.vitepress/cache/**',
      'docs/.vitepress/config.ts',
      'node_modules/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  unicorn.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['eslint.config.js'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // `prevent-abbreviations` was renamed to `name-replacements` in unicorn 68;
      // keep it off — short names like `opts`/`deps`/`ref` are idiomatic here.
      'unicorn/name-replacements': 'off',
      // Both rewrite the ` * `-prefixed JSDoc style used throughout the repo.
      'unicorn/no-asterisk-prefix-in-documentation-comments': 'off',
      'unicorn/single-line-block-comment-style': 'off',
      // Would rename option fields (e.g. `noEdit`) that are part of the
      // programmatic API surface.
      'unicorn/consistent-boolean-name': 'off',
      'unicorn/no-null': 'off',
      'unicorn/no-array-reduce': 'off',
      'unicorn/prefer-top-level-await': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true },
      ],
    },
  },
  {
    // The shebang makes unicorn treat cli.ts as a script, but its exports
    // (`buildProgram`, `mergeOptions`, `main`, …) are deliberate seams for the
    // unit tests and `docs:gen-cli`; the bootstrap is guarded by
    // `isInvokedDirectly`, so importing the module has no side effects.
    files: ['src/cli.ts'],
    rules: {
      'unicorn/no-exports-in-scripts': 'off',
    },
  },
  {
    // Tool config files are a single `export default defineConfig(...)`.
    files: ['*.config.{js,ts}'],
    rules: {
      'unicorn/no-top-level-side-effects': 'off',
    },
  },
  {
    files: ['tests/**/*.ts', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/require-await': 'off',
      'unicorn/no-useless-undefined': 'off',
      'unicorn/import-style': 'off',
    },
  },
  prettierConfig,
);
