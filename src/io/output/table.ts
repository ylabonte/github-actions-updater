import Table from 'cli-table3';
import pc from 'picocolors';
import path from 'node:path';

import type { Resolution } from '../../core/types.js';
import { toPosixPath } from '../../utils/paths.js';
import { formatLevel, formatSummary, formatVersion, type FormatterOptions } from './formatter.js';

export interface RenderTableOptions extends FormatterOptions {
  readonly cwd?: string;
}

/**
 * Render a colored table of resolutions. Designed to be readable both with and without
 * color (so it works in CI logs, file redirects, and IDE terminals).
 */
export function renderTable(resolutions: readonly Resolution[], opts: RenderTableOptions): string {
  const cwd = opts.cwd ?? process.cwd();
  const head = opts.color
    ? ['Workflow', 'Action', 'Current', 'Latest', 'Δ'].map((h) => pc.bold(h))
    : ['Workflow', 'Action', 'Current', 'Latest', 'Δ'];

  const chars = borderChars(opts.color);
  const table = new Table({
    head,
    style: { head: [], border: opts.color ? ['dim'] : [] },
    ...(chars && { chars }),
  });

  for (const r of resolutions) {
    const ref = r.reference.parsed;
    const action = displayAction(ref);
    const workflow = toPosixPath(path.relative(cwd, r.reference.location.file));
    // For error rows, the Latest column carries the error text — a green ✓ in Δ would be
    // misleading, so we surface a yellow ⚠ instead.
    const delta = r.error ? (opts.color ? pc.yellow('⚠') : '⚠') : formatLevel(r.level, opts);
    table.push([
      opts.color ? pc.dim(workflow) : workflow,
      action,
      formatVersion(r.current, 'none', opts),
      r.error
        ? opts.color
          ? pc.yellow(r.error)
          : r.error
        : formatVersion(r.latest, r.level, opts),
      delta,
    ]);
  }

  const summary = formatSummary(resolutions, opts);
  return `${table.toString()}\n\n${summary}`;
}

function displayAction(ref: Resolution['reference']['parsed']): string {
  switch (ref.kind) {
    case 'tag':
    case 'sha-pinned':
    case 'branch': {
      const r = ref;
      const base = `${r.owner}/${r.repo}`;
      return r.subpath ? `${base}/${r.subpath}` : base;
    }
    case 'docker': {
      return `docker://${ref.image}`;
    }
    case 'local': {
      return ref.path;
    }
  }
}

/** A slightly nicer set of border glyphs than cli-table3's default. */
function borderChars(color: boolean): NonNullable<ConstructorParameters<typeof Table>[0]>['chars'] {
  if (!color) return undefined;
  return {
    top: '─',
    'top-mid': '┬',
    'top-left': '╭',
    'top-right': '╮',
    bottom: '─',
    'bottom-mid': '┴',
    'bottom-left': '╰',
    'bottom-right': '╯',
    left: '│',
    'left-mid': '├',
    mid: '─',
    'mid-mid': '┼',
    right: '│',
    'right-mid': '┤',
    middle: '│',
  };
}
