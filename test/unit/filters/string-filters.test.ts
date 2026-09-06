import { describe, expect, it } from 'vitest';
import {
  ExcludeFilter,
  IncludeFilter,
  NamePatternFilter,
  RegexFilter,
  UrlPatternFilter,
  WildcardFilter,
} from '../../../src/filters/string-filters.js';
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

describe('IncludeFilter / ExcludeFilter', () => {
  it('include passes when any pattern is a substring of url/name/text', () => {
    const filter = new IncludeFilter(['banner']);
    expect(filter.apply(makeItem({ url: 'https://x.com/banner-01.jpg' })).passed).toBe(true);
    expect(filter.apply(makeItem({ url: 'https://x.com/thumb-01.jpg' })).passed).toBe(false);
  });

  it('exclude rejects when a pattern matches', () => {
    const filter = new ExcludeFilter(['thumb']);
    expect(filter.apply(makeItem({ url: 'https://x.com/thumb-01.jpg' })).passed).toBe(false);
    expect(filter.apply(makeItem({ url: 'https://x.com/full-01.jpg' })).passed).toBe(true);
  });
});

describe('RegexFilter', () => {
  it('matches a bare pattern against url/name/text', () => {
    const filter = new RegexFilter(['\\d{4}-\\d{2}-\\d{2}']);
    expect(filter.apply(makeItem({ name: 'report-2026-07-19' })).passed).toBe(true);
    expect(filter.apply(makeItem({ name: 'report-final' })).passed).toBe(false);
  });

  it('supports /pattern/flags literal syntax', () => {
    const filter = new RegexFilter(['/^IMG_/i']);
    expect(filter.apply(makeItem({ name: 'img_0001' })).passed).toBe(true);
  });

  it('invalid regex never throws — item simply fails to match', () => {
    const filter = new RegexFilter(['(unterminated']);
    expect(() => filter.apply(makeItem({ name: 'x' }))).not.toThrow();
    expect(filter.apply(makeItem({ name: 'x' })).passed).toBe(false);
  });
});

describe('WildcardFilter', () => {
  it('matches glob patterns case-insensitively', () => {
    const filter = new WildcardFilter(['*.JPG', '*.png']);
    expect(filter.apply(makeItem({ url: 'https://x.com/a.jpg' })).passed).toBe(true);
    expect(filter.apply(makeItem({ url: 'https://x.com/a.gif' })).passed).toBe(false);
  });
});

describe('NamePatternFilter / UrlPatternFilter', () => {
  it('namePattern only looks at item.name, not url or text', () => {
    const filter = new NamePatternFilter('report-*');
    expect(
      filter.apply(makeItem({ name: 'report-final', url: 'https://x.com/other' })).passed,
    ).toBe(true);
    expect(
      filter.apply(makeItem({ name: 'summary', url: 'https://x.com/report-final' })).passed,
    ).toBe(false);
  });

  it('urlPattern only looks at item.url', () => {
    const filter = new UrlPatternFilter('*/gallery/*');
    expect(filter.apply(makeItem({ url: 'https://x.com/gallery/1.jpg' })).passed).toBe(true);
    expect(filter.apply(makeItem({ url: 'https://x.com/other/1.jpg' })).passed).toBe(false);
  });
});
