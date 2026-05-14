# Ignoring actions

Use `--filter` to include only matching action names, and `--reject` to exclude them. Both accept multiple glob patterns.

## Only check first-party actions

```bash
gau --filter 'actions/*' --filter 'github/*'
```

## Skip a flaky or pinned action

```bash
gau --reject 'cypress-io/github-action'
```

## Skip everything from a problematic owner

```bash
gau --reject 'flaky-org/**'
```

## Skip docker images

```bash
gau --reject 'docker://**'
```

The patterns are matched against the action name (`owner/repo[/subpath]` for GitHub actions, `docker://image` for Docker images, the path string for local actions). Standard glob syntax: `*` matches a single path segment, `**` matches any depth, `?` matches a single non-slash character.
