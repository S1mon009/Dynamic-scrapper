import { describe, expect, it } from 'vitest';
import { NamingStrategy } from '../../../src/storage/naming-strategy.js';
import { outputConfigSchema } from '../../../src/config/schema.js';
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

describe('NamingStrategy', () => {
  it('derives the stem from item.name and appends the extension', () => {
    const strategy = new NamingStrategy(outputConfigSchema.parse({ numberingStyle: 'none' }));
    const name = strategy.generateFileName(makeItem({ name: 'sunset', extension: 'jpg' }), 0);
    expect(name).toBe('sunset.jpg');
  });

  it('zero-pads sequential numbering to the configured width', () => {
    const strategy = new NamingStrategy(
      outputConfigSchema.parse({ filename: 'wallpaper', numberPadding: 3, startIndex: 1 }),
    );
    expect(strategy.generateFileName(makeItem({ extension: 'jpg' }), 0)).toBe('wallpaper-001.jpg');
    expect(strategy.generateFileName(makeItem({ extension: 'jpg' }), 1)).toBe('wallpaper-002.jpg');
  });

  it('honors a custom startIndex', () => {
    const strategy = new NamingStrategy(
      outputConfigSchema.parse({ filename: 'img', startIndex: 100, numberPadding: 0 }),
    );
    expect(strategy.generateFileName(makeItem(), 0)).toBe('img-100');
  });

  it('falls back to a safe sequential number when config values are missing', () => {
    const strategy = new NamingStrategy(outputConfigSchema.parse({ filename: 'img' }));
    expect(strategy.generateFileName(makeItem({ extension: 'jpg' }), 0)).toBe('img-1.jpg');
  });

  it('applies prefix and suffix around the stem+number', () => {
    const strategy = new NamingStrategy(
      outputConfigSchema.parse({
        filename: 'photo',
        prefix: 'IMG_',
        suffix: '_final',
        numberingStyle: 'none',
      }),
    );
    expect(strategy.generateFileName(makeItem({ extension: 'png' }), 0)).toBe(
      'IMG_photo_final.png',
    );
  });

  it('numberingStyle "none" omits the number entirely', () => {
    const strategy = new NamingStrategy(
      outputConfigSchema.parse({ filename: 'report', numberingStyle: 'none' }),
    );
    expect(strategy.generateFileName(makeItem(), 0)).toBe('report');
    expect(strategy.generateFileName(makeItem(), 1)).toBe('report');
  });

  it('falls back to a URL-derived name when the item has no name', () => {
    const strategy = new NamingStrategy(outputConfigSchema.parse({ numberingStyle: 'none' }));
    const name = strategy.generateFileName(
      makeItem({
        name: undefined,
        url: 'https://cdn.example.com/path/cover.png',
        extension: 'png',
      }),
      0,
    );
    expect(name).toBe('cover.png');
  });

  it('sanitizes unsafe characters out of the generated name', () => {
    const strategy = new NamingStrategy(outputConfigSchema.parse({ numberingStyle: 'none' }));
    const name = strategy.generateFileName(makeItem({ name: 'a/b:c*d?.jpg', extension: 'jpg' }), 0);
    expect(name).not.toMatch(/[/\\?*:]/);
  });
});
