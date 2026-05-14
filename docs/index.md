---
layout: home

hero:
  name: github-actions-updater
  text: ncu for GitHub Actions.
  tagline: Scan .github/workflows for outdated references — and apply the bumps with one command.
  actions:
    - theme: brand
      text: Get started
      link: /guide/quickstart
    - theme: alt
      text: CLI reference
      link: /reference/cli

features:
  - title: Every ref style
    details: Tag refs (`@v4`), exact tags (`@v4.1.1`), SHA-pinned with version comments, branch refs, and `docker://` images — all handled.
  - title: Polished CLI
    details: Colored, glyph-bordered table by default. `--json` for CI. Interactive multi-select with `-i`.
  - title: Surgical YAML rewrites
    details: '`--write` replaces version strings in place. Comments, formatting, and whitespace stay exactly as you wrote them.'
  - title: Auth chain that just works
    details: '`GITHUB_TOKEN` → `gh auth token` → anonymous, in that order. No flags needed in most setups.'
  - title: Tested above 90%
    details: 142+ unit and integration tests. Strict TypeScript. Zero shell-injection surface.
  - title: Self-checking
    details: This repo runs `ghau` against its own workflows every Monday. The tool maintains itself.
---

## Install

```bash
# global
npm install -g github-actions-updater

# or with pnpm
pnpm add -g github-actions-updater

# or ephemeral
npx github-actions-updater
```

## 30-second demo

```bash
# Scan and report
ghau

# Apply every available update
ghau -u

# Pick what to apply
ghau -i

# CI-friendly machine output
ghau --json
```
