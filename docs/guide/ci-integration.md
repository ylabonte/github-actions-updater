# CI integration

By default `ghau` exits 0 even when there are outdated references — a scan that finished
successfully isn't an error, just an information signal. Pass `--fail-on-outdated` to flip
that behavior when you want CI to block on drift.

## Drift-only reporting (recommended)

This pattern reports drift but never fails the build:

```yaml
name: Action drift
on:
  schedule:
    - cron: '0 8 * * 1' # Mondays, 08:00 UTC
  workflow_dispatch:

jobs:
  drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npx github-actions-updater --json > drift.json
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - uses: actions/upload-artifact@v4
        with:
          name: action-drift
          path: drift.json
```

## Hard gate

To fail CI when drift is detected (e.g. on PRs):

```yaml
- run: npx github-actions-updater --fail-on-outdated
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Exit codes:

- `0` — scan ran; outdated entries (if any) do not fail unless `--fail-on-outdated` is set.
- `1` — partial failure (one or more resolutions errored), or `--fail-on-outdated` set and entries were outdated.
- `2` — every resolution errored (usually rate limiting / auth / network).

## JSON output

`--json` emits a structured report:

```json
{
  "summary": { "outdated": 2, "current": 5, "errors": 0, "workflows": 3 },
  "entries": [
    {
      "workflow": "/repo/.github/workflows/ci.yml",
      "action": "actions/checkout",
      "ref": "actions/checkout@v3",
      "kind": "tag",
      "current": "v3",
      "latest": "v4.2.0",
      "level": "major",
      "outdated": true
    }
  ]
}
```

Pipe it into `jq` or save it as an artifact to integrate with whatever you use to track tech debt.
