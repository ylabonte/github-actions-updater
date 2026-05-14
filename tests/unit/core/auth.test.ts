import { describe, expect, it } from 'vitest';

import { resolveAuth } from '../../../src/core/auth.js';

describe('resolveAuth', () => {
  it('uses explicit token first', async () => {
    const r = await resolveAuth({
      explicitToken: 'ghp_explicit',
      env: { GITHUB_TOKEN: 'ghp_env' },
      runGhCli: async () => 'ghp_gh',
    });
    expect(r).toEqual({ token: 'ghp_explicit', source: 'explicit' });
  });

  it('falls back to GITHUB_TOKEN env', async () => {
    const r = await resolveAuth({
      env: { GITHUB_TOKEN: 'ghp_env' },
      runGhCli: async () => 'ghp_gh',
    });
    expect(r).toEqual({ token: 'ghp_env', source: 'env' });
  });

  it('falls back to GH_TOKEN env', async () => {
    const r = await resolveAuth({
      env: { GH_TOKEN: 'ghp_env' },
      runGhCli: async () => null,
    });
    expect(r).toEqual({ token: 'ghp_env', source: 'env' });
  });

  it('falls back to gh CLI', async () => {
    const r = await resolveAuth({
      env: {},
      runGhCli: async () => 'ghp_gh',
    });
    expect(r).toEqual({ token: 'ghp_gh', source: 'gh-cli' });
  });

  it('returns anonymous when nothing available', async () => {
    const r = await resolveAuth({
      env: {},
      runGhCli: async () => null,
    });
    expect(r).toEqual({ token: null, source: 'anonymous' });
  });

  it('returns anonymous when gh throws', async () => {
    const r = await resolveAuth({
      env: {},
      runGhCli: async () => {
        throw new Error('gh not installed');
      },
    });
    expect(r.source).toBe('anonymous');
  });

  it('ignores empty/whitespace tokens', async () => {
    const r = await resolveAuth({
      explicitToken: '   ',
      env: { GITHUB_TOKEN: '' },
      runGhCli: async () => '  ',
    });
    expect(r.source).toBe('anonymous');
  });

  it('trims whitespace from valid tokens', async () => {
    const r = await resolveAuth({
      explicitToken: '  ghp_abc  ',
      env: {},
    });
    expect(r.token).toBe('ghp_abc');
  });
});
