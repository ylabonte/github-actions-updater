# JSON output

When invoked with `--json`, `ghau` writes a structured report to stdout instead of the table.

## Top-level shape

```ts
interface JsonReport {
  summary: {
    outdated: number;
    current: number;
    errors: number;
    workflows: number;
  };
  entries: JsonReportEntry[];
}

interface JsonReportEntry {
  workflow: string; // absolute path
  action: string; // owner/repo[/subpath] or docker://image or ./local
  ref: string; // raw `uses:` value as it appeared in the file
  kind: 'tag' | 'sha-pinned' | 'branch' | 'docker' | 'local';
  current: string;
  latest: string | null;
  level: 'major' | 'minor' | 'patch' | 'mutable' | 'none';
  outdated: boolean;
  error?: string;
}
```

## Example

```json
{
  "summary": { "outdated": 1, "current": 0, "errors": 0, "workflows": 1 },
  "entries": [
    {
      "workflow": "/repo/.github/workflows/ci.yml",
      "action": "actions/checkout",
      "ref": "actions/checkout@v3",
      "kind": "tag",
      "current": "v3",
      "latest": "v4.2.0",
      "level": "major",
      "outdated": true
    }
  ]
}
```

When color output is enabled simultaneously (it's not, by default with `--json`), color escape codes are stripped from the values.
