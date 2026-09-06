import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { StaticPageSource } from '../../../src/engines/static-engine.js';
import { ImageScraper, FileScraper } from '../../../src/scrapers/media-scrapers.js';
import {
  HeadingScraper,
  TableScraper,
  TextScraper,
} from '../../../src/scrapers/content-scrapers.js';
import {
  AttributeScraper,
  CssScraper,
  LinkScraper,
  XPathScraper,
} from '../../../src/scrapers/selector-scrapers.js';
import { ScraperRegistry } from '../../../src/scrapers/registry.js';
import type { ScrapeTarget } from '../../../src/config/schema.js';
import type { ScraperContext } from '../../../src/scrapers/scraper.interface.js';

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));
const sampleHtml = readFileSync(path.join(fixtureDir, '../../fixtures/sample.html'), 'utf-8');

function makeContext(target: ScrapeTarget): ScraperContext {
  const pageSource = StaticPageSource.fromHtml(sampleHtml, 'https://example.com/gallery/');
  return { pageSource, target, depth: 0 };
}

describe('ImageScraper', () => {
  it('resolves absolute URLs and reads alt text as the name', async () => {
    const ctx = makeContext({ type: 'image', selector: 'img' });
    const items = await new ImageScraper().scrape(ctx);
    expect(items).toHaveLength(3);
    expect(items[0]?.url).toBe('https://example.com/images/bleach-001.jpg');
    expect(items[0]?.name).toBe('Bleach wallpaper');
    expect(items[0]?.extension).toBe('jpg');
    expect(items[1]?.url).toBe('https://cdn.example.com/images/naruto-002.png');
  });

  it('falls back to image URLs embedded in script JSON when no DOM img elements match', async () => {
    const html = `<!doctype html><html><body><script>window.__data = {"images":["https:\/\/example.com\/00-1.jpg","https:\/\/example.com\/01-8.png"]};</script></body></html>`; // eslint-disable-line
    const ctx: any = {
      pageSource: StaticPageSource.fromHtml(html, 'https://example.com/chapter/'),
      target: { type: 'image', selector: 'img' },
      depth: 0,
    };

    const items = await new ImageScraper().scrape(ctx);

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.url)).toEqual([
      'https://example.com/00-1.jpg',
      'https://example.com/01-8.png',
    ]);
    expect(items[0]?.name).toBe('00-1');
    expect(items[1]?.extension).toBe('png');
  });

  it('supports CSS class selectors for image targets', async () => {
    const ctx = makeContext({ type: 'image', selector: '.thumb' });
    const items = await new ImageScraper().scrape(ctx);

    expect(items.length).toBeGreaterThan(0);
    expect(items.some((item: any) => item.url.startsWith('https://'))).toBe(true);
    expect(items.some((item: any) => item.name.length > 0)).toBe(true);
  });

  it('does not fall back to script images when a specific class selector matches nothing', async () => {
    const html = `<!doctype html><html><body><script>window.__data = {"images":["https:\/\/example.com\/00-1.jpg"]};</script></body></html>`; // eslint-disable-line
    const ctx: any = {
      pageSource: StaticPageSource.fromHtml(html, 'https://example.com/chapter/'),
      target: { type: 'image', selector: '.missing-class' },
      depth: 0,
    };

    const items = await new ImageScraper().scrape(ctx);

    expect(items).toHaveLength(0);
  });
});

describe('FileScraper', () => {
  it('extracts downloadable links with a resolvable extension', async () => {
    const ctx = makeContext({ type: 'file', selector: 'a[download]' });
    const items = await new FileScraper().scrape(ctx);
    expect(items).toHaveLength(1);
    expect(items[0]?.url).toBe('https://example.com/document.pdf');
    expect(items[0]?.extension).toBe('pdf');
  });
});

describe('LinkScraper', () => {
  it('resolves every link, skipping mailto: and other non-http(s) hrefs', async () => {
    const ctx = makeContext({ type: 'link', selector: 'a' });
    const items = await new LinkScraper().scrape(ctx);
    const urls = items.map((i) => i.url);
    expect(urls).toContain('https://example.com/gallery/1');
    expect(urls).toContain('https://external.example.org/promo');
    expect(urls.some((u) => u?.startsWith('mailto:'))).toBe(false);
  });

  it('classes from the anchor are captured for CSS-class filtering', async () => {
    const ctx = makeContext({ type: 'link', selector: 'a.external' });
    const items = await new LinkScraper().scrape(ctx);
    expect(items).toHaveLength(1);
    expect(items[0]?.cssClasses).toContain('external');
  });
});

