import { describe, expect, it } from 'vitest';

import { resolveTag } from '../../../../src/core/resolver/tag-resolver.js';
import { fakeGitHubClient, makeReference } from '../../../helpers/fixtures.js';

describe('resolveTag', () => {
  it('finds newer minor tag', async () => {
    const client = fakeGitHubClient({
      'actions/checkout': [
        { name: 'v4.1.0', sha: 'aaa' },
        { name: 'v4.1.1', sha: 'bbb' },
        { name: 'v4.2.0', sha: 'ccc' },
      ],
    });
    const ref = makeReference('actions/checkout@v4.1.0');
    const r = await resolveTag(ref, client, 'latest');
    expect(r.outdated).toBe(true);
    expect(r.latest).toBe('v4.2.0');
    expect(r.level).toBe('minor');
  });

  it('reports no update when already latest', async () => {
    const client = fakeGitHubClient({
      'actions/checkout': [{ name: 'v4.0.0', sha: 'aaa' }],
    });
    const ref = makeReference('actions/checkout@v4.0.0');
    const r = await resolveTag(ref, client, 'latest');
    expect(r.outdated).toBe(false);
    expect(r.level).toBe('none');
  });

  it('mirrors v-prefix style of user current ref', async () => {
    const client = fakeGitHubClient({
      'actions/setup-node': [{ name: 'v4.1.0', sha: 'aaa' }],
    });
    const r = await resolveTag(makeReference('actions/setup-node@4.0.0'), client, 'latest');
    expect(r.latest).toBe('4.1.0');
  });

  it('adds v-prefix when user has v-prefix and tag lacks one', async () => {
    const client = fakeGitHubClient({
      'actions/setup-node': [{ name: '4.1.0', sha: 'aaa' }],
    });
    const r = await resolveTag(makeReference('actions/setup-node@v4.0.0'), client, 'latest');
    expect(r.latest).toBe('v4.1.0');
  });

  it('returns null latest when no tags exist', async () => {
    const client = fakeGitHubClient({ 'actions/checkout': [] });
    const r = await resolveTag(makeReference('actions/checkout@v4'), client, 'latest');
    expect(r.latest).toBeNull();
    expect(r.outdated).toBe(false);
  });

  it('respects target=minor (no major bump)', async () => {
    const client = fakeGitHubClient({
      'actions/checkout': [
        { name: 'v3.5.0', sha: 'a' },
        { name: 'v4.0.0', sha: 'b' },
        { name: 'v4.1.0', sha: 'c' },
      ],
    });
    const r = await resolveTag(makeReference('actions/checkout@v3.0.0'), client, 'minor');
    expect(r.latest).toBe('v3.5.0');
  });
});
