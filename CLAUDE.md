# CLAUDE.md

Working guide for Claude (or any AI coding assistant) on `github-actions-updater`.
The goal: ship correct, secure, well-tested code without the user having to re-explain
the same rules every session.

## Project at a glance

- **What it is.** A CLI (`ghau`) that scans `.github/workflows/*.{yml,yaml}` for outdated
  remote `uses:` references and optionally rewrites them in place. Think `ncu`, but
  for GitHub Actions.
- **Stack.** TypeScript ESM, Node 20+, pnpm. Vitest + `@vitest/coverage-v8`. ESLint
  (strict-type-checked + unicorn) + Prettier. VitePress for docs. Changesets for
  releases. Targets `github-actions-updater` on npm; binary is `ghau`.
- **Architecture.** `src/core/` (scanner, parser, comparator, resolvers, auth) is the
  pure-ish domain; `src/io/` (yaml-writer, table/json renderers) handles the boundary;
  `src/commands/` (check, update, interactive, git-commit) orchestrates; `src/cli.ts`
  is the thin commander entry. Programmatic API re-exported from `src/index.ts`.

## Workflow rules (non-negotiable)

These came out of past sessions where things slipped through to CI. Follow them
_every time_; they're cheap on the local machine and expensive when CI catches them.

### Before every commit

Run **all four**, in this order, and fix anything red before committing:

```bash
pnpm format:check   # prettier — easy to miss because `pnpm lint` does NOT cover it
pnpm lint
pnpm typecheck
pnpm test           # or pnpm test:coverage when the change touches src/
```

`pnpm format:check` is separate from `pnpm lint` and easy to forget when you've only
edited markdown/docs. CI runs both — so do you.

When tests or lint fail mid-task, fix and re-run; do not commit "WIP" or "skip CI"
unless the user explicitly asks for it. A commit that fails CI wastes a full
matrix run.

### Use the task tracker

For any work that's more than a one-line change:

1. Call `TaskCreate` for each discrete step _before_ you start coding.
2. Mark `in_progress` when you pick it up.
3. Mark `completed` immediately when it's done — don't batch.
4. If you discover work mid-task, create new tasks rather than silently expanding scope.

This is what the user sees as progress; without it, the session feels opaque.

### Changesets — user-relevant only, and interactive

**Changesets exist for changes the user (= the npm/Action consumer) will notice or
care about.** Examples that warrant an entry: new flags, behavior changes, bug fixes
visible from the outside, breaking renames. Examples that do **not** warrant an entry,
and should never end up in `CHANGELOG.md`: process / workflow / CLAUDE.md updates,
internal refactors that preserve public behavior, test-only changes, lockfile bumps,
dev-dependency upgrades, CI tweaks, formatting passes. When unsure, ask: "would this
change appear in the changelog of any other npm package shipping the same fix?" — if
not, no changeset.

When a change does warrant a changeset, **always ask the user before adding or
modifying one** via `AskUserQuestion`, with the proposed entry body in the option
`preview`. This is the same shape as commit confirmation:

- Question: `"Add (or extend) a changeset entry for this change?"`
- One option `Approve` whose `preview` is the full proposed Markdown — frontmatter
  (`'github-actions-updater': major|minor|patch`) plus the body.
- One option `Alter` — when chosen, ask what to change, then re-issue.
- One option `Skip` — explicitly choose to ship the change with no changeset entry
  (the right call for non-user-visible work).
- One option `Cancel` — back out without committing the calling change either.

Don't create a `.changeset/*.md` file from Bash before this prompt has been approved.
The reason this is interactive: the user may be batching related work into a single
release, may be preparing a different cut, or may judge the change to be invisible
enough not to need an entry. Don't decide for them.

### Code review mindset — every change

Treat every diff as if you're reviewing it for a PR with strict standards. Four lenses:

#### 1. Bugs

