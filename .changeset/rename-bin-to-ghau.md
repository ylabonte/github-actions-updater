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
