# Quickstart

`github-actions-updater` (`gau`) scans the `.github/workflows/` directory of the current repo for remote `uses:` references and tells you which are outdated. It works on any repo, not just Node.js ones.

## Install

```bash
npm install -g github-actions-updater
```

Or use it without installing:

```bash
npx github-actions-updater
```

## Run a scan

From the root of a repo with a `.github/workflows/` directory:

```bash
gau
```

You'll get a colored table:

```
┌──────────────────────────┬────────────────────┬─────────┬────────┬───────┐
│ Workflow                 │ Action             │ Current │ Latest │ Δ     │
├──────────────────────────┼────────────────────┼─────────┼────────┼───────┤
│ .github/workflows/ci.yml │ actions/checkout   │ v3      │ v4.2.0 │ major │
│ .github/workflows/ci.yml │ actions/setup-node │ v3.8.2  │ v4.0.4 │ major │
└──────────────────────────┴────────────────────┴─────────┴────────┴───────┘

2 outdated · 0 up to date · across 1 workflow
```

Exit codes:

| Code | Meaning                  |
| ---- | ------------------------ |
| `0`  | All references current   |
| `1`  | At least one is outdated |
| `2`  | A fatal error occurred   |

## Apply updates

```bash
gau -u
# or
gau --write
```

`gau` rewrites the workflow files in place. SHA-pinned refs (`@<sha> # vX.Y.Z`) have both their SHA and trailing comment updated together. Formatting and comments are preserved exactly as they were.

## Pick interactively

```bash
gau -i
```

A checkbox UI lets you pick which updates to apply. Deselected entries are left untouched.

## Authentication

By default `gau` tries, in order:

1. `GITHUB_TOKEN` environment variable
2. `GH_TOKEN` environment variable
3. `gh auth token` (if the [GitHub CLI](https://cli.github.com) is installed and logged in)
4. Anonymous (60 requests/hour — fine for tiny repos, painful for real ones)

See the [authentication guide](./authentication) for details.
