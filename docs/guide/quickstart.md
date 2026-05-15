# Quickstart

`github-actions-updater` (`ghau`) scans the `.github/workflows/` directory of the current repo for remote `uses:` references and tells you which are outdated. It works on any repo, not just Node.js ones.

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
ghau
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

| Code | When                                                                                                           |
| ---- | -------------------------------------------------------------------------------------------------------------- |
| `0`  | The scan ran. Outdated entries do **not** fail by default — opt in with `--fail-on-outdated` for CI gating.    |
| `1`  | At least one resolution errored (partial failure), or `--fail-on-outdated` was set and outdated entries exist. |
| `2`  | Every resolution errored — usually rate limiting, auth, or network.                                            |

## Apply updates

```bash
ghau -u
# or
ghau --write
```

`ghau` rewrites the workflow files in place. SHA-pinned refs (`@<sha> # vX.Y.Z`) have both their SHA and trailing comment updated together. Formatting and comments are preserved exactly as they were.

Add `--commit` to also stage the changes and open `git commit -v` with a pre-filled message:

```bash
ghau -u --commit            # apply + open editor
ghau -i --commit            # pick + apply + open editor
ghau -u --commit --no-edit  # apply + commit verbatim, no editor (CI-friendly)
```

`--no-edit` (or running with stdin redirected, e.g. in a CI workflow) commits the
prefilled message as-is without launching an editor.

## Pick interactively

```bash
ghau -i
```

A checkbox UI lets you pick which updates to apply. Deselected entries are left untouched.

## Repo-level defaults

If you keep typing the same flags (`--target minor`, `--reject docker://**`, etc.), drop them into a config file at the repo root once.

`.ghaurc.json`:

```json
{
  "target": "minor",
  "rejects": ["docker://**"]
}
```

`ghau` picks it up automatically. CLI flags still win when you pass them explicitly. See the [config-file guide](./config-file) for the full schema and other supported shapes (`ghau.config.mjs` with typed `defineConfig`, a `ghau` key in `package.json`, etc.).

## Authentication

By default `ghau` tries, in order:

1. `GITHUB_TOKEN` environment variable
2. `GH_TOKEN` environment variable
3. `gh auth token` (if the [GitHub CLI](https://cli.github.com) is installed and logged in)
4. Anonymous (60 requests/hour — fine for tiny repos, painful for real ones)

See the [authentication guide](./authentication) for details.
