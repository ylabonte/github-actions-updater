import { classifyDiff, pickLatest, type Candidate } from '../comparator.js';
import { parseTag } from '../../utils/semver-tag.js';
import type { DockerRef, Reference, Resolution, Target } from '../types.js';

export interface DockerClient {
  listTags(image: string): Promise<string[]>;
}

/**
 * Resolve a `docker://image:tag` reference by querying the registry. The default client
 * supports Docker Hub library/`<image>` form and GHCR; full registry parsing is intentionally
 * minimal — most workflow `docker://` refs are Docker Hub.
 */
export async function resolveDocker(
  reference: Reference,
  client: DockerClient,
  target: Target,
): Promise<Resolution> {
  const ref = reference.parsed as DockerRef;
  if (!ref.tag) {
    return {
      reference,
      current: 'latest',
      latest: null,
      level: 'none',
      outdated: false,
      error: 'No tag specified; cannot compare versions',
    };
  }

  let tags: string[];
  try {
    tags = await client.listTags(ref.image);
  } catch (error) {
    return {
      reference,
      current: ref.tag,
      latest: null,
      level: 'none',
      outdated: false,
      error: `Failed to list tags: ${(error as Error).message}`,
    };
  }

  const candidates: Candidate[] = [];
  for (const t of tags) {
    const parsed = parseTag(t);
    if (parsed) candidates.push({ tag: parsed });
  }

  const current = parseTag(ref.tag);
  const latest = pickLatest(current, candidates, target);
  const level = classifyDiff(current, latest);

  return {
    reference,
    current: ref.tag,
    latest: latest ? latest.raw : null,
    level,
    outdated: latest !== null && level !== 'none',
  };
}

/**
 * Minimal Docker Hub client. Public images only; uses the v2 catalog API anonymously.
 */
export function createDockerHubClient(): DockerClient {
  return {
    async listTags(image) {
      const path = image.includes('/') ? image : `library/${image}`;
      const tags: string[] = [];
      let url: string | null = `https://hub.docker.com/v2/repositories/${path}/tags/?page_size=100`;
      while (url) {
        const res: Response = await fetch(url);
        if (!res.ok) throw new Error(`Registry responded with ${res.status}`);
        const data = (await res.json()) as { results: { name: string }[]; next: string | null };
        for (const r of data.results) tags.push(r.name);
        url = data.next;
        if (tags.length >= 500) break;
      }
      return tags;
    },
  };
}
