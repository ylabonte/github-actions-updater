---
'github-actions-updater': minor
---

Drop Node 20 support; require Node 22+.

Node 20 left LTS at the end of April 2026, so the project drops it from its supported runtimes. The CLI is now tested on Node 22 and Node 24, with Node 24 as the build/release default. `package.json`'s `engines.node` bumps from `>=20.0.0` to `>=22.0.0`.

**What this means in practice:** the `engines` field is advisory — npm will print a warning when installing on Node 20 but will still complete the install. Configurations with `engine-strict=true` will refuse outright. The CLI itself uses no Node 22+ APIs in this release, so unaffected users on Node 20 are likely to keep working for a while — but any regression observed on Node 20 will not be treated as a bug, and CI will not catch one.

**What to do if you're on Node 20:** upgrade your runner to Node 22 or Node 24. There are no source-level API changes in this release; the bump is policy-only.

Why this isn't a major: the `engines` field is a soft contract, no runtime API changed, and the package is young enough that burning a 2.0.0 on a Node-support narrowing alone would make the version stream noisier than it needs to be. A loud changelog entry captures the contract change without committing the version number.
