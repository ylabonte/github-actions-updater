# GitHub Copilot instructions for github-actions-updater

Mirror of `CLAUDE.md` for Copilot — same rules, condensed. Keep this file in sync
when the workflow rules in `CLAUDE.md` change.

## What this project is

A CLI (`ghau`) that scans `.github/workflows/*.{yml,yaml}` for outdated remote `uses:`
references and optionally rewrites them. TypeScript ESM, Node 20+, pnpm. Tested with
Vitest, linted with ESLint strict-type-checked + unicorn, formatted with Prettier.

## Workflow rules

1. **Format, lint, typecheck, and test before every commit.** Run `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` and fix anything red. `format:check` is separate from `lint` and easy to forget when only editing markdown. CI repeats these on three OSes and two Node versions; don't waste a matrix run.
2. **Track work in tasks.** Anything bigger than a one-line tweak: create discrete tasks, mark them `in_progress`/`completed` as you go. Don't batch.
3. **Changesets — interactively.** Before adding or modifying a `.changeset/*.md` entry, ask the user: add to existing, new file, or skip?
4. **Atomic commits.** Conventional prefixes (`feat`, `fix`, `chore`, `docs`, `test`, `refactor`; `!` for breaking). Body explains _why_.
5. **Confirm every externally-visible mutation with a rich, content-visible prompt.** This covers `git commit`, `git push`, `gh pr create`/`edit`/`comment`/`review`/`merge`/`close`/`reopen`, replies to PR review comments (`gh api …/comments/<id>/replies` or GraphQL `addPullRequestReviewThreadReply`), resolving/unresolving PR review threads, `gh issue` equivalents, adding/editing `.changeset/*.md` files, and any post to a third-party service. In each case, present the full content of the action (commit message, PR title+body, comment body, every reply in a batched review response, proposed changeset markdown — or, for state changes like merge/close/resolve-thread, a one-line statement of what's about to happen) in an interactive prompt the user navigates with arrow keys. Options: `Approve` / `Alter ...` / `Cancel` when the content can be edited; `Approve` / `Cancel` for state changes and pushes. **Batch related mutations** (multiple replies to one review, multiple thread resolutions tied to those replies) into a single prompt — one user gesture per logical response, not one per API call. The Claude-side mechanism is `AskUserQuestion` with the content in the option `preview` field; never fall back to a plain Y/N. Copilot users implement the same shape with whatever rich-prompt facility is available; if none, surface the full content in chat and wait for an explicit reply.
6. **Changesets are for user-relevant changes only.** New flags, behavior changes, bug fixes visible from outside, breaking renames → changeset. Process / workflow / `CLAUDE.md` updates, internal refactors that preserve public behavior, test-only changes, lockfile bumps, dev-dep upgrades, CI tweaks, formatting passes → **no** changeset. When unsure, ask the user. The release `CHANGELOG.md` should read like a feature/fix log, not a commit log.

## Code review lenses — apply to every change

### Bugs

- Cross-platform paths: Windows uses `\`, we display POSIX. Use `src/utils/paths.ts::toPosixPath`.
- Don't throw on partial resolver failure — surface via `Resolution.error`.
- Snapshot tests must not depend on `process.cwd()`. Pass explicit `cwd` to renderers.

### Optimizations

- Reuse the existing utilities (`toPosixPath`, `parseTag`, `trackLevel`, `minimatch`) before pulling in a new dep.
- API responses are cached per-process in `core/resolver/github-client.ts` — preserve that pattern.
- YAML is rewritten by text-splice (`io/yaml-writer.ts`), not AST round-trip. Don't change that.

### Security — top priority

Treat **every** change as a potential attack surface. This tool reads files, hits APIs, spawns `git`/`gh`, and may modify the user's repo.

- **No shell injection.** Use `execFile`/`spawn` with an args array, never `exec`. Avoid `shell: true` unless every arg is a constant; document why if you must.
- **No command injection via input.** Action names, tag names, paths from workflow files are attacker-controllable. Never interpolate them into shell, env-var names, URLs outside expected slots, or paths containing `..`.
- **No prototype pollution.** Parse external input into `Map` or `Object.create(null)`; never `Object.assign` parsed data onto config.
- **No URL/path injection.** Use Octokit / `fetch` with structured params. Validate `owner`/`repo`/`tag` shape before sending.
- **No regex DoS.** Any regex against user input must be linear-time; cap length first if unsure.
- **Tokens are sacred.** Tokens flow through `src/core/auth.ts` into the in-memory Octokit. Don't log them, don't persist them, don't pass them anywhere else.
- **Workflow file rewrites.** Any `Replacement.newValue` must be valid YAML in `uses:` context — no stray newlines, no `:`, no leading whitespace tricks.
- **Workflow injection in our own CI.** Never put `${{ github.event.* }}` directly inside `run:`. Use `env:` blocks with quoted shell variables.
- **Supply chain.** When bumping a dependency, check Dependabot afterward — moderate advisories should land as `pnpm.overrides` before merging.

If you spot a security issue while making an unrelated change, flag it to the user — don't silently patch and move on.

### Documentation surfaces

Doc/code drift is the most-flagged class of issue in our PR reviews. Anything visible at a user-facing contract boundary lives in **multiple files** — when you change a CLI flag, an Action input/output, an exit code, or a behavior described in prose, walk every place the contract is named in the same commit:

- The implementation (`src/` for the CLI, the `run:` script in `action.yml` for the Action).
- The matching `description:` in `action.yml` for inputs/outputs.
- The matching row in **`README.md`** tables.
- The matching paragraph(s) in **`docs/guide/*.md`**.
- Any open **`.changeset/*.md`** entry that bundles this change.

Before committing, `grep -n` the identifier across the repo. If it's named in three files but updated in one, that's doc drift. Anti-patterns to avoid: universal-sounding claims in scoped sections ("All CLI behavior is unchanged" reads as a whole-release promise even when the section describes one rename), and authoritative-sounding details that aren't verified (don't cite `repo:read` PAT scopes — they don't exist; don't cite `git diff HEAD~1..HEAD` if the script uses a different form).

## Project conventions

- **Reference styles:** `@v4` (floating major), `@v4.1` (floating minor), `@v4.1.1` (exact), `@<sha> # v4.1.1` (SHA-pinned with required version comment), `@main` (branch — mutable), `docker://image:tag`. Local refs (`./...`) are skipped.
- **Floating partial tags are pre-resolved.** `@v4` is functionally "latest `v4.x.y`"; don't flag within-major bumps as outdated. See `src/core/comparator.ts::classifyDiff`.
- **Exit codes:** `0` = scan ran (outdated entries don't fail by default), `1` = error or `--fail-on-outdated`+stale, `2` = every resolution errored. Default-0 is deliberate.
- **Display glyphs:** `✓` (U+2713) for up-to-date, `⚠` (U+26A0) for errors. Not the emoji versions (skews table).
- **Color:** `picocolors`. **Table:** `cli-table3`. **Prompts:** `@clack/prompts`. Don't add chalk/inquirer.

## Common pitfalls

- Machine-dependent snapshots — always pin `cwd` in renderer tests.
- `path.relative` on Windows yields backslashes — normalize with `toPosixPath`.
- `spawn` of `.cmd` shims on Windows fails without `shell: true` (see `tests/integration/cli.test.ts`).
- `git commit -t` aborts on unchanged buffers — we use `-F <file> -e -v` instead.
- Vitest 4 dropped `coverage.all`. Don't reintroduce.
- pnpm 11 needs explicit `allowBuilds` in `pnpm-workspace.yaml` for esbuild.
- `process.stdin.isTTY` is ambient — force it explicitly in tests with `Object.defineProperty` + `try/finally`, otherwise the test passes in CI and fails locally (or vice versa).
- Composite Action input defaults are literal strings — `default: ${{ github.token }}` is the string, not the token. Use an empty default + `env:`-block expression fallback.
- `set -euo pipefail` + `cli | tee out` + a CLI that may exit non-zero will kill the script before subsequent commands. Wrap: `set +e` → pipe → `cap=${PIPESTATUS[0]}` → `set -e` → write outputs → `exit "$cap"`.
- `jq` itself fails on empty/invalid JSON — `// 0` only handles missing fields, not parse errors. Combine with `2>/dev/null || echo 0`.
- Fixed `$RUNNER_TEMP/<name>.json` collides under multi-use in one job. `mktemp "$RUNNER_TEMP/<name>.XXXXXXXX.json"` is the fix.
- `extra=($VAR)` enables pathname expansion in bash — globs in `$VAR` expand against the workspace. Use `read -r -a extra <<<"$VAR"`, then guard `(( ${#extra[@]} > 0 ))` because whitespace-only input parses to an empty array and a bare `--flag` eats the next argument.
- Unborn-branch git ops: `git rev-parse HEAD` is empty. Code paths diffing HEAD before/after need a `git diff-tree --root <after>` fallback when the "before" is empty.
- `git diff -- '*.yml'` matches basenames across the entire tree. Scope to a directory: `git diff -- "$dir/*.yml" "$dir/*.yaml"`.
- npm package specs accept tarball URLs, git URLs, file paths, and `npm:other-pkg@...` aliases. Allowlist user-controlled values (e.g. `^[A-Za-z0-9][A-Za-z0-9._+-]*$`) before passing to `npx`.

## Useful commands

```bash
pnpm dev                  # run from source
pnpm dev -- -u --commit   # apply + commit-with-template
pnpm test                 # full suite (~2s)
pnpm test:coverage        # thresholds: 90% L/F/S, 85% B
pnpm build                # dist/cli.js
pnpm changeset            # only when the user OKs the entry
```

## When in doubt

Ask the user with a multiple-choice question (max one). They prefer a short clarification over a guess-and-revert cycle.
