# github-actions-updater

## 1.1.0

### Minor Changes

- 10601b3: Add config-file support via cosmiconfig.

  Repo-level defaults can now live in a **data-only** config file at the repo root — a `ghau` key in `package.json`, `.ghaurc`, `.ghaurc.json`, `.ghaurc.yaml`, `.ghaurc.yml`, or `ghau.config.json`. CLI flags override config values; config values override built-in defaults. Tokens are deliberately _not_ loadable from config — they belong in env vars or `gh auth token`.

  Schema (validated by zod; unknown keys are rejected):

  ```ts
  interface GhauConfig {
    target?: 'latest' | 'major' | 'minor' | 'patch' | 'greatest';
    filters?: string[];
    rejects?: string[];
    workflowsDir?: string;
    allowBranchPin?: boolean;
    failOnOutdated?: boolean;
  }
  ```

  Relative `workflowsDir` values are resolved against the config file's directory (not `process.cwd()`), so a repo-level `.ghaurc.json` keeps pointing at `<repo-root>/.github/workflows` regardless of which subdirectory inside the repo you invoke `ghau` from. **Containment is enforced** — a `workflowsDir` that is absolute (any platform-recognized form, including Windows drive-absolute and UNC even on POSIX), that contains a backslash (Windows-only separator; rejected for portability), that resolves outside the config file's directory via `..`-traversal, or whose realpath escapes the config tree through a symlink is rejected at load time. Repo-controlled configs can therefore only point at directories inside the repo, and behave identically on POSIX and Windows runners; operators who legitimately need an absolute path can still pass `--workflows` on the CLI.

  Rationale: a checked-in config is reachable by anyone who can land a PR, and — in `--write` mode — steering the YAML rewriter outside the repo would be a real attack vector. The validation closes that vector before the scanner ever opens a file.

  **Executable config formats (`.js`, `.cjs`, `.mjs`, `.ts`) are intentionally not supported.** Allowing them would let `ghau` execute repository-controlled JavaScript during config discovery — and in the composite Action path, `GITHUB_TOKEN` is already in the process environment by the time the CLI starts, so a checked-in `ghau.config.mjs` from an attacker-controlled PR could exfiltrate it. Keeping the config surface data-only eliminates that vector; an opt-in for executable formats may land in a future minor with appropriate CI safeguards. See `docs/guide/config-file.md` for the full rationale.

  ## Also in this release: Action-side contract changes

  To make the config-file precedence work end-to-end when the tool runs as a composite Action, several Action inputs gained new "defer to config" semantics:
  - **`target` input default changed** from `'latest'` to an empty string. When omitted, the Action no longer forces `--target latest` on the CLI; the CLI then honors a `target` value from a repo config file (or falls through to its own built-in `latest` default if no config). Set the input explicitly to force a value over any config.
  - **`workflows` input behavior clarified.** The input itself already defaulted to an empty string in 1.0.0; what's new is that an empty value now lets the CLI honor `workflowsDir` from a repo config file (previously it just fell through to the CLI's built-in `.github/workflows`). The Action's metadata description has been updated to reflect this; no Action-input default change.
  - **`allow-branch-pin` and `fail-on-outdated` inputs** are now tri-state. Empty (the new default) defers to the config; `'true'` appends the positive CLI flag; `'false'` appends a new negative CLI flag (`--no-allow-branch-pin` / `--no-fail-on-outdated`) so a one-off run can override a config-set `true` back to `false` without editing the config. **Back-compat for 1.0.x pins**: if a caller explicitly pins `version: '1.0.x'` and sets the tri-state input to `'false'`, the older CLI doesn't know the negative flag and would crash. To preserve the pre-1.1 behavior (where `false` was effectively a no-op — `false` matched the CLI's built-in default already), the Action detects a `1.0.x` version pin and treats `false` as a no-op + warning rather than emitting the new flag. Defaults (`version: '1'`) inherit `1.1.0` once published and aren't affected.

  The new CLI flags `--no-allow-branch-pin` and `--no-fail-on-outdated` are also available directly for non-Action invocations.

  Action users with `with: { target: latest }` / `with: { workflows: .github/workflows }` explicitly set in their workflows are unaffected. Action users who _omit_ those inputs will now inherit the config file's values (or fall through to the unchanged CLI defaults if no config) — the documented "Action input > config file > built-in default" precedence.

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
