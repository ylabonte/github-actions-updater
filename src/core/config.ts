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

import fs from 'node:fs/promises';
import path from 'node:path';

import { cosmiconfig } from 'cosmiconfig';
import { z } from 'zod';

import { TARGETS } from './types.js';
import { toPosixPath } from '../utils/paths.js';

/**
 * Resolve every symlink encountered along `p`, even if the final segment (or
 * some prefix) doesn't exist yet. We can't call `fs.realpath` directly because
 * it requires every segment to exist. Instead, walk upward until we find a
 * segment that does exist, `realpath` that prefix, then re-attach the rest.
 *
 * This is used for the symlink-containment check on `workflowsDir`: the
 * configured directory may not exist when the config loads (think `ghau` on a
 * fresh checkout), but if any ancestor IS a symlink, we must still detect that
 * the effective destination is outside the config tree.
 */
async function realPathOfExistingPrefix(p: string): Promise<string> {
  try {
    return await fs.realpath(p);
  } catch {
    const parent = path.dirname(p);
    /* c8 ignore next — defensive: the recursion bottoms out before reaching the FS root in practice. */
    if (parent === p) return p;
    const realParent = await realPathOfExistingPrefix(parent);
    return path.join(realParent, path.basename(p));
  }
}

/**
 * Cross-platform POSIX normalization for paths embedded in user-facing error
 * messages. Unlike `toPosixPath` (which only swaps the native separator), this
 * unconditionally swaps backslashes so a Windows-form value (`C:\wf`,
 * `\\server\share`) rejected on a POSIX runner still prints with forward
 * slashes. The error is a portability signal, not a render of an on-disk
 * path — backslash-leaking the value would re-add confusion the loader is
 * explicitly trying to prevent.
 */
function normalizeForMessage(p: string): string {
  return p.replaceAll('\\', '/');
}

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

  // Validate + resolve `workflowsDir` from config.
  //
  // The threat model: a `.ghaurc.json` is repository-controlled, which means
  // it can be modified by anyone who can land a PR. If the schema accepted
  // arbitrary paths, an attacker-controlled config could steer the scanner
  // (and, with `--write`, the YAML rewriter) outside the repo — e.g.
  // `workflowsDir: "/etc/something"`, `workflowsDir: "../../escape"`, or a
  // value pointing at a symlink that resolves outside the repo.
  //
  // Containment rule: config-provided `workflowsDir` MUST be a relative path
  // that, when resolved against the config file's directory AND with all
  // symlinks fully resolved, stays inside that directory tree. Absolute
  // paths, `..`-escaping paths, AND symlink-escaping paths are rejected.
  // Callers who need an absolute path can still pass it explicitly via the
  // CLI's `--workflows` flag (which is an explicit operator choice, not a
  // checked-in config).
  //
  // The other config keys are not paths and don't need this check.
  const config: GhauConfig = parsed.data;
  if (config.workflowsDir !== undefined) {
    const configDir = path.dirname(result.filepath);

    // Three pre-resolve checks plus two post-resolve checks, in this order.
    // None is redundant; each catches a class the others miss:
    //
    //   (1) `path.isAbsolute` (native) catches absolutes for the platform
    //       we're running on. On POSIX that's `/foo`; on Windows that's
    //       `C:\foo`, `\foo`, `\\server\share`, etc.
    //   (2) `path.win32.isAbsolute` catches Windows absolutes even when
    //       we're running on POSIX. A checked-in config could be opened
    //       on Linux (where the native check would miss `\\server\share`)
    //       and the resulting `path.resolve` would treat the value as a
    //       literal dirname — not an escape on POSIX, but the same config
    //       file is meant to be portable, and the same value would be a
    //       real escape if anyone ran the project on Windows. Reject it
    //       up front so the configs are platform-invariant.
    //   (3) `/^[A-Za-z]:/` catches Windows drive-RELATIVE paths (`C:foo`,
    //       `D:foo`), which neither absolute check returns `true` for
    //       despite being drive-qualified — `path.resolve` would then
    //       resolve them against the current working dir on the named
    //       drive, landing outside the config tree. Same portability
    //       reasoning: rejected even on POSIX.
    //   (4) After lexical resolve, the relative-path check catches
    //       `..`-escape AND the case where the resolved path landed on a
    //       different drive (Windows): `path.relative` returns an
    //       absolute string when there's no relative way to express the
    //       link between two paths on different roots.
    //   (5) After symlink resolve (`realpath` on the deepest existing
    //       prefix), the same relative-path check catches the case where
    //       `workflowsDir` points at a symlink inside the config tree
    //       whose target lands outside. The scanner and writer follow
    //       symlinks via normal `readdir`/`readFile`/write calls, so
    //       without this check a repo-controlled `ln -s ../../secrets wf`
    //       + `workflowsDir: wf` would let `--write` rewrite files
    //       outside the repo even though the lexical check passes.
    if (
      path.isAbsolute(config.workflowsDir) ||
      path.win32.isAbsolute(config.workflowsDir) ||
      /^[A-Za-z]:/.test(config.workflowsDir)
    ) {
      throw new Error(
        `Invalid ghau config in ${toPosixPath(result.filepath)}:\n` +
          `  workflowsDir: must be a path relative to the config file's directory; ` +
          `got '${normalizeForMessage(config.workflowsDir)}'. ` +
          `Use the --workflows CLI flag if you really need to point at an absolute path.`,
      );
    }
    const resolved = path.resolve(configDir, config.workflowsDir);
    const relative = path.relative(configDir, resolved);
    if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
      throw new Error(
        `Invalid ghau config in ${toPosixPath(result.filepath)}:\n` +
          `  workflowsDir: '${normalizeForMessage(config.workflowsDir)}' resolves outside the config file's directory ` +
          `(${toPosixPath(resolved)}). Repo configs may only point at directories inside the repo.`,
      );
    }

    // Symlink containment: also check the realpath. The lexical check above
    // can't see through a symlink-pointing-outside, but `fs.realpath` does.
    // We compute the "effective" realpath even when the target dir doesn't
    // exist yet (see `realPathOfExistingPrefix`) so a fresh checkout still
    // gets the safety guarantee, and we realpath `configDir` too so a repo
    // that lives behind its own symlink doesn't false-positive.
    const configRealDir = await realPathOfExistingPrefix(configDir);
    const resolvedReal = await realPathOfExistingPrefix(resolved);
    const realRelative = path.relative(configRealDir, resolvedReal);
    if (
      realRelative === '..' ||
      realRelative.startsWith('..' + path.sep) ||
      path.isAbsolute(realRelative)
    ) {
      throw new Error(
        `Invalid ghau config in ${toPosixPath(result.filepath)}:\n` +
          `  workflowsDir: '${normalizeForMessage(config.workflowsDir)}' resolves through a symlink to ` +
          `${toPosixPath(resolvedReal)}, which is outside the config file's directory ` +
          `(${toPosixPath(configRealDir)}). Repo configs may only point at directories inside the repo; ` +
          `remove the offending symlink or pass --workflows on the CLI for an explicit absolute path.`,
      );
    }
    config.workflowsDir = resolved;
  }

  return { config, filepath: result.filepath };
}
