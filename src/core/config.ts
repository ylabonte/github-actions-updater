/**
 * Config file loading via cosmiconfig.
 *
 * Supported locations (data-only):
 *
 * - `package.json` `"ghau"` field
 * - `.ghaurc` (JSON or YAML auto-detected by cosmiconfig)
 * - `.ghaurc.json`
 * - `.ghaurc.yaml`
 * - `.ghaurc.yml`
 * - `ghau.config.json`
 *
 * **Executable formats (`.js`, `.cjs`, `.mjs`, `.ts`) are intentionally NOT
 * supported.** Allowing them would mean `ghau` runs repository-controlled
 * JavaScript during config discovery. In the composite Action path,
 * `GITHUB_TOKEN` is already in the process environment by the time the CLI
 * starts, so a checked-in `ghau.config.mjs` from an attacker-controlled PR
 * could read or exfiltrate it — even though `token` is not part of the
 * config schema. Keeping the config surface data-only eliminates that vector.
 *
 * Users who need typed/dynamic configs in v1.1.0 should generate JSON at
 * build time. A future minor may add an explicit opt-in for executable
 * formats with appropriate CI safeguards — file an issue on the repo if
 * you have a use case.
 *
 * Schema validation rejects unknown keys and bad shapes with a single `Error`
 * message that lists every offending field. CLI flags override config values;
 * config values override hardcoded defaults — the merge happens at the call
 * site in `src/cli.ts`.
 */

import path from 'node:path';

import { cosmiconfig } from 'cosmiconfig';
import { z } from 'zod';

import { TARGETS } from './types.js';
import { toPosixPath } from '../utils/paths.js';

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
 *
 * Relative `workflowsDir` values are resolved against the directory of the
 * config file itself (not `process.cwd()`), so a repo-level config in
 * `repo/.ghaurc.json` keeps pointing at `repo/.github/workflows` regardless
 * of where the CLI was invoked.
 */
export async function loadConfig(cwd?: string): Promise<LoadedConfig | null> {
  const explorer = cosmiconfig('ghau', {
    searchPlaces: [
      'package.json',
      '.ghaurc',
      '.ghaurc.json',
      '.ghaurc.yaml',
      '.ghaurc.yml',
      'ghau.config.json',
    ],
    // Walk all the way to the filesystem root rather than stopping at the
    // default (which in cosmiconfig 9 is the user's home directory). This
    // makes the search find a repo-level `.ghaurc.json` even when the CLI
    // is invoked from a subdirectory whose path is outside the home tree
    // (e.g. a CI runner's `/var/.../runner/work/...` or a tmpdir path in
    // tests). The directory walk is bounded by filesystem depth and is
    // negligible cost in practice.
    stopDir: '/',
  });

  let result: Awaited<ReturnType<typeof explorer.search>>;
  try {
    result = await explorer.search(cwd);
  } catch (error) {
    // cosmiconfig's parser errors (invalid JSON/YAML in a discovered config
    // file) include the native filepath, which contains backslashes on
    // Windows. The codebase convention is to POSIX-normalize any human-
    // readable path before it reaches the user (see `src/utils/paths.ts`
    // and the schema-validation error below). Rethrow with backslashes
    // swapped so the message is stable cross-platform; preserve the
    // original via `cause` for upstream consumers that want the raw error.
    const message = (error as Error).message.replaceAll('\\', '/');
    throw new Error(`Invalid ghau config: ${message}`, { cause: error });
  }
  if (result === null || result.isEmpty === true) return null;

  const parsed = GhauConfigSchema.safeParse(result.config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => {
        const issuePath = issue.path.length === 0 ? '<root>' : issue.path.join('.');
        return `  ${issuePath}: ${issue.message}`;
      })
      .join('\n');
    throw new Error(`Invalid ghau config in ${toPosixPath(result.filepath)}:\n${issues}`);
  }

  // Resolve a relative `workflowsDir` against the config file's directory.
  // Without this, `ghau` invoked from `repo/packages/app` with a repo-level
  // `.ghaurc.json` containing `workflowsDir: ".github/workflows"` would scan
  // `repo/packages/app/.github/workflows`, not `repo/.github/workflows`.
  const config: GhauConfig = parsed.data;
  if (config.workflowsDir !== undefined && !path.isAbsolute(config.workflowsDir)) {
    const configDir = path.dirname(result.filepath);
    config.workflowsDir = path.resolve(configDir, config.workflowsDir);
  }

  return { config, filepath: result.filepath };
}
