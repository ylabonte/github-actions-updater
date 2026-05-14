import type { Reference, Resolution, RemoteRef } from '../types.js';
import type { GitHubClient } from './github-client.js';

/**
 * Resolve a branch-style ref. Branches are mutable — "outdated" here means the local pin
 * (which we don't have) versus current HEAD. Since the user wrote `@main`, there's no local
 * pin to compare against; we always report `level: 'mutable'` and surface the current head
 * SHA so the user can see what they'd be running.
 *
 * On `--write` we offer to convert the branch ref to a SHA pin with a comment, but that is
 * opt-in via a separate flag — the resolver itself just reports.
 */
export async function resolveBranch(
  reference: Reference,
  client: GitHubClient,
): Promise<Resolution> {
  const ref = reference.parsed as RemoteRef;
  const head = await client.getBranchHead(ref.owner, ref.repo, ref.ref);
  if (!head) {
    return {
      reference,
      current: ref.ref,
      latest: null,
      level: 'none',
      outdated: false,
      error: `Branch '${ref.ref}' not found`,
    };
  }
  return {
    reference,
    current: ref.ref,
    latest: `${ref.ref} @ ${head.sha.slice(0, 7)}`,
    level: 'mutable',
    outdated: false,
  };
}
