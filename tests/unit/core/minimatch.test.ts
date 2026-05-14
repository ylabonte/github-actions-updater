import { describe, expect, it } from 'vitest';

import { minimatch } from '../../../src/core/minimatch.js';

describe('minimatch', () => {
  it('matches exact strings', () => {
    expect(minimatch('actions/checkout', 'actions/checkout')).toBe(true);
    expect(minimatch('actions/checkout', 'actions/cache')).toBe(false);
  });

  it('matches single-segment glob with *', () => {
    expect(minimatch('actions/checkout', 'actions/*')).toBe(true);
    expect(minimatch('actions/foo/bar', 'actions/*')).toBe(false);
  });

  it('matches across segments with **', () => {
    expect(minimatch('actions/foo/bar', 'actions/**')).toBe(true);
    expect(minimatch('actions/foo/bar/baz', '**')).toBe(true);
  });

  it('escapes regex metacharacters', () => {
    expect(minimatch('docker://node:20', 'docker://*')).toBe(true);
  });

  it('handles `?` as single non-slash char', () => {
    expect(minimatch('ab', 'a?')).toBe(true);
    expect(minimatch('a/b', 'a?b')).toBe(false);
  });
});
