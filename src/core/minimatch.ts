/**
 * Tiny glob matcher for action names. Supports `*` and `**` only — sufficient for filters
 * like `actions/*` or `**\/checkout`. Avoids pulling in `minimatch`/`picomatch` for this
 * one use case.
 */
export function minimatch(value: string, pattern: string): boolean {
  const re = new RegExp(`^${globToRegexBody(pattern)}$`);
  return re.test(value);
}

function globToRegexBody(pattern: string): string {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === undefined) continue;
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        out += '.*';
        i++;
      } else {
        out += '[^/]*';
      }
    } else if (c === '?') {
      out += '[^/]';
    } else if ('.+^${}()|[]\\'.includes(c)) {
      out += `\\${c}`;
    } else {
      out += c;
    }
  }
  return out;
}
