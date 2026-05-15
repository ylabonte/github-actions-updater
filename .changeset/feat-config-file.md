---
'github-actions-updater': minor
---

Add config-file support via cosmiconfig.

Repo-level defaults can now live in a config file at the repo root — a `ghau` key in `package.json`, `.ghaurc[.json|.yaml|.yml|.js|.cjs|.mjs]`, `ghau.config.[js|cjs|mjs|ts|json]`. CLI flags override config values; config values override built-in defaults. Tokens are deliberately _not_ loadable from config — they belong in env vars or `gh auth token`.

Schema (validated by zod; unknown keys are rejected):

```ts
interface GhauConfig {
  target?: 'latest' | 'major' | 'minor' | 'patch' | 'greatest';
  filters?: string[];
  rejects?: string[];
  workflowsDir?: string;
  allowBranchPin?: boolean;
  failOnOutdated?: boolean;
}
```

The package also exports a `defineConfig` helper for TypeScript users:

```ts
// ghau.config.ts
import { defineConfig } from 'github-actions-updater';

export default defineConfig({
  target: 'minor',
  rejects: ['docker://**'],
  failOnOutdated: true,
});
```

See `docs/guide/config-file.md` for the full schema, search-order, and precedence rules.
