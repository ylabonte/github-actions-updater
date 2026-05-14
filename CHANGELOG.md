# github-actions-updater

## 1.0.0

### Major Changes

- aa866c2: **BREAKING — binary renamed: `gau` → `ghau`.**

  The previous binary name `gau` collides with [Oh My Zsh's git plugin
  default alias](https://github.com/ohmyzsh/ohmyzsh/blob/master/plugins/git/git.plugin.zsh)
  for `git add --update`, which is enabled in nearly every Oh My Zsh
  install out of the box. The shell alias is expanded before binary
  lookup, so a globally installed `gau` was shadowed for a large slice of
  the target audience.

  ### Migration

  ```diff
  - gau                       # scan
  - gau -u                    # apply updates
  - gau -i                    # pick interactively
  + ghau                      # scan
  + ghau -u                   # apply updates
  + ghau -i                   # pick interactively
  ```

  `package.json` `"bin"` now lists only `ghau`. If you scripted against
  `gau` in CI or shell aliases, replace it with `ghau`. The old `gau`
  binary is removed — no transition period — because keeping it as a
  deprecated alias wouldn't have helped Oh My Zsh users anyway (the
  shell alias still wins).

  The rename itself changes nothing about CLI behavior — flags, exit codes,
  output formats, and interactive prompts are byte-for-byte identical to the
  previous release. See the sections below for the actual additive features
  bundled into this release.

  ### Also in this release: `--no-edit` for non-interactive commits

  `--commit` previously always passed `-e` to `git commit`, which forces an editor open. That was fine for the interactive desktop flow but unusable in CI without setting `GIT_EDITOR` to something non-interactive. The new `--no-edit` flag (mirrors `git commit --no-edit`) commits the prefilled message verbatim, no editor invocation.

  `--no-edit` is also auto-enabled when stdin is not a TTY — so CI flows (including the bundled composite GitHub Action wrapper) work out of the box even without the explicit flag.

  ```bash
  ghau -u --commit --no-edit    # CI-friendly: commits the prefilled message as-is
  ```

  ### Also in this release: composite GitHub Action wrapper

  `github-actions-updater` is now consumable as a GitHub Action in addition to the npm CLI:

  ```yaml
  - uses: ylabonte/github-actions-updater@v1
    with:
      write: true
      commit: true
  ```

  The Action is a composite that delegates to `npx github-actions-updater@<version>` — the npm package stays the single source of truth, no bundling, no committed JS blob. Inputs mirror the CLI flags one-to-one; the action also exposes `outdated`, `changes`, and `json` outputs for downstream composition. Pair with [`peter-evans/create-pull-request`](https://github.com/peter-evans/create-pull-request) for an auto-PR flow.

  The floating `v<major>` tag (e.g. `v1`) is force-pushed by the release workflow after each `pnpm release` succeeds, so `uses: ...@v1` always resolves to the latest 1.x.y.

  See the README's "Use as a GitHub Action" section and the [extended docs](https://ylabonte.github.io/github-actions-updater/guide/use-as-action) for recipes (auto-PR, drift report, hard CI gate, monorepo, version pinning).

### Minor Changes

- 27a08a4: UX polish: ✓/⚠ glyphs, and scans now exit 0 by default (gate on outdated entries with the new opt-in `--fail-on-outdated`).
  - **Table** — up-to-date rows now show a green `✓` in the Δ column; error rows show a yellow `⚠`. Empty Δ cells were indistinguishable from in-flight rows.
  - **Exit code: `--fail-on-outdated` (BREAKING default change)** — `ghau` no longer exits 1 by default when outdated entries are present. The scan succeeded; that's exit 0. Pass `--fail-on-outdated` to restore the old behavior for CI gating. Error exit codes (1 for partial, 2 for all-errored) are unchanged.

  CI integration recipes in `docs/guide/ci-integration.md` updated to use `--fail-on-outdated` for the hard-gate pattern.

- 2a52c95: Fix floating-tag false positives and Windows CI.
  - **Partial tag refs (`@v4`, `@v4.1`) no longer report as outdated against same-track tags.**
    Floating major/minor tags are maintained by action authors as moving pointers within their
    track, so a `@v4` ref pointing at `v4.7.0` is already up to date. Only cross-track moves
    (`v4` → `v5`, or `v4.1` → `v4.2`) are flagged as bumps now. On `--write`, partial refs
    preserve their style: `@v4` rewrites to `@v5`, not `@v5.0.0`.
  - **Windows: table rendering and JSON output now show POSIX-style paths**, matching every other platform.

  ### New: `--commit` flag

  Add `--commit` to `--write` or `--interactive` and `ghau` will, after the workflow files
  are rewritten, stage them with `git add` and open `git commit -v` with a pre-filled
  message — first line summary plus one bullet per updated action. Skipped (with a warning)
  if you're not inside a git repository.

- 8465f53: Initial public release.
  - Scan `.github/workflows/*.{yml,yaml}` for outdated remote `uses:` references
  - Support tag, exact-tag, SHA-pinned (with version comment), branch, and `docker://` reference styles
  - `--write` mode preserves comments and formatting via surgical text splicing
  - Interactive multi-select mode (`-i`)
  - Auth chain: `GITHUB_TOKEN` → `GH_TOKEN` → `gh auth token` → anonymous
  - Configurable `--target` policy (latest, major, minor, patch, greatest)
  - JSON output for CI integration
