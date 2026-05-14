/**
 * Shared domain types.
 *
 * Naming convention: a "Reference" is a parsed `uses:` value plus the location in the source
 * file it came from. A "Resolution" is what the resolver decided about that reference.
 */

export type RefKind =
  | 'tag' // owner/repo@v4 or owner/repo@v4.1.1
  | 'sha-pinned' // owner/repo@<40-char-sha> (with optional `# vX.Y.Z` trailing comment)
  | 'branch' // owner/repo@main
  | 'docker' // docker://image[:tag]
  | 'local'; // ./.github/actions/foo or ./local-action — skipped

export interface RemoteRef {
  readonly kind: Exclude<RefKind, 'local' | 'docker'>;
  readonly owner: string;
  readonly repo: string;
  /** Sub-path inside the repo, e.g. `actions/aws/configure-credentials` from `aws-actions/...@v4`. */
  readonly subpath: string | null;
  /** The literal text after `@` (tag, branch name, or SHA). */
  readonly ref: string;
  /** For SHA-pinned: the trailing `# vX.Y.Z` if present (without the `#`), else null. */
  readonly comment: string | null;
}

export interface DockerRef {
  readonly kind: 'docker';
  readonly image: string; // e.g. "node" or "ghcr.io/owner/image"
  readonly tag: string | null; // null means implicit "latest"
}

export interface LocalRef {
  readonly kind: 'local';
  readonly path: string; // e.g. "./.github/actions/build"
}

export type ParsedRef = RemoteRef | DockerRef | LocalRef;

export interface SourceLocation {
  readonly file: string; // absolute path
  readonly line: number; // 1-based
  readonly column: number; // 1-based, position of the value (after `uses: `)
  /** Byte offset of the `uses:` value start in the original file content. */
  readonly offset: number;
  /** Byte offset of the value end (exclusive). */
  readonly endOffset: number;
}

export interface Reference {
  readonly raw: string; // original string, exactly as it appeared in the file
  readonly parsed: ParsedRef;
  readonly location: SourceLocation;
}

export type UpdateLevel = 'major' | 'minor' | 'patch' | 'mutable' | 'none';

export interface Resolution {
  readonly reference: Reference;
  readonly current: string; // human-readable "current" version (e.g. `v4.1.1`, branch SHA, tag)
  readonly latest: string | null; // null when no remote info available
  readonly level: UpdateLevel;
  /** True iff `latest` represents a strictly newer state than `current`. */
  readonly outdated: boolean;
  /** Optional error info — non-fatal; lets the run continue while flagging the row. */
  readonly error?: string;
}

export type Target = 'latest' | 'major' | 'minor' | 'patch' | 'greatest';
