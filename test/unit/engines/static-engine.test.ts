import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { StaticPageSource } from '../../../src/engines/static-engine.js';

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));
const sampleHtml = readFileSync(path.join(fixtureDir, '../../fixtures/sample.html'), 'utf-8');

describe('StaticPageSource (jsdom)', () => {
  it('selects elements by CSS selector', async () => {
    const source = StaticPageSource.fromHtml(sampleHtml, 'https://example.com/gallery');
    const images = await source.querySelectorAll('img');
    expect(images).toHaveLength(3);
    expect(await images[0]?.getAttribute('src')).toBe('/images/bleach-001.jpg');
    await source.close();
  });

  it('selects elements by XPath', async () => {
    const source = StaticPageSource.fromHtml(sampleHtml, 'https://example.com/gallery');
    const headings = await source.xpathAll('//h1 | //h2');
    expect(headings).toHaveLength(2);
    expect(await headings[0]?.getText()).toBe('Anime Wallpaper Gallery');
    await source.close();
  });

  it('reads attributes, text, and outer/inner HTML from an element handle', async () => {
    const source = StaticPageSource.fromHtml(sampleHtml, 'https://example.com/gallery');
    const [img] = await source.querySelectorAll('.hero');
    expect(await img?.getAttribute('alt')).toBe('One Piece banner');
    expect(await img?.getTagName()).toBe('img');
    expect(await img?.getOuterHtml()).toContain('onepiece-003.gif');
    await source.close();
  });

  it('throws a clear EngineError on an invalid CSS selector', async () => {
    const source = StaticPageSource.fromHtml(sampleHtml, 'https://example.com/gallery');
    await expect(source.querySelectorAll(':::not-valid:::')).rejects.toThrow(
      /Invalid CSS selector/,
    );
    await source.close();
  });

  it('extracts table rows via CSS selectors for the table scraper to consume', async () => {
    const source = StaticPageSource.fromHtml(sampleHtml, 'https://example.com/gallery');
    const rows = await source.querySelectorAll('#stats tbody tr');
    expect(rows).toHaveLength(2);
    await source.close();
  });
});
