import path from 'node:path';

/**
 * Normalize a (possibly Windows-style) path to POSIX form. We use this for any path that
 * leaves the I/O layer and reaches a human reader (table column, JSON `workflow` field,
 * test assertions) so the output is identical across platforms.
 *
 * Absolute paths intended for `fs` calls keep their native form — only display/relative
 * representations get normalized.
 */
export function toPosixPath(p: string): string {
  if (path.sep === '/') return p;
  /* c8 ignore next — Windows-only branch, not exercised on POSIX CI runners. */
  return p.split(path.sep).join('/');
}
