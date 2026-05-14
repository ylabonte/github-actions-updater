import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runCheck } from '../../../src/commands/check.js';
import type { DockerClient } from '../../../src/core/resolver/docker-resolver.js';
import { fakeGitHubClient } from '../../helpers/fixtures.js';

const noopDocker: DockerClient = {
  async listTags() {
    return [];
  },
};

const WORKFLOW_OUTDATED = [
  'jobs:',
  '  x:',
  '    steps:',
  '      - uses: actions/checkout@v3',
  '',
].join('\n');

const WORKFLOW_CURRENT = [
  'jobs:',
  '  x:',
  '    steps:',
  '      - uses: actions/checkout@v4',
  '',
].join('\n');

describe('runCheck', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'gau-check-'));
    await mkdir(join(cwd, '.github', 'workflows'), { recursive: true });
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('returns exit 1 when outdated entries exist', async () => {
    await writeFile(join(cwd, '.github', 'workflows', 'ci.yml'), WORKFLOW_OUTDATED);
    const github = fakeGitHubClient({ 'actions/checkout': [{ name: 'v4.0.0', sha: 'a' }] });
    const r = await runCheck(
      { github, docker: noopDocker },
      {
        target: 'latest',
        cwd,
        color: false,
        json: false,
      },
    );
    expect(r.exitCode).toBe(1);
    expect(r.text).toContain('actions/checkout');
  });

  it('returns exit 0 when all current', async () => {
    await writeFile(join(cwd, '.github', 'workflows', 'ci.yml'), WORKFLOW_CURRENT);
    const github = fakeGitHubClient({ 'actions/checkout': [{ name: 'v4.0.0', sha: 'a' }] });
    const r = await runCheck(
      { github, docker: noopDocker },
      {
        target: 'latest',
        cwd,
        color: false,
        json: false,
      },
    );
    expect(r.exitCode).toBe(0);
  });

  it('emits JSON when json=true', async () => {
    await writeFile(join(cwd, '.github', 'workflows', 'ci.yml'), WORKFLOW_OUTDATED);
    const github = fakeGitHubClient({ 'actions/checkout': [{ name: 'v4.0.0', sha: 'a' }] });
    const r = await runCheck(
      { github, docker: noopDocker },
      {
        target: 'latest',
        cwd,
        color: false,
        json: true,
      },
    );
    expect(() => JSON.parse(r.text)).not.toThrow();
  });

  it('returns exit 2 when every resolution errored', async () => {
    await writeFile(join(cwd, '.github', 'workflows', 'ci.yml'), WORKFLOW_OUTDATED);
    const github = {
      async listTags() {
        throw new Error('boom');
      },
      async getBranchHead() {
        return null;
      },
      async resolveTagSha() {
        return null;
      },
    };
    const r = await runCheck(
      { github, docker: noopDocker },
      {
        target: 'latest',
        cwd,
        color: false,
        json: false,
      },
    );
    expect(r.exitCode).toBe(2);
  });
});
