import { parseReference } from '../../src/core/reference.js';
import type { GitHubClient, GitHubTag } from '../../src/core/resolver/github-client.js';
import type { Reference } from '../../src/core/types.js';

/**
 * Build a `Reference` from a raw `uses:` string for use in resolver tests. Source location is
 * synthesized; tests that depend on offsets supply their own location explicitly.
 */
export function makeReference(
  rawValue: string,
  location?: Partial<Reference['location']>,
): Reference {
  const parsed = parseReference(rawValue);
  if (!parsed) throw new Error(`Test helper: cannot parse ${rawValue}`);
  return {
    raw: rawValue,
    parsed,
    location: {
      file: '/tmp/test.yml',
      line: 1,
      column: 1,
      offset: 0,
      endOffset: rawValue.length,
      ...location,
    },
  };
}

export type FakeGitHubData = Readonly<Record<string, readonly GitHubTag[]>>;

export interface FakeGitHubOptions {
  readonly branches?: Record<string, string>; // "owner/repo/branch" → sha
  readonly tagShas?: Record<string, string>; // "owner/repo/tagname" → sha
}

export function fakeGitHubClient(
  tags: FakeGitHubData,
  options: FakeGitHubOptions = {},
): GitHubClient {
  return {
    async listTags(owner, repo) {
      return [...(tags[`${owner}/${repo}`] ?? [])];
    },
    async getBranchHead(owner, repo, branch) {
      const sha = options.branches?.[`${owner}/${repo}/${branch}`];
      return sha ? { sha } : null;
    },
    async resolveTagSha(owner, repo, tag) {
      const explicit = options.tagShas?.[`${owner}/${repo}/${tag}`];
      if (explicit) return explicit;
      const found = (tags[`${owner}/${repo}`] ?? []).find((t) => t.name === tag);
      return found?.sha ?? null;
    },
  };
}
