# How it works

`gau` runs a simple pipeline:

1. **Scan** — find every `*.yml` and `*.yaml` file in `.github/workflows/` (skipping subdirectories and `.github/actions/`).
2. **Parse** — for each file, extract every `uses:` value with its source position.
3. **Classify** — categorize each reference: tag, exact tag, SHA-pinned, branch, docker, or local.
4. **Resolve** — for each remote reference, fetch the candidate versions from the GitHub or Docker registry API and pick the "latest" per the `--target` policy.
5. **Report** — render a colored table, or JSON, or an interactive prompt.
6. **(Optional) Write** — splice the new value back into the original file, preserving comments and whitespace.

## Reference styles

| Style                 | Example                             | "Outdated" means                     |
| --------------------- | ----------------------------------- | ------------------------------------ |
| Floating major        | `actions/checkout@v4`               | A higher tag exists (per `--target`) |
| Exact tag             | `actions/checkout@v4.1.1`           | A higher tag exists (per `--target`) |
| SHA + version comment | `actions/checkout@a1b2c3d # v4.1.1` | The comment names an outdated tag    |
| Branch                | `actions/checkout@main`             | Always "mutable" — no real version   |
| Docker image          | `docker://node:20-alpine`           | A higher tag exists on the registry  |
| Local                 | `./.github/actions/build`           | Skipped                              |

## `--target` policy

| Value              | Picks                                      |
| ------------------ | ------------------------------------------ |
| `latest` (default) | Highest stable tag                         |
| `major`            | Same as `latest`; symmetric with `ncu`     |
| `minor`            | Highest tag with the same major as current |
| `patch`            | Highest tag with the same major.minor      |
| `greatest`         | Highest tag including pre-releases         |

## Surgical writes

When you run `gau --write`, the tool does **not** reserialize the YAML through an AST. It splices replacements directly into the original text using the byte offsets captured at parse time. The result: comments, blank lines, indentation, and quoting style all stay exactly as you wrote them.

For SHA-pinned references, both the SHA and the trailing `# vX.Y.Z` comment are updated together — that comment is treated as part of the reference, not as decoration.
