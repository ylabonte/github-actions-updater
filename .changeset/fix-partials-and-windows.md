---
'github-actions-updater': patch
---

Fix floating-tag false positives and Windows CI.

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
