# Changesets

This folder is managed by [changesets](https://github.com/changesets/changesets).

To create a changeset for the next release:

```bash
pnpm changeset
```

Pick the bump type, write a short description, and commit the resulting Markdown file. The release workflow will turn it into a version bump PR and (on merge) publish to npm with provenance.
