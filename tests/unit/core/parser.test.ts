import { describe, expect, it } from 'vitest';

import { parseWorkflow, WorkflowParseError } from '../../../src/core/parser.js';

const wf = (content: string) => ({
  path: '/tmp/x.yml',
  relativePath: 'x.yml',
  content,
});

describe('parseWorkflow', () => {
  it('extracts uses references with source locations', () => {
    const content = [
      'name: test',
      'on: [push]',
      'jobs:',
      '  build:',
      '    runs-on: ubuntu-latest',
      '    steps:',
      '      - uses: actions/checkout@v4',
      '      - name: Setup',
      '        uses: actions/setup-node@v4.1.0',
      '',
    ].join('\n');
    const refs = parseWorkflow(wf(content));
    expect(refs).toHaveLength(2);
    expect(refs[0]?.parsed.kind).toBe('tag');
    expect(refs[0]?.location.line).toBe(7);
    expect(refs[1]?.location.line).toBe(9);
  });

  it('skips local action refs in `kind: local` form but does not error', () => {
    const content = [
      'jobs:',
      '  x:',
      '    steps:',
      '      - uses: ./.github/actions/build',
      '      - uses: actions/cache@v3',
      '',
    ].join('\n');
    const refs = parseWorkflow(wf(content));
    expect(refs).toHaveLength(2);
    expect(refs[0]?.parsed.kind).toBe('local');
    expect(refs[1]?.parsed.kind).toBe('tag');
  });

  it('captures inline trailing comments for SHA-pinned refs', () => {
    const content = [
      'jobs:',
      '  x:',
      '    steps:',
      '      - uses: actions/checkout@a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0 # v4.1.1',
      '',
    ].join('\n');
    const refs = parseWorkflow(wf(content));
    expect(refs[0]?.parsed).toMatchObject({
      kind: 'sha-pinned',
      comment: 'v4.1.1',
    });
  });

  it('returns empty when no uses present', () => {
    const content = 'name: empty\non: push\njobs:\n  a:\n    runs-on: ubuntu-latest\n';
    const refs = parseWorkflow(wf(content));
    expect(refs).toEqual([]);
  });

  it('throws WorkflowParseError on invalid YAML', () => {
    expect(() => parseWorkflow(wf('jobs:\n  - [\n'))).toThrow(WorkflowParseError);
  });

  it('handles empty content', () => {
    const refs = parseWorkflow(wf(''));
    expect(refs).toEqual([]);
  });

  it('captures correct byte offsets', () => {
    const content = 'jobs:\n  x:\n    steps:\n      - uses: actions/checkout@v4\n';
    const refs = parseWorkflow(wf(content));
    const r = refs[0]!;
    expect(content.slice(r.location.offset, r.location.endOffset)).toBe('actions/checkout@v4');
  });
});
