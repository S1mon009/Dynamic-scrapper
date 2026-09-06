import type { ScrapedItem } from '../core/types.js';
import { getUrlBaseName, getUrlExtension, resolveUrl } from '../utils/url.utils.js';
import {
  buildBaseItem,
  resolveElements,
  type IScraper,
  type ScraperContext,
} from './scraper.interface.js';

function extractImageUrlsFromScriptHtml(html: string): string[] {
  const urls = new Set<string>();
  const urlPattern =
    /https?:[\\/]{2}[^"'\s<>]+\.(?:jpe?g|png|gif|webp|avif|bmp|svg)(?:\?[^"'\s<>]*)?/gi;

  for (const match of html.matchAll(urlPattern)) {
    const value = match[0].trim().replace(/\\/g, '');
    if (value) urls.add(value);
  }

  return [...urls];
}

function shouldFallbackToScriptUrls(selector: string | undefined): boolean {
  if (!selector) return true;
  const trimmed = selector.trim();
  if (!trimmed) return true;
  return /^[a-zA-Z][\w:-]*$/i.test(trimmed);
}

/** Extracts image URLs from image elements and supported embedded data. */
export class ImageScraper implements IScraper {
  readonly type = 'image' as const;

  /**
   * Extracts image resources from the configured target.
   *
   * @param ctx - Current page, target and crawl depth.
   * @returns Extracted image items.
   * @throws Error when the target selector is invalid or missing.
   */
  async scrape(ctx: ScraperContext): Promise<ScrapedItem[]> {
    const { elements, sourceSelector } = await resolveElements(ctx.pageSource, ctx.target);
    const items: ScrapedItem[] = [];

    for (const el of elements) {
      const base = await buildBaseItem(el, ctx, sourceSelector);
      const attrName = ctx.target.attribute ?? 'src';
      const raw =
        base.attributes[attrName] ?? base.attributes['data-src'] ?? base.attributes['src'];
      const url = resolveUrl(raw, ctx.pageSource.url);
      if (!url) continue;
      items.push({
        type: 'image',
        ...base,
        url,
        name: base.attributes['alt']?.trim() || getUrlBaseName(url) || 'image',
        extension: getUrlExtension(url),
      });
    }

    if (items.length > 0) return items;
    if (!shouldFallbackToScriptUrls(ctx.target.selector)) return items;

    const html = await ctx.pageSource.getFullHtml();
    const scriptUrls = extractImageUrlsFromScriptHtml(html);
    for (const url of scriptUrls) {
      const resolved = resolveUrl(url, ctx.pageSource.url);
      if (!resolved) continue;
      items.push({
        type: 'image',
        attributes: {},
        cssClasses: [],
        sourceSelector,
        sourcePageUrl: ctx.pageSource.url,
        depth: ctx.depth,
        url: resolved,
        name: getUrlBaseName(resolved) || 'image',
        extension: getUrlExtension(resolved),
      });
    }

    return items;
  }
}

/** Extracts downloadable file URLs from selected elements. */
export class FileScraper implements IScraper {
  readonly type = 'file' as const;

  /**
   * Extracts file resources from the configured target.
   *
   * @param ctx - Current page, target and crawl depth.
   * @returns Extracted file items.
   * @throws Error when the target selector is invalid or missing.
   */
  async scrape(ctx: ScraperContext): Promise<ScrapedItem[]> {
    const { elements, sourceSelector } = await resolveElements(ctx.pageSource, ctx.target);
    const items: ScrapedItem[] = [];
    for (const el of elements) {
      const base = await buildBaseItem(el, ctx, sourceSelector);
      const attrName = ctx.target.attribute ?? 'href';
      const url = resolveUrl(base.attributes[attrName], ctx.pageSource.url);
      if (!url) continue;
      items.push({
        type: 'file',
        ...base,
        url,
        name: (base.text ?? '').trim() || getUrlBaseName(url) || 'file',
        extension: getUrlExtension(url),
      });
    }
    return items;
  }
}
