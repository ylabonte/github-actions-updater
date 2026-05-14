#!/usr/bin/env node
import { Command, Option } from '@commander-js/extra-typings';
import ora from 'ora';
import pc from 'picocolors';

import { resolveAuth } from './core/auth.js';
import { createGitHubClient } from './core/resolver/github-client.js';
import { createDockerHubClient } from './core/resolver/docker-resolver.js';
import { runPipeline } from './core/pipeline.js';

import { applyUpdates } from './commands/update.js';
import { runInteractive } from './commands/interactive.js';
import { renderTable } from './io/output/table.js';
import { renderJson } from './io/output/json.js';

const VERSION = '0.0.0';

const TARGETS = ['latest', 'major', 'minor', 'patch', 'greatest'] as const;

export function buildProgram() {
  return new Command()
    .name('gau')
    .description('ncu for GitHub Actions — scan .github/workflows for outdated references.')
    .version(VERSION)
    .option('-u, --write', 'apply updates in place', false)
    .option('-i, --interactive', 'interactively pick updates to apply', false)
    .addOption(
      new Option('-t, --target <target>', 'update target policy')
        .choices(TARGETS)
        .default('latest' as const),
    )
    .option('--filter <patterns...>', 'include only matching action names (glob)')
    .option('--reject <patterns...>', 'exclude matching action names (glob)')
    .option('--workflows <path>', 'override .github/workflows directory')
    .option('--json', 'emit machine-readable JSON', false)
    .option('--no-color', 'disable color output')
    .option('--token <token>', 'GitHub token (overrides env / gh CLI)')
    .option('--allow-branch-pin', 'on --write, convert branch refs to pinned SHAs', false)
    .option('-v, --verbose', 'verbose logging', false);
}

export async function main(argv: readonly string[]): Promise<number> {
  const program = buildProgram();
  await program.parseAsync(argv, { from: 'user' });
  const opts = program.opts();
  const useColor = opts.color && !opts.json;

  const auth = await resolveAuth({
    ...(opts.token !== undefined && { explicitToken: opts.token }),
  });
  if (auth.source === 'anonymous') {
    process.stderr.write(
      pc.yellow(
        '⚠ Running unauthenticated (60 req/hr). Set GITHUB_TOKEN or run `gh auth login` to lift the limit.\n',
      ),
    );
  } else if (opts.verbose) {
    process.stderr.write(pc.dim(`Auth source: ${auth.source}\n`));
  }

  const github = createGitHubClient({ token: auth.token });
  const docker = createDockerHubClient();
  const deps = { github, docker };

  const spinner = opts.json ? null : ora('Scanning workflows…').start();
  try {
    const { resolutions } = await runPipeline(deps, {
      target: opts.target,
      ...(opts.filter !== undefined && { filters: opts.filter }),
      ...(opts.reject !== undefined && { rejects: opts.reject }),
      ...(opts.workflows !== undefined && { workflowsDir: opts.workflows }),
    });
    spinner?.stop();

    if (opts.interactive) {
      await runInteractive(resolutions, {
        ...(opts.allowBranchPin && { allowBranchPin: true }),
      });
      return 0;
    }

    const text = opts.json
      ? JSON.stringify(renderJson(resolutions), null, 2)
      : renderTable(resolutions, { color: useColor });
    process.stdout.write(`${text}\n`);

    if (opts.write) {
      const applied = await applyUpdates(resolutions, {
        ...(opts.allowBranchPin && { allowBranchPin: true }),
      });
      const total = applied.reduce((acc, r) => acc + r.changes, 0);
      if (!opts.json) {
        process.stdout.write(
          pc.green(
            `\n✔ Wrote ${total} update${total === 1 ? '' : 's'} across ${applied.length} file${applied.length === 1 ? '' : 's'}.\n`,
          ),
        );
      }
      return 0;
    }

    const hasError = resolutions.some((r) => r.error);
    const allError = resolutions.length > 0 && resolutions.every((r) => r.error);
    if (allError) return 2;
    if (resolutions.some((r) => r.outdated)) return 1;
    if (hasError) return 1;
    return 0;
  } catch (error) {
    spinner?.fail();
    process.stderr.write(pc.red(`✖ ${(error as Error).message}\n`));
    if (opts.verbose) process.stderr.write(`${(error as Error).stack ?? ''}\n`);
    return 2;
  }
}

// Run when invoked as a script (not when imported by tests).
const invokedDirectly =
  import.meta.url === `file://${process.argv[1] ?? ''}` ||
  process.argv[1]?.endsWith('cli.js') === true ||
  process.argv[1]?.endsWith('cli.ts') === true;

if (invokedDirectly) {
  void main(process.argv.slice(2)).then((code) => {
    process.exit(code);
  });
}

// Re-export the check pipeline for programmatic use.

export { runCheck } from './commands/check.js';
