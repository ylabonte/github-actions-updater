# github-actions-updater

> `ncu` for GitHub Actions — scan `.github/workflows/` for outdated remote `uses:` references and (optionally) apply the updates, with a polished colorful CLI.

[![CI](https://github.com/yannic/github-actions-updater/actions/workflows/ci.yml/badge.svg)](https://github.com/yannic/github-actions-updater/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/github-actions-updater.svg)](https://www.npmjs.com/package/github-actions-updater)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

```
┌──────────────────────────┬────────────────────┬─────────┬────────┬───────┐
│ Workflow                 │ Action             │ Current │ Latest │ Δ     │
├──────────────────────────┼────────────────────┼─────────┼────────┼───────┤
│ .github/workflows/ci.yml │ actions/checkout   │ v3      │ v4.2.0 │ major │
│ .github/workflows/ci.yml │ actions/setup-node │ v3.8.2  │ v4.0.4 │ major │
└──────────────────────────┴────────────────────┴─────────┴────────┴───────┘
2 outdated · 0 up to date · across 1 workflow
```

## Install

```bash
npm install -g github-actions-updater
# or
pnpm add -g github-actions-updater
# or run once
npx github-actions-updater
```

The installed binary is `gau`.

## Usage

```bash
gau                       # scan and report
gau -u                    # apply every available update
gau -i                    # pick interactively
gau --json                # machine-readable
gau --target minor        # stay within current major
gau --filter 'actions/*'  # only first-party actions
```

Exit codes: `0` = current, `1` = outdated, `2` = error.

## Reference styles supported

| Style                 | Example                              |
| --------------------- | ------------------------------------ |
| Floating major        | `actions/checkout@v4`                |
| Exact tag             | `actions/checkout@v4.1.1`            |
| SHA + version comment | `actions/checkout@a1b2c3d… # v4.1.1` |
| Branch                | `actions/checkout@main`              |
| Docker image          | `docker://node:20-alpine`            |
| Local                 | `./.github/actions/build` (skipped)  |

For SHA-pinned refs, both the SHA and the trailing `# vX.Y.Z` comment are updated together on `--write`.

## Auth

`gau` looks for a token in this order:

1. `--token <token>` flag
2. `GITHUB_TOKEN` / `GH_TOKEN` env var
3. `gh auth token` (if [`gh` CLI](https://cli.github.com) is installed)
4. Anonymous (60 req/hour)

## Why?

There's no real shortage of update tooling for Node.js dependencies, but action references tend to drift quietly. `ncu` doesn't see them. Dependabot does, but its PR-driven flow is heavy for repos with a handful of actions. `gau` fills the gap — a small, local-first CLI you can run before a commit or in CI.

## Documentation

Full docs: <https://yannic.github.io/github-actions-updater/>

## Development

```bash
pnpm install
pnpm dev               # run the CLI from source
pnpm test:coverage     # run tests with coverage (90% threshold)
pnpm lint
pnpm typecheck
pnpm build
```

## Contributing

Issues and PRs welcome. Run `pnpm changeset` when adding user-visible changes; the release pipeline picks them up automatically.

## License

[MIT](./LICENSE)
