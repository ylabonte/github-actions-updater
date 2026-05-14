# github-actions-updater

> `ncu` for GitHub Actions — scan `.github/workflows/` for outdated `uses:` references and (optionally) apply the updates.

[![CI](https://github.com/yannic/github-actions-updater/actions/workflows/ci.yml/badge.svg)](https://github.com/yannic/github-actions-updater/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/github-actions-updater.svg)](https://www.npmjs.com/package/github-actions-updater)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

```shell
$ ghau
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

The installed binary is `ghau`.

## Usage

```bash
ghau                       # scan and report
ghau -u                    # apply every available update
ghau -i                    # pick interactively
ghau --json                # machine-readable
ghau --target minor        # stay within current major
ghau --filter 'actions/*'  # only first-party actions
```

Exit codes:

| Code | When                                                                                                                        |
| ---- | --------------------------------------------------------------------------------------------------------------------------- |
| `0`  | The scan ran. By default outdated entries do **not** fail the run — pass `--fail-on-outdated` if you want them to.          |
| `1`  | At least one resolution errored (and not every resolution did), or `--fail-on-outdated` was set and outdated entries exist. |
| `2`  | Every resolution errored — usually auth or network.                                                                         |

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

`ghau` looks for a token in this order:

1. `--token <token>` flag
2. `GITHUB_TOKEN` / `GH_TOKEN` env var
3. `gh auth token` (if [`gh` CLI](https://cli.github.com) is installed)
4. Anonymous (60 req/hour)

## Why?

There's no real shortage of update tooling for Node.js dependencies, but action references tend to drift quietly. `ncu` doesn't see them. Dependabot does, but its PR-driven flow is heavy for repos with a handful of actions. `ghau` fills the gap — a small, local-first CLI you can run before a commit or in CI.

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

---

If `ghau` saved you some time, a coffee is always appreciated — entirely optional, never expected.

<a href="https://www.buymeacoffee.com/ylabonte"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="40" width="144"></a>
