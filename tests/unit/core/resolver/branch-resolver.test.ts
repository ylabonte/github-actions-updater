import { describe, expect, it } from 'vitest';

import { resolveBranch } from '../../../../src/core/resolver/branch-resolver.js';
import { fakeGitHubClient, makeReference } from '../../../helpers/fixtures.js';

describe('resolveBranch', () => {
  it('reports current head SHA with mutable level', async () => {
    const client = fakeGitHubClient(
      {},
      { branches: { 'actions/checkout/main': 'cafef00dcafef00dcafef00dcafef00dcafef00d' } },
    );
    const ref = makeReference('actions/checkout@main');
    const r = await resolveBranch(ref, client);
    expect(r.level).toBe('mutable');
    expect(r.outdated).toBe(false);
    expect(r.latest).toContain('cafef00');
  });

  it('returns error when branch not found', async () => {
    const client = fakeGitHubClient({});
    const ref = makeReference('actions/checkout@nope');
    const r = await resolveBranch(ref, client);
    expect(r.error).toMatch(/not found/);
  });
});
