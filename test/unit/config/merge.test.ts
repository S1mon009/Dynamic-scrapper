import { describe, expect, it } from 'vitest';
import { deepMerge, deepMergeAll } from '../../../src/config/merge.js';

describe('deepMerge', () => {
  it('overrides scalar values', () => {
    expect(deepMerge({ a: 1, b: 2 }, { a: 10 })).toEqual({ a: 10, b: 2 });
  });

  it('merges nested objects key by key instead of replacing wholesale', () => {
    const base = { output: { directory: './downloads', prefix: 'x' } };
    const override = { output: { prefix: 'y' } };
    expect(deepMerge(base, override)).toEqual({
      output: { directory: './downloads', prefix: 'y' },
    });
  });

  it('replaces arrays wholesale rather than concatenating', () => {
    const base = { filters: { include: ['*.jpg', '*.png'] } };
    const override = { filters: { include: ['*.gif'] } };
    expect(deepMerge(base, override)).toEqual({ filters: { include: ['*.gif'] } });
  });

  it('never lets undefined in the override erase a base value', () => {
    const base = { name: 'task', url: 'https://example.com' };
    const override = { name: undefined, url: 'https://other.com' };
    expect(deepMerge(base, override)).toEqual({ name: 'task', url: 'https://other.com' });
  });

  it('deepMergeAll applies overrides left to right', () => {
    const result = deepMergeAll({ a: 1, b: 1 }, { a: 2 }, { a: 3, b: 3 });
    expect(result).toEqual({ a: 3, b: 3 });
  });

  it('does not mutate the base object', () => {
    const base = { output: { directory: 'x' } };
    const copy = structuredClone(base);
    deepMerge(base, { output: { directory: 'y' } });
    expect(base).toEqual(copy);
  });
});
