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

  it('loads `.ghaurc` (cosmiconfig auto-detects JSON/YAML)', async () => {
    await writeFile(path.join(cwd, '.ghaurc'), JSON.stringify({ target: 'patch' }));
    const result = await loadConfig(cwd);
    expect(result?.config).toEqual({ target: 'patch' });
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

  it('leaves an absolute `workflowsDir` from config untouched', async () => {
    const abs = path.join(cwd, 'absolute-wf');
    await writeFile(path.join(cwd, '.ghaurc.json'), JSON.stringify({ workflowsDir: abs }));
    const result = await loadConfig(cwd);
    expect(result?.config.workflowsDir).toBe(abs);
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
