import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { scanWorkflows } from '../../../src/core/scanner.js';

describe('scanWorkflows', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'ghau-test-'));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('returns empty array when .github/workflows is missing', async () => {
    const files = await scanWorkflows({ cwd });
    expect(files).toEqual([]);
  });

  it('finds .yml and .yaml files, skips others', async () => {
    const wf = join(cwd, '.github', 'workflows');
    await mkdir(wf, { recursive: true });
    await writeFile(join(wf, 'ci.yml'), 'name: ci\n');
    await writeFile(join(wf, 'release.yaml'), 'name: release\n');
    await writeFile(join(wf, 'README.md'), '# not a workflow\n');

    const files = await scanWorkflows({ cwd });
    expect(files.map((f) => f.relativePath).toSorted()).toEqual([
      '.github/workflows/ci.yml',
      '.github/workflows/release.yaml',
    ]);
  });

  it('honors workflowsDir override', async () => {
    const custom = join(cwd, 'custom');
    await mkdir(custom, { recursive: true });
    await writeFile(join(custom, 'a.yml'), 'name: a\n');
    const files = await scanWorkflows({ cwd, workflowsDir: custom });
    expect(files).toHaveLength(1);
  });

  it('returns sorted output', async () => {
    const wf = join(cwd, '.github', 'workflows');
    await mkdir(wf, { recursive: true });
    await writeFile(join(wf, 'z.yml'), '');
    await writeFile(join(wf, 'a.yml'), '');
    await writeFile(join(wf, 'm.yml'), '');
    const files = await scanWorkflows({ cwd });
    expect(files.map((f) => f.relativePath)).toEqual([
      '.github/workflows/a.yml',
      '.github/workflows/m.yml',
      '.github/workflows/z.yml',
    ]);
  });

  it('returns POSIX-style relativePath on all platforms', async () => {
    const wf = join(cwd, '.github', 'workflows');
    await mkdir(wf, { recursive: true });
    await writeFile(join(wf, 'a.yml'), '');
    const files = await scanWorkflows({ cwd });
    expect(files[0]?.relativePath).toBe('.github/workflows/a.yml');
    expect(files[0]?.relativePath).not.toContain('\\');
  });

  it('skips subdirectories', async () => {
    const wf = join(cwd, '.github', 'workflows');
    await mkdir(join(wf, 'subdir'), { recursive: true });
    await writeFile(join(wf, 'a.yml'), 'name: a\n');
    await writeFile(join(wf, 'subdir', 'b.yml'), 'name: b\n');
    const files = await scanWorkflows({ cwd });
    expect(files.map((f) => f.relativePath)).toEqual(['.github/workflows/a.yml']);
  });
});
