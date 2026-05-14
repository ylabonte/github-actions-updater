import semver from 'semver';

import { isStable, type ParsedTag } from '../utils/semver-tag.js';
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
 * Classify a version diff. Returns `'none'` when latest is null or equal/older than current.
 *
 * For tags resolved from partial refs (`v4` → `4.0.0`), the comparison still works because
 * semver comparison only cares about the normalized version. The display layer is responsible
 * for showing the original raw text.
 */
export function classifyDiff(current: ParsedTag | null, latest: ParsedTag | null): UpdateLevel {
  if (!current || !latest) return 'none';
  if (semver.lte(latest.version, current.version)) return 'none';
  if (latest.version.major !== current.version.major) return 'major';
  if (latest.version.minor !== current.version.minor) return 'minor';
  if (latest.version.patch !== current.version.patch) return 'patch';
  return 'none';
}
