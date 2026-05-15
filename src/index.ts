/**
 * Programmatic entry point. The primary interface is the `ghau` CLI, but we expose the core
 * pieces here so they can be used as a library if someone needs to integrate the check
 * into another tool.
 */

export { runPipeline } from './core/pipeline.js';
export { runCheck } from './commands/check.js';
export { applyUpdates } from './commands/update.js';
export { commitUpdates, buildCommitMessage } from './commands/git-commit.js';
export { resolveAuth } from './core/auth.js';
export { loadConfig, defineConfig, GhauConfigSchema } from './core/config.js';
export { createGitHubClient } from './core/resolver/github-client.js';
export { createDockerHubClient } from './core/resolver/docker-resolver.js';
export { renderTable } from './io/output/table.js';
export { renderJson } from './io/output/json.js';
export { parseReference } from './core/reference.js';
export { parseWorkflow } from './core/parser.js';
export { scanWorkflows } from './core/scanner.js';

export type { GhauConfig, LoadedConfig } from './core/config.js';

export type {
  RefKind,
  RemoteRef,
  DockerRef,
  LocalRef,
  ParsedRef,
  SourceLocation,
  Reference,
  Resolution,
  Target,
  UpdateLevel,
} from './core/types.js';