describe('TextScraper / HeadingScraper', () => {
  it('extracts trimmed text content', async () => {
    const ctx = makeContext({ type: 'text', selector: '.description' });
    const items = await new TextScraper().scrape(ctx);
    expect(items[0]?.text).toBe('Hand-picked wallpapers updated weekly.');
  });

  it('heading scraper picks up h1/h2 separately from body text', async () => {
    const ctx = makeContext({ type: 'heading', selector: 'h1, h2' });
    const items = await new HeadingScraper().scrape(ctx);
    expect(items.map((i) => i.text)).toEqual(['Anime Wallpaper Gallery', 'Curated collection']);
  });
});

describe('TableScraper', () => {
  it('parses table rows into a 2D array including the header row', async () => {
    const ctx = makeContext({ type: 'table', selector: '#stats' });
    const items = await new TableScraper().scrape(ctx);
    expect(items).toHaveLength(1);
    expect(items[0]?.tableRows).toEqual([
      ['Series', 'Views'],
      ['Bleach', '1200'],
      ['Naruto', '980'],
    ]);
  });
});

describe('AttributeScraper', () => {
  it('reads the configured attribute and also resolves it as a URL when possible', async () => {
    const ctx = makeContext({ type: 'attribute', selector: 'img', attribute: 'data-id' });
    const items = await new AttributeScraper().scrape(ctx);
    expect(items.map((i) => i.text)).toEqual(['101', '102', '103']);
    expect(items[0]?.url).toBeUndefined();
  });

  it('throws a clear error when attribute is not configured', async () => {
    const ctx = makeContext({ type: 'attribute', selector: 'img' });
    await expect(new AttributeScraper().scrape(ctx)).rejects.toThrow(/needs "attribute"/);
  });
});

describe('CssScraper / XPathScraper', () => {
  it('css scraper returns raw matches for any selector', async () => {
    const ctx = makeContext({ type: 'css', selector: '.card' });
    const items = await new CssScraper().scrape(ctx);
    expect(items).toHaveLength(3);
  });

  it('xpath scraper returns raw matches for any expression', async () => {
    const ctx = makeContext({
      type: 'xpath',
      xpath: "//a[contains(concat(' ', normalize-space(@class), ' '), ' card ')]",
    });
    const items = await new XPathScraper().scrape(ctx);
    expect(items).toHaveLength(3);
  });

  it('xpath @class= is an exact match, unlike the CSS class selector', async () => {
    const ctx = makeContext({ type: 'xpath', xpath: '//a[@class="card"]' });
    const items = await new XPathScraper().scrape(ctx);
    expect(items).toHaveLength(2);
  });
});

describe('ScraperRegistry', () => {
  it('has a scraper registered for every built-in scraper type', () => {
    const registry = new ScraperRegistry();
    for (const type of [
      'image',
      'file',
      'link',
      'text',
      'heading',
      'table',
      'attribute',
      'css',
      'xpath',
    ] as const) {
      expect(registry.has(type)).toBe(true);
    }
  });

  it('throws a clear error for an unregistered type', () => {
    const registry = new ScraperRegistry(false);
    expect(() => registry.get('image')).toThrow(/No scraper registered/);
  });

  it('allows registering a custom scraper without touching the built-ins', async () => {
    const registry = new ScraperRegistry();
    registry.register({
      type: 'image',
      // eslint-disable-next-line @typescript-eslint/require-await
      scrape: async () => [
        {
          type: 'image',
          attributes: {},
          cssClasses: [],
          sourcePageUrl: 'https://example.com',
          depth: 0,
          name: 'overridden',
        },
      ],
    });
    const result = await registry
      .get('image')
      .scrape(makeContext({ type: 'image', selector: 'img' }));
    expect(result[0]?.name).toBe('overridden');
  });
});
