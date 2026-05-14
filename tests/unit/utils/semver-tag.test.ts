import { describe, expect, it } from 'vitest';

import { isStable, parseTag } from '../../../src/utils/semver-tag.js';

describe('parseTag', () => {
  it('parses full semver with v-prefix', () => {
    const t = parseTag('v1.2.3');
    expect(t?.version.version).toBe('1.2.3');
    expect(t?.partial).toBe(false);
  });

  it('parses semver without v-prefix', () => {
    const t = parseTag('1.2.3');
    expect(t?.version.version).toBe('1.2.3');
    expect(t?.partial).toBe(false);
  });

  it('parses partial major-only tag', () => {
    const t = parseTag('v4');
    expect(t?.version.major).toBe(4);
    expect(t?.partial).toBe(true);
  });

  it('parses partial major.minor tag', () => {
    const t = parseTag('v4.1');
    expect(t?.version.major).toBe(4);
    expect(t?.version.minor).toBe(1);
    expect(t?.partial).toBe(true);
  });

  it('parses prereleases', () => {
    const t = parseTag('v1.2.3-rc.1');
    expect(t?.version.prerelease).toEqual(['rc', 1]);
  });

  it('returns null for non-semver tags', () => {
    expect(parseTag('latest')).toBeNull();
    expect(parseTag('nightly')).toBeNull();
    expect(parseTag('2024-01-15')).toBeNull();
  });
});

describe('isStable', () => {
  it('returns true for stable tags', () => {
    const t = parseTag('v1.2.3')!;
    expect(isStable(t)).toBe(true);
  });

  it('returns false for prereleases', () => {
    const t = parseTag('v1.2.3-rc.1')!;
    expect(isStable(t)).toBe(false);
  });
});
