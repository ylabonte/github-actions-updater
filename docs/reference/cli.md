# CLI reference

::: tip
This page is auto-generated from the `commander` definition by `pnpm docs:gen-cli`. Edits here will be overwritten — modify `src/cli.ts` instead.
:::

<!-- AUTOGEN:BEGIN -->

```
Usage: gau [options]

ncu for GitHub Actions — scan .github/workflows for outdated references.

Options:
  -V, --version           output the version number
  -u, --write             apply updates in place (default: false)
  -i, --interactive       interactively pick updates to apply (default: false)
  -t, --target <target>   update target policy (choices: "latest", "major",
                          "minor", "patch", "greatest", default: "latest")
  --filter <patterns...>  include only matching action names (glob)
  --reject <patterns...>  exclude matching action names (glob)
  --workflows <path>      override .github/workflows directory
  --json                  emit machine-readable JSON (default: false)
  --no-color              disable color output
  --token <token>         GitHub token (overrides env / gh CLI)
  --allow-branch-pin      on --write, convert branch refs to pinned SHAs
                          (default: false)
  --commit                after --write or --interactive: stage the changed
                          workflow files and open `git commit -v` with a
                          pre-filled message (default: false)
  -v, --verbose           verbose logging (default: false)
  -h, --help              display help for command
```

<!-- AUTOGEN:END -->

## Exit codes

| Code | Meaning                                         |
| ---- | ----------------------------------------------- |
| `0`  | All references current, or write mode completed |
| `1`  | At least one reference is outdated              |
| `2`  | A fatal error occurred                          |
