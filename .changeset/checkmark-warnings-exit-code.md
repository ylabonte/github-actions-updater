---
'github-actions-updater': minor
---

UX polish: ✓/⚠ glyphs, and scans now exit 0 by default (gate on outdated entries with the new opt-in `--fail-on-outdated`).

- **Table** — up-to-date rows now show a green `✓` in the Δ column; error rows show a yellow `⚠`. Empty Δ cells were indistinguishable from in-flight rows.
- **Exit code: `--fail-on-outdated` (BREAKING default change)** — `ghau` no longer exits 1 by default when outdated entries are present. The scan succeeded; that's exit 0. Pass `--fail-on-outdated` to restore the old behavior for CI gating. Error exit codes (1 for partial, 2 for all-errored) are unchanged.

CI integration recipes in `docs/guide/ci-integration.md` updated to use `--fail-on-outdated` for the hard-gate pattern.
