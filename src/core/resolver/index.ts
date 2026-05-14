import type { Reference, Resolution, Target } from '../types.js';
import { resolveBranch } from './branch-resolver.js';
import { resolveDocker, type DockerClient } from './docker-resolver.js';
import type { GitHubClient } from './github-client.js';
import { resolveSha } from './sha-resolver.js';
import { resolveTag } from './tag-resolver.js';

export interface ResolverDeps {
  readonly github: GitHubClient;
  readonly docker: DockerClient;
}

/**
 * Dispatch a reference to the correct resolver. Local references are filtered upstream and
 * should not reach here, but we tolerate them defensively.
 */
export async function resolve(
  reference: Reference,
  deps: ResolverDeps,
  target: Target,
): Promise<Resolution> {
  const { parsed } = reference;
  switch (parsed.kind) {
    case 'tag': {
      return resolveTag(reference, deps.github, target);
    }
    case 'sha-pinned': {
      return resolveSha(reference, deps.github, target);
    }
    case 'branch': {
      return resolveBranch(reference, deps.github);
    }
    case 'docker': {
      return resolveDocker(reference, deps.docker, target);
    }
    case 'local': {
      return {
        reference,
        current: parsed.path,
        latest: null,
        level: 'none',
        outdated: false,
      };
    }
  }
}

export type { ShaResolution } from './sha-resolver.js';

export { resolveTag } from './tag-resolver.js';
export { resolveSha } from './sha-resolver.js';
export { resolveBranch } from './branch-resolver.js';
export { resolveDocker, type DockerClient } from './docker-resolver.js';
export { type GitHubClient } from './github-client.js';
