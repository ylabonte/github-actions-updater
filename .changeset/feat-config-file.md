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

Relative `workflowsDir` values are resolved against the config file's directory (not `process.cwd()`), so a repo-level `.ghaurc.json` keeps pointing at `<repo-root>/.github/workflows` regardless of which subdirectory inside the repo you invoke `ghau` from. **Containment is enforced** — a `workflowsDir` that is absolute or that resolves outside the config file's directory (via `..`-traversal) is rejected at load time. Repo-controlled configs can therefore only point at directories inside the repo; operators who legitimately need an absolute path can still pass `--workflows` on the CLI.

Rationale: a checked-in config is reachable by anyone who can land a PR, and — in `--write` mode — steering the YAML rewriter outside the repo would be a real attack vector. The validation closes that vector before the scanner ever opens a file.

**Executable config formats (`.js`, `.cjs`, `.mjs`, `.ts`) are intentionally not supported.** Allowing them would let `ghau` execute repository-controlled JavaScript during config discovery — and in the composite Action path, `GITHUB_TOKEN` is already in the process environment by the time the CLI starts, so a checked-in `ghau.config.mjs` from an attacker-controlled PR could exfiltrate it. Keeping the config surface data-only eliminates that vector; an opt-in for executable formats may land in a future minor with appropriate CI safeguards. See `docs/guide/config-file.md` for the full rationale.

## Also in this release: Action-side contract changes

To make the config-file precedence work end-to-end when the tool runs as a composite Action, several Action inputs gained new "defer to config" semantics:

- **`target` and `workflows` inputs** now default to empty strings (previously `'latest'` and `'.github/workflows'` respectively). When empty, the Action skips the corresponding `--target` / `--workflows` flag on the CLI invocation entirely, so the CLI honors the config file's value (or its own built-in default if no config). Set the inputs explicitly to force a value over any config — useful when you want a hard CI guarantee.
- **`allow-branch-pin` and `fail-on-outdated` inputs** are now tri-state. Empty (the new default) defers to the config; `'true'` appends the positive CLI flag; `'false'` appends a new negative CLI flag (`--no-allow-branch-pin` / `--no-fail-on-outdated`) so a one-off run can override a config-set `true` back to `false` without editing the config.

The new CLI flags `--no-allow-branch-pin` and `--no-fail-on-outdated` are also available directly for non-Action invocations.

Action users with `with: { target: latest }` / `with: { workflows: .github/workflows }` explicitly set in their workflows are unaffected. Action users who _omit_ those inputs will now inherit the config file's values (or fall through to the unchanged CLI defaults if no config) — the documented "Action input > config file > built-in default" precedence.
