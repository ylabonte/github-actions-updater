import { describe, expect, it } from 'vitest';

import { renderJson } from '../../../../src/io/output/json.js';
import type { Resolution } from '../../../../src/core/types.js';
import { makeReference } from '../../../helpers/fixtures.js';

describe('renderJson', () => {
  it('renders tag resolution with all fields', () => {
    const r: Resolution = {
      reference: makeReference('actions/checkout@v4'),
      current: 'v4',
      latest: 'v4.1.0',
      level: 'minor',
      outdated: true,
    };
    const out = renderJson([r]);
    expect(out.summary).toEqual({ outdated: 1, current: 0, errors: 0, workflows: 1 });
    expect(out.entries[0]).toMatchObject({
      action: 'actions/checkout',
      kind: 'tag',
      current: 'v4',
      latest: 'v4.1.0',
      level: 'minor',
      outdated: true,
    });
  });

  it('renders docker action', () => {
    const r: Resolution = {
      reference: makeReference('docker://node:20'),
      current: '20',
      latest: '21',
      level: 'major',
      outdated: true,
    };
    expect(renderJson([r]).entries[0]?.action).toBe('docker://node');
  });

  it('renders local action', () => {
    const r: Resolution = {
      reference: makeReference('./.github/actions/build'),
      current: './.github/actions/build',
      latest: null,
      level: 'none',
      outdated: false,
    };
    expect(renderJson([r]).entries[0]?.action).toBe('./.github/actions/build');
  });

  it('includes error when present', () => {
    const r: Resolution = {
      reference: makeReference('actions/checkout@v4'),
      current: 'v4',
      latest: null,
      level: 'none',
      outdated: false,
      error: 'rate limited',
    };
    expect(renderJson([r]).entries[0]?.error).toBe('rate limited');
  });

  it('renders subpath in action name', () => {
    const r: Resolution = {
      reference: makeReference('aws-actions/x/configure@v2'),
      current: 'v2',
      latest: 'v2.1.0',
      level: 'minor',
      outdated: true,
    };
    expect(renderJson([r]).entries[0]?.action).toBe('aws-actions/x/configure');
  });
});
