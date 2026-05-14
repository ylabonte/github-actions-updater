import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseWorkflow } from '../../../src/core/parser.js';
import type { Resolution } from '../../../src/core/types.js';

const clackState = {
  selectionResult: [] as Resolution[] | symbol,
  cancelSymbol: Symbol('cancel'),
};

vi.mock('@clack/prompts', () => {
  return {
    intro: vi.fn(),
    outro: vi.fn(),
    isCancel: (value: unknown) => value === clackState.cancelSymbol,
    multiselect: vi.fn(async () => clackState.selectionResult),
  };
});

const { runInteractive } = await import('../../../src/commands/interactive.js');

describe('runInteractive', () => {
  let cwd: string;
  let file: string;
  let refs: Awaited<ReturnType<typeof parseWorkflow>>;
  const original = 'jobs:\n  x:\n    steps:\n      - uses: actions/checkout@v3\n';

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'gau-interactive-'));
    await mkdir(join(cwd, 'wf'), { recursive: true });
    file = join(cwd, 'wf', 'ci.yml');
    await writeFile(file, original);
    refs = parseWorkflow({ path: file, relativePath: 'ci.yml', content: original });
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('returns empty list when no outdated entries', async () => {
    const result = await runInteractive([], {});
    expect(result).toEqual([]);
  });

  it('applies user selection', async () => {
    const r: Resolution = {
      reference: refs[0]!,
      current: 'v3',
      latest: 'v4',
      level: 'major',
      outdated: true,
    };
    clackState.selectionResult = [r];
    const result = await runInteractive([r], {});
    expect(result).toHaveLength(1);
    expect(await readFile(file, 'utf8')).toContain('actions/checkout@v4');
  });

  it('returns empty list when user cancels', async () => {
    const r: Resolution = {
      reference: refs[0]!,
      current: 'v3',
      latest: 'v4',
      level: 'major',
      outdated: true,
    };
    clackState.selectionResult = clackState.cancelSymbol;
    const result = await runInteractive([r], {});
    expect(result).toEqual([]);
    expect(await readFile(file, 'utf8')).toBe(original);
  });

  it('returns empty list when user picks nothing', async () => {
    const r: Resolution = {
      reference: refs[0]!,
      current: 'v3',
      latest: 'v4',
      level: 'major',
      outdated: true,
    };
    clackState.selectionResult = [];
    const result = await runInteractive([r], {});
    expect(result).toEqual([]);
  });

  it('handles each ref kind in display label', async () => {
    // Build references of each ref kind to exercise the displayLabel switch.
    const dockerContent = 'jobs:\n  x:\n    steps:\n      - uses: docker://node:20\n';
    const localContent = 'jobs:\n  x:\n    steps:\n      - uses: ./.github/actions/build\n';
    const dockerFile = join(cwd, 'wf', 'docker.yml');
    const localFile = join(cwd, 'wf', 'local.yml');
    await writeFile(dockerFile, dockerContent);
    await writeFile(localFile, localContent);
    const dockerRefs = parseWorkflow({
      path: dockerFile,
      relativePath: 'docker.yml',
      content: dockerContent,
    });
    const localRefs = parseWorkflow({
      path: localFile,
      relativePath: 'local.yml',
      content: localContent,
    });

    const resolutions: Resolution[] = [
      { reference: refs[0]!, current: 'v3', latest: 'v4', level: 'major', outdated: true },
      { reference: dockerRefs[0]!, current: '20', latest: '21', level: 'major', outdated: true },
      {
        reference: localRefs[0]!,
        current: './.github/actions/build',
        latest: 'x',
        level: 'minor',
        outdated: true,
      },
    ];
    clackState.selectionResult = [];
    const result = await runInteractive(resolutions, {});
    expect(result).toEqual([]);
  });
});
