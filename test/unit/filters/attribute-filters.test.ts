import { describe, expect, it } from 'vitest';
import { AttributeFilter, CssClassFilter } from '../../../src/filters/attribute-filters.js';
import type { ScrapedItem } from '../../../src/core/types.js';

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

describe('AttributeFilter', () => {
  it('matches an exact attribute value', () => {
    const filter = new AttributeFilter({ 'data-role': 'thumbnail' });
    expect(filter.apply(makeItem({ attributes: { 'data-role': 'thumbnail' } })).passed).toBe(true);
    expect(filter.apply(makeItem({ attributes: { 'data-role': 'hero' } })).passed).toBe(false);
  });

  it('matches a wildcard attribute value', () => {
    const filter = new AttributeFilter({ alt: '*sunset*' });
    expect(filter.apply(makeItem({ attributes: { alt: 'A beautiful sunset photo' } })).passed).toBe(
      true,
    );
  });

  it('matches a /regex/ attribute value', () => {
    const filter = new AttributeFilter({ 'data-id': '/^\\d+$/' });
    expect(filter.apply(makeItem({ attributes: { 'data-id': '12345' } })).passed).toBe(true);
    expect(filter.apply(makeItem({ attributes: { 'data-id': 'abc' } })).passed).toBe(false);
  });

  it('requires every configured attribute to match', () => {
    const filter = new AttributeFilter({ alt: '*x*', 'data-role': 'thumb' });
    expect(
      filter.apply(makeItem({ attributes: { alt: 'x-ray', 'data-role': 'hero' } })).passed,
    ).toBe(false);
  });

  it('fails when the attribute is missing entirely', () => {
    const filter = new AttributeFilter({ 'data-role': 'thumb' });
    expect(filter.apply(makeItem({ attributes: {} })).passed).toBe(false);
  });
});

describe('CssClassFilter', () => {
  it('passes when the item has at least one of the configured classes', () => {
    const filter = new CssClassFilter(['thumb', 'preview']);
    expect(filter.apply(makeItem({ cssClasses: ['thumb', 'lazy'] })).passed).toBe(true);
    expect(filter.apply(makeItem({ cssClasses: ['hero'] })).passed).toBe(false);
  });
});
