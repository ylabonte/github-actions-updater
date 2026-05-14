import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildCommitMessage, commitUpdates } from '../../../src/commands/git-commit.js';
import type { Resolution } from '../../../src/core/types.js';
import type { ShaResolution } from '../../../src/core/resolver/sha-resolver.js';
import { makeReference } from '../../helpers/fixtures.js';

const run = promisify(execFile);

const tagRes = (raw: string, current: string, latest: string): Resolution => ({
  reference: makeReference(raw),
  current,
  latest,
  level: 'minor',
  outdated: true,
});

describe('buildCommitMessage', () => {
  it('uses a single-action headline when there is exactly one update', () => {
    const msg = buildCommitMessage([tagRes('actions/checkout@v3', 'v3', 'v4.2.0')]);
    expect(msg.split('\n')[0]).toBe('chore(deps): update actions/checkout from v3 to v4.2.0');
  });

  it('uses a grouped headline when there are multiple updates', () => {
    const msg = buildCommitMessage([
      tagRes('actions/checkout@v3', 'v3', 'v4.2.0'),
      tagRes('actions/setup-node@v3.8.2', 'v3.8.2', 'v4.0.4'),
    ]);
    expect(msg.split('\n')[0]).toBe('chore(deps): update GitHub Actions (2 updates)');
  });

  it('lists one bullet per applied resolution', () => {
    const msg = buildCommitMessage([
      tagRes('actions/checkout@v3', 'v3', 'v4.2.0'),
      tagRes('actions/setup-node@v3.8.2', 'v3.8.2', 'v4.0.4'),
    ]);
    expect(msg).toContain('- actions/checkout: v3 → v4.2.0');
    expect(msg).toContain('- actions/setup-node: v3.8.2 → v4.0.4');
  });

  it('renders SHA-pinned entries with short-SHA tail and pinned marker', () => {
    const ref = makeReference('actions/checkout@aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111 # v3.0.0');
    const r: ShaResolution = {
      reference: ref,
      current: 'v3.0.0',
      latest: 'v4.0.0',
      level: 'major',
      outdated: true,
      latestSha: 'bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222',
      latestComment: 'v4.0.0',
    };
    const msg = buildCommitMessage([r]);
    expect(msg).toContain('actions/checkout: pinned v3.0.0 → v4.0.0');
    expect(msg).toContain('bbbb222');
  });

  it('renders docker entries with full docker:// prefix', () => {
    const ref = makeReference('docker://node:20');
    const r: Resolution = {
      reference: ref,
      current: '20',
      latest: '21',
      level: 'major',
      outdated: true,
    };
    expect(buildCommitMessage([r])).toContain('- docker://node: 20 → 21');
  });

  it('keeps comment lines starting with `#` so git strips them on commit', () => {
    const msg = buildCommitMessage([tagRes('actions/checkout@v3', 'v3', 'v4')]);
    const commentLines = msg.split('\n').filter((l) => l.startsWith('#'));
    expect(commentLines.length).toBeGreaterThan(0);
    expect(commentLines.join(' ')).toContain('github-actions-updater');
  });
});

describe('commitUpdates (no-op paths)', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'gau-commit-test-'));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('returns reason when applied is empty', async () => {
    const result = await commitUpdates([], { cwd });
    expect(result.committed).toBe(false);
    expect(result.reason).toMatch(/no updates/);
  });

  it('returns reason when not inside a git repository', async () => {
    // tmpdir is not a git repo.
    const result = await commitUpdates([tagRes('actions/checkout@v3', 'v3', 'v4')], { cwd });
    expect(result.committed).toBe(false);
    expect(result.reason).toMatch(/git/);
  });

  it('stages files and reports success when the injected spawn returns 0', async () => {
    await run('git', ['init', '-b', 'main', '--quiet', cwd], { cwd });
    await run('git', ['config', 'user.email', 'test@example.com'], { cwd });
    await run('git', ['config', 'user.name', 'Test'], { cwd });
    await mkdir(path.join(cwd, 'wf'), { recursive: true });
    const file = path.join(cwd, 'wf', 'ci.yml');
    await writeFile(file, 'jobs:\n  x:\n    steps:\n      - uses: actions/checkout@v4.2.0\n');

    const resolution: Resolution = {
      reference: {
        ...makeReference('actions/checkout@v3'),
        location: { file, line: 1, column: 1, offset: 0, endOffset: 0 },
      },
      current: 'v3',
      latest: 'v4',
      level: 'major',
      outdated: true,
    };

    let capturedArgs: readonly string[] | undefined;
    const result = await commitUpdates([resolution], {
      cwd,
      spawnCommit: async (args) => {
        capturedArgs = args;
        return 0;
      },
    });

    expect(result.committed).toBe(true);
    expect(capturedArgs?.slice(0, 4)).toEqual(['commit', '-v', '-e', '-F']);
    // The seed file passed via -F lives under our tmpdir.
    const seedArg = capturedArgs?.[4];
    expect(seedArg?.includes('gau-commit-')).toBe(true);

    // Staged file should appear in the index. Git emits POSIX-style paths on every platform,
    // so we normalize our expectation through path.relative + replace.
    const { stdout: staged } = await run('git', ['diff', '--cached', '--name-only', '--', file], {
      cwd,
    });
    const expected = path.relative(cwd, file).split(path.sep).join('/');
    expect(staged.trim()).toBe(expected);
  });

  it('reports non-zero exit code from injected spawn', async () => {
    await run('git', ['init', '-b', 'main', '--quiet', cwd], { cwd });
    await run('git', ['config', 'user.email', 'test@example.com'], { cwd });
    await run('git', ['config', 'user.name', 'Test'], { cwd });
    await mkdir(path.join(cwd, 'wf'), { recursive: true });
    const file = path.join(cwd, 'wf', 'ci.yml');
    await writeFile(file, 'jobs:\n  x:\n    steps:\n      - uses: actions/checkout@v4.2.0\n');

    const resolution: Resolution = {
      reference: {
        ...makeReference('actions/checkout@v3'),
        location: { file, line: 1, column: 1, offset: 0, endOffset: 0 },
      },
      current: 'v3',
      latest: 'v4',
      level: 'major',
      outdated: true,
    };

    const result = await commitUpdates([resolution], {
      cwd,
      spawnCommit: async () => 130,
    });
    expect(result.committed).toBe(false);
    expect(result.reason).toMatch(/130/);
  });
});
