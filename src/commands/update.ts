import { readFile } from 'node:fs/promises';

import { rewriteContent, writeWorkflow, type Replacement } from '../io/yaml-writer.js';
import type { Resolution } from '../core/types.js';
import type { ShaResolution } from '../core/resolver/sha-resolver.js';

export interface ApplyResult {
  readonly file: string;
  readonly changes: number;
}

export interface ApplyOutcome {
  /** Per-file summary of writes (zero-change entries possible if rewrite was a no-op). */
  readonly files: ApplyResult[];
  /** Resolutions whose replacement actually contributed to a write. Drives commit message. */
  readonly applied: Resolution[];
}

export interface ApplyOptions {
  /** When true, branch refs are rewritten to SHA pins. Default false (safer). */
  readonly allowBranchPin?: boolean;
}

/**
 * Apply selected outdated resolutions to disk. Branch refs are skipped unless
 * `allowBranchPin` is true. Returns a per-file summary plus the list of resolutions whose
 * rewrites were actually persisted — callers use that list to drive commit-message
 * generation.
 */
export async function applyUpdates(
  resolutions: readonly Resolution[],
  options: ApplyOptions = {},
): Promise<ApplyOutcome> {
  const byFile = new Map<string, { replacements: Replacement[]; resolutions: Resolution[] }>();

  for (const r of resolutions) {
    if (!r.outdated || !r.latest) continue;
    const kind = r.reference.parsed.kind;
    if (kind === 'branch' && !options.allowBranchPin) continue;

    const replacement = buildReplacement(r);
    if (!replacement) continue;

    const bucket = byFile.get(r.reference.location.file) ?? { replacements: [], resolutions: [] };
    bucket.replacements.push(replacement);
    bucket.resolutions.push(r);
    byFile.set(r.reference.location.file, bucket);
  }

  const files: ApplyResult[] = [];
  const applied: Resolution[] = [];
  for (const [file, bucket] of byFile) {
    const original = await readFile(file, 'utf8');
    const { content, changes } = rewriteContent(original, bucket.replacements);
    if (changes > 0 && content !== original) {
      await writeWorkflow(file, content);
      applied.push(...bucket.resolutions);
    }
    files.push({ file, changes });
  }
  return { files, applied };
}

function buildReplacement(r: Resolution): Replacement | null {
  if (!r.latest) return null;
  const parsed = r.reference.parsed;
  if (parsed.kind === 'tag') {
    return {
      reference: r.reference,
      newValue: `${parsed.owner}/${parsed.repo}${parsed.subpath ? `/${parsed.subpath}` : ''}@${r.latest}`,
    };
  }
  if (parsed.kind === 'sha-pinned') {
    const sha = (r as ShaResolution).latestSha;
    const comment = (r as ShaResolution).latestComment ?? r.latest;
    if (!sha) return null;
    return {
      reference: r.reference,
      newValue: `${parsed.owner}/${parsed.repo}${parsed.subpath ? `/${parsed.subpath}` : ''}@${sha}`,
      newComment: comment,
    };
  }
  if (parsed.kind === 'docker') {
    return {
      reference: r.reference,
      newValue: `docker://${parsed.image}:${r.latest}`,
    };
  }
  // branch: only reachable when allowBranchPin is true and we have a latest
  return null;
}
