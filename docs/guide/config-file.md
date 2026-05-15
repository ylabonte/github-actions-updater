# Config file

`ghau` discovers a config file at startup via
[cosmiconfig](https://github.com/cosmiconfig/cosmiconfig) — search starts in the
current working directory and walks upward. CLI flags override config-file
values; config-file values override hardcoded defaults.

## Where it looks

In order of precedence within the same directory:

- A `ghau` key in `package.json`
- `.ghaurc`
- `.ghaurc.json`
- `.ghaurc.yaml`
- `.ghaurc.yml`
- `.ghaurc.js`
- `.ghaurc.cjs`
- `.ghaurc.mjs`
- `ghau.config.js`
- `ghau.config.cjs`
- `ghau.config.mjs`
- `ghau.config.ts`
- `ghau.config.json`

If no config file is found, `ghau` runs with built-in defaults — the same as
before config-file support landed.

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

## Examples

### Repo-level defaults via `.ghaurc.json`

```json
{
  "target": "minor",
  "rejects": ["docker://**"]
}
```

### Typed config via `ghau.config.ts`

The package exports a `defineConfig` helper for type-safety:

```ts
// ghau.config.ts
import { defineConfig } from 'github-actions-updater';

export default defineConfig({
  target: 'minor',
  rejects: ['actions/cache', 'docker://**'],
  failOnOutdated: true,
});
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
