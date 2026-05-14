# Use as a GitHub Action

`github-actions-updater` ships as a composite Action alongside its npm CLI. Drop it into any workflow with:

```yaml
- uses: ylabonte/github-actions-updater@v1
```

The Action runs `npx github-actions-updater@<version>` under the hood — same code, same defaults, same flags. The npm package is the single source of truth; the Action is a thin manifest that wires inputs/outputs to the CLI.

## Inputs and outputs

The complete tables live in the [README](https://github.com/ylabonte/github-actions-updater#use-as-a-github-action). Highlights worth flagging here:

- **`version`** defaults to `1` — the same major as the action ref (`@v1`). That keeps the action ref and the underlying CLI major aligned so `uses: …@v1` can never silently jump to a future `2.x` CLI. Override the input to pin tighter (`version: '1.2.3'`) for fully reproducible builds, or set it to `latest` to opt into floating across majors.
- **`commit: true`** implies `--no-edit` — no editor is invoked, the action commits the prefilled message verbatim. Without `commit`, the workflow files are left modified for the next step to handle.
- **`fail-on-outdated: true`** turns the action into a CI gate. Without it the action always exits 0 on a successful scan, even if there's drift.
- **`github-token`** defaults to the workflow's auto-provided `github.token`. That's enough for public-repo scans. For private repos, supply a token with read access to the repository: a classic PAT with the `repo` scope, or a fine-grained PAT with the **Contents: Read** permission on the target repo. The token never leaves the in-memory Octokit instance — see `src/core/auth.ts`.
- **`changes` output** is the number of workflow files actually rewritten by the run, not the scan-time outdated count. Derived from `git diff HEAD~1..HEAD` when `commit: true` (the commit's file list) or from `git diff` against the index when `write: true` without `--commit` (the working-tree changes). Always `0` when `write: false` or when the workflow isn't running inside a git repository. Safe to gate downstream steps on, e.g. `if: steps.ghau.outputs.changes > 0`.

## Recipes

### 1. Auto-PR weekly (canonical)

Schedule a weekly run that opens a PR with the bumped versions.

```yaml
name: Update GitHub Actions

on:
  schedule:
    - cron: '0 8 * * 1' # Mondays, 08:00 UTC
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ylabonte/github-actions-updater@v1
        id: ghau
        with:
          write: true
          commit: true
      - uses: peter-evans/create-pull-request@v6
        if: steps.ghau.outputs.changes > 0
        with:
          branch: chore/update-github-actions
          title: 'chore(deps): update GitHub Actions'
          body: |
            Automated update of outdated GitHub Actions references.
            See the commit message for the per-action breakdown.
          delete-branch: true
```

- `permissions.pull-requests: write` is required for `peter-evans/create-pull-request`.
- Our `--commit` makes the commit; `peter-evans/create-pull-request` detects the existing commit and pushes it to a new branch, opening the PR. No double-commit.

### 2. Drift-only PR comment (no writes)

For repos that want awareness without automation: comment a summary on every PR.

```yaml
name: Action drift report
on:
  pull_request:
    paths:
      - '.github/workflows/**'

permissions:
  contents: read
  pull-requests: write

jobs:
  drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ylabonte/github-actions-updater@v1
        id: ghau
      - name: Comment if drift
        if: steps.ghau.outputs.outdated > 0
        uses: actions/github-script@v7
        env:
          REPORT: ${{ steps.ghau.outputs.json }}
        with:
          script: |
            const fs = require('node:fs');
            const data = JSON.parse(fs.readFileSync(process.env.REPORT, 'utf8'));
            const rows = data.entries.filter(e => e.outdated)
              .map(e => `- \`${e.action}\` ${e.current} → ${e.latest} (${e.level})`)
              .join('\n');
            const body = `**${data.summary.outdated} outdated GitHub Action${data.summary.outdated === 1 ? '' : 's'}**\n\n${rows}`;
            await github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body,
            });
```

### 3. Hard CI gate (fail on drift)

For repos that treat outdated actions as a build failure:

```yaml
- uses: ylabonte/github-actions-updater@v1
  with:
    fail-on-outdated: true
```

The Action exits 1, the job fails, the PR can't be merged until the actions are bumped.

### 4. Pinning the Action version

```yaml
# Latest stable v1.x.y (recommended for most users)
uses: ylabonte/github-actions-updater@v1

# Pin to an exact release for reproducible builds
uses: ylabonte/github-actions-updater@v1.2.3

# Pin to a commit SHA (most paranoid; insulates against tag re-pointing)
uses: ylabonte/github-actions-updater@<40-char-sha>
```

The `version` _input_ separately controls which **npm version** of the underlying CLI runs. The Action ref decides which `action.yml` is loaded; the input decides which CLI it dispatches to. They're independent, but typically tracked together:

```yaml
uses: ylabonte/github-actions-updater@v1
with:
  version: '1' # same major as the action ref
```

### 5. Monorepos and non-default workflow directories

The Action scans `.github/workflows` by default. If your generated/synced workflow files live elsewhere, point at them:

```yaml
- uses: ylabonte/github-actions-updater@v1
  with:
    workflows: packages/web/.github/workflows
```

To scan multiple roots, run the Action multiple times and combine the JSON outputs in a follow-up step.

## Marketplace

This repo is published to the GitHub Marketplace under the same name. The first publish was a one-time click on the [Releases page](https://github.com/ylabonte/github-actions-updater/releases) ("Publish this Action to the Marketplace"). Subsequent releases inherit that listing automatically.

The floating `v<major>` tag is maintained by the release workflow — see `.github/workflows/release.yml`. Don't push `v1` manually.
