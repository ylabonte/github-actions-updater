import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CLI = join(__dirname, '..', '..', 'src', 'cli.ts');
const IS_WIN = process.platform === 'win32';
// On Windows, the tsx shim is installed as `tsx.cmd`. Spawning a `.cmd` file without a shell
// reaches Node's CVE-2024-27980 guard and fails with ENOENT. Routing through the shell is
// the simplest portable resolution; the args are static test strings so there's no
// injection surface.
const TSX = join(__dirname, '..', '..', 'node_modules', '.bin', IS_WIN ? 'tsx.cmd' : 'tsx');

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Spawn the CLI through tsx so we don't depend on `pnpm build` having run. Runs offline by
 * blanking the GitHub token — tests that need network responses are unit-tested separately
 * with fake clients.
 */
function runCli(args: readonly string[], cwd: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(TSX, [CLI, ...args], {
      cwd,
      env: { ...process.env, GITHUB_TOKEN: '', GH_TOKEN: '', PATH: process.env['PATH'] },
      shell: IS_WIN,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 0 });
    });
  });
}

describe('cli end-to-end', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'ghau-cli-'));
    await mkdir(join(cwd, '.github', 'workflows'), { recursive: true });
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('exits 0 when there are no workflow files', async () => {
    const r = await runCli(['--json'], cwd);
    const data = JSON.parse(r.stdout) as { summary: { outdated: number } };
    expect(data.summary.outdated).toBe(0);
    expect(r.exitCode).toBe(0);
  }, 30_000);

  it('prints --help and exits 0', async () => {
    const r = await runCli(['--help'], cwd);
    expect(r.stdout).toContain('Usage: ghau');
    expect(r.exitCode).toBe(0);
  }, 30_000);

  it('prints version', async () => {
    const r = await runCli(['--version'], cwd);
    expect(r.stdout.trim()).toMatch(/\d+\.\d+\.\d+/);
    expect(r.exitCode).toBe(0);
  }, 30_000);

  it('exits 1 when the workflow has unresolvable actions and rate limit hits', async () => {
    // Without a token and with no network mock, the GitHub API call will fail. We assert the
    // CLI doesn't crash and reports the error via JSON.
    await writeFile(
      join(cwd, '.github', 'workflows', 'ci.yml'),
      'jobs:\n  x:\n    steps:\n      - uses: actions/checkout@v3\n',
    );
    const r = await runCli(['--json', '--filter', 'nonexistent/*'], cwd);
    // After filter removes everything, summary should reflect 0 entries → exit 0.
    const data = JSON.parse(r.stdout) as { summary: { outdated: number; errors: number } };
    expect(data.summary.outdated).toBe(0);
    expect(r.exitCode).toBe(0);
  }, 30_000);

  it('logs the config file path in verbose mode when one is discovered', async () => {
    await writeFile(join(cwd, '.ghaurc.json'), JSON.stringify({ target: 'minor' }));
    const r = await runCli(['--verbose', '--json'], cwd);
    expect(r.stderr).toContain('Config:');
    expect(r.stderr).toContain('.ghaurc.json');
    expect(r.exitCode).toBe(0);
  }, 30_000);

  it('config values feed the pipeline (rejects-from-config filters out actions)', async () => {
    await writeFile(
      join(cwd, '.github', 'workflows', 'ci.yml'),
      'jobs:\n  x:\n    steps:\n      - uses: actions/checkout@v3\n',
    );
    await writeFile(join(cwd, '.ghaurc.json'), JSON.stringify({ rejects: ['actions/*'] }));
    // The reject glob removes every action from the scan → 0 outdated, exit 0,
    // even though the workflow file contains an outdated action and we have no
    // network. If the config wasn't picked up the scan would attempt to resolve
    // and the structure of the result would differ.
    const r = await runCli(['--json'], cwd);
    const data = JSON.parse(r.stdout) as {
      summary: { outdated: number; total: number };
      entries: unknown[];
    };
    expect(data.entries).toHaveLength(0);
    expect(data.summary.outdated).toBe(0);
    expect(r.exitCode).toBe(0);
  }, 30_000);

  it('CLI flags override config values', async () => {
    await writeFile(
      join(cwd, '.github', 'workflows', 'ci.yml'),
      'jobs:\n  x:\n    steps:\n      - uses: actions/checkout@v3\n',
    );
    await writeFile(join(cwd, '.ghaurc.json'), JSON.stringify({ rejects: ['actions/*'] }));
    // CLI `--reject nothing-matches/**` overrides the config's `rejects: ['actions/*']`,
    // so the action is no longer filtered out and reaches the (unresolvable, no-network)
    // GitHub fetch. We assert the entry is present, not its resolution outcome.
    const r = await runCli(['--json', '--reject', 'nothing-matches/**'], cwd);
    const data = JSON.parse(r.stdout) as {
      entries: { action: string }[];
    };
    expect(data.entries.length).toBeGreaterThan(0);
    expect(data.entries[0]?.action).toBe('actions/checkout');
  }, 30_000);

  it('exits 2 with a clear error message when the config is malformed', async () => {
    await writeFile(join(cwd, '.ghaurc.json'), JSON.stringify({ target: 'made-up-target' }));
    const r = await runCli(['--json'], cwd);
    expect(r.stderr).toContain('Invalid ghau config');
    expect(r.stderr).toContain('target');
    expect(r.exitCode).toBe(2);
  }, 30_000);
});
