import { intro, isCancel, multiselect, outro } from '@clack/prompts';
import pc from 'picocolors';
import path from 'node:path';

import type { Resolution } from '../core/types.js';
import { formatLevel } from '../io/output/formatter.js';
import { applyUpdates, type ApplyOptions } from './update.js';

/**
 * Show a checkbox UI for picking which outdated entries to update, then apply the selection.
 * Returns the applied resolutions. Throws on cancel — callers should treat that as exit code 0.
 */
export async function runInteractive(
  resolutions: readonly Resolution[],
  options: { cwd?: string } & ApplyOptions = {},
): Promise<Resolution[]> {
  const outdated = resolutions.filter((r) => r.outdated && r.latest);
  if (outdated.length === 0) {
    intro(pc.green('All actions are up to date.'));
    outro('Nothing to do.');
    return [];
  }

  intro(pc.bold(pc.cyan('github-actions-updater')));

  const cwd = options.cwd ?? process.cwd();
  const choices = outdated.map((r) => ({
    label: `${displayLabel(r, cwd)} ${pc.dim('→')} ${r.latest ?? '?'} ${formatLevel(r.level, { color: true })}`,
    value: r,
  }));

  const selection = await multiselect({
    message: 'Select updates to apply',
    options: choices,
    initialValues: outdated,
    required: false,
  });

  if (isCancel(selection)) {
    outro(pc.dim('Cancelled. Nothing was written.'));
    return [];
  }

  const selected = selection;
  if (selected.length === 0) {
    outro(pc.dim('No updates selected.'));
    return [];
  }

  const outcome = await applyUpdates(selected, options);
  const totalChanges = outcome.files.reduce((acc, r) => acc + r.changes, 0);
  outro(
    pc.green(
      `Applied ${totalChanges} update${totalChanges === 1 ? '' : 's'} across ${outcome.files.length} file${outcome.files.length === 1 ? '' : 's'}.`,
    ),
  );
  return outcome.applied;
}

function displayLabel(r: Resolution, cwd: string): string {
  const wf = path.relative(cwd, r.reference.location.file);
  const ref = r.reference.parsed;
  let name: string;
  switch (ref.kind) {
    case 'tag':
    case 'sha-pinned':
    case 'branch': {
      name = ref.subpath ? `${ref.owner}/${ref.repo}/${ref.subpath}` : `${ref.owner}/${ref.repo}`;
      break;
    }
    case 'docker': {
      name = `docker://${ref.image}`;
      break;
    }
    case 'local': {
      name = ref.path;
      break;
    }
  }
  return `${pc.dim(wf)} ${pc.bold(name)} ${pc.dim(`(${r.current})`)}`;
}
