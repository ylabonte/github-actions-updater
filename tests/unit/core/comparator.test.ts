import { describe, expect, it } from 'vitest';

import { classifyDiff, pickLatest, type Candidate } from '../../../src/core/comparator.js';
import { parseTag } from '../../../src/utils/semver-tag.js';

const candidates = (raws: readonly string[]): Candidate[] =>
  raws
    .map((r) => parseTag(r))
    .filter((t): t is NonNullable<ReturnType<typeof parseTag>> => t !== null)
    .map((tag) => ({ tag }));

describe('pickLatest', () => {
  it('picks highest stable tag by default', () => {
    const c = candidates(['v1.0.0', 'v2.0.0', 'v3.0.0-rc.1']);
    const current = parseTag('v1.0.0');
    expect(pickLatest(current, c, 'latest')?.raw).toBe('v2.0.0');
  });

  it('includes prereleases with greatest', () => {
    const c = candidates(['v1.0.0', 'v2.0.0', 'v3.0.0-rc.1']);
    const current = parseTag('v1.0.0');
    expect(pickLatest(current, c, 'greatest')?.raw).toBe('v3.0.0-rc.1');
  });

  it('constrains by major with target=minor', () => {
    const c = candidates(['v1.0.0', 'v1.1.0', 'v2.0.0']);
    const current = parseTag('v1.0.0');
    expect(pickLatest(current, c, 'minor')?.raw).toBe('v1.1.0');
  });

  it('constrains by major.minor with target=patch', () => {
    const c = candidates(['v1.0.0', 'v1.0.5', 'v1.1.0']);
    const current = parseTag('v1.0.0');
    expect(pickLatest(current, c, 'patch')?.raw).toBe('v1.0.5');
  });

  it('returns null when no candidates', () => {
    expect(pickLatest(null, [], 'latest')).toBeNull();
  });

  it('handles null current as latest semantics', () => {
    const c = candidates(['v1.0.0', 'v2.0.0']);
    expect(pickLatest(null, c, 'latest')?.raw).toBe('v2.0.0');
  });

  it('returns null when target excludes all', () => {
    const c = candidates(['v2.0.0', 'v3.0.0']);
    const current = parseTag('v1.0.0');
    expect(pickLatest(current, c, 'minor')).toBeNull();
  });
});

describe('classifyDiff', () => {
  it('returns major when major changed', () => {
    expect(classifyDiff(parseTag('v1.0.0'), parseTag('v2.0.0'))).toBe('major');
  });

  it('returns minor when only minor changed', () => {
    expect(classifyDiff(parseTag('v1.0.0'), parseTag('v1.1.0'))).toBe('minor');
  });

  it('returns patch when only patch changed', () => {
    expect(classifyDiff(parseTag('v1.0.0'), parseTag('v1.0.1'))).toBe('patch');
  });

  it('returns none when versions are equal', () => {
    expect(classifyDiff(parseTag('v1.0.0'), parseTag('v1.0.0'))).toBe('none');
  });

  it('returns none when latest is older', () => {
    expect(classifyDiff(parseTag('v2.0.0'), parseTag('v1.0.0'))).toBe('none');
  });

  it('returns none when either side is null', () => {
    expect(classifyDiff(null, parseTag('v1.0.0'))).toBe('none');
    expect(classifyDiff(parseTag('v1.0.0'), null)).toBe('none');
  });

  // Partial-ref semantics: floating major/minor tags swallow within-track diffs.
  it('major-partial current swallows within-major bumps', () => {
    expect(classifyDiff(parseTag('v4'), parseTag('v4.2.0'))).toBe('none');
    expect(classifyDiff(parseTag('v4'), parseTag('v4.0.1'))).toBe('none');
  });

  it('major-partial current still flags cross-major', () => {
    expect(classifyDiff(parseTag('v4'), parseTag('v5.0.0'))).toBe('major');
  });

  it('minor-partial current swallows within-minor bumps', () => {
    expect(classifyDiff(parseTag('v4.1'), parseTag('v4.1.7'))).toBe('none');
  });

  it('minor-partial current flags higher minors as minor', () => {
    expect(classifyDiff(parseTag('v4.1'), parseTag('v4.2.0'))).toBe('minor');
  });

  it('minor-partial current flags higher majors as major', () => {
    expect(classifyDiff(parseTag('v4.1'), parseTag('v5.0.0'))).toBe('major');
  });
});
