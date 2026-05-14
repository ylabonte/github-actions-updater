import { describe, expect, it } from 'vitest';

import { isStable, parseTag, trackLevel } from '../../../src/utils/semver-tag.js';

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

describe('trackLevel', () => {
  it('returns major for major-only partial', () => {
    expect(trackLevel(parseTag('v4')!)).toBe('major');
    expect(trackLevel(parseTag('4')!)).toBe('major');
  });

  it('returns minor for major.minor partial', () => {
    expect(trackLevel(parseTag('v4.1')!)).toBe('minor');
    expect(trackLevel(parseTag('4.1')!)).toBe('minor');
  });

  it('returns exact for full semver', () => {
    expect(trackLevel(parseTag('v4.1.2')!)).toBe('exact');
    expect(trackLevel(parseTag('1.2.3-rc.1')!)).toBe('exact');
  });
});
