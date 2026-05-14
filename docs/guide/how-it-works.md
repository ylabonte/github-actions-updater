# How it works

`ghau` runs a simple pipeline:

1. **Scan** — find every `*.yml` and `*.yaml` file in `.github/workflows/` (skipping subdirectories and `.github/actions/`).
2. **Parse** — for each file, extract every `uses:` value with its source position.
3. **Classify** — categorize each reference: tag, exact tag, SHA-pinned, branch, docker, or local.
4. **Resolve** — for each remote reference, fetch the candidate versions from the GitHub or Docker registry API and pick the "latest" per the `--target` policy.
5. **Report** — render a colored table, or JSON, or an interactive prompt.
6. **(Optional) Write** — splice the new value back into the original file, preserving comments and whitespace.

## Reference styles

| Style                 | Example                             | "Outdated" means                                                    |
| --------------------- | ----------------------------------- | ------------------------------------------------------------------- |
| Floating major        | `actions/checkout@v4`               | A tag in a **higher major** exists (within-major bumps are ignored) |
| Floating major.minor  | `actions/checkout@v4.1`             | A tag in a **higher (major, minor)** exists                         |
| Exact tag             | `actions/checkout@v4.1.1`           | Any higher tag exists (per `--target`)                              |
| SHA + version comment | `actions/checkout@a1b2c3d # v4.1.1` | The comment names an outdated tag                                   |
| Branch                | `actions/checkout@main`             | Always "mutable" — no real version                                  |
| Docker image          | `docker://node:20-alpine`           | A higher tag exists on the registry                                 |
| Local                 | `./.github/actions/build`           | Skipped                                                             |

### Floating partial tags

Most action authors maintain `@v4` as a _floating_ major tag — they force-push it to the
latest within-major release whenever they cut a new minor or patch. That means `@v4` is
already functionally equivalent to "latest v4.x.y". `ghau` treats it that way: it doesn't
report `@v4` as outdated against `v4.7.0`, because the ref already resolves there.
A cross-major release (`v5.0.0`) is the first thing that bumps the row to "major".

The same applies to `@v4.1`: it floats within `v4.1.x`, so a new patch isn't a bump, but
`v4.2.0` is. On `--write`, partial refs preserve their style: `@v4` → `@v5`, not
`@v4` → `@v5.0.0`.

## `--target` policy

| Value              | Picks                                      |
| ------------------ | ------------------------------------------ |
| `latest` (default) | Highest stable tag                         |
| `major`            | Same as `latest`; symmetric with `ncu`     |
| `minor`            | Highest tag with the same major as current |
| `patch`            | Highest tag with the same major.minor      |
| `greatest`         | Highest tag including pre-releases         |

## Surgical writes

When you run `ghau --write`, the tool does **not** reserialize the YAML through an AST. It splices replacements directly into the original text using the byte offsets captured at parse time. The result: comments, blank lines, indentation, and quoting style all stay exactly as you wrote them.

For SHA-pinned references, both the SHA and the trailing `# vX.Y.Z` comment are updated together — that comment is treated as part of the reference, not as decoration.

## Committing the updates

Add `--commit` to `--write` or `--interactive` and `ghau` will, after the workflow files are rewritten:

1. Stage the changed files with `git add`.
2. Open `git commit -v` with a pre-filled message: a one-line summary plus a bullet per updated action.

You're in the editor — save to commit, or leave the message empty to abort. The `-v` flag includes the diff in the editor view so you can sanity-check the rewrite before sealing the commit.

Skipped if you're not inside a git repository (a warning is printed; the file writes still happen).
