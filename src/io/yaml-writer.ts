import { writeFile } from 'node:fs/promises';

import type { Reference } from '../core/types.js';

export interface Replacement {
  readonly reference: Reference;
  /** The new `uses:` value (without the inline comment). */
  readonly newValue: string;
  /** Optional new trailing `# comment`. Use null to remove an existing comment, undefined to leave it alone. */
  readonly newComment?: string | null;
}

export interface RewriteResult {
  readonly file: string;
  readonly content: string;
  readonly changes: number;
}

/**
 * Surgically rewrite workflow files. We don't reserialize through the YAML AST — that would
 * normalize formatting and may strip comments. Instead we splice replacements directly into
 * the source text using the byte offsets the parser captured.
 *
 * Replacements within the same file are applied in reverse-offset order so earlier offsets
 * remain valid as we mutate the string.
 */
export function rewriteContent(
  originalContent: string,
  replacements: readonly Replacement[],
): RewriteResult {
  if (replacements.length === 0) {
    return { file: '', content: originalContent, changes: 0 };
  }
  const sorted = replacements.toSorted(
    (a, b) => b.reference.location.offset - a.reference.location.offset,
  );

  let content = originalContent;
  let changes = 0;
  for (const r of sorted) {
    const { offset, endOffset } = r.reference.location;

    let newSegment = r.newValue;
    if (r.newComment === undefined) {
      // Only the value is replaced; whatever trails it (e.g. an existing
      // `# comment`) stays as-is.
      content = content.slice(0, offset) + newSegment + content.slice(endOffset);
    } else {
      // Replace everything up to end-of-line: drop the old comment and, unless
      // `newComment` is null, write the new one.
      if (r.newComment !== null) {
        newSegment += `  # ${r.newComment}`;
      }
      content =
        content.slice(0, offset) + newSegment + content.slice(findLineEnd(content, endOffset));
    }
    changes++;
  }

  return { file: '', content, changes };
}

/** Persist a rewritten file to disk. */
export async function writeWorkflow(filePath: string, content: string): Promise<void> {
  await writeFile(filePath, content, 'utf8');
}

function findLineEnd(content: string, from: number): number {
  const nl = content.indexOf('\n', from);
  return nl === -1 ? content.length : nl;
}
