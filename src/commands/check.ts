import { renderTable } from '../io/output/table.js';
import { renderJson } from '../io/output/json.js';
import type { ResolverDeps } from '../core/resolver/index.js';
import { runPipeline, type PipelineOptions } from '../core/pipeline.js';
import type { Resolution } from '../core/types.js';

export interface CheckOptions extends PipelineOptions {
  readonly color: boolean;
  readonly json: boolean;
  /**
   * When true, return exit code 1 if any resolution is outdated. When false (default), only
   * errors trigger a non-zero exit. Mirrors the `--fail-on-outdated` CLI flag.
   */
  readonly failOnOutdated?: boolean;
}

export interface CheckOutput {
  readonly resolutions: Resolution[];
  readonly text: string;
  /**
   * Process exit code:
   *   - 2: every resolution errored (catastrophic — likely auth/network).
   *   - 1: at least one resolution errored, OR (`failOnOutdated` && any outdated).
   *   - 0: otherwise (including the default case where outdated entries exist but no errors).
   */
  readonly exitCode: 0 | 1 | 2;
}

export async function runCheck(deps: ResolverDeps, options: CheckOptions): Promise<CheckOutput> {
  const { resolutions } = await runPipeline(deps, options);
  const hasError = resolutions.some((r) => r.error);
  const allError = resolutions.length > 0 && resolutions.every((r) => r.error);
  const hasOutdated = resolutions.some((r) => r.outdated);

  const exitCode: 0 | 1 | 2 = allError
    ? 2
    : hasError
      ? 1
      : options.failOnOutdated && hasOutdated
        ? 1
        : 0;

  const text = options.json
    ? JSON.stringify(renderJson(resolutions), null, 2)
    : renderTable(resolutions, {
        color: options.color,
        ...(options.cwd !== undefined && { cwd: options.cwd }),
      });

  return { resolutions, text, exitCode };
}
