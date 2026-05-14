import semver from 'semver';

import { isStable, trackLevel, type ParsedTag } from '../utils/semver-tag.js';
import type { Target, UpdateLevel } from './types.js';

export interface Candidate {
  readonly tag: ParsedTag;
}

/**
 * Pick the "latest" tag according to `target` semantics, evaluated relative to `current`.
 *
 * - `latest`: highest stable tag overall.
 * - `greatest`: highest tag including pre-releases.
 * - `major`: same as `latest`, kept distinct for symmetry with ncu.
 * - `minor`: highest tag whose major equals current.major.
 * - `patch`: highest tag whose major.minor equals current's.
 *
 * `current` may be `null` (e.g. when the user's ref doesn't parse as semver). In that case
 * the result still respects target's "stable vs pre-release" axis but cannot apply minor/
 * patch constraints, so it falls back to `latest` semantics.
 */
export function pickLatest(
  current: ParsedTag | null,
  candidates: readonly Candidate[],
  target: Target,
): ParsedTag | null {
  if (candidates.length === 0) return null;

  const includePre = target === 'greatest';
  const eligible = candidates
    .filter((c) => (includePre ? true : isStable(c.tag)))
    .filter((c) => filterByTarget(current, c.tag, target));

  const first = eligible[0];
  if (!first) return null;
  let best = first.tag;
  for (let i = 1; i < eligible.length; i++) {
    const candidate = eligible[i];
    if (!candidate) continue;
    if (semver.gt(candidate.tag.version, best.version)) best = candidate.tag;
  }
  return best;
}

function filterByTarget(current: ParsedTag | null, candidate: ParsedTag, target: Target): boolean {
  if (!current) return true;
  switch (target) {
    case 'patch': {
      return (
        candidate.version.major === current.version.major &&
        candidate.version.minor === current.version.minor
      );
    }
    case 'minor': {
      return candidate.version.major === current.version.major;
    }
    case 'latest':
    case 'major':
    case 'greatest': {
      return true;
    }
  }
}

/**
 * Classify a version diff between the user's current ref and a candidate latest.
 *
 * Partial refs (`@v4`, `@v4.1`) implicitly track a version prefix — action authors force-push
 * the floating tag to keep it pointing at the latest within-track release. So `@v4` is
 * functionally "latest v4.x.y" and shouldn't be reported as outdated when a higher v4.x.y
 * appears. Only a cross-track move (`v4` → `v5`, or `v4.1` → `v4.2`) is a real bump.
 *
 * Returns `'none'` when latest is null, equal/older, or within the current's implicit track.
 */
export function classifyDiff(current: ParsedTag | null, latest: ParsedTag | null): UpdateLevel {
  if (!current || !latest) return 'none';
  if (semver.lte(latest.version, current.version)) return 'none';

  const track = trackLevel(current);
  const sameMajor = latest.version.major === current.version.major;
  const sameMinor = sameMajor && latest.version.minor === current.version.minor;

  if (track === 'major' && sameMajor) return 'none';
  if (track === 'minor' && sameMinor) return 'none';

  if (!sameMajor) return 'major';
  if (!sameMinor) return 'minor';
  if (latest.version.patch !== current.version.patch) return 'patch';
  return 'none';
}
