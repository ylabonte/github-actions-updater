import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseWorkflow } from '../../../src/core/parser.js';
import { rewriteContent, writeWorkflow } from '../../../src/io/yaml-writer.js';
import type { Replacement } from '../../../src/io/yaml-writer.js';

const workflow = (content: string) => ({
  path: '/tmp/x.yml',
  relativePath: 'x.yml',
  content,
});

describe('rewriteContent', () => {
  it('returns content unchanged when no replacements', () => {
    const original = 'jobs:\n  x:\n    steps: []\n';
    expect(rewriteContent(original, []).content).toBe(original);
  });

  it('replaces a single tag in place, preserving surrounding text', () => {
    const original = [
      'jobs:',
      '  x:',
      '    steps:',
      '      - uses: actions/checkout@v3',
      '        with:',
      '          foo: bar',
      '',
    ].join('\n');
    const refs = parseWorkflow(workflow(original));
    const replacement: Replacement = {
      reference: refs[0]!,
      newValue: 'actions/checkout@v4',
    };
    const { content, changes } = rewriteContent(original, [replacement]);
    expect(changes).toBe(1);
    expect(content).toContain('actions/checkout@v4');
    expect(content).toContain('foo: bar');
  });

  it('replaces SHA and trailing comment together', () => {
    const original = [
      'jobs:',
      '  x:',
      '    steps:',
      '      - uses: actions/checkout@aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111 # v3.0.0',
      '',
    ].join('\n');
    const refs = parseWorkflow(workflow(original));
    const replacement: Replacement = {
      reference: refs[0]!,
      newValue: 'actions/checkout@bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222',
      newComment: 'v4.0.0',
    };
    const { content } = rewriteContent(original, [replacement]);
    expect(content).toContain('actions/checkout@bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222');
    expect(content).toContain('# v4.0.0');
    expect(content).not.toContain('v3.0.0');
  });

  it('applies multiple replacements in reverse order to preserve offsets', () => {
    const original = [
      'jobs:',
      '  x:',
      '    steps:',
      '      - uses: actions/checkout@v3',
      '      - uses: actions/setup-node@v3',
      '',
    ].join('\n');
    const refs = parseWorkflow(workflow(original));
    const { content, changes } = rewriteContent(original, [
      { reference: refs[0]!, newValue: 'actions/checkout@v4' },
      { reference: refs[1]!, newValue: 'actions/setup-node@v4' },
    ]);
    expect(changes).toBe(2);
    expect(content).toContain('actions/checkout@v4');
    expect(content).toContain('actions/setup-node@v4');
  });

  it('persists changes to disk via writeWorkflow', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gau-write-'));
    try {
      const file = join(dir, 'wf.yml');
      await writeFile(file, 'name: t\n');
      await writeWorkflow(file, 'name: u\n');
      expect(await readFile(file, 'utf8')).toBe('name: u\n');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
