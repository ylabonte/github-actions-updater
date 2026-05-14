import { describe, expect, it } from 'vitest';

import { parseReference } from '../../../src/core/reference.js';

describe('parseReference', () => {
  it('parses owner/repo@v4 as tag', () => {
    const r = parseReference('actions/checkout@v4');
    expect(r).toEqual({
      kind: 'tag',
      owner: 'actions',
      repo: 'checkout',
      subpath: null,
      ref: 'v4',
      comment: null,
    });
  });

  it('parses owner/repo@v1.2.3 as tag', () => {
    const r = parseReference('actions/setup-node@v4.0.1');
    expect(r?.kind).toBe('tag');
    expect(r).toMatchObject({ owner: 'actions', repo: 'setup-node', ref: 'v4.0.1' });
  });

  it('parses pure-numeric semver as tag', () => {
    const r = parseReference('actions/setup-node@4.0.1');
    expect(r?.kind).toBe('tag');
  });

  it('parses a subpath', () => {
    const r = parseReference('aws-actions/aws-toolkit-action/configure@v2');
    expect(r).toMatchObject({
      owner: 'aws-actions',
      repo: 'aws-toolkit-action',
      subpath: 'configure',
    });
  });

  it('parses 40-char SHA as sha-pinned', () => {
    const r = parseReference('actions/checkout@a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0');
    expect(r?.kind).toBe('sha-pinned');
  });

  it('parses SHA with trailing version comment', () => {
    const r = parseReference('actions/checkout@a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0 # v4.1.1');
    expect(r).toMatchObject({ kind: 'sha-pinned', comment: 'v4.1.1' });
  });

  it('parses short SHA as sha-pinned', () => {
    const r = parseReference('actions/checkout@a1b2c3d');
    expect(r?.kind).toBe('sha-pinned');
  });

  it('parses branch refs', () => {
    const r = parseReference('actions/checkout@main');
    expect(r?.kind).toBe('branch');
  });

  it('parses release branch with slashes treated as branch', () => {
    const r = parseReference('actions/checkout@release/v1');
    expect(r?.kind).toBe('branch');
  });

  it('parses local paths', () => {
    const r = parseReference('./.github/actions/build');
    expect(r).toEqual({ kind: 'local', path: './.github/actions/build' });
  });

  it('parses docker refs with tag', () => {
    const r = parseReference('docker://alpine:3.20');
    expect(r).toEqual({ kind: 'docker', image: 'alpine', tag: '3.20' });
  });

  it('parses docker refs without tag', () => {
    const r = parseReference('docker://alpine');
    expect(r).toEqual({ kind: 'docker', image: 'alpine', tag: null });
  });

  it('parses docker refs with registry host and port', () => {
    const r = parseReference('docker://registry:5000/myimage:v1');
    expect(r).toEqual({ kind: 'docker', image: 'registry:5000/myimage', tag: 'v1' });
  });

  it('returns null for malformed inputs', () => {
    expect(parseReference('')).toBeNull();
    expect(parseReference('@')).toBeNull();
    expect(parseReference('owner@v1')).toBeNull();
    expect(parseReference('owner/@v1')).toBeNull();
    expect(parseReference('/repo@v1')).toBeNull();
    expect(parseReference('owner/repo@')).toBeNull();
    expect(parseReference('owner/repo')).toBeNull();
  });

  it('strips trailing comments not on SHA-pinned refs', () => {
    const r = parseReference('actions/checkout@v4 # some note');
    expect(r).toMatchObject({ kind: 'tag', ref: 'v4', comment: null });
  });

  it('handles comment with empty body', () => {
    const r = parseReference('actions/checkout@v4 #');
    expect(r?.kind).toBe('tag');
  });
});
