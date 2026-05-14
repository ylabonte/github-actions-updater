import { execFile, spawn } from 'node:child_process';
import { mkdtemp, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import type { Resolution } from '../core/types.js';
import type { ShaResolution } from '../core/resolver/sha-resolver.js';

const execFileAsync = promisify(execFile);

export interface CommitOptions {
  readonly cwd?: string;
  /**
   * Override the `git commit` spawn for testing. Receives the args and cwd, returns the
   * exit code. Defaults to the real inherited-stdio spawn so the user's editor opens.
   * @internal
   */
  readonly spawnCommit?: (args: readonly string[], cwd: string) => Promise<number>;
}

export interface CommitResult {
  readonly committed: boolean;
  /** Populated when committed is false — explains why. Empty when committed succeeded. */
  readonly reason?: string;
}

/**
 * Open `git commit -v -t <template>` with a pre-filled message describing the applied
 * updates. The user's editor opens; they save to commit or leave the message empty to
 * abort. The template includes a one-line summary followed by a bullet per action.
 *
 * Caller is responsible for ensuring `applied` contains only resolutions whose workflow
 * file was actually rewritten. Files are staged with `git add -- <files>` before commit.
 */
export async function commitUpdates(
  applied: readonly Resolution[],
  options: CommitOptions = {},
): Promise<CommitResult> {
  if (applied.length === 0) {
    return { committed: false, reason: 'no updates to commit' };
  }

  const cwd = options.cwd ?? process.cwd();

  if (!(await isGitRepo(cwd))) {
    return { committed: false, reason: 'not inside a git repository' };
  }

  const files = uniqueFiles(applied);
  /* c8 ignore next 3 — defensive: unreachable because every Resolution carries a file path. */
  if (files.length === 0) {
    return { committed: false, reason: 'no files to stage' };
  }

  const template = buildCommitMessage(applied);
  const tempDir = await mkdtemp(path.join(tmpdir(), 'gau-commit-'));
  const templatePath = path.join(tempDir, 'COMMIT_EDITMSG');

  try {
    await writeFile(templatePath, template, 'utf8');
    await execFileAsync('git', ['add', '--', ...files], { cwd });
    const spawnFn = options.spawnCommit ?? spawnGitCommit;
    // `-F <file>` seeds the message; `-e` forces the editor open for review; `-v` shows the
    // staged diff alongside. Crucially this is NOT `-t` (template): with `-t`, git aborts
    // if the buffer matches the seed text verbatim, which broke the common "accept the
    // prefilled message" flow. With `-F -e` git commits whatever the user saves, including
    // the unchanged seed.
    const code = await spawnFn(['commit', '-v', '-e', '-F', templatePath], cwd);
    if (code === 0) return { committed: true };
    return { committed: false, reason: `git commit exited with code ${code}` };
  } finally {
    await unlink(templatePath).catch(() => {
      /* ignore */
    });
  }
}

/**
 * Build the commit template body. Pure function — no I/O, easy to test.
 *
 * Format:
 *
 *   chore(deps): update <N> GitHub Action[s]
 *
 *   - owner/repo: v3 → v4.2.0
 *   - owner/other: pinned v3.0.0 → v5.0.5
 *
 *   # (footer with usage hints, stripped by git when committing)
 *
 * SHA-pinned entries show the version delta from the comment rather than raw SHAs because
 * the SHAs are noisy and the version is what humans care about.
 */
export function buildCommitMessage(applied: readonly Resolution[]): string {
  const lines: string[] = [];
  const headline =
    applied.length === 1
      ? singleHeadline(firstResolution(applied))
      : `chore(deps): update GitHub Actions (${applied.length} updates)`;
  lines.push(headline, '');

  for (const r of applied) {
    lines.push(`- ${entryLine(r)}`);
  }

  lines.push(
    '',
    '# Prepared by github-actions-updater (gau).',
    '# Edit this message as you like, then save and close to commit.',
    '# Leave the message empty (or delete all non-# lines) to abort the commit.',
    '',
  );
  return lines.join('\n');
}

function singleHeadline(r: Resolution): string {
  const name = actionName(r);
  return `chore(deps): update ${name} from ${r.current} to ${r.latest ?? '?'}`;
}

function firstResolution(applied: readonly Resolution[]): Resolution {
  const first = applied[0];
  if (!first) throw new Error('buildCommitMessage: empty applied list');
  return first;
}

function entryLine(r: Resolution): string {
  const name = actionName(r);
  const kind = r.reference.parsed.kind;
  if (kind === 'sha-pinned') {
    const sha = (r as ShaResolution).latestSha;
    const shaTail = sha ? ` (→ ${sha.slice(0, 7)})` : '';
    return `${name}: pinned ${r.current} → ${r.latest ?? '?'}${shaTail}`;
  }
  return `${name}: ${r.current} → ${r.latest ?? '?'}`;
}

function actionName(r: Resolution): string {
  const p = r.reference.parsed;
  switch (p.kind) {
    case 'tag':
    case 'sha-pinned':
    case 'branch': {
      return p.subpath ? `${p.owner}/${p.repo}/${p.subpath}` : `${p.owner}/${p.repo}`;
    }
    case 'docker': {
      return `docker://${p.image}`;
    }
    /* c8 ignore next 3 — local refs are filtered before reaching the commit path. */
    case 'local': {
      return p.path;
    }
  }
}

function uniqueFiles(applied: readonly Resolution[]): string[] {
  const seen = new Set<string>();
  for (const r of applied) seen.add(r.reference.location.file);
  return [...seen];
}

async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['rev-parse', '--git-dir'], { cwd });
    return true;
  } catch {
    return false;
  }
}

/**
 * Spawn `git commit` with inherited stdio so the user's editor and `-v` diff display work
 * as expected. Resolves with the child's exit code.
 *
 * Inputs are all internal constants except for the template path (which we created above in
 * a tmpdir we own) and the cwd. No injection surface.
 *
 * Coverage is excluded because exercising the editor flow requires an interactive TTY.
 */
/* c8 ignore start */
function spawnGitCommit(args: readonly string[], cwd: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn('git', [...args], { cwd, stdio: 'inherit' });
    child.on('close', (code) => {
      resolve(code ?? 0);
    });
  });
}
/* c8 ignore stop */
