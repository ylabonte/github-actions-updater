import { describe, expect, it } from 'vitest';

import { renderTable } from '../../../../src/io/output/table.js';
import type { Resolution } from '../../../../src/core/types.js';
import { makeReference } from '../../../helpers/fixtures.js';

// Use a fixed cwd so the rendered "Workflow" column is deterministic across runners.
// makeReference() sets location.file to `/tmp/test.yml`; with cwd `/tmp` the relative
// rendering is simply `test.yml` on every platform.
const FIXED_CWD = '/tmp';

const sample: Resolution[] = [
  {
    reference: makeReference('actions/checkout@v4'),
    current: 'v4',
    latest: 'v4.1.0',
    level: 'minor',
    outdated: true,
  },
  {
    reference: makeReference('actions/setup-node@v4.0.1'),
    current: 'v4.0.1',
    latest: 'v4.0.1',
    level: 'none',
    outdated: false,
  },
  {
    reference: makeReference('docker://node:20'),
    current: '20',
    latest: null,
    level: 'none',
    outdated: false,
    error: 'rate limited',
  },
];

describe('renderTable', () => {
  it('renders without color (snapshot)', () => {
    expect(renderTable(sample, { color: false, cwd: FIXED_CWD })).toMatchSnapshot();
  });

  it('renders with color and contains expected fragments', () => {
    const out = renderTable(sample, { color: true, cwd: FIXED_CWD });
    expect(out).toContain('actions/checkout');
    expect(out).toContain('Workflow');
    expect(out).toContain('outdated');
  });

  it('renders empty input', () => {
    const out = renderTable([], { color: false, cwd: FIXED_CWD });
    expect(out).toContain('0 up to date');
  });

  it('renders local refs by path', () => {
    const r: Resolution = {
      reference: makeReference('./.github/actions/build'),
      current: './.github/actions/build',
      latest: null,
      level: 'none',
      outdated: false,
    };
    const out = renderTable([r], { color: false, cwd: FIXED_CWD });
    expect(out).toContain('./.github/actions/build');
  });
});
