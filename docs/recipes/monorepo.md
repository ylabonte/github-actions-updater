# Monorepos

GitHub Actions only loads workflows from the top-level `.github/workflows/` directory, so most monorepos end up with a single workflow root regardless of how the source code is organized. `ghau` follows the same convention.

If you keep auxiliary workflow files elsewhere (for example, you've built tooling that copies them into `.github/workflows/` at release time), you can scan a non-default directory:

```bash
ghau --workflows ./packages/foo/.github/workflows
```

To scan multiple roots, run `ghau` once per root and merge the JSON outputs:

```bash
ghau --json --workflows ./apps/web/workflows > web.json
ghau --json --workflows ./apps/api/workflows > api.json
jq -s '{ summary: { outdated: (map(.summary.outdated) | add) }, entries: (map(.entries) | flatten) }' web.json api.json > combined.json
```
