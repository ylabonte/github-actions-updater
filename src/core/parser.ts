import { LineCounter, parseDocument, isMap, isScalar, type Node } from 'yaml';

import { parseReference } from './reference.js';
import type { Reference, SourceLocation } from './types.js';
import type { WorkflowFile } from './scanner.js';

/**
 * Extract every `uses:` reference from a workflow file, with precise source positions for
 * later surgical rewriting. Skips local action references (they're parsed but classified as
 * `kind: 'local'`).
 *
 * Pure: no I/O. Operates on the already-read file content.
 */
export function parseWorkflow(file: WorkflowFile): Reference[] {
  const lineCounter = new LineCounter();
  const doc = parseDocument(file.content, { lineCounter, keepSourceTokens: true });
  const firstError = doc.errors[0];
  if (firstError) {
    throw new WorkflowParseError(file.relativePath, firstError.message);
  }
  if (!doc.contents) return [];

  const references: Reference[] = [];
  walk(doc.contents, (node) => {
    if (!isMap(node)) return;
    for (const pair of node.items) {
      if (!isScalar(pair.key) || pair.key.value !== 'uses') continue;
      if (!isScalar(pair.value)) continue;
      const scalar = pair.value;
      if (typeof scalar.value !== 'string') continue;
      const range = scalar.range;
      if (!range) continue;

      const [start, valueEnd] = range;
      const rawSlice = file.content.slice(start, valueEnd);
      // eemeli/yaml strips inline trailing comments from the scalar value, but exposes them
      // separately. We re-attach for parseReference so SHA-pinned refs keep their `# v…` hint.
      const trailing =
        typeof scalar.comment === 'string' && scalar.comment.length > 0
          ? ` # ${scalar.comment.trim()}`
          : '';
      const parsed = parseReference(`${scalar.value}${trailing}`);
      if (!parsed) continue;

      const { line, col } = lineCounter.linePos(start);
      const location: SourceLocation = {
        file: file.path,
        line,
        column: col,
        offset: start,
        endOffset: valueEnd,
      };
      references.push({
        raw: rawSlice,
        parsed,
        location,
      });
    }
  });

  return references;
}

function walk(node: Node, visit: (n: Node) => void): void {
  visit(node);
  if (isMap(node)) {
    for (const pair of node.items) {
      if (pair.value !== undefined && pair.value !== null && typeof pair.value === 'object') {
        walk(pair.value as Node, visit);
      }
    }
  } else if ('items' in node && Array.isArray((node as { items: unknown }).items)) {
    for (const item of (node as { items: Node[] }).items) {
      if (typeof item === 'object') walk(item, visit);
    }
  }
}

export class WorkflowParseError extends Error {
  constructor(
    public readonly file: string,
    message: string,
  ) {
    super(`Failed to parse ${file}: ${message}`);
    this.name = 'WorkflowParseError';
  }
}
