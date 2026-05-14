---
'github-actions-updater': minor
---

Initial public release.

- Scan `.github/workflows/*.{yml,yaml}` for outdated remote `uses:` references
- Support tag, exact-tag, SHA-pinned (with version comment), branch, and `docker://` reference styles
- `--write` mode preserves comments and formatting via surgical text splicing
- Interactive multi-select mode (`-i`)
- Auth chain: `GITHUB_TOKEN` → `GH_TOKEN` → `gh auth token` → anonymous
- Configurable `--target` policy (latest, major, minor, patch, greatest)
- JSON output for CI integration
- 90%+ test coverage with strict TypeScript and ESLint
