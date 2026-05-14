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
