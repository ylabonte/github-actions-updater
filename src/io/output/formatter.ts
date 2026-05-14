import pc from 'picocolors';

import type { Resolution, UpdateLevel } from '../../core/types.js';

export interface FormatterOptions {
  readonly color: boolean;
}

/**
 * Format the level label with appropriate color. Up-to-date rows (`level === 'none'`) get a
 * green ✓ glyph so they're scannable at a glance — a blank Δ column was indistinguishable
 * from an in-flight or omitted row.
 */
export function formatLevel(level: UpdateLevel, opts: FormatterOptions): string {
  if (!opts.color) return level === 'none' ? '✓' : level;
  switch (level) {
    case 'major': {
      return pc.bold(pc.red('major'));
    }
    case 'minor': {
      return pc.cyan('minor');
    }
    case 'patch': {
      return pc.green('patch');
    }
    case 'mutable': {
      return pc.dim(pc.yellow('mutable'));
    }
    case 'none': {
      return pc.green('✓');
    }
  }
}

export function formatVersion(
  value: string | null,
  level: UpdateLevel,
  opts: FormatterOptions,
): string {
  if (value === null) return opts.color ? pc.dim('—') : '—';
  if (!opts.color) return value;
  switch (level) {
    case 'major': {
      return pc.red(value);
    }
    case 'minor': {
      return pc.cyan(value);
    }
    case 'patch': {
      return pc.green(value);
    }
    case 'mutable': {
      return pc.yellow(value);
    }
    case 'none': {
      return pc.dim(value);
    }
  }
}

export function summarize(resolutions: readonly Resolution[]): {
  outdated: number;
  current: number;
  errors: number;
  workflows: number;
} {
  const files = new Set<string>();
  let outdated = 0;
  let current = 0;
  let errors = 0;
  for (const r of resolutions) {
    files.add(r.reference.location.file);
    if (r.error) {
      errors++;
      continue;
    }
    if (r.outdated) outdated++;
    else current++;
  }
  return { outdated, current, errors, workflows: files.size };
}

export function formatSummary(resolutions: readonly Resolution[], opts: FormatterOptions): string {
  const s = summarize(resolutions);
  const parts: string[] = [];
  if (s.outdated > 0) {
    parts.push(opts.color ? pc.bold(pc.red(`${s.outdated} outdated`)) : `${s.outdated} outdated`);
  }
  parts.push(opts.color ? pc.green(`${s.current} up to date`) : `${s.current} up to date`);
  if (s.errors > 0) {
    parts.push(opts.color ? pc.yellow(`${s.errors} errors`) : `${s.errors} errors`);
  }
  parts.push(`across ${s.workflows} workflow${s.workflows === 1 ? '' : 's'}`);
  return parts.join(' · ');
}
