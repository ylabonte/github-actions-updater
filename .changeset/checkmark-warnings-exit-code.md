---
'github-actions-updater': minor
---

UX polish: ✓ checkmark, silenced dev-script warnings, opt-in fail-on-outdated.

- **Table** — up-to-date rows now show a green `✓` in the Δ column; error rows show a yellow `⚠`. Empty Δ cells were indistinguishable from in-flight rows.
- **Dev scripts** — `npm run dev` no longer warns about three unknown config keys (all pnpm v8+ defaults; removed from `.npmrc`). `pnpm run dev` and `pnpm docs:gen-cli` no longer print Node's DEP0205 `module.register()` deprecation from tsx — suppressed via `cross-env NODE_OPTIONS=--no-deprecation` (new `cross-env` devDep handles Windows).
- **Exit code: `--fail-on-outdated` (BREAKING default change)** — `gau` no longer exits 1 by default when outdated entries are present. The scan succeeded; that's exit 0. Pass `--fail-on-outdated` to restore the old behavior for CI gating. Error exit codes (1 for partial, 2 for all-errored) are unchanged.

CI integration recipes in `docs/guide/ci-integration.md` updated to use `--fail-on-outdated` for the hard-gate pattern.
