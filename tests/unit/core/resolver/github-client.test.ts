import { describe, expect, it } from 'vitest';

import { createGitHubClient } from '../../../../src/core/resolver/github-client.js';

/**
 * Use a minimal Octokit-shaped stub. The wrapper only touches a handful of methods, so we
 * don't need a real Octokit instance — passing a structurally typed stub is sufficient.
 */
interface Stub {
  rest: {
    repos: {
      getBranch: (args: {
        owner: string;
        repo: string;
        branch: string;
      }) => Promise<{ data: { commit: { sha: string } } }>;
      listTags: unknown;
    };
    git: {
      getRef: (args: {
        owner: string;
        repo: string;
        ref: string;
      }) => Promise<{ data: { object: { type: string; sha: string } } }>;
      getTag: (args: {
        owner: string;
        repo: string;
        tag_sha: string;
      }) => Promise<{ data: { object: { sha: string } } }>;
    };
  };
  paginate: {
    iterator: (
      method: unknown,
      params: { owner: string; repo: string; per_page: number },
    ) => AsyncIterable<{ data: { name: string; commit: { sha: string } }[] }>;
  };
}

function makeStub(
  overrides: Partial<{
    tags: { name: string; sha: string }[];
    branch: string;
    tagRef: { type: 'commit' | 'tag'; sha: string } | 'notfound';
    tagObject: { sha: string };
  }> = {},
): Stub {
  return {
    rest: {
      repos: {
        async getBranch() {
          if (overrides.branch === undefined)
            throw Object.assign(new Error('nope'), { status: 404 });
          return { data: { commit: { sha: overrides.branch } } };
        },
        listTags: null,
      },
      git: {
        async getRef() {
          if (overrides.tagRef === 'notfound')
            throw Object.assign(new Error('nope'), { status: 404 });
          return { data: { object: overrides.tagRef ?? { type: 'commit', sha: 'abc' } } };
        },
        async getTag() {
          return { data: { object: overrides.tagObject ?? { sha: 'deref' } } };
        },
      },
    },
    paginate: {
      async *iterator() {
        yield {
          data: (overrides.tags ?? []).map((t) => ({ name: t.name, commit: { sha: t.sha } })),
        };
      },
    },
  };
}

describe('createGitHubClient', () => {
  it('lists tags via pagination', async () => {
    const stub = makeStub({
      tags: [
        { name: 'v1.0.0', sha: 'a' },
        { name: 'v2.0.0', sha: 'b' },
      ],
    });
    const client = createGitHubClient({ token: null, octokit: stub as never });
    const tags = await client.listTags('a', 'b');
    expect(tags).toEqual([
      { name: 'v1.0.0', sha: 'a' },
      { name: 'v2.0.0', sha: 'b' },
    ]);
  });

  it('caches list-tags results within process', async () => {
    let count = 0;
    const stub = makeStub();
    const orig = stub.paginate.iterator;
    stub.paginate.iterator = (...args) => {
      count++;
      return orig(...args);
    };
    const client = createGitHubClient({ token: null, octokit: stub as never });
    await client.listTags('a', 'b');
    await client.listTags('a', 'b');
    expect(count).toBe(1);
  });

  it('returns null when branch is not found', async () => {
    const stub = makeStub();
    const client = createGitHubClient({ token: null, octokit: stub as never });
    const r = await client.getBranchHead('a', 'b', 'main');
    expect(r).toBeNull();
  });

  it('returns branch head sha when found', async () => {
    const stub = makeStub({ branch: 'sha123' });
    const client = createGitHubClient({ token: null, octokit: stub as never });
    expect(await client.getBranchHead('a', 'b', 'main')).toEqual({ sha: 'sha123' });
  });

  it('returns ref sha for lightweight tag', async () => {
    const stub = makeStub({ tagRef: { type: 'commit', sha: 'commit-sha' } });
    const client = createGitHubClient({ token: null, octokit: stub as never });
    expect(await client.resolveTagSha('a', 'b', 'v1')).toBe('commit-sha');
  });

  it('dereferences annotated tags to commit sha', async () => {
    const stub = makeStub({
      tagRef: { type: 'tag', sha: 'tag-obj-sha' },
      tagObject: { sha: 'commit-sha' },
    });
    const client = createGitHubClient({ token: null, octokit: stub as never });
    expect(await client.resolveTagSha('a', 'b', 'v1')).toBe('commit-sha');
  });

  it('caches branch lookups', async () => {
    let count = 0;
    const stub: Stub = makeStub({ branch: 'shaA' });
    const orig = stub.rest.repos.getBranch;
    stub.rest.repos.getBranch = async (args) => {
      count++;
      return orig(args);
    };
    const client = createGitHubClient({ token: null, octokit: stub as never });
    await client.getBranchHead('a', 'b', 'main');
    await client.getBranchHead('a', 'b', 'main');
    expect(count).toBe(1);
  });

  it('caches tag SHA lookups', async () => {
    let count = 0;
    const stub: Stub = makeStub({ tagRef: { type: 'commit', sha: 'x' } });
    const orig = stub.rest.git.getRef;
    stub.rest.git.getRef = async (args) => {
      count++;
      return orig(args);
    };
    const client = createGitHubClient({ token: null, octokit: stub as never });
    await client.resolveTagSha('a', 'b', 'v1');
    await client.resolveTagSha('a', 'b', 'v1');
    expect(count).toBe(1);
  });

  it('re-throws non-404 errors from branch lookup', async () => {
    const stub: Stub = makeStub();
    stub.rest.repos.getBranch = async () => {
      throw Object.assign(new Error('boom'), { status: 500 });
    };
    const client = createGitHubClient({ token: null, octokit: stub as never });
    await expect(client.getBranchHead('a', 'b', 'main')).rejects.toThrow('boom');
  });

  it('re-throws non-404 errors from tag lookup', async () => {
    const stub: Stub = makeStub();
    stub.rest.git.getRef = async () => {
      throw Object.assign(new Error('boom'), { status: 500 });
    };
    const client = createGitHubClient({ token: null, octokit: stub as never });
    await expect(client.resolveTagSha('a', 'b', 'v1')).rejects.toThrow('boom');
  });

  it('uses a real Octokit when none provided', () => {
    const client = createGitHubClient({ token: 'fake' });
    expect(client).toHaveProperty('listTags');
  });

  it('returns null on tag not-found', async () => {
    const stub = makeStub({ tagRef: 'notfound' });
    const client = createGitHubClient({ token: null, octokit: stub as never });
    expect(await client.resolveTagSha('a', 'b', 'v1')).toBeNull();
  });
});
