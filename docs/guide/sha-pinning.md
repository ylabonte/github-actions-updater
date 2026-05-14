# SHA pinning

The GitHub security team [recommends pinning third-party actions to specific commit SHAs](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#using-third-party-actions). Tags are mutable; SHAs are not.

The conventional form is:

```yaml
- uses: actions/checkout@a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0 # v4.1.1
```

The trailing comment is what makes the pin maintainable — it tells humans and tools what version the SHA actually represents.

## How `gau` handles SHA-pinned refs

When `gau` encounters a SHA-pinned reference:

1. It reads the trailing `# vX.Y.Z` comment as the canonical "current" version.
2. It queries the action's tags to find a newer version per `--target`.
3. If found, it resolves the new version's commit SHA.
4. On `--write`, both the SHA and the version comment are rewritten together.

A diff after `gau -u` looks like this:

```diff
-      - uses: actions/checkout@a1b2c3d4... # v4.1.1
+      - uses: actions/checkout@b2c3d4e5... # v4.2.0
```

## What if the comment is missing?

If a SHA-pinned ref has no `# vX.Y.Z` comment, `gau` cannot tell what version it represents, so it surfaces a row-level error rather than guessing. To bring such refs back under the tool's coverage, add the version comment manually once — `gau` will keep it in sync after that.
