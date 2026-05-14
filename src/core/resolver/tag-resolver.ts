import { classifyDiff, pickLatest, type Candidate } from '../comparator.js';
import { parseTag, trackLevel, type TrackLevel } from '../../utils/semver-tag.js';
import type { Reference, Resolution, RemoteRef, Target } from '../types.js';
import type { GitHubClient } from './github-client.js';

/**
 * Resolve a tag-style ref (`@v4`, `@v4.1.1`, etc.) to its "latest" counterpart according to
 * the target policy. The returned `Resolution.latest` is the raw tag string that should
 * replace the current ref, preserving the user's `v`-prefix convention.
 */
export async function resolveTag(
  reference: Reference,
  client: GitHubClient,
  target: Target,
): Promise<Resolution> {
  const ref = reference.parsed as RemoteRef;
  const tags = await client.listTags(ref.owner, ref.repo);

  const candidates: Candidate[] = [];
  for (const t of tags) {
    const parsed = parseTag(t.name);
    if (parsed) candidates.push({ tag: parsed });
  }

  const current = parseTag(ref.ref);
  const latest = pickLatest(current, candidates, target);
  const level = classifyDiff(current, latest);
  const currentTrack: TrackLevel = current ? trackLevel(current) : 'exact';

  return {
    reference,
    current: ref.ref,
    latest: latest ? renderTag(latest.raw, ref.ref, currentTrack) : null,
    level,
    outdated: latest !== null && level !== 'none',
  };
}

/**
 * Render the new ref string, preserving the user's pinning style:
 *
 *   user has `v4`     (major partial) → keep major form on bumps: `v5`
 *   user has `v4.1`   (minor partial) → keep major.minor form: `v4.2` or `v5.0`
 *   user has `v4.1.0` (exact)         → return the full latest tag verbatim
 *
 * Also preserves the user's `v`-prefix convention either way.
 *
 * This is a display/write helper — the canonical version comparison happens in `classifyDiff`.
 */
function renderTag(latestRaw: string, currentRaw: string, currentTrack: TrackLevel): string {
  const wantsV = currentRaw.startsWith('v') || currentRaw.startsWith('V');
  const cleaned = latestRaw.replace(/^v/i, '');

  let body = cleaned;
  if (currentTrack !== 'exact') {
    const parts = cleaned.split('.');
    /* c8 ignore next — parts[0] is always defined since split always yields a non-empty array. */
    body = currentTrack === 'major' ? (parts[0] ?? cleaned) : parts.slice(0, 2).join('.');
  }
  return wantsV ? `v${body}` : body;
}
