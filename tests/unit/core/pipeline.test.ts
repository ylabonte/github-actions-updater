import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runPipeline } from '../../../src/core/pipeline.js';
import type { DockerClient } from '../../../src/core/resolver/docker-resolver.js';
import { fakeGitHubClient } from '../../helpers/fixtures.js';

const noopDocker: DockerClient = {
  async listTags() {
    return [];
  },
};

const WORKFLOW = [
  'name: ci',
  'on: [push]',
  'jobs:',
  '  build:',
  '    runs-on: ubuntu-latest',
  '    steps:',
  '      - uses: actions/checkout@v3',
  '      - uses: actions/setup-node@v4.0.0',
  '      - uses: ./.github/actions/local',
  '',
].join('\n');

describe('runPipeline', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'ghau-pipe-'));
    const wfDir = join(cwd, '.github', 'workflows');
    await mkdir(wfDir, { recursive: true });
    await writeFile(join(wfDir, 'ci.yml'), WORKFLOW);
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('scans, parses, and resolves all remote refs', async () => {
    const github = fakeGitHubClient({
      'actions/checkout': [{ name: 'v4.0.0', sha: 'aaa' }],
      'actions/setup-node': [{ name: 'v4.1.0', sha: 'bbb' }],
    });
    const result = await runPipeline({ github, docker: noopDocker }, { target: 'latest', cwd });
    expect(result.resolutions).toHaveLength(2);
    expect(result.resolutions.every((r) => r.outdated)).toBe(true);
  });

  it('applies filter glob', async () => {
    const github = fakeGitHubClient({
      'actions/checkout': [{ name: 'v4.0.0', sha: 'aaa' }],
      'actions/setup-node': [{ name: 'v4.1.0', sha: 'bbb' }],
    });
    const result = await runPipeline(
      { github, docker: noopDocker },
      { target: 'latest', cwd, filters: ['actions/checkout'] },
    );
    expect(result.resolutions).toHaveLength(1);
    expect(result.resolutions[0]?.reference.parsed.kind).toBe('tag');
  });

  it('applies reject glob', async () => {
    const github = fakeGitHubClient({
      'actions/checkout': [{ name: 'v4.0.0', sha: 'aaa' }],
      'actions/setup-node': [{ name: 'v4.1.0', sha: 'bbb' }],
    });
    const result = await runPipeline(
      { github, docker: noopDocker },
      { target: 'latest', cwd, rejects: ['actions/setup-node'] },
    );
    expect(result.resolutions).toHaveLength(1);
  });

  it('filter matches docker:// refs', async () => {
    const dockerWf = ['jobs:', '  x:', '    steps:', '      - uses: docker://node:20', ''].join(
      '\n',
    );
    await writeFile(join(cwd, '.github', 'workflows', 'docker.yml'), dockerWf);
    const github = fakeGitHubClient({});
    const dockerCli = {
      async listTags() {
        return ['20', '21'];
      },
    };
    const result = await runPipeline(
      { github, docker: dockerCli },
      { target: 'latest', cwd, filters: ['docker://*'] },
    );
    expect(result.resolutions).toHaveLength(1);
  });

  it('captures resolver errors as resolution.error', async () => {
    const failing: typeof noopDocker extends infer T ? T : never = noopDocker;
    void failing;
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
    const result = await runPipeline({ github, docker: noopDocker }, { target: 'latest', cwd });
    expect(result.resolutions.every((r) => r.error)).toBe(true);
  });
});
