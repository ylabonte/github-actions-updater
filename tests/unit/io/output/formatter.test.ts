import { describe, expect, it } from 'vitest';

import {
  formatLevel,
  formatSummary,
  formatVersion,
  summarize,
} from '../../../../src/io/output/formatter.js';
import type { Resolution } from '../../../../src/core/types.js';
import { makeReference } from '../../../helpers/fixtures.js';

const res = (overrides: Partial<Resolution> = {}): Resolution => ({
  reference: makeReference('actions/checkout@v4'),
  current: 'v4',
  latest: 'v4.1.0',
  level: 'minor',
  outdated: true,
  ...overrides,
});

describe('formatLevel', () => {
  it('returns empty for none without color', () => {
    expect(formatLevel('none', { color: false })).toBe('');
  });
  it('returns label for non-none without color', () => {
    expect(formatLevel('major', { color: false })).toBe('major');
    expect(formatLevel('mutable', { color: false })).toBe('mutable');
  });
  it('returns colored output with color enabled', () => {
    expect(formatLevel('major', { color: true })).toContain('major');
    expect(formatLevel('minor', { color: true })).toContain('minor');
    expect(formatLevel('patch', { color: true })).toContain('patch');
    expect(formatLevel('mutable', { color: true })).toContain('mutable');
    expect(formatLevel('none', { color: true })).toBe('');
  });
});

describe('formatVersion', () => {
  it('renders dash for null', () => {
    expect(formatVersion(null, 'none', { color: false })).toBe('—');
  });
  it('returns plain value without color', () => {
    expect(formatVersion('v1.0', 'minor', { color: false })).toBe('v1.0');
  });
  it('returns colored value', () => {
    expect(formatVersion('v1.0', 'major', { color: true })).toContain('v1.0');
    expect(formatVersion('v1.0', 'patch', { color: true })).toContain('v1.0');
    expect(formatVersion('v1.0', 'mutable', { color: true })).toContain('v1.0');
    expect(formatVersion('v1.0', 'none', { color: true })).toContain('v1.0');
  });
});

describe('summarize', () => {
  it('counts outdated, current, and errors', () => {
    const r = [
      res({ outdated: true }),
      res({ outdated: false, level: 'none' }),
      res({ error: 'rate limited' }),
    ];
    expect(summarize(r)).toEqual({ outdated: 1, current: 1, errors: 1, workflows: 1 });
  });

  it('handles empty', () => {
    expect(summarize([])).toEqual({ outdated: 0, current: 0, errors: 0, workflows: 0 });
  });
});

describe('formatSummary', () => {
  it('reports outdated and errors', () => {
    const s = formatSummary([res({ outdated: true }), res({ error: 'x' })], { color: false });
    expect(s).toContain('1 outdated');
    expect(s).toContain('1 errors');
    expect(s).toContain('workflow');
  });

  it('pluralizes correctly', () => {
    const ref2 = makeReference('actions/setup-node@v4', { file: '/tmp/other.yml' });
    const s = formatSummary([res(), { ...res(), reference: ref2 }], { color: false });
    expect(s).toContain('workflows');
  });

  it('produces colored output when enabled', () => {
    const s = formatSummary([res()], { color: true });
    expect(s.length).toBeGreaterThan(0);
  });
});
