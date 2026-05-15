/**
 * Config file loading via cosmiconfig.
 *
 * Supported locations (cosmiconfig defaults plus the `ghau.config.*` family):
 *
 * - `package.json` `"ghau"` field
 * - `.ghaurc`, `.ghaurc.json`, `.ghaurc.yaml`, `.ghaurc.yml`
 * - `.ghaurc.js`, `.ghaurc.cjs`, `.ghaurc.mjs`
 * - `ghau.config.js`, `ghau.config.cjs`, `ghau.config.mjs`, `ghau.config.ts`
 * - `ghau.config.json`
 *
 * Schema validation rejects unknown keys and bad shapes with a single `Error`
 * message that lists every offending field. CLI flags override config values;
 * config values override hardcoded defaults — the merge happens at the call
 * site in `src/cli.ts`.
 */

import { cosmiconfig } from 'cosmiconfig';
import { z } from 'zod';

const TARGETS = ['latest', 'major', 'minor', 'patch', 'greatest'] as const;

export const GhauConfigSchema = z
  .object({
    target: z.enum(TARGETS).optional(),
    filters: z.array(z.string().min(1)).optional(),
    rejects: z.array(z.string().min(1)).optional(),
    workflowsDir: z.string().min(1).optional(),
    allowBranchPin: z.boolean().optional(),
    failOnOutdated: z.boolean().optional(),
  })
  .strict();

export type GhauConfig = z.infer<typeof GhauConfigSchema>;

export interface LoadedConfig {
  readonly config: GhauConfig;
  readonly filepath: string;
}

/**
 * Search for a config file starting at `cwd` (defaulting to `process.cwd()`)
 * and walking up. Returns `null` when no config file is present — that path is
 * treated identically to "all defaults" at the call site.
 *
 * Throws a single, formatted `Error` when a config was found but failed schema
 * validation, so the CLI can surface a clean message to the user.
 */
export async function loadConfig(cwd?: string): Promise<LoadedConfig | null> {
  const explorer = cosmiconfig('ghau', {
    searchPlaces: [
      'package.json',
      '.ghaurc',
      '.ghaurc.json',
      '.ghaurc.yaml',
      '.ghaurc.yml',
      '.ghaurc.js',
      '.ghaurc.cjs',
      '.ghaurc.mjs',
      'ghau.config.js',
      'ghau.config.cjs',
      'ghau.config.mjs',
      'ghau.config.ts',
      'ghau.config.json',
    ],
  });

  const result = await explorer.search(cwd);
  if (result === null || result.isEmpty === true) return null;

  const parsed = GhauConfigSchema.safeParse(result.config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => {
        const path = issue.path.length === 0 ? '<root>' : issue.path.join('.');
        return `  ${path}: ${issue.message}`;
      })
      .join('\n');
    throw new Error(`Invalid ghau config in ${result.filepath}:\n${issues}`);
  }

  return { config: parsed.data, filepath: result.filepath };
}

/**
 * Identity helper for TS users authoring `ghau.config.ts` with type-safety:
 *
 * ```ts
 * import { defineConfig } from 'github-actions-updater';
 *
 * export default defineConfig({
 *   target: 'minor',
 *   rejects: ['docker://**'],
 * });
 * ```
 */
export function defineConfig(config: GhauConfig): GhauConfig {
  return config;
}
