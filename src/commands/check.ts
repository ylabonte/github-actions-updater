import { renderTable } from '../io/output/table.js';
import { renderJson } from '../io/output/json.js';
import type { ResolverDeps } from '../core/resolver/index.js';
import { runPipeline, type PipelineOptions } from '../core/pipeline.js';
import type { Resolution } from '../core/types.js';

export interface CheckOptions extends PipelineOptions {
  readonly color: boolean;
  readonly json: boolean;
}

export interface CheckOutput {
  readonly resolutions: Resolution[];
  readonly text: string;
  /** Process exit code: 0 = current, 1 = outdated, 2 = error. */
  readonly exitCode: 0 | 1 | 2;
}

export async function runCheck(deps: ResolverDeps, options: CheckOptions): Promise<CheckOutput> {
  const { resolutions } = await runPipeline(deps, options);
  const hasError = resolutions.some((r) => r.error);
  const hasOutdated = resolutions.some((r) => r.outdated);

  const exitCode: 0 | 1 | 2 =
    hasError && resolutions.every((r) => r.error) ? 2 : hasOutdated ? 1 : 0;

  const text = options.json
    ? JSON.stringify(renderJson(resolutions), null, 2)
    : renderTable(resolutions, {
        color: options.color,
        ...(options.cwd !== undefined && { cwd: options.cwd }),
      });

  return { resolutions, text, exitCode };
}
