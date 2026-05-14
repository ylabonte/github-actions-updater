import { defineConfig } from 'vitepress';

const REPO = 'github-actions-updater';

export default defineConfig({
  title: 'github-actions-updater',
  description: 'ncu for GitHub Actions — find and apply updates to remote action references.',
  base: process.env['DOCS_BASE'] ?? `/${REPO}/`,
  cleanUrls: true,
  lastUpdated: true,
  // esbuild 0.27 refuses to transpile vitepress 1.6's parameter-destructuring patterns to
  // the default `es2020` target ("not supported yet"). Bumping the build target to esnext
  // skips the down-level transform — modern evergreen browsers already support these.
  vite: {
    build: {
      target: 'esnext',
    },
  },
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/quickstart' },
      { text: 'CLI reference', link: '/reference/cli' },
      { text: 'Recipes', link: '/recipes/' },
      { text: 'GitHub', link: `https://github.com/ylabonte/${REPO}` },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Getting started',
          items: [
            { text: 'Quickstart', link: '/guide/quickstart' },
            { text: 'How it works', link: '/guide/how-it-works' },
            { text: 'CI integration', link: '/guide/ci-integration' },
          ],
        },
        {
          text: 'Workflows',
          items: [
            { text: 'Use as a GitHub Action', link: '/guide/use-as-action' },
            { text: 'SHA pinning', link: '/guide/sha-pinning' },
            { text: 'Config file', link: '/guide/config-file' },
            { text: 'Authentication', link: '/guide/authentication' },
          ],
        },
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'CLI', link: '/reference/cli' },
            { text: 'JSON output', link: '/reference/json-output' },
          ],
        },
      ],
      '/recipes/': [
        {
          text: 'Recipes',
          items: [
            { text: 'Overview', link: '/recipes/' },
            { text: 'Monorepos', link: '/recipes/monorepo' },
            { text: 'Ignoring actions', link: '/recipes/ignoring' },
          ],
        },
      ],
    },
    search: { provider: 'local' },
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © Yannic Labonte',
    },
    editLink: {
      pattern: `https://github.com/ylabonte/${REPO}/edit/main/docs/:path`,
    },
  },
});
