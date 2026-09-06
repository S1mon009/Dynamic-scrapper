import { describe, expect, it } from 'vitest';
import { FilterChain } from '../../../src/filters/filter-chain.js';
import { buildFilterChain, buildItemFilters } from '../../../src/filters/filter-factory.js';
import { CustomFilterRegistry } from '../../../src/filters/custom-filter.js';
import type { ItemFilter, ScrapedItem } from '../../../src/core/types.js';

function makeItem(overrides: Partial<ScrapedItem> = {}): ScrapedItem {
  return {
    type: 'image',
    attributes: {},
    cssClasses: [],
    sourcePageUrl: 'https://example.com',
    depth: 0,
    ...overrides,
  };
}

const alwaysPass: ItemFilter = { name: 'always-pass', apply: () => ({ passed: true }) };

describe('FilterChain', () => {
  it('rejects further items once maxResults is reached', async () => {
    const chain = new FilterChain([alwaysPass], { maxResults: 2 });
    expect((await chain.evaluate(makeItem())).passed).toBe(true);
    expect((await chain.evaluate(makeItem())).passed).toBe(true);
    const third = await chain.evaluate(makeItem());
    expect(third.passed).toBe(false);
    expect(chain.passedTotal).toBe(2);
  });

  it('checkMinResults reports a shortfall after the run completes', async () => {
    const chain = new FilterChain([alwaysPass], { minResults: 5 });
    await chain.evaluate(makeItem());
    await chain.evaluate(makeItem());
    const result = chain.checkMinResults();
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('2');
    expect(result.reason).toContain('5');
  });

  it('short-circuits on the first failing filter and reports which one', async () => {
    const failing: ItemFilter = { name: 'nope', apply: () => ({ passed: false, reason: 'bad' }) };
    const chain = new FilterChain([alwaysPass, failing]);
    const result = await chain.evaluate(makeItem());
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('nope');
  });
});

describe('buildItemFilters', () => {
  it('only builds filters for fields actually present in the config', () => {
    const filters = buildItemFilters({ extensions: ['jpg'] });
    expect(filters).toHaveLength(1);
    expect(filters[0]?.name).toBe('extensions');
  });

  it('builds every configured filter category', () => {
    const filters = buildItemFilters({
      domains: ['example.com'],
      extensions: ['jpg'],
      include: ['banner'],
      cssClasses: ['thumb'],
    });
    expect(filters.map((f) => f.name).sort()).toEqual([
      'cssClasses',
      'domains',
      'extensions',
      'include',
    ]);
  });

  it('throws a clear error when custom filters are referenced without a registry', () => {
    expect(() => buildItemFilters({ custom: ['myFilter'] })).toThrow(/customFiltersPath/);
  });

  it('resolves custom filters from a provided registry', () => {
    const registry = new CustomFilterRegistry();
    registry.register('onlyPng', (item) => item.url?.endsWith('.png') ?? false);
    const filters = buildItemFilters({ custom: ['onlyPng'] }, registry);
    expect(filters).toHaveLength(1);
    expect(filters[0]?.name).toBe('custom:onlyPng');
  });
});

describe('buildFilterChain', () => {
  it('wires maxResults/minResults from config into the chain', async () => {
    const chain = buildFilterChain({ extensions: ['jpg'], maxResults: 1 });
    expect((await chain.evaluate(makeItem({ url: 'https://x.com/a.jpg' }))).passed).toBe(true);
    expect((await chain.evaluate(makeItem({ url: 'https://x.com/b.jpg' }))).passed).toBe(false);
  });
});
