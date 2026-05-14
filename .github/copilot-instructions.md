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
5. **Confirm every `git commit` / `git push` with a rich, message-visible prompt.** Even in autonomous modes, present the full commit message (for commits) or the list of commits being pushed (for pushes) in an interactive prompt the user can navigate with arrow keys, with options `Approve` / `Alter the message` / `Cancel` for commits and `Approve` / `Cancel` for pushes. The Claude-side mechanism is `AskUserQuestion` with the message in the option `preview` field; never fall back to a plain Y/N. Copilot users implement the same shape with whatever rich-prompt facility is available; if none, surface the full message in chat and wait for an explicit reply.

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
