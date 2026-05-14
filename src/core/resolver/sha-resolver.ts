import { classifyDiff, pickLatest, type Candidate } from '../comparator.js';
import { parseTag } from '../../utils/semver-tag.js';
import type { Reference, Resolution, RemoteRef, Target } from '../types.js';
import type { GitHubClient } from './github-client.js';

export interface ShaResolution extends Resolution {
  /** The SHA we'd write on `--write` if `outdated`. Null when no update or no tag SHA found. */
  readonly latestSha: string | null;
  /** The version comment that should accompany the SHA (for `# vX.Y.Z`). */
  readonly latestComment: string | null;
}

/**
 * Resolve a SHA-pinned ref. The trailing comment (`# v4.1.1`) is treated as the canonical
 * "current version" when present; if absent, we cannot meaningfully compare, so we leave
 * the row as `level: 'none'` with an explanatory error.
 */
export async function resolveSha(
  reference: Reference,
  client: GitHubClient,
  target: Target,
): Promise<ShaResolution> {
  const ref = reference.parsed as RemoteRef;
  const tags = await client.listTags(ref.owner, ref.repo);

  const candidates: Candidate[] = [];
  for (const t of tags) {
    const parsed = parseTag(t.name);
    if (parsed) candidates.push({ tag: parsed });
  }

  const current = ref.comment ? parseTag(ref.comment) : null;
  const latest = pickLatest(current, candidates, target);
  const level = classifyDiff(current, latest);

  let latestSha: string | null = null;
  if (latest) {
    const matched = tags.find((t) => t.name === latest.raw);
    if (matched) {
      // For lightweight tags the listTags SHA is the commit SHA. For annotated tags it's the
      // tag-object SHA, which actions/checkout resolves transparently — we still surface the
      // commit SHA via a separate API call to give users a clean rewrite.
      latestSha = await client.resolveTagSha(ref.owner, ref.repo, latest.raw);
      latestSha ??= matched.sha;
    }
  }

  const result: ShaResolution = {
    reference,
    current: ref.comment ?? ref.ref.slice(0, 7),
    latest: latest ? latest.raw : null,
    level,
    outdated: latestSha !== null && latestSha !== ref.ref && level !== 'none',
    latestSha,
    latestComment: latest ? latest.raw : null,
    ...(ref.comment
      ? {}
      : { error: 'SHA pinned without version comment — cannot determine current version' }),
  };
  return result;
}
