import type { DockerRef, LocalRef, ParsedRef, RemoteRef } from './types.js';

const SHA_RE = /^[0-9a-f]{40}$/i;
const SHORT_SHA_RE = /^[0-9a-f]{7,39}$/i;

/**
 * Parse a `uses:` value.
 *
 * Forms handled (per GitHub Actions docs):
 * - `owner/repo@ref` (with optional `/subpath`)
 * - `owner/repo/path/to/action@ref`
 * - `./path/to/action` (local)
 * - `docker://image` or `docker://image:tag` or `docker://host/image:tag`
 *
 * Trailing comments (`# v1.2.3`) are conventionally placed on the same line. Those are not
 * part of the value itself — the parser strips them before classification but preserves them
 * via the `comment` field for SHA-pinned refs (so the writer can update them).
 *
 * Returns null when the string cannot be parsed as a known form.
 */
export function parseReference(rawValue: string): ParsedRef | null {
  // Strip an inline comment, but keep its text for SHA-pinned handling.
  let value = rawValue;
  let comment: string | null = null;
  const hashIdx = findCommentStart(value);
  if (hashIdx === -1) {
    value = value.trim();
  } else {
    comment = value.slice(hashIdx + 1).trim() || null;
    value = value.slice(0, hashIdx).trim();
  }

  if (value.length === 0) return null;

  // Local action: relative path starting with `./` or `../`, no `@`.
  if (value.startsWith('./') || value.startsWith('../')) {
    return { kind: 'local', path: value } satisfies LocalRef;
  }

  // Docker action.
  if (value.startsWith('docker://')) {
    const rest = value.slice('docker://'.length);
    const colonIdx = rest.lastIndexOf(':');
    // A colon could be part of a port number in a registry host (e.g. `registry:5000/x`).
    // Tag-vs-port is disambiguated by whether the colon appears after the last `/`.
    const lastSlash = rest.lastIndexOf('/');
    if (colonIdx > lastSlash) {
      return {
        kind: 'docker',
        image: rest.slice(0, colonIdx),
        tag: rest.slice(colonIdx + 1) || null,
      } satisfies DockerRef;
    }
    return { kind: 'docker', image: rest, tag: null } satisfies DockerRef;
  }

  // Remote ref must contain `@` separating the action path from the ref.
  const atIdx = value.indexOf('@');
  if (atIdx === -1) return null;

  const actionPath = value.slice(0, atIdx);
  const ref = value.slice(atIdx + 1);
  if (actionPath.length === 0 || ref.length === 0) return null;

  const segments = actionPath.split('/');
  if (segments.length < 2) return null;
  const owner = segments[0];
  const repo = segments[1];
  if (owner === undefined || repo === undefined || owner.length === 0 || repo.length === 0) {
    return null;
  }
  const subpath = segments.length > 2 ? segments.slice(2).join('/') : null;

  const kind: RemoteRef['kind'] = SHA_RE.test(ref)
    ? 'sha-pinned'
    : looksLikeTag(ref)
      ? 'tag'
      : SHORT_SHA_RE.test(ref)
        ? 'sha-pinned'
        : 'branch';

  return {
    kind,
    owner,
    repo,
    subpath,
    ref,
    comment: kind === 'sha-pinned' ? comment : null,
  } satisfies RemoteRef;
}

/** Heuristic: looks like a tag if it starts with `v` followed by a digit, or is pure-numeric semver. */
function looksLikeTag(ref: string): boolean {
  if (/^v\d/.test(ref)) return true;
  if (/^\d+(\.\d+){0,2}([-+].+)?$/.test(ref)) return true;
  return false;
}

/**
 * Find the byte index of an inline YAML comment in a value, or -1 if there is none.
 *
 * Why this is tricky: a `#` is only a comment when preceded by whitespace (or is the first
 * char), per the YAML spec. `actions/cache@v4#fragment` would not be a comment, but in
 * practice `uses:` values never contain `#` mid-token, so this is a thin safety net.
 */
function findCommentStart(value: string): number {
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    const prev = value[i - 1];
    if (ch === '#' && (i === 0 || (prev !== undefined && /\s/.test(prev)))) {
      return i;
    }
  }
  return -1;
}
