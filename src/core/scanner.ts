import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { toPosixPath } from '../utils/paths.js';

export interface WorkflowFile {
  readonly path: string; // absolute
  readonly relativePath: string; // relative to cwd
  readonly content: string;
}

export interface ScanOptions {
  /** Directory to scan. Default: `<cwd>/.github/workflows`. */
  readonly workflowsDir?: string;
  /** Working directory used to compute `relativePath` and resolve defaults. */
  readonly cwd?: string;
}

/**
 * Locate workflow files. Returns files directly under `.github/workflows/` matching `*.yml`
 * or `*.yaml`. Local composite-action files under `.github/actions/` are intentionally
 * excluded — those are not "remote" references the tool can update.
 */
export async function scanWorkflows(options: ScanOptions = {}): Promise<WorkflowFile[]> {
  const cwd = options.cwd ?? process.cwd();
  const workflowsDir = options.workflowsDir ?? path.join(cwd, '.github', 'workflows');

  let entries: string[];
  try {
    entries = await readdir(workflowsDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }

  const files: WorkflowFile[] = [];
  for (const name of entries) {
    if (!name.endsWith('.yml') && !name.endsWith('.yaml')) continue;
    const abs = path.resolve(workflowsDir, name);
    const s = await stat(abs);
    if (!s.isFile()) continue;
    const content = await readFile(abs, 'utf8');
    files.push({
      path: abs,
      relativePath: toPosixPath(path.relative(cwd, abs)),
      content,
    });
  }

  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return files;
}
