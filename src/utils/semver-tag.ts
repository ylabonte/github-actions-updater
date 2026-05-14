import semver from 'semver';

/**
 * Parse a tag string into a semver-comparable form. Tag conventions seen in GitHub Actions:
 *
 *   v1            → 1.0.0 (with `partial: true`)
 *   v1.2          → 1.2.0 (with `partial: true`)
 *   v1.2.3        → 1.2.3
 *   1.2.3         → 1.2.3
 *   v1.2.3-rc.1   → 1.2.3-rc.1
 *
 * Returns null when the tag is not semver-shaped (e.g. `nightly`, `latest`, `2024-01-15`).
 */
export interface ParsedTag {
  readonly raw: string;
  readonly version: semver.SemVer;
  /** True when the source had fewer than 3 dot-separated parts (e.g. `v4`, `v4.1`). */
  readonly partial: boolean;
}

const PARTIAL_RE = /^v?(\d+)(?:\.(\d+))?$/;

export function parseTag(raw: string): ParsedTag | null {
  const cleaned = raw.startsWith('v') || raw.startsWith('V') ? raw.slice(1) : raw;
  const direct = semver.parse(cleaned);
  if (direct) {
    return { raw, version: direct, partial: false };
  }
  const m = PARTIAL_RE.exec(raw);
  if (m) {
    const major = m[1];
    const minor = m[2] ?? '0';
    if (major !== undefined) {
      const parsed = semver.parse(`${major}.${minor}.0`);
      if (parsed) return { raw, version: parsed, partial: true };
    }
  }
  return null;
}

export function isStable(tag: ParsedTag): boolean {
  return tag.version.prerelease.length === 0;
}
