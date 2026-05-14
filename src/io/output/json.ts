import type { Resolution } from '../../core/types.js';
import { summarize } from './formatter.js';

export interface JsonReportEntry {
  workflow: string;
  action: string;
  ref: string;
  kind: string;
  current: string;
  latest: string | null;
  level: string;
  outdated: boolean;
  error?: string;
}

export interface JsonReport {
  summary: {
    outdated: number;
    current: number;
    errors: number;
    workflows: number;
  };
  entries: JsonReportEntry[];
}

export function renderJson(resolutions: readonly Resolution[]): JsonReport {
  return {
    summary: summarize(resolutions),
    entries: resolutions.map((r): JsonReportEntry => {
      const ref = r.reference.parsed;
      let action: string;
      const kind: string = ref.kind;
      if (ref.kind === 'docker') {
        action = `docker://${ref.image}`;
      } else if (ref.kind === 'local') {
        action = ref.path;
      } else {
        action = ref.subpath
          ? `${ref.owner}/${ref.repo}/${ref.subpath}`
          : `${ref.owner}/${ref.repo}`;
      }
      const base: JsonReportEntry = {
        workflow: r.reference.location.file,
        action,
        ref: r.reference.raw,
        kind,
        current: r.current,
        latest: r.latest,
        level: r.level,
        outdated: r.outdated,
      };
      return r.error ? { ...base, error: r.error } : base;
    }),
  };
}
