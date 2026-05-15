# Config file

`ghau` discovers a config file at startup via
[cosmiconfig](https://github.com/cosmiconfig/cosmiconfig) — search starts in the
current working directory and walks up to the filesystem root. CLI flags
override config-file values; config-file values override hardcoded defaults.

## Where it looks

In order of precedence within the same directory:

- A `ghau` key in `package.json`
- `.ghaurc` (JSON or YAML, auto-detected)
- `.ghaurc.json`
- `.ghaurc.yaml`
- `.ghaurc.yml`
- `ghau.config.json`

If no config file is found, `ghau` runs with built-in defaults — the same as
before config-file support landed.

::: warning Data-only by design
Executable config formats (`.js`, `.cjs`, `.mjs`, `.ts`) are intentionally
**not supported**. Allowing them would mean `ghau` runs
repository-controlled JavaScript during config discovery. In the composite
Action path, `GITHUB_TOKEN` is already in the process environment by the
time the CLI starts, so a checked-in `ghau.config.mjs` from an
attacker-controlled PR could read or exfiltrate it — even though `token`
is not part of the config schema. Keeping the config surface data-only
eliminates that vector at the cost of dynamic configs; if you need a
dynamic config, generate JSON at build time. An explicit opt-in for
executable formats may land in a future minor with appropriate CI
safeguards.
:::

## Schema

```ts
interface GhauConfig {
  /** Update target policy. Default: `'latest'`. */
  target?: 'latest' | 'major' | 'minor' | 'patch' | 'greatest';
  /** Include only matching action names (glob). */
  filters?: string[];
  /** Exclude matching action names (glob). */
  rejects?: string[];
  /** Override the workflows directory. Default: `.github/workflows`. */
  workflowsDir?: string;
  /** On `--write`, convert branch refs to pinned SHAs. Default: `false`. */
  allowBranchPin?: boolean;
  /** Exit non-zero when outdated entries are found. Default: `false`. */
  failOnOutdated?: boolean;
}
```

Unknown keys are rejected with a clear error pointing at the file and the
offending field. `ghau` exits `2` when a config is present but malformed —
the same exit code used for fatal scan errors.

## Relative paths

A relative `workflowsDir` is resolved against the **config file's
directory**, not against `process.cwd()`. So a repo-level
`.ghaurc.json` containing:

```json
{ "workflowsDir": ".github/workflows" }
```

…always points at `<repo-root>/.github/workflows`, regardless of which
subdirectory inside the repo you invoke `ghau` from.

CLI-provided `--workflows` paths stay `process.cwd()`-relative (that's the
standard CLI behavior).

::: warning Containment is enforced
Because a config file is repository-controlled, `workflowsDir` is required
to stay inside the config file's directory tree. The loader rejects (with
exit code `2`):

- **Absolute paths** in any platform-recognized form — POSIX (`/foo`),
  Windows drive-absolutes (`C:\foo`), Windows-rooted (`\foo`), and UNC
  (`\\server\share`). The Windows forms are rejected even when the config
  is loaded on POSIX, so the same checked-in file behaves consistently
  across platforms.
- **Drive-relative paths** (`C:foo`, `D:foo`) for the same portability
  reason.
- **`..`-escaping paths** that resolve outside the config file's
  directory (the check is on the _resolved_ path, so benign cases like
  `subdir/../wf` still work).

If you need an absolute path for a single run, use the CLI's
`--workflows` flag instead — that's an explicit operator choice rather
than a checked-in repo policy.
:::

## Examples

### Repo-level defaults via `.ghaurc.json`

```json
{
  "target": "minor",
  "rejects": ["docker://**"]
}
```

### YAML via `.ghaurc.yaml`

```yaml
target: minor
rejects:
  - docker://**
failOnOutdated: true
```

### Embedded in `package.json`

```json
{
  "name": "my-project",
  "ghau": {
    "target": "patch",
    "workflowsDir": "config/workflows"
  }
}
```

## Precedence

Effective options are resolved as **CLI flag → config file → built-in default**.

For options with a Commander default (`--target`, `--allow-branch-pin`,
`--fail-on-outdated`), the config value is applied only when the CLI didn't
explicitly set the flag. For options without a default (`--filter`,
`--reject`, `--workflows`), the config value fills in whenever the CLI omits
them.

Tokens (`--token`) are **never** loaded from config — they belong in env vars
or `gh auth token`, not in checked-in files.

## What's not configurable

These remain CLI-only because they describe a _single invocation_, not repo
policy:

- `--write`, `-u` — destructive; opt in per run.
- `--interactive`, `-i` — flow control for the current terminal session.
- `--commit`, `--no-edit` — same.
- `--json` — output shape selector for the current pipe.
- `--token` — security; see above.
- `--no-color` — terminal preference, not project preference.
- `--verbose` — diagnostic.
