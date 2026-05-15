---
'github-actions-updater': minor
---

Add config-file support via cosmiconfig.

Repo-level defaults can now live in a **data-only** config file at the repo root — a `ghau` key in `package.json`, `.ghaurc`, `.ghaurc.json`, `.ghaurc.yaml`, `.ghaurc.yml`, or `ghau.config.json`. CLI flags override config values; config values override built-in defaults. Tokens are deliberately _not_ loadable from config — they belong in env vars or `gh auth token`.

Schema (validated by zod; unknown keys are rejected):

```ts
interface GhauConfig {
  target?: 'latest' | 'major' | 'minor' | 'patch' | 'greatest';
  filters?: string[];
  rejects?: string[];
  workflowsDir?: string;
  allowBranchPin?: boolean;
  failOnOutdated?: boolean;
}
```

Relative `workflowsDir` values are resolved against the config file's directory (not `process.cwd()`), so a repo-level `.ghaurc.json` keeps pointing at `<repo-root>/.github/workflows` regardless of which subdirectory inside the repo you invoke `ghau` from.

**Executable config formats (`.js`, `.cjs`, `.mjs`, `.ts`) are intentionally not supported.** Allowing them would let `ghau` execute repository-controlled JavaScript during config discovery — and in the composite Action path, `GITHUB_TOKEN` is already in the process environment by the time the CLI starts, so a checked-in `ghau.config.mjs` from an attacker-controlled PR could exfiltrate it. Keeping the config surface data-only eliminates that vector; an opt-in for executable formats may land in a future minor with appropriate CI safeguards. See `docs/guide/config-file.md` for the full rationale.
