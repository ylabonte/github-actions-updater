# github-actions-updater

## 1.0.0

Initial public release of `github-actions-updater` — an `ncu`-style CLI and composite GitHub Action for keeping the `uses:` references in your workflow files up to date.

### CLI (`ghau`)

- **Scans** `.github/workflows/*.{yml,yaml}` for outdated remote `uses:` references and renders a colored summary table (or `--json` for machine-readable output).
- **Reference styles supported**: floating major (`@v4`), floating minor (`@v4.1`), exact (`@v4.1.1`), SHA-pinned with version comment (`@<sha> # v4.1.1`), branch (`@main` — reported as mutable), Docker (`docker://image:tag`). Local refs (`./...`) are skipped.
- **Floating partial tags are pre-resolved**: `@v4` against `v4.7.0` is up-to-date; only cross-track moves (`v4` → `v5`, `v4.1` → `v4.2`) are flagged. On `--write`, partial refs preserve their style: `@v4` rewrites to `@v5`, not `@v5.0.0`.
- **`-u` / `--write`** applies updates in place. Surgical text-splice preserves comments and formatting; no AST round-trip.
- **`-i` / `--interactive`** picks updates from a multi-select prompt.
- **`--commit`** stages the rewritten files and produces a `git commit -v` with a pre-filled message (first-line summary + one bullet per updated action). Combine with `--no-edit` (or rely on auto-detection when stdin isn't a TTY) for a fully non-interactive commit suitable for CI.
- **Auth chain**: `--token <token>` → `GITHUB_TOKEN` / `GH_TOKEN` env → `gh auth token` → anonymous (60 req/hour).
- **`--target` policy**: `latest` (default), `major`, `minor`, `patch`, `greatest`.
- **`--filter` / `--reject`** with glob patterns over action names.
- **`--fail-on-outdated`** turns the scan into a CI gate. By default scans exit 0 even when outdated entries are present.
- **Exit codes**: `0` on a successful scan, `1` for partial resolution errors or `--fail-on-outdated` + drift, `2` when every resolution errored (auth/network).
- **Cross-platform paths**: POSIX-normalized in display and JSON output on every platform, including Windows.
- **Display polish**: green ✓ in the Δ column for up-to-date rows, yellow ⚠ for error rows.

### Composite GitHub Action

`github-actions-updater` is also consumable as a GitHub Action wrapper around the CLI:

```yaml
- uses: ylabonte/github-actions-updater@v1
  with:
    write: true
    commit: true
```

- Composite action; delegates to `npx github-actions-updater@<version>` so the npm package stays the single source of truth (no bundled JS blob, no double-update path).
- All CLI flags are mirrored as workflow inputs.
- Exposes `outdated`, `changes`, and `json` outputs for downstream composition.
- Pairs cleanly with [`peter-evans/create-pull-request`](https://github.com/peter-evans/create-pull-request) for an auto-PR flow.
- The floating `v<major>` tag (e.g. `v1`) tracks the latest 1.x.y release automatically.

See the README's "Use as a GitHub Action" section and the [extended docs](https://ylabonte.github.io/github-actions-updater/guide/use-as-action) for recipes (auto-PR, drift report, hard CI gate, monorepo, version pinning).

### Installation

```bash
npm install -g github-actions-updater
# or
pnpm add -g github-actions-updater
# or run once
npx github-actions-updater
```

The installed binary is `ghau`.
