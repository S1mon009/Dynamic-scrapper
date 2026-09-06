import { describe, expect, it } from 'vitest';
import {
  ExtensionFilter,
  MimeTypeFilter,
  SizeFilter,
} from '../../../src/filters/resource-filters.js';
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

describe('ExtensionFilter', () => {
  it('accepts extensions with or without a leading dot in config', () => {
    const filter = new ExtensionFilter(['.jpg', 'png']);
    expect(filter.apply(makeItem({ url: 'https://x.com/a.jpg' })).passed).toBe(true);
    expect(filter.apply(makeItem({ url: 'https://x.com/a.png' })).passed).toBe(true);
    expect(filter.apply(makeItem({ url: 'https://x.com/a.gif' })).passed).toBe(false);
  });

  it('derives extension from the URL when item.extension is not set', () => {
    const filter = new ExtensionFilter(['pdf']);
    expect(filter.apply(makeItem({ url: 'https://x.com/report.pdf?download=1' })).passed).toBe(
      true,
    );
  });

  it('rejects when no extension can be resolved', () => {
    const filter = new ExtensionFilter(['jpg']);
    expect(filter.apply(makeItem({ url: 'https://x.com/no-extension-here' })).passed).toBe(false);
  });
});

describe('MimeTypeFilter', () => {
  it('matches an exact mime type', () => {
    const filter = new MimeTypeFilter(['image/jpeg']);
    expect(filter.apply(makeItem({ mimeType: 'image/jpeg' })).passed).toBe(true);
    expect(filter.apply(makeItem({ mimeType: 'image/png' })).passed).toBe(false);
  });

  it('supports wildcard top-level types like image/*', () => {
    const filter = new MimeTypeFilter(['image/*']);
    expect(filter.apply(makeItem({ mimeType: 'image/webp' })).passed).toBe(true);
    expect(filter.apply(makeItem({ mimeType: 'application/pdf' })).passed).toBe(false);
  });

  it('falls back to deriving mime type from the extension', () => {
    const filter = new MimeTypeFilter(['application/pdf']);
    expect(filter.apply(makeItem({ url: 'https://x.com/doc.pdf' })).passed).toBe(true);
  });
});

describe('SizeFilter', () => {
  it('passes items with unknown size (not yet fetched)', () => {
    const filter = new SizeFilter(1000, 5000);
    expect(filter.apply(makeItem()).passed).toBe(true);
  });

  it('enforces min and max bounds once size is known', () => {
    const filter = new SizeFilter(1000, 5000);
    expect(filter.apply(makeItem({ sizeBytes: 500 })).passed).toBe(false);
    expect(filter.apply(makeItem({ sizeBytes: 2000 })).passed).toBe(true);
    expect(filter.apply(makeItem({ sizeBytes: 9000 })).passed).toBe(false);
  });
});
