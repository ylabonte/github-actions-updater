import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { defineConfig, GhauConfigSchema, loadConfig } from '../../../src/core/config.js';

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

  it('loads `ghau.config.json`', async () => {
    await writeFile(
      path.join(cwd, 'ghau.config.json'),
      JSON.stringify({ filters: ['actions/*'], workflowsDir: 'wf' }),
    );
    const result = await loadConfig(cwd);
    expect(result?.config).toEqual({ filters: ['actions/*'], workflowsDir: 'wf' });
  });

  it('loads `ghau.config.js` (CommonJS)', async () => {
    await writeFile(
      path.join(cwd, 'package.json'),
      JSON.stringify({ name: 'fixture', type: 'commonjs' }),
    );
    await writeFile(
      path.join(cwd, 'ghau.config.js'),
      "module.exports = { target: 'major', allowBranchPin: true };\n",
    );
    const result = await loadConfig(cwd);
    expect(result?.config).toEqual({ target: 'major', allowBranchPin: true });
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

describe('defineConfig', () => {
  it('is the identity function (helper for TS users)', () => {
    const cfg = defineConfig({ target: 'minor', rejects: ['docker://**'] });
    expect(cfg).toEqual({ target: 'minor', rejects: ['docker://**'] });
  });
});
