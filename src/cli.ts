#!/usr/bin/env node
import { Command, Option } from '@commander-js/extra-typings';
import ora from 'ora';
import pc from 'picocolors';

import { resolveAuth } from './core/auth.js';
import { createGitHubClient } from './core/resolver/github-client.js';
import { createDockerHubClient } from './core/resolver/docker-resolver.js';
import { runPipeline } from './core/pipeline.js';

import { confirm, isCancel } from '@clack/prompts';

import { applyUpdates } from './commands/update.js';
import { runInteractive } from './commands/interactive.js';
import { commitUpdates } from './commands/git-commit.js';
import type { Resolution } from './core/types.js';
import { renderTable } from './io/output/table.js';
import { renderJson } from './io/output/json.js';

const VERSION = '0.0.0';

const TARGETS = ['latest', 'major', 'minor', 'patch', 'greatest'] as const;

export function buildProgram() {
  return new Command()
    .name('ghau')
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
    .option(
      '--commit',
      'after --write or --interactive: stage the changed workflow files and open `git commit -v` with a pre-filled message',
      false,
    )
    .option(
      '--no-edit',
      'with --commit: commit the prefilled message verbatim without opening an editor (auto-enabled when stdin is not a TTY)',
    )
    .option(
      '--fail-on-outdated',
      'exit 1 when outdated entries are found (default: exit 0 unless an actual error occurred)',
      false,
    )
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

    if (opts.commit && !opts.write && !opts.interactive) {
      process.stderr.write(pc.red('✖ --commit requires --write/-u or --interactive/-i.\n'));
      return 2;
    }

    if (opts.interactive) {
      const applied = await runInteractive(resolutions, {
        ...(opts.allowBranchPin && { allowBranchPin: true }),
      });
      if (opts.commit) {
        await runCommit(applied, !opts.edit);
      }
      return 0;
    }

    const text = opts.json
      ? JSON.stringify(renderJson(resolutions), null, 2)
      : renderTable(resolutions, { color: useColor });
    process.stdout.write(`${text}\n`);

    if (opts.write) {
      const outcome = await applyUpdates(resolutions, {
        ...(opts.allowBranchPin && { allowBranchPin: true }),
      });
      const total = outcome.files.reduce((acc, r) => acc + r.changes, 0);
      if (!opts.json) {
        process.stdout.write(
          pc.green(
            `\n✔ Wrote ${total} update${total === 1 ? '' : 's'} across ${outcome.files.length} file${outcome.files.length === 1 ? '' : 's'}.\n`,
          ),
        );
      }
      if (opts.commit) {
        // Pause so the user can actually look at the table before the editor takes over the
        // screen. Skipped when there's no TTY (CI), when emitting JSON (machine flow), or
        // when --no-edit was explicitly passed (script-style flow, no editor would open
        // anyway). The `-i` path doesn't need this — the multiselect already gave the user
        // a chance to review and choose.
        if (process.stdin.isTTY && !opts.json && opts.edit) {
          const proceed = await confirm({
            message: 'Open the editor to review and confirm the commit message?',
            initialValue: true,
          });
          if (isCancel(proceed) || !proceed) {
            process.stderr.write(pc.yellow('⚠ Skipped commit: cancelled.\n'));
            return 0;
          }
        }
        await runCommit(outcome.applied, !opts.edit);
      }
      return 0;
    }

    const hasError = resolutions.some((r) => r.error);
    const allError = resolutions.length > 0 && resolutions.every((r) => r.error);
    // Default: exit 0 unless something errored. `--fail-on-outdated` brings back the
    // "fail when stale" behavior for CI gating.
    if (allError) return 2;
    if (hasError) return 1;
    if (opts.failOnOutdated && resolutions.some((r) => r.outdated)) return 1;
    return 0;
  } catch (error) {
    spinner?.fail();
    process.stderr.write(pc.red(`✖ ${(error as Error).message}\n`));
    if (opts.verbose) process.stderr.write(`${(error as Error).stack ?? ''}\n`);
    return 2;
  }
}

async function runCommit(applied: readonly Resolution[], noEdit = false): Promise<void> {
  const result = await commitUpdates(applied, { noEdit });
  if (result.committed) {
    process.stdout.write(pc.green('\n✔ Committed.\n'));
  } else if (result.reason) {
    process.stderr.write(pc.yellow(`⚠ Skipped commit: ${result.reason}\n`));
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