- Off-by-one, null handling, untested edge cases.
- Cross-platform paths (Windows uses `\`; we display POSIX). Use `path.relative` +
  `toPosixPath` (see `src/utils/paths.ts`) for any path shown to a human or test.
- Race conditions / shared mutable state across async paths.
- Resolver fallbacks: a partial failure (one action errors, others succeed) should be
  surfaced via `Resolution.error`, not thrown.
- Deterministic tests: snapshot fixtures must not depend on `process.cwd()`. Pass an
  explicit `cwd` to renderers when asserting output.

#### 2. Optimizations

- Don't pull in heavy dependencies for trivial helpers; the project's existing utilities
  (`toPosixPath`, `parseTag`, `trackLevel`, `minimatch`) cover most cases.
- API calls are cached per-process in `core/resolver/github-client.ts`; preserve that
  pattern when adding resolvers.
- Avoid serializing YAML through the AST when rewriting workflow files — `io/yaml-writer.ts`
  splices replacements directly into the source text to preserve comments and formatting.
  That's a deliberate design choice; don't "improve" it into a round-trip.

#### 3. Security — high priority

This tool reads files, hits GitHub's API, spawns `git`/`gh`, and may rewrite repo files.
Every change must be evaluated against these:

- **No shell.** Use `execFile`/`spawn` directly with an args array — never `exec`, never
  `spawn(cmd, { shell: true })` with non-constant input. If you must spawn a Windows
  shim (e.g. `tsx.cmd`), confine `shell: true` to a branch where every arg is a static
  test string.
- **No command injection via configuration.** Action names, tag names, workflow paths
  are all attacker-controllable in malicious repos. Never interpolate them into a shell
  command, an env var name, a URL outside its expected position, or a file path
  containing `..`.
- **No prototype pollution.** When parsing user/external input (configs, action refs),
  prefer `Map` over plain objects, or use `Object.create(null)`. Never `Object.assign`
  a parsed object onto a config object.
- **No URL/path injection.** When constructing GitHub or Docker registry URLs, use the
  Octokit/`fetch` interfaces with structured parameters rather than string concatenation.
  Validate that `owner`/`repo`/`tag` match expected patterns before sending them.
- **No regex DoS.** Any new regex applied to user input must be linear-time. If you're
  unsure, add a length cap before matching.
- **Credentials hygiene.** GitHub tokens come through env vars or `gh auth token`. Never
  log, never write to disk, never pass beyond the in-memory `Octokit` instance. The
  `resolveAuth` chain is the only legitimate token-handling code.
- **Supply chain.** When bumping a dependency, check the GitHub Dependabot tab on the
  remote afterward — moderate advisories should land as `pnpm.overrides` entries
  before merging.
- **Workflow file rewriting.** `ghau --write` rewrites files inside the user's repo. Any
  resolver that produces a `Replacement` must guarantee the `newValue` is well-formed
  YAML in `uses:` context. No newlines, no `:` outside expected places, no leading
  whitespace tricks.
- **Workflow injection in our own CI.** The project's own `.github/workflows/*.yml`
  must not interpolate `${{ github.event.* }}` into `run:` commands directly — use
  `env:` blocks with quoted shell variables. See the GitHub Security blog post on
  workflow injection.

If you find a security issue while making an unrelated change, flag it to the user
immediately. Don't silently fix and move on; the user wants to know.

#### 4. Documentation surfaces

The single most-flagged class of issue in our PR reviews is doc/code drift — prose
that described a previous version of the implementation. Anything visible at a
user-facing contract boundary lives in **multiple files**, and a code change that
doesn't carry the matching prose along is incomplete. When you touch a CLI flag,
an Action input/output, an exit code, or a behavior described in writing, walk
every place the contract is named and update them in the same commit:

- The implementation itself — `src/` for the CLI, the `run:` script in `action.yml`
  for the Action.
- The matching `description:` field in `action.yml` (`inputs:` / `outputs:`).
- The matching row in **`README.md`** tables — Inputs, Outputs, Exit codes, Usage.
- The matching paragraph(s) in **`docs/guide/`** — usually `use-as-action.md`,
  `ci-integration.md`, `quickstart.md`, or `how-it-works.md`.
- Any open **`.changeset/*.md`** entry that bundles this change.

Before committing a contract-touching change, `grep -n` the identifier (flag name,
input name, output name, behavior phrase) across the repo. If it's named in three
files but updated in only one, you have doc drift in flight. CI will not catch
this; the next reviewer will.

This matters doubly when behavior evolves across several commits in one PR. The
doc paragraph that was correct on commit N can drift wrong on commit N+3 even
though nothing about the paragraph changed.

Two anti-patterns from past sessions:

- **Universal-sounding claims in scoped docs.** "All CLI behavior is unchanged"
  reads as a promise about the entire release, not the rename it was actually
  describing. Scope claims to their section: "The rename itself changes nothing
  about ..." beats "Nothing has changed."
- **Authoritative-sounding details that aren't verified.** Don't cite scopes
  (`repo:read` — doesn't exist), commands (`git diff HEAD~1..HEAD` — wasn't what
  the script did), or APIs without checking them. Either look it up, or hedge in
  language that survives implementation drift ("a token with read access" beats a
  wrong scope name). When you touch a code path, re-verify any prose elsewhere
  that names the path's mechanics.

## Project conventions

### Reference styles & semantics

- Tag refs: `actions/checkout@v4.1.1` (exact) or `@v4` (floating major) or `@v4.1`
  (floating minor).
- SHA-pinned with version comment: `actions/checkout@<sha> # v4.1.1`. The comment is
  load-bearing — it's how we know the current version. Without it we surface an error,
  we do _not_ guess.
- Branch: `actions/checkout@main`. Reported as `mutable`; rewriting only happens with
  `--allow-branch-pin`.
- Docker: `docker://node:20`. Resolved via Docker Hub registry API.
- Local: `./.github/actions/build`. Skipped (filtered out before resolution).

**Floating partial tags are not outdated against same-track moves.** `@v4` against
`v4.7.0` is `level: 'none'`. Only cross-track moves (`v4` → `v5`) are flagged. On
`--write`, partial style is preserved: `@v4` → `@v5`, not `@v5.0.0`. See
`src/core/comparator.ts::classifyDiff` and `src/utils/semver-tag.ts::trackLevel`.

### CLI exit codes

| Code | When                                                                                      |
| ---- | ----------------------------------------------------------------------------------------- |
| `0`  | Scan ran. Outdated entries do **not** fail by default.                                    |
| `1`  | A resolution errored (partial), or `--fail-on-outdated` was set and entries are outdated. |
| `2`  | Every resolution errored — usually auth or network.                                       |

The default-0 is deliberate — see the changeset for `--fail-on-outdated`. Don't revert.

### Color & display

- `picocolors` for color (no chalk; we keep the dep tree tiny).
- `cli-table3` for the table; border chars are explicit so the table is consistent
  across terminals.
- `✓` (U+2713) and `⚠` (U+26A0) for Δ-column glyphs. **Not** the emoji versions —
  emoji are inconsistently wide and skew the table.
- Display paths are always POSIX-normalized via `src/utils/paths.ts::toPosixPath`.
  Absolute paths used for `fs` calls stay native.

### Testing

- Unit tests in `tests/unit/`; integration tests in `tests/integration/`.
- Fake `GitHubClient` and `DockerClient` in `tests/helpers/fixtures.ts`. Use those
  instead of mocking Octokit directly.
- For snapshot tests on `renderTable`, **always** pass an explicit `cwd: '/tmp'` (or
  similar) so the snapshot is platform-deterministic.
- Coverage thresholds: lines/functions/statements at 90%, branches at 85% (vitest 4
  counts branches more granularly than v2 did).
- Use `c8 ignore` sparingly — only for genuine system-boundary code (subprocess
  spawns that need real binaries, fetch wrappers that need real network).

### Git hygiene

- Logical, atomic commits. One concern per commit.
- Conventional commit prefixes: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`.
  Add `!` for breaking (`feat(cli)!:`).
- Body explains _why_, not what — the diff already says what.
- Never `--no-verify`, never `--force` without explicit user authorization.

### Confirm before externally-visible actions — always, via `AskUserQuestion`

Even in auto/yolo mode, any action that's visible to others or hard to fully undo must
be confirmed by the user via `AskUserQuestion`, with the full content of the action
rendered in an option `preview`. Plain Y/N harness prompts via `permissions.ask` are
explicitly removed — the rich preview is the whole point.

The rule applies to:

- `git commit` — preview is the commit message you're about to use.
- `git push` — preview is the list of commits leaving the local machine.
- `gh pr create` — preview is the **PR title plus the full body**.
- `gh pr edit` — preview is the resulting title/body (the new state, not the diff).
- `gh pr comment`, `gh pr review` — preview is the comment / review body.
- **Replying to a PR review comment or discussion thread** (via
  `gh api repos/…/pulls/N/comments/<id>/replies` or the equivalent GraphQL
  `addPullRequestReviewThreadReply`) — preview is the reply body. When responding to
  multiple inline comments from the same review, **batch all the replies into a single
  prompt** whose preview lists every reply with its target file:line header. One
  prompt per review, not one prompt per comment.
- **Resolving / unresolving a PR review thread** (GraphQL `resolveReviewThread` /
  `unresolveReviewThread`) — `Approve` / `Cancel`. When resolving a batch of threads
  that were all responded to together, batch the resolutions into the same single
  prompt that approves the replies (so a review response is one user gesture, not N).
- `gh pr merge`, `gh pr close`, `gh pr reopen` — preview is a short statement of which
  PR changes state and how (e.g. `#42 → merged via squash`). No `Alter` option.
- `gh issue create` / `edit` / `comment` / `close` / `reopen` — same shape as PR.
- Adding or modifying a `.changeset/*.md` file — see the "Changesets — user-relevant
  only, and interactive" section above; the prompt shape is the same.
- Anything posting to a third-party service (Slack, gist, paste, registry).

If you're touching shared state — or about to write something that'll appear in a
public changelog, in a reviewer's inbox, or in someone else's GitHub notifications —
ask first.

**Shape of the prompt:**

| Action kind                | Option set                                                                                                                | Preview content                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Commit                     | `Approve` / `Alter the message` / `Cancel`                                                                                | Full commit message.                                                                               |
| Push                       | `Approve` / `Cancel`                                                                                                      | `git log @{upstream}..HEAD --oneline --decorate` (or, for a new branch, `git log -<N> --oneline`). |
| PR create                  | `Approve` / `Alter title` / `Alter body` / `Cancel` (use multiSelect=false; pick the most-likely-to-be-asked-for `Alter`) | `<title>\n\n<full body>`.                                                                          |
| PR edit / comment / review | `Approve` / `Alter the body` / `Cancel`                                                                                   | The new title+body or comment body.                                                                |
| PR review reply (batch)    | `Approve` / `Alter` / `Cancel`                                                                                            | Every reply body in the batch, each prefixed with `── <file>:<line> ──`.                           |
| PR / issue state change    | `Approve` / `Cancel`                                                                                                      | One-line statement (`#42 → closed`, `#42 → merged via squash and merge`).                          |
| Thread resolve (batch)     | `Approve` / `Cancel`                                                                                                      | List of `<file>:<line>` threads being resolved.                                                    |
| Changeset add / edit       | `Approve` / `Alter` / `Skip` / `Cancel`                                                                                   | Full proposed `.changeset/*.md` content (frontmatter + body).                                      |

When the user picks `Alter ...`, follow up by asking what to change (or ask for new
text outright), then re-issue the same question with the revised preview. **Never**
execute the underlying command before this prompt has been approved.

**Example call (PR create):**

```ts
AskUserQuestion({
  questions: [
    {
      question: 'Open this PR?',
      header: 'PR',
      multiSelect: false,
      options: [
        {
          label: 'Approve',
          description: 'Open the PR with the title and body shown.',
          preview: 'feat(cli): --no-edit flag for non-interactive commits\n\n…full body…',
        },
        { label: 'Alter title', description: 'Give me a new title; body stays.' },
        { label: 'Alter body', description: 'Give me a new body; title stays.' },
        { label: 'Cancel', description: 'Do not open the PR.' },
      ],
    },
  ],
});
```

Rules:

- **Never** invoke any of the above commands from Bash before the prompt has been
  approved. The prompt is the only sanity check on irreversible-ish actions.
- If you want to perform several similar mutations in rapid succession (multiple
  commits, multiple comments), **batch** them into one logical unit when possible
  rather than spamming prompts.
- The harness-level `permissions.ask` was intentionally removed from
  `.claude/settings.local.json` to avoid double-prompting. If you decide you want the
  belt-and-braces backstop, the original block is documented as a comment in that file.

## Common pitfalls (we've hit these)

- **Machine-dependent snapshots.** Always pin `cwd` in renderer tests.
- **`path.relative` on Windows yields backslashes.** Normalize with `toPosixPath`
  before display/test assertions.
- **`spawn` of `.cmd` shims on Windows fails without `shell: true`.** See
  `tests/integration/cli.test.ts` for the pattern.
- **`git commit -t <template>` rejects unchanged buffers.** Use `-F <file> -e -v`
  instead; see `src/commands/git-commit.ts` for the rationale comment.
- **Vitest 4 dropped `coverage.all`.** Don't reintroduce it.
- **pnpm 11 requires explicit build approval.** See `pnpm-workspace.yaml`'s
  `allowBuilds` entry for esbuild.
- **Floating partial tags are pre-resolved.** `@v4` is functionally `latest v4.x.y`;
  don't flag within-major moves as outdated.
- **`process.stdin.isTTY` is ambient.** Tests that depend on it pass under vitest
  but fail under `pnpm test:watch` from a real terminal. Force `isTTY` explicitly
  with `Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: <bool> })`
  - a `try/finally` restore.
- **Composite Action input defaults are literal strings.** `default: ${{ github.token }}`
  is the literal string `${{ github.token }}`, not the token. Use empty default plus
  an expression fallback in the `env:` block, evaluated at step time.
- **`set -euo pipefail` + pipe + downstream tool that may exit non-zero.** A failing
  CLI in `cli | tee out` kills the script before subsequent commands run. Wrap with
  `set +e` → `cli | tee out` → `captured=${PIPESTATUS[0]}` → `set -e`, write outputs,
  end with `exit "$captured"`.
- **`jq` itself fails on empty/unparseable JSON.** `// 0` inside the filter doesn't
  cover this — `jq` exits non-zero before the filter even runs. Combine `// 0` with
  `2>/dev/null || echo 0` outside to stay robust under both modes.
- **Fixed `$RUNNER_TEMP/<name>.json` collides under multi-use.** Two invocations of
  the same composite action in one job overwrite each other's reports. Use
  `mktemp "$RUNNER_TEMP/<name>.XXXXXXXX.json"` and surface the per-invocation path
  as the output.
- **`extra=($VAR)` enables pathname expansion in bash.** Globs in `$VAR` expand
  against the workspace before reaching the next stage. Use `read -r -a extra <<<"$VAR"`
  instead, then guard `(( ${#extra[@]} > 0 ))` because whitespace-only input parses
  to a zero-length array and a bare `--flag` with no values silently eats the next
  argument.
- **Unborn-branch git operations.** A fresh repo with no commits has no `HEAD`;
  `git rev-parse HEAD` returns empty. Code paths that diff "HEAD before" against
  "HEAD after" need to fall back to `git diff-tree --root <after>` against the empty
  tree when the "before" side is empty.
- **`git diff -- '*.yml'` is repo-wide.** Pathspecs without a leading directory match
  basenames across the whole tree, so unrelated yml/yaml files inflate counts. Scope
  to the directory you actually care about: `git diff -- "$dir/*.yml" "$dir/*.yaml"`
  matches direct children only.
- **npm package specs accept more than semver.** `npm install foo@<spec>` parses
  `<spec>` against a wide grammar — tarball URLs, git URLs, file paths, alias forms
  (`npm:other-pkg@...`) — all of which override the package name and execute
  arbitrary code. Validate any user-controlled `<spec>` against a tight allowlist
  (e.g. `^[A-Za-z0-9][A-Za-z0-9._+-]*$`) before passing to `npx`.

## Useful commands

```bash
pnpm dev                 # run the CLI from source
pnpm dev -- -u --commit  # apply updates and open commit editor
pnpm test                # full suite (~2s)
pnpm test:coverage       # with thresholds
pnpm build               # produce dist/cli.js
pnpm docs:dev            # local docs preview
pnpm docs:gen-cli        # regenerate the CLI reference from commander
pnpm changeset           # add an entry (only when user approves)
```

## When in doubt

Ask. The user prefers a short clarifying question over a guess-and-revert cycle.
But also: keep questions decisive (multiple-choice over open-ended) and respect their
time — don't ask three when one would do.
