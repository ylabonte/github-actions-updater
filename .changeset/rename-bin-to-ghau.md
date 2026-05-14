---
'github-actions-updater': major
---

**BREAKING — binary renamed: `gau` → `ghau`.**

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

All CLI behavior, flags, exit codes, and output formats are unchanged.

### Also in this release: `--no-edit` for non-interactive commits

`--commit` previously always passed `-e` to `git commit`, which forces an editor open. That was fine for the interactive desktop flow but unusable in CI without setting `GIT_EDITOR` to something non-interactive. The new `--no-edit` flag (mirrors `git commit --no-edit`) commits the prefilled message verbatim, no editor invocation.

`--no-edit` is also auto-enabled when stdin is not a TTY — so CI flows (including the upcoming GitHub Action wrapper) work out of the box even without the explicit flag.

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
