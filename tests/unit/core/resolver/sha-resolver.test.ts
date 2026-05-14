import { describe, expect, it } from 'vitest';

import { resolveSha } from '../../../../src/core/resolver/sha-resolver.js';
import { fakeGitHubClient, makeReference } from '../../../helpers/fixtures.js';

const SHA_OLD = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0';
const SHA_NEW = 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1';

describe('resolveSha', () => {
  it('reports newer SHA when comment indicates old version', async () => {
    const client = fakeGitHubClient(
      {
        'actions/checkout': [
          { name: 'v4.1.0', sha: SHA_OLD },
          { name: 'v4.2.0', sha: SHA_NEW },
        ],
      },
      { tagShas: { 'actions/checkout/v4.2.0': SHA_NEW } },
    );
    const ref = makeReference(`actions/checkout@${SHA_OLD} # v4.1.0`);
    const r = await resolveSha(ref, client, 'latest');
    expect(r.outdated).toBe(true);
    expect(r.latest).toBe('v4.2.0');
    expect(r.latestSha).toBe(SHA_NEW);
    expect(r.latestComment).toBe('v4.2.0');
  });

  it('surfaces error when SHA has no version comment', async () => {
    const client = fakeGitHubClient({ 'actions/checkout': [] });
    const ref = makeReference(`actions/checkout@${SHA_OLD}`);
    const r = await resolveSha(ref, client, 'latest');
    expect(r.error).toMatch(/comment/);
  });

  it('reports current when nothing newer', async () => {
    const client = fakeGitHubClient(
      { 'actions/checkout': [{ name: 'v4.1.0', sha: SHA_OLD }] },
      { tagShas: { 'actions/checkout/v4.1.0': SHA_OLD } },
    );
    const ref = makeReference(`actions/checkout@${SHA_OLD} # v4.1.0`);
    const r = await resolveSha(ref, client, 'latest');
    expect(r.outdated).toBe(false);
  });
});
