import { classifyDiff, pickLatest, type Candidate } from '../comparator.js';
import { parseTag } from '../../utils/semver-tag.js';
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

  return {
    reference,
    current: ref.ref,
    latest: latest ? renderTag(latest.raw, ref.ref) : null,
    level,
    outdated: latest !== null && level !== 'none',
  };
}

/**
 * When the user uses `v4` (no minor/patch), prefer to mirror that style even if the newer
 * tag we picked has a more specific form. Conversely, if the user has `v4.1.1`, keep the
 * fully qualified form.
 *
 * This is a display/write helper — the canonical version comparison happens in `pickLatest`.
 */
function renderTag(latestRaw: string, currentRaw: string): string {
  // Preserve `v` vs no-`v` style of the user's current ref.
  if (!currentRaw.startsWith('v') && latestRaw.startsWith('v')) {
    return latestRaw.slice(1);
  }
  if (currentRaw.startsWith('v') && !latestRaw.startsWith('v')) {
    return `v${latestRaw}`;
  }
  return latestRaw;
}
