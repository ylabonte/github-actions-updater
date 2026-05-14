import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDockerHubClient } from '../../../../src/core/resolver/docker-resolver.js';

describe('createDockerHubClient', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('paginates through tag pages until next is null', async () => {
    const pages = [
      { results: [{ name: '1.0' }, { name: '1.1' }], next: 'page2' },
      { results: [{ name: '1.2' }], next: null },
    ];
    let i = 0;
    globalThis.fetch = vi.fn(async () => Response.json(pages[i++]!));

    const client = createDockerHubClient();
    const tags = await client.listTags('node');
    expect(tags).toEqual(['1.0', '1.1', '1.2']);
  });

  it('prefixes single-segment images with library/', async () => {
    const fetchMock = vi.fn(async (_url: string) =>
      Response.json({ results: [], next: null }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const client = createDockerHubClient();
    await client.listTags('alpine');
    expect(fetchMock.mock.calls[0]?.[0]).toContain('library/alpine');
  });

  it('throws on non-OK responses', async () => {
    globalThis.fetch = vi.fn(async () => new Response('nope', { status: 500 }));
    const client = createDockerHubClient();
    await expect(client.listTags('node')).rejects.toThrow(/500/);
  });
});
