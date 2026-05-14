import { minimatch } from './minimatch.js';
import { parseWorkflow } from './parser.js';
import { scanWorkflows, type ScanOptions, type WorkflowFile } from './scanner.js';
import { resolve as resolveRef, type ResolverDeps } from './resolver/index.js';
import type { Reference, Resolution, Target } from './types.js';

export interface PipelineOptions extends ScanOptions {
  readonly target: Target;
  readonly filters?: readonly string[]; // include only matching action names
  readonly rejects?: readonly string[]; // exclude matching action names
}

export interface PipelineResult {
  readonly files: WorkflowFile[];
  readonly references: Reference[];
  readonly resolutions: Resolution[];
}

/**
 * Glue: scan → parse → filter → resolve. Returns everything callers need to render output
 * or apply updates. Resolution failures are surfaced as `Resolution.error` rather than thrown.
 */
export async function runPipeline(
  deps: ResolverDeps,
  options: PipelineOptions,
): Promise<PipelineResult> {
  const files = await scanWorkflows({
    ...(options.workflowsDir !== undefined && { workflowsDir: options.workflowsDir }),
    ...(options.cwd !== undefined && { cwd: options.cwd }),
  });

  const references: Reference[] = [];
  for (const file of files) {
    for (const ref of parseWorkflow(file)) {
      if (ref.parsed.kind === 'local') continue;
      if (!includeRef(ref, options.filters, options.rejects)) continue;
      references.push(ref);
    }
  }

  const resolutions: Resolution[] = [];
  for (const ref of references) {
    try {
      resolutions.push(await resolveRef(ref, deps, options.target));
    } catch (error) {
      resolutions.push({
        reference: ref,
        current: refDisplay(ref),
        latest: null,
        level: 'none',
        outdated: false,
        error: (error as Error).message,
      });
    }
  }

  return { files, references, resolutions };
}

function refDisplay(reference: Reference): string {
  const parsed = reference.parsed;
  switch (parsed.kind) {
    case 'tag':
    case 'sha-pinned':
    case 'branch': {
      return parsed.ref;
    }
    case 'docker': {
      return parsed.tag ?? 'latest';
    }
    case 'local': {
      return parsed.path;
    }
  }
}

function includeRef(
  ref: Reference,
  filters: readonly string[] | undefined,
  rejects: readonly string[] | undefined,
): boolean {
  const name = actionName(ref);
  if (filters && filters.length > 0 && !filters.some((p) => minimatch(name, p))) return false;
  if (rejects?.some((p) => minimatch(name, p))) return false;
  return true;
}

function actionName(ref: Reference): string {
  const p = ref.parsed;
  switch (p.kind) {
    case 'tag':
    case 'sha-pinned':
    case 'branch': {
      return p.subpath ? `${p.owner}/${p.repo}/${p.subpath}` : `${p.owner}/${p.repo}`;
    }
    case 'docker': {
      return `docker://${p.image}`;
    }
    case 'local': {
      return p.path;
    }
  }
}
