import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type AuthSource = 'env' | 'gh-cli' | 'explicit' | 'anonymous';

export interface AuthResult {
  readonly token: string | null;
  readonly source: AuthSource;
}

export interface ResolveAuthOptions {
  readonly explicitToken?: string;
  readonly env?: NodeJS.ProcessEnv;
  /** Override the spawn function — primarily for testing. */
  readonly runGhCli?: () => Promise<string | null>;
}

/**
 * Resolve a GitHub token using the documented chain:
 *
 *   explicit (--token) → GITHUB_TOKEN / GH_TOKEN env → `gh auth token` → anonymous
 *
 * Anonymous is fine for small workflows but rate-limited at 60 req/hr.
 */
export async function resolveAuth(options: ResolveAuthOptions = {}): Promise<AuthResult> {
  const explicit = options.explicitToken?.trim();
  if (explicit) return { token: explicit, source: 'explicit' };

  const env = options.env ?? process.env;
  const fromEnv = env['GITHUB_TOKEN'] ?? env['GH_TOKEN'];
  if (fromEnv && fromEnv.trim().length > 0) {
    return { token: fromEnv.trim(), source: 'env' };
  }

  const runGh = options.runGhCli ?? defaultGhAuthToken;
  try {
    const token = await runGh();
    if (token && token.trim().length > 0) {
      return { token: token.trim(), source: 'gh-cli' };
    }
  } catch {
    // gh not installed or not logged in — fall through.
  }

  return { token: null, source: 'anonymous' };
}

// Inputs are hardcoded constants — no injection surface. Uses execFile (not shell exec).
/* c8 ignore start — system-boundary: would need a real `gh` binary to exercise. */
async function defaultGhAuthToken(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('gh', ['auth', 'token'], { timeout: 5000 });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}
/* c8 ignore stop */
