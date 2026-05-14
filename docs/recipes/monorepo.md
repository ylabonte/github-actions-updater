# Monorepos

GitHub Actions only loads workflows from the top-level `.github/workflows/` directory, so most monorepos end up with a single workflow root regardless of how the source code is organized. `gau` follows the same convention.

If you keep auxiliary workflow files elsewhere (for example, you've built tooling that copies them into `.github/workflows/` at release time), you can scan a non-default directory:

```bash
gau --workflows ./packages/foo/.github/workflows
```

To scan multiple roots, run `gau` once per root and merge the JSON outputs:

```bash
gau --json --workflows ./apps/web/workflows > web.json
gau --json --workflows ./apps/api/workflows > api.json
jq -s '{ summary: { outdated: (map(.summary.outdated) | add) }, entries: (map(.entries) | flatten) }' web.json api.json > combined.json
```
