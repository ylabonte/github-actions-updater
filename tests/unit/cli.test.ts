import { describe, expect, it } from 'vitest';

import { buildProgram, mergeOptions } from '../../src/cli.js';

/**
 * Drive `mergeOptions` directly so we exercise the `getOptionValueSource`-gated
 * path for every config-mergeable option. The integration tests cover the
 * `rejects` (no-default) case end-to-end; these unit tests close the gap for
 * options with Commander `.default()` values (`target`, `allowBranchPin`,
 * `failOnOutdated`) where the gating logic actually matters.
 */
async function parse(args: readonly string[]) {
  const program = buildProgram();
  await program.parseAsync([...args], { from: 'user' });
  return program;
}

describe('mergeOptions — defaulted Commander options', () => {
  it('config `target` wins when --target is not passed on CLI', async () => {
    const program = await parse(['--json']);
    const merged = mergeOptions(program, { target: 'minor' });
    expect(merged.target).toBe('minor');
  });

  it('CLI --target overrides config `target`', async () => {
    const program = await parse(['--target', 'major']);
    const merged = mergeOptions(program, { target: 'minor' });
    expect(merged.target).toBe('major');
  });

  it("falls back to Commander's `latest` default when neither CLI nor config sets target", async () => {
    const program = await parse([]);
    const merged = mergeOptions(program, {});
    expect(merged.target).toBe('latest');
  });

  it('config `allowBranchPin: true` wins when --allow-branch-pin is not on CLI', async () => {
    const program = await parse([]);
    const merged = mergeOptions(program, { allowBranchPin: true });
    expect(merged.allowBranchPin).toBe(true);
  });

  it('CLI --allow-branch-pin overrides config `allowBranchPin: false`', async () => {
    // Commander applies a `false` default; explicit --allow-branch-pin flips it to true.
    // Config setting false should not win because the CLI source is no longer 'default'.
    const program = await parse(['--allow-branch-pin']);
    const merged = mergeOptions(program, { allowBranchPin: false });
    expect(merged.allowBranchPin).toBe(true);
  });

  it('config `failOnOutdated: true` wins when --fail-on-outdated is not on CLI', async () => {
    const program = await parse([]);
    const merged = mergeOptions(program, { failOnOutdated: true });
    expect(merged.failOnOutdated).toBe(true);
  });

  it('CLI --fail-on-outdated overrides config `failOnOutdated: false`', async () => {
    const program = await parse(['--fail-on-outdated']);
    const merged = mergeOptions(program, { failOnOutdated: false });
    expect(merged.failOnOutdated).toBe(true);
  });
});

describe('mergeOptions — non-defaulted Commander options', () => {
  it('config `filters` wins when --filter is not on CLI', async () => {
    const program = await parse([]);
    const merged = mergeOptions(program, { filters: ['actions/*'] });
    expect(merged.filter).toEqual(['actions/*']);
  });

  it('CLI --filter overrides config `filters`', async () => {
    const program = await parse(['--filter', 'docker://**']);
    const merged = mergeOptions(program, { filters: ['actions/*'] });
    expect(merged.filter).toEqual(['docker://**']);
  });

  it('config `rejects` wins when --reject is not on CLI', async () => {
    const program = await parse([]);
    const merged = mergeOptions(program, { rejects: ['actions/cache'] });
    expect(merged.reject).toEqual(['actions/cache']);
  });

  it('config `workflowsDir` wins when --workflows is not on CLI', async () => {
    const program = await parse([]);
    const merged = mergeOptions(program, { workflowsDir: 'packages/web/.github/workflows' });
    expect(merged.workflows).toBe('packages/web/.github/workflows');
  });

  it('CLI --workflows overrides config `workflowsDir`', async () => {
    const program = await parse(['--workflows', 'cli/.github/workflows']);
    const merged = mergeOptions(program, { workflowsDir: 'config/.github/workflows' });
    expect(merged.workflows).toBe('cli/.github/workflows');
  });

  it('options remain undefined when neither CLI nor config provides them', async () => {
    const program = await parse([]);
    const merged = mergeOptions(program, {});
    expect(merged.filter).toBeUndefined();
    expect(merged.reject).toBeUndefined();
    expect(merged.workflows).toBeUndefined();
  });
});

describe('mergeOptions — non-config-mergeable options pass through unchanged', () => {
  it('preserves `write`, `interactive`, `commit`, `json`, `verbose` from the CLI', async () => {
    const program = await parse(['--write', '--commit', '--json', '--verbose']);
    const merged = mergeOptions(program, { target: 'minor' });
    expect(merged.write).toBe(true);
    expect(merged.commit).toBe(true);
    expect(merged.json).toBe(true);
    expect(merged.verbose).toBe(true);
  });

  it('preserves `token` from the CLI (and never reads it from config)', async () => {
    const program = await parse(['--token', 'ghp_test']);
    const merged = mergeOptions(program, {});
    expect(merged.token).toBe('ghp_test');
  });
});
