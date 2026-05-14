# Contributing

Thanks for your interest! `github-actions-updater` is a small project with a clear scope; that constraint is intentional — it keeps the surface area testable and the failure modes predictable.

## Setup

```bash
pnpm install
pnpm build
pnpm test:coverage
```

You need Node 20+ and pnpm 9+.

## Development loop

```bash
pnpm dev -- --json --filter 'actions/*'   # run the CLI from source
pnpm test:watch                           # tests in watch mode
pnpm lint                                 # eslint
pnpm typecheck                            # tsc --noEmit
```

## Code quality bar

- All code is TypeScript with `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`.
- ESLint with `@typescript-eslint/strict-type-checked` and `eslint-plugin-unicorn`.
- Prettier for formatting (config in `.prettierrc.json`).
- 90%+ line, branch, and function coverage; CI fails below the threshold.

## Tests

- Unit tests live in `tests/unit/` and mirror `src/`.
- Integration tests live in `tests/integration/` (spawn the CLI through tsx).
- Network calls are mocked: GitHub API via stubbed Octokit, Docker Hub via `vi.stubGlobal('fetch')`, and shell tools (`gh`) via dependency injection.

## Changesets

If your change is user-visible, add a changeset:

```bash
pnpm changeset
```

Pick `patch`, `minor`, or `major`, describe the change in one or two sentences, and commit the resulting Markdown file in `.changeset/`.

## Branch hygiene

- `main` is the integration branch.
- Open PRs against `main`. Squash-merge on green CI.
- Releases happen via the changesets workflow — never tag/release manually.
