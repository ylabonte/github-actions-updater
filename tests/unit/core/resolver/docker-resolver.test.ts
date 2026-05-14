import { describe, expect, it } from 'vitest';

import { resolveDocker, type DockerClient } from '../../../../src/core/resolver/docker-resolver.js';
import { makeReference } from '../../../helpers/fixtures.js';

const fakeDocker = (tags: string[]): DockerClient => ({
  async listTags() {
    return tags;
  },
});

const failingDocker = (msg: string): DockerClient => ({
  async listTags() {
    throw new Error(msg);
  },
});

describe('resolveDocker', () => {
  it('finds newer image tag', async () => {
    const r = await resolveDocker(
      makeReference('docker://node:20.0.0'),
      fakeDocker(['18.0.0', '20.0.0', '20.1.0', '21.0.0']),
      'latest',
    );
    expect(r.outdated).toBe(true);
    expect(r.latest).toBe('21.0.0');
    expect(r.level).toBe('major');
  });

  it('returns error when no tag specified', async () => {
    const r = await resolveDocker(makeReference('docker://alpine'), fakeDocker(['3.20']), 'latest');
    expect(r.error).toMatch(/No tag/);
  });

  it('returns error when registry fails', async () => {
    const r = await resolveDocker(
      makeReference('docker://node:20'),
      failingDocker('boom'),
      'latest',
    );
    expect(r.error).toContain('boom');
  });

  it('reports up-to-date', async () => {
    const r = await resolveDocker(
      makeReference('docker://node:20.0.0'),
      fakeDocker(['20.0.0']),
      'latest',
    );
    expect(r.outdated).toBe(false);
  });
});
