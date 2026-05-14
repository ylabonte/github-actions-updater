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

  it('major-partial ref is not outdated against same-major tags', async () => {
    const client = fakeGitHubClient({
      'actions/checkout': [
        { name: 'v4.0.0', sha: 'a' },
        { name: 'v4.1.0', sha: 'b' },
        { name: 'v4.2.0', sha: 'c' },
      ],
    });
    const r = await resolveTag(makeReference('actions/checkout@v4'), client, 'latest');
    expect(r.outdated).toBe(false);
    expect(r.level).toBe('none');
  });

  it('major-partial ref flags cross-major bump and renders in major form', async () => {
    const client = fakeGitHubClient({
      'actions/checkout': [
        { name: 'v4.2.0', sha: 'a' },
        { name: 'v5.0.0', sha: 'b' },
        { name: 'v5.1.0', sha: 'c' },
      ],
    });
    const r = await resolveTag(makeReference('actions/checkout@v4'), client, 'latest');
    expect(r.outdated).toBe(true);
    expect(r.level).toBe('major');
    expect(r.latest).toBe('v5');
  });

  it('minor-partial ref is not outdated against same-minor tags', async () => {
    const client = fakeGitHubClient({
      'actions/checkout': [
        { name: 'v4.1.0', sha: 'a' },
        { name: 'v4.1.7', sha: 'b' },
      ],
    });
    const r = await resolveTag(makeReference('actions/checkout@v4.1'), client, 'latest');
    expect(r.outdated).toBe(false);
  });

  it('minor-partial ref renders bump as major.minor', async () => {
    const client = fakeGitHubClient({
      'actions/checkout': [
        { name: 'v4.1.0', sha: 'a' },
        { name: 'v4.2.0', sha: 'b' },
      ],
    });
    const r = await resolveTag(makeReference('actions/checkout@v4.1'), client, 'latest');
    expect(r.outdated).toBe(true);
    expect(r.latest).toBe('v4.2');
  });

  it('handles current ref that does not parse as semver', async () => {
    const client = fakeGitHubClient({
      'someuser/branch-named-action': [{ name: 'v1.0.0', sha: 'a' }],
    });
    // `latest` is not a tag — parseTag returns null for it. The resolver should still find a
    // semver candidate and report it; without a current tag to anchor on, no `v` is prepended.
    const r = await resolveTag(
      makeReference('someuser/branch-named-action@latest'),
      client,
      'latest',
    );
    expect(r.current).toBe('latest');
    expect(r.latest).toBe('1.0.0');
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
