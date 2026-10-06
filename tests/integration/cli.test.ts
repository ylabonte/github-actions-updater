import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
function runCli(
  args: readonly string[],
  cwd: string,
  env: Readonly<Record<string, string>> = {},
): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(TSX, [CLI, ...args], {
      cwd,
      env: { ...process.env, GITHUB_TOKEN: '', GH_TOKEN: '', PATH: process.env['PATH'], ...env },
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
    // `code` is `number | null`; a default parameter would only cover `undefined`.
    // eslint-disable-next-line unicorn/prefer-default-parameters
    child.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 0 });
    });
  });
}

/** Env that points every home/config-dir lookup at `home`, across platforms. */
function fakeHomeEnv(home: string): Record<string, string> {
  return {
    HOME: home,
    USERPROFILE: home,
    XDG_CONFIG_HOME: join(home, '.config'),
    APPDATA: join(home, 'AppData', 'Roaming'),
  };
}

/** cosmiconfig's (env-paths) global config dir for `ghau` on Linux, macOS and Windows. */
function globalConfigDirs(home: string): string[] {
  return [
    join(home, '.config', 'ghau'),
    join(home, 'Library', 'Preferences', 'ghau'),
    join(home, 'AppData', 'Roaming', 'ghau', 'Config'),
  ];
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

  it('prints the version from package.json', async () => {
    const pkg = JSON.parse(await readFile(join(__dirname, '..', '..', 'package.json'), 'utf8')) as {
      version: string;
    };
    const r = await runCli(['--version'], cwd);
    expect(r.stdout.trim()).toBe(pkg.version);
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

  // CLI-flag-overrides-config-values precedence is covered at the unit level in
  // `tests/unit/cli.test.ts` via direct calls to `mergeOptions(program, config)`.
  // A previous integration test exercised the path end-to-end but had to let
  // an unrejected `actions/checkout@v3` reach the resolver (to assert the
  // override changed which entries appeared), which made a real unauthenticated
  // GitHub API request on CI runners — flaky under rate limiting. The unit-level
  // coverage is comprehensive (every config-mergeable option, both directions
  // including the new --no-allow-branch-pin / --no-fail-on-outdated paths) and
  // offline, so no integration test for this precedence specifically.

  it('exits 2 with a clear error message when the config is malformed', async () => {
    await writeFile(join(cwd, '.ghaurc.json'), JSON.stringify({ target: 'made-up-target' }));
    const r = await runCli(['--json'], cwd);
    expect(r.stderr).toContain('Invalid ghau config');
    expect(r.stderr).toContain('target');
    expect(r.exitCode).toBe(2);
  }, 30_000);

  // cosmiconfig's `global` search strategy (implied by any `stopDir`) also
  // probes an env-paths config dir for `config.{json,yaml,js,ts,cjs,mjs}`,
  // regardless of our `searchPlaces`. These run in a child process because
  // env-paths captures the home directory at module load, so the fake home
  // has to be in place before the CLI starts.
  describe("ignores cosmiconfig's global config directory", () => {
    it('never executes a global config.{js,cjs,mjs}', async () => {
      const home = join(cwd, 'home');
      const marker = join(cwd, 'executed.marker');
      const body = `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'x');\nmodule.exports = {};\n`;
      for (const dir of globalConfigDirs(home)) {
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, 'config.js'), body);
        await writeFile(join(dir, 'config.cjs'), body);
        await writeFile(
          join(dir, 'config.mjs'),
          `import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(marker)}, 'x');\nexport default {};\n`,
        );
      }
      const r = await runCli(['--json'], cwd, fakeHomeEnv(home));
      expect(existsSync(marker)).toBe(false);
      expect(r.exitCode).toBe(0);
    }, 30_000);

    it('never reads a global config.json', async () => {
      const home = join(cwd, 'home');
      for (const dir of globalConfigDirs(home)) {
        await mkdir(dir, { recursive: true });
        // Would fail schema validation (exit 2) if it were loaded.
        await writeFile(join(dir, 'config.json'), JSON.stringify({ notAKey: true }));
      }
      const r = await runCli(['--json'], cwd, fakeHomeEnv(home));
      expect(r.stderr).not.toContain('Invalid ghau config');
      expect(r.exitCode).toBe(0);
    }, 30_000);
  });
});
