# Authentication

The GitHub API limits unauthenticated requests to **60 per hour, per IP**. A repo with a dozen distinct action references can blow through that on a single scan.

`ghau` looks for a token in this order:

1. `--token <token>` CLI flag (highest priority).
2. `GITHUB_TOKEN` environment variable.
3. `GH_TOKEN` environment variable.
4. `gh auth token` (if the [GitHub CLI](https://cli.github.com) is installed and logged in).
5. Anonymous (with a warning printed to stderr).

## In CI

GitHub Actions provides `GITHUB_TOKEN` automatically. Just pass it through:

```yaml
- run: ghau --json
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Locally

The easiest path is to install [`gh`](https://cli.github.com) and run `gh auth login`. `ghau` will pick up its token automatically. Alternatively, export a personal access token:

```bash
export GITHUB_TOKEN=ghp_xxx
```

A scope-less token is enough — the tool only reads public metadata (tags, branches, refs).

## Rate limit warning

When running anonymously, `ghau` prints:

```
⚠ Running unauthenticated (60 req/hr). Set GITHUB_TOKEN or run `gh auth login` to lift the limit.
```

This is informational; the run continues.
