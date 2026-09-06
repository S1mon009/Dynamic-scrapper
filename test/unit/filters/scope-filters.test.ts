import { describe, expect, it } from 'vitest';
import { DepthFilter, DomainFilter, SubdomainFilter } from '../../../src/filters/scope-filters.js';
import type { ScrapedItem } from '../../../src/core/types.js';

function makeItem(overrides: Partial<ScrapedItem> = {}): ScrapedItem {
  return {
    type: 'link',
    attributes: {},
    cssClasses: [],
    sourcePageUrl: 'https://example.com',
    depth: 0,
    ...overrides,
  };
}

describe('DomainFilter', () => {
  it('accepts the exact domain and any of its subdomains', () => {
    const filter = new DomainFilter(['example.com']);
    expect(filter.apply(makeItem({ url: 'https://example.com/x' })).passed).toBe(true);
    expect(filter.apply(makeItem({ url: 'https://cdn.example.com/x' })).passed).toBe(true);
    expect(filter.apply(makeItem({ url: 'https://other.com/x' })).passed).toBe(false);
  });
});

describe('SubdomainFilter', () => {
  it('accepts only strict subdomains, not the bare root domain', () => {
    const filter = new SubdomainFilter(['example.com']);
    expect(filter.apply(makeItem({ url: 'https://cdn.example.com/x' })).passed).toBe(true);
    expect(filter.apply(makeItem({ url: 'https://example.com/x' })).passed).toBe(false);
  });
});

describe('DepthFilter', () => {
  it('rejects items sourced from pages deeper than maxDepth', () => {
    const filter = new DepthFilter(1);
    expect(filter.apply(makeItem({ depth: 0 })).passed).toBe(true);
    expect(filter.apply(makeItem({ depth: 1 })).passed).toBe(true);
    expect(filter.apply(makeItem({ depth: 2 })).passed).toBe(false);
  });
});
