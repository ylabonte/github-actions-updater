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
  --fail-on-outdated      exit 1 when outdated entries are found (default: exit
                          0 unless an actual error occurred) (default: false)
  -v, --verbose           verbose logging (default: false)
  -h, --help              display help for command
```

<!-- AUTOGEN:END -->

## Exit codes

| Code | When                                                                                                                  |
| ---- | --------------------------------------------------------------------------------------------------------------------- |
| `0`  | The scan ran. Outdated entries do **not** fail by default — opt in with `--fail-on-outdated` if you want CI to break. |
| `1`  | A resolution errored (partial failure), or `--fail-on-outdated` was set and outdated entries exist.                   |
| `2`  | Every resolution errored — usually auth/network or rate limiting.                                                     |
