import type { ScrapedItem } from '../core/types.js';
import { FilterError } from '../core/errors.js';
import {
  getUrlBaseName,
  getUrlExtension,
  looksLikeUrlValue,
  resolveUrl,
} from '../utils/url.utils.js';
import {
  buildBaseItem,
  resolveElements,
  type IScraper,
  type ScraperContext,
} from './scraper.interface.js';

/** Extracts links from an element attribute, normally `href`. */
export class LinkScraper implements IScraper {
  readonly type = 'link' as const;

  /**
   * Extracts and resolves links from the configured target.
   *
   * @param ctx - Current page, target and crawl depth.
   * @returns Extracted link items.
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
        type: 'link',
        ...base,
        url,
        name: (base.text ?? '').trim() || getUrlBaseName(url) || url,
        extension: getUrlExtension(url),
      });
    }
    return items;
  }
}

/** Extracts the value of a configured HTML attribute. */
export class AttributeScraper implements IScraper {
  readonly type = 'attribute' as const;

  /**
   * Extracts attribute values from selected elements.
   *
   * @param ctx - Current page, target and crawl depth.
   * @returns Extracted attribute items.
   * @throws FilterError when the target has no attribute name.
   */
  async scrape(ctx: ScraperContext): Promise<ScrapedItem[]> {
    if (!ctx.target.attribute) {
      throw new FilterError(`Target "${ctx.target.name ?? 'attribute'}" needs "attribute" set`);
    }
    const { elements, sourceSelector } = await resolveElements(ctx.pageSource, ctx.target);
    const items: ScrapedItem[] = [];
    for (const el of elements) {
      const base = await buildBaseItem(el, ctx, sourceSelector);
      const value = base.attributes[ctx.target.attribute];
      if (value === undefined) continue;
      items.push({
        type: 'attribute',
        ...base,
        text: value,
        url: looksLikeUrlValue(value)
          ? (resolveUrl(value, ctx.pageSource.url) ?? undefined)
          : undefined,
        name: ctx.target.name ?? `${ctx.target.attribute}=${value.slice(0, 40)}`,
      });
    }
    return items;
  }
}

/** Extracts complete elements selected with a CSS selector. */
export class CssScraper implements IScraper {
  readonly type = 'css' as const;

  /**
   * Extracts selected elements as HTML items.
   *
   * @param ctx - Current page, target and crawl depth.
   * @returns Extracted CSS-selected items.
   * @throws FilterError when the target has no CSS selector.
   */
  async scrape(ctx: ScraperContext): Promise<ScrapedItem[]> {
    if (!ctx.target.selector) {
      throw new FilterError(`Target "${ctx.target.name ?? 'css'}" needs "selector" set`);
    }
    const elements = await ctx.pageSource.querySelectorAll(ctx.target.selector);
    const items: ScrapedItem[] = [];
    for (const el of elements) {
      const base = await buildBaseItem(el, ctx, ctx.target.selector);
      items.push({ type: 'css', ...base, name: ctx.target.name ?? base.tagName });
    }
    return items;
  }
}

/** Extracts complete elements selected with an XPath expression. */
export class XPathScraper implements IScraper {
  readonly type = 'xpath' as const;

  /**
   * Extracts XPath-selected elements as HTML items.
   *
   * @param ctx - Current page, target and crawl depth.
   * @returns Extracted XPath-selected items.
   * @throws FilterError when the target has no XPath expression.
   */
  async scrape(ctx: ScraperContext): Promise<ScrapedItem[]> {
    if (!ctx.target.xpath) {
      throw new FilterError(`Target "${ctx.target.name ?? 'xpath'}" needs "xpath" set`);
    }
    const elements = await ctx.pageSource.xpathAll(ctx.target.xpath);
    const items: ScrapedItem[] = [];
    for (const el of elements) {
      const base = await buildBaseItem(el, ctx, ctx.target.xpath);
      items.push({ type: 'xpath', ...base, name: ctx.target.name ?? base.tagName });
    }
    return items;
  }
}
