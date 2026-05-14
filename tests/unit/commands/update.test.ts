import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { applyUpdates } from '../../../src/commands/update.js';
import { parseWorkflow } from '../../../src/core/parser.js';
import type { Resolution } from '../../../src/core/types.js';
import type { ShaResolution } from '../../../src/core/resolver/sha-resolver.js';

describe('applyUpdates', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'ghau-update-'));
    await mkdir(join(cwd, 'wf'), { recursive: true });
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('rewrites a tag ref on disk', async () => {
    const file = join(cwd, 'wf', 'ci.yml');
    const original = 'jobs:\n  x:\n    steps:\n      - uses: actions/checkout@v3\n';
    await writeFile(file, original);
    const refs = parseWorkflow({ path: file, relativePath: 'ci.yml', content: original });
    const resolution: Resolution = {
      reference: refs[0]!,
      current: 'v3',
      latest: 'v4',
      level: 'major',
      outdated: true,
    };
    const outcome = await applyUpdates([resolution]);
    expect(outcome.files).toEqual([{ file, changes: 1 }]);
    expect(outcome.applied).toHaveLength(1);
    expect(outcome.applied[0]?.reference).toBe(refs[0]);
    expect(await readFile(file, 'utf8')).toContain('actions/checkout@v4');
  });

  it('rewrites SHA + comment together', async () => {
    const file = join(cwd, 'wf', 'ci.yml');
    const original =
      'jobs:\n  x:\n    steps:\n      - uses: actions/checkout@aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111 # v3.0.0\n';
    await writeFile(file, original);
    const refs = parseWorkflow({ path: file, relativePath: 'ci.yml', content: original });
    const resolution: ShaResolution = {
      reference: refs[0]!,
      current: 'v3.0.0',
      latest: 'v4.0.0',
      level: 'major',
      outdated: true,
      latestSha: 'bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222',
      latestComment: 'v4.0.0',
    };
    await applyUpdates([resolution]);
    const written = await readFile(file, 'utf8');
    expect(written).toContain('bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222');
    expect(written).toContain('# v4.0.0');
  });

  it('skips entries that are not outdated', async () => {
    const file = join(cwd, 'wf', 'ci.yml');
    const original = 'jobs:\n  x:\n    steps:\n      - uses: actions/checkout@v3\n';
    await writeFile(file, original);
    const refs = parseWorkflow({ path: file, relativePath: 'ci.yml', content: original });
    const r: Resolution = {
      reference: refs[0]!,
      current: 'v3',
      latest: 'v3',
      level: 'none',
      outdated: false,
    };
    const outcome = await applyUpdates([r]);
    expect(outcome.files).toEqual([]);
    expect(outcome.applied).toEqual([]);
  });

  it('skips branch refs by default', async () => {
    const file = join(cwd, 'wf', 'ci.yml');
    const original = 'jobs:\n  x:\n    steps:\n      - uses: actions/checkout@main\n';
    await writeFile(file, original);
    const refs = parseWorkflow({ path: file, relativePath: 'ci.yml', content: original });
    const r: Resolution = {
      reference: refs[0]!,
      current: 'main',
      latest: 'main @ abc1234',
      level: 'mutable',
      outdated: true,
    };
    const outcome = await applyUpdates([r]);
    expect(outcome.files).toEqual([]);
  });

  it('returns no replacement when latest is null', async () => {
    const file = join(cwd, 'wf', 'ci.yml');
    const original = 'jobs:\n  x:\n    steps:\n      - uses: actions/checkout@v3\n';
    await writeFile(file, original);
    const refs = parseWorkflow({ path: file, relativePath: 'ci.yml', content: original });
    const r: Resolution = {
      reference: refs[0]!,
      current: 'v3',
      latest: null,
      level: 'none',
      outdated: true, // intentionally inconsistent — buildReplacement should still bail on null latest
    };
    const outcome = await applyUpdates([r]);
    expect(outcome.files).toEqual([]);
  });

  it('returns no replacement for SHA when latestSha is null', async () => {
    const file = join(cwd, 'wf', 'ci.yml');
    const original =
      'jobs:\n  x:\n    steps:\n      - uses: actions/checkout@aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111 # v3.0.0\n';
    await writeFile(file, original);
    const refs = parseWorkflow({ path: file, relativePath: 'ci.yml', content: original });
    const r: ShaResolution = {
      reference: refs[0]!,
      current: 'v3.0.0',
      latest: 'v4.0.0',
      level: 'major',
      outdated: true,
      latestSha: null,
      latestComment: 'v4.0.0',
    };
    const outcome = await applyUpdates([r]);
    expect(outcome.files).toEqual([]);
  });

  it('skips branch refs when allowBranchPin is false (explicit option)', async () => {
    const file = join(cwd, 'wf', 'ci.yml');
    const original = 'jobs:\n  x:\n    steps:\n      - uses: actions/checkout@main\n';
    await writeFile(file, original);
    const refs = parseWorkflow({ path: file, relativePath: 'ci.yml', content: original });
    const r: Resolution = {
      reference: refs[0]!,
      current: 'main',
      latest: 'sha-xyz',
      level: 'mutable',
      outdated: true,
    };
    const outcome = await applyUpdates([r], { allowBranchPin: false });
    expect(outcome.files).toEqual([]);
    expect(outcome.applied).toEqual([]);
  });

  it('rewrites docker image tag', async () => {
    const file = join(cwd, 'wf', 'ci.yml');
    const original = 'jobs:\n  x:\n    steps:\n      - uses: docker://node:20\n';
    await writeFile(file, original);
    const refs = parseWorkflow({ path: file, relativePath: 'ci.yml', content: original });
    const r: Resolution = {
      reference: refs[0]!,
      current: '20',
      latest: '21',
      level: 'major',
      outdated: true,
    };
    await applyUpdates([r]);
    expect(await readFile(file, 'utf8')).toContain('docker://node:21');
  });
});
