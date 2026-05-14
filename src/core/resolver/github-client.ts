import { Octokit } from '@octokit/rest';

export interface GitHubTag {
  readonly name: string;
  readonly sha: string;
}

export interface GitHubBranchRef {
  readonly sha: string;
}

export interface GitHubClient {
  listTags(owner: string, repo: string): Promise<GitHubTag[]>;
  getBranchHead(owner: string, repo: string, branch: string): Promise<GitHubBranchRef | null>;
  resolveTagSha(owner: string, repo: string, tag: string): Promise<string | null>;
}

export interface CreateGitHubClientOptions {
  readonly token: string | null;
  readonly userAgent?: string;
  /** Inject a pre-built Octokit (testing). When provided, `token` is ignored. */
  readonly octokit?: Octokit;
}

/**
 * Thin wrapper around Octokit with per-process caching to avoid duplicate API hits within a
 * single CLI invocation. The cache is keyed by (owner, repo, kind) and is intentionally
 * in-memory only — an on-disk cache layer can be added later without changing the interface.
 */
export function createGitHubClient(options: CreateGitHubClientOptions): GitHubClient {
  const octokit =
    options.octokit ??
    new Octokit({
      auth: options.token ?? undefined,
      userAgent: options.userAgent ?? 'github-actions-updater',
    });

  const tagsCache = new Map<string, Promise<GitHubTag[]>>();
  const branchCache = new Map<string, Promise<GitHubBranchRef | null>>();
  const tagShaCache = new Map<string, Promise<string | null>>();

  return {
    async listTags(owner, repo) {
      const key = `${owner}/${repo}`;
      const existing = tagsCache.get(key);
      if (existing) return existing;
      const promise = fetchAllTags(octokit, owner, repo);
      tagsCache.set(key, promise);
      return promise;
    },
    async getBranchHead(owner, repo, branch) {
      const key = `${owner}/${repo}/${branch}`;
      const existing = branchCache.get(key);
      if (existing) return existing;
      const promise = (async (): Promise<GitHubBranchRef | null> => {
        try {
          const res = await octokit.rest.repos.getBranch({ owner, repo, branch });
          return { sha: res.data.commit.sha };
        } catch (error) {
          if (isNotFound(error)) return null;
          throw error;
        }
      })();
      branchCache.set(key, promise);
      return promise;
    },
    async resolveTagSha(owner, repo, tag) {
      const key = `${owner}/${repo}/${tag}`;
      const existing = tagShaCache.get(key);
      if (existing) return existing;
      const promise = (async (): Promise<string | null> => {
        try {
          // `git/ref` returns the ref directly. Annotated tags need an extra dereference,
          // but for the purpose of pinning to a SHA the ref's SHA is what `actions/checkout`
          // would use, so we accept it as-is.
          const res = await octokit.rest.git.getRef({ owner, repo, ref: `tags/${tag}` });
          if (res.data.object.type === 'tag') {
            // Annotated tag — dereference to commit SHA.
            const tagRes = await octokit.rest.git.getTag({
              owner,
              repo,
              tag_sha: res.data.object.sha,
            });
            return tagRes.data.object.sha;
          }
          return res.data.object.sha;
        } catch (error) {
          if (isNotFound(error)) return null;
          throw error;
        }
      })();
      tagShaCache.set(key, promise);
      return promise;
    },
  };
}

async function fetchAllTags(octokit: Octokit, owner: string, repo: string): Promise<GitHubTag[]> {
  const tags: GitHubTag[] = [];
  // Paginate; most action repos have far fewer than 300 tags.
  const iterator = octokit.paginate.iterator(octokit.rest.repos.listTags, {
    owner,
    repo,
    per_page: 100,
  });
  for await (const page of iterator) {
    for (const t of page.data) {
      tags.push({ name: t.name, sha: t.commit.sha });
    }
    // Cap pagination to avoid pathological repos.
    if (tags.length >= 1000) break;
  }
  return tags;
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    (err as { status: number }).status === 404
  );
}
