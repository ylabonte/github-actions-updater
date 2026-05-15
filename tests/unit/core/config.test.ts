import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GhauConfigSchema, loadConfig } from '../../../src/core/config.js';

describe('loadConfig', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'ghau-config-test-'));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('returns null when no config file is present', async () => {
    const result = await loadConfig(cwd);
    expect(result).toBeNull();
  });

  it('loads `.ghaurc.json`', async () => {
    await writeFile(
      path.join(cwd, '.ghaurc.json'),
      JSON.stringify({ target: 'minor', rejects: ['docker://**'] }),
    );
    const result = await loadConfig(cwd);
    expect(result?.config).toEqual({ target: 'minor', rejects: ['docker://**'] });
    expect(result?.filepath).toBe(path.join(cwd, '.ghaurc.json'));
  });

  it('loads `.ghaurc` with JSON content (cosmiconfig auto-detects)', async () => {
    await writeFile(path.join(cwd, '.ghaurc'), JSON.stringify({ target: 'patch' }));
    const result = await loadConfig(cwd);
    expect(result?.config).toEqual({ target: 'patch' });
  });

  it('loads `.ghaurc` with YAML content (cosmiconfig auto-detects)', async () => {
    // Same filename as the previous test, but written as YAML. cosmiconfig
    // tries the JSON loader first and falls back to YAML, so this exercises
    // the no-extension YAML path independently of the JSON path.
    await writeFile(
      path.join(cwd, '.ghaurc'),
      'target: patch\nallowBranchPin: true\nrejects:\n  - "docker://**"\n',
    );
    const result = await loadConfig(cwd);
    expect(result?.config).toEqual({
      target: 'patch',
      allowBranchPin: true,
      rejects: ['docker://**'],
    });
  });

  it('loads `.ghaurc.yaml`', async () => {
    await writeFile(
      path.join(cwd, '.ghaurc.yaml'),
      'target: major\nallowBranchPin: true\nrejects:\n  - "docker://**"\n',
    );
    const result = await loadConfig(cwd);
    expect(result?.config).toEqual({
      target: 'major',
      allowBranchPin: true,
      rejects: ['docker://**'],
    });
  });

  it('loads `.ghaurc.yml` (the alias-extension form)', async () => {
    // `.yml` is in `searchPlaces` alongside `.yaml`; the previous test only
    // exercised the `.yaml` form. This fixture ensures a regression in
    // either loader path or in `searchPlaces` removes ONE of the documented
    // filenames loudly rather than silently dropping `.yml` support.
    await writeFile(path.join(cwd, '.ghaurc.yml'), 'target: patch\nfailOnOutdated: true\n');
    const result = await loadConfig(cwd);
    expect(result?.config).toEqual({ target: 'patch', failOnOutdated: true });
  });

  it('loads `ghau.config.json`', async () => {
    await writeFile(path.join(cwd, 'ghau.config.json'), JSON.stringify({ filters: ['actions/*'] }));
    const result = await loadConfig(cwd);
    expect(result?.config).toEqual({ filters: ['actions/*'] });
  });

  it('loads the `ghau` key from package.json', async () => {
    await writeFile(
      path.join(cwd, 'package.json'),
      JSON.stringify({
        name: 'fixture',
        ghau: { target: 'minor', failOnOutdated: true },
      }),
    );
    const result = await loadConfig(cwd);
    expect(result?.config).toEqual({ target: 'minor', failOnOutdated: true });
    expect(result?.filepath).toBe(path.join(cwd, 'package.json'));
  });

  it('returns null when package.json exists but has no `ghau` key', async () => {
    await writeFile(path.join(cwd, 'package.json'), JSON.stringify({ name: 'fixture' }));
    const result = await loadConfig(cwd);
    expect(result).toBeNull();
  });

  it('does NOT load executable formats (`.js`, `.mjs`, `.cjs`)', async () => {
    // Defense in depth: even if cosmiconfig's default loaders or a future
    // change re-enabled these, our explicit `searchPlaces` list omits them.
    // All three executable extensions have a fixture so the test name's
    // promise is honored by what's on disk.
    await writeFile(path.join(cwd, 'ghau.config.js'), "module.exports = { target: 'major' };\n");
    await writeFile(path.join(cwd, '.ghaurc.cjs'), "module.exports = { target: 'major' };\n");
    await writeFile(path.join(cwd, '.ghaurc.mjs'), "export default { target: 'major' };\n");
    const result = await loadConfig(cwd);
    expect(result).toBeNull();
  });

  it('resolves a relative `workflowsDir` against the config file directory', async () => {
    // Without resolution, a relative path from a config found while walking
    // up from a subdirectory would resolve against process.cwd(), not the
    // config's directory. We resolve against the config dir.
    const subdir = path.join(cwd, 'packages', 'app');
    await mkdir(subdir, { recursive: true });
    await writeFile(
      path.join(cwd, '.ghaurc.json'),
      JSON.stringify({ workflowsDir: '.github/workflows' }),
    );
    const result = await loadConfig(subdir);
    expect(result?.config.workflowsDir).toBe(path.resolve(cwd, '.github/workflows'));
    expect(result?.filepath).toBe(path.join(cwd, '.ghaurc.json'));
  });

  it('rejects an absolute `workflowsDir` from config (security: repo configs must stay relative)', async () => {
    // Absolute paths in checked-in configs are an attack vector: an
    // attacker-controlled PR could point ghau at `/etc/...` or any other
    // directory outside the repo. Operators who legitimately need to point
    // at an absolute path can pass `--workflows` on the CLI directly.
    const abs = path.join(cwd, 'absolute-wf');
    await writeFile(path.join(cwd, '.ghaurc.json'), JSON.stringify({ workflowsDir: abs }));
    await expect(loadConfig(cwd)).rejects.toThrow(
      /workflowsDir: must be a path relative to the config file's directory/,
    );
  });

  it("rejects a `workflowsDir` that escapes the config file's directory via `..`", async () => {
    // Same threat model: an attacker controlling the config could use a
    // `..`-traversing relative path to escape the repo (or the configured
    // subtree). The containment check after `path.resolve` catches this.
    await writeFile(
      path.join(cwd, '.ghaurc.json'),
      JSON.stringify({ workflowsDir: '../escape-target' }),
    );
    await expect(loadConfig(cwd)).rejects.toThrow(
      /workflowsDir: '\.\.\/escape-target' resolves outside the config file's directory/,
    );
  });

  it('accepts a `workflowsDir` whose `..` segments resolve back inside the directory', async () => {
    // `subdir/../wf` is fine — it resolves to `<cwd>/wf`, which is inside
    // the config dir. The containment check operates on the resolved path,
    // not on the literal string.
    await mkdir(path.join(cwd, 'wf'), { recursive: true });
    await writeFile(
      path.join(cwd, '.ghaurc.json'),
      JSON.stringify({ workflowsDir: 'subdir/../wf' }),
    );
    const result = await loadConfig(cwd);
    expect(result?.config.workflowsDir).toBe(path.resolve(cwd, 'wf'));
  });

  it('rejects a config with an unknown key', async () => {
    await writeFile(
      path.join(cwd, '.ghaurc.json'),
      JSON.stringify({ target: 'minor', unknownKey: true }),
    );
    await expect(loadConfig(cwd)).rejects.toThrow(/Invalid ghau config/);
    await expect(loadConfig(cwd)).rejects.toThrow(/unknownKey/);
  });

  it('rejects a config with the wrong type', async () => {
    await writeFile(path.join(cwd, '.ghaurc.json'), JSON.stringify({ target: 42 }));
    await expect(loadConfig(cwd)).rejects.toThrow(/Invalid ghau config/);
    await expect(loadConfig(cwd)).rejects.toThrow(/target/);
  });

  it('rejects a config with an out-of-enum target', async () => {
    await writeFile(path.join(cwd, '.ghaurc.json'), JSON.stringify({ target: 'whatever' }));
    await expect(loadConfig(cwd)).rejects.toThrow(/Invalid ghau config/);
    await expect(loadConfig(cwd)).rejects.toThrow(/target/);
  });

  it('rejects empty-string entries in filters/rejects arrays', async () => {
    await writeFile(path.join(cwd, '.ghaurc.json'), JSON.stringify({ filters: [''] }));
    await expect(loadConfig(cwd)).rejects.toThrow(/Invalid ghau config/);
  });

  it('accepts an empty config object', async () => {
    await writeFile(path.join(cwd, '.ghaurc.json'), JSON.stringify({}));
    const result = await loadConfig(cwd);
    expect(result?.config).toEqual({});
  });

  it('rethrows cosmiconfig parser errors (malformed JSON) with POSIX-normalized paths', async () => {
    // cosmiconfig's parser throws BEFORE we get to schema validation; the
    // error from the JSON loader includes the native filepath, which can
    // contain backslashes on Windows. The wrapper rethrows with backslashes
    // replaced so the message is stable cross-platform.
    await writeFile(path.join(cwd, '.ghaurc.json'), '{ not valid json');
    await expect(loadConfig(cwd)).rejects.toThrow(/Invalid ghau config/);
    await expect(loadConfig(cwd)).rejects.toThrow(/^[^\\]+$/);
  });

  it('uses POSIX path separators in error messages even on Windows-style native paths', async () => {
    // The native path may contain backslashes on Windows; the error message
    // is user-facing and should be stable cross-platform. We can't easily
    // simulate Windows from a POSIX test, but we can at least assert the
    // error mentions the basename and contains no double-slashes from a
    // botched normalization.
    await writeFile(path.join(cwd, '.ghaurc.json'), JSON.stringify({ target: 'bogus' }));
    await expect(loadConfig(cwd)).rejects.toThrow(/\.ghaurc\.json/);
    await expect(loadConfig(cwd)).rejects.toThrow(/^[^\\]+$/);
  });
});

describe('GhauConfigSchema', () => {
  it('parses a fully populated config', () => {
    const parsed = GhauConfigSchema.parse({
      target: 'greatest',
      filters: ['actions/*', 'docker://node:*'],
      rejects: ['actions/cache'],
      workflowsDir: 'packages/web/.github/workflows',
      allowBranchPin: true,
      failOnOutdated: true,
    });
    expect(parsed.target).toBe('greatest');
    expect(parsed.allowBranchPin).toBe(true);
    expect(parsed.failOnOutdated).toBe(true);
  });

  it('rejects a non-object root', () => {
    expect(() => GhauConfigSchema.parse('not an object')).toThrow();
  });
});
