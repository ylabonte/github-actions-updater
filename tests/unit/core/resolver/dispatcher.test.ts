import { describe, expect, it } from 'vitest';

import { resolve } from '../../../../src/core/resolver/index.js';
import type { DockerClient } from '../../../../src/core/resolver/docker-resolver.js';
import { fakeGitHubClient, makeReference } from '../../../helpers/fixtures.js';

const noopDocker: DockerClient = {
  async listTags() {
    return [];
  },
};

describe('resolve dispatch', () => {
  it('routes tag refs to tag resolver', async () => {
    const github = fakeGitHubClient({ 'actions/checkout': [{ name: 'v4.0.0', sha: 'aaa' }] });
    const ref = makeReference('actions/checkout@v3.0.0');
    const r = await resolve(ref, { github, docker: noopDocker }, 'latest');
    expect(r.outdated).toBe(true);
  });

  it('routes branch refs to branch resolver', async () => {
    const github = fakeGitHubClient({}, { branches: { 'actions/checkout/main': 'sha123' } });
    const ref = makeReference('actions/checkout@main');
    const r = await resolve(ref, { github, docker: noopDocker }, 'latest');
    expect(r.level).toBe('mutable');
  });

  it('returns trivial resolution for local refs', async () => {
    const github = fakeGitHubClient({});
    const ref = makeReference('./.github/actions/build');
    const r = await resolve(ref, { github, docker: noopDocker }, 'latest');
    expect(r.outdated).toBe(false);
    expect(r.latest).toBeNull();
  });
});
