# Config file

Config files are loaded via [cosmiconfig](https://github.com/cosmiconfig/cosmiconfig), so any of the following are recognized:

- `gau.config.ts`
- `gau.config.js`
- `gau.config.cjs`
- `gau.config.mjs`
- `gau.config.json`
- `.gaurc`
- `.gaurc.json`
- A `gau` key in `package.json`

::: info Status
Config file loading is wired through `cosmiconfig`. The schema is intentionally minimal at v0.x; expect new fields to land as use cases emerge.
:::

## Schema

```ts
interface GauConfig {
  target?: 'latest' | 'major' | 'minor' | 'patch' | 'greatest';
  filters?: string[]; // include only matching action names (glob)
  rejects?: string[]; // exclude matching action names (glob)
  workflowsDir?: string;
  allowBranchPin?: boolean;
}
```

## Example

```ts
// gau.config.ts
import { defineConfig } from 'github-actions-updater';

export default defineConfig({
  target: 'minor',
  rejects: ['actions/cache', 'docker://**'],
});
```

CLI flags override config-file values.
