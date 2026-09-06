import type { ScrapeTarget } from '../config/schema.js';
import type { PageElementHandle, PageSource, ScrapedItem, ScraperType } from '../core/types.js';

/** Context supplied to a scraper for one extraction target. */
export interface ScraperContext {
  /** Page currently being inspected. */
  pageSource: PageSource;
  /** Declarative target configuration. */
  target: ScrapeTarget;
  /** Crawl depth of the current page. */
  depth: number;
}

/** Contract implemented by every extraction strategy. */
export interface IScraper {
  /** Target type handled by this scraper. */
  readonly type: ScraperType;
  /** Extracts items from the current page. */
  scrape(context: ScraperContext): Promise<ScrapedItem[]>;
}

/**
 * Resolves the CSS selector or XPath configured for a target.
 *
 * @param pageSource - Page to query.
 * @param target - Extraction target.
 * @returns Matching elements and the selector expression used.
 * @throws Error when the target has no selector or XPath.
 */
export async function resolveElements(
  pageSource: PageSource,
  target: ScrapeTarget,
): Promise<{ elements: PageElementHandle[]; sourceSelector: string }> {
  if (target.xpath) {
    return { elements: await pageSource.xpathAll(target.xpath), sourceSelector: target.xpath };
  }
  if (target.selector) {
    return {
      elements: await pageSource.querySelectorAll(target.selector),
      sourceSelector: target.selector,
    };
  }
  throw new Error(`Target "${target.name ?? target.type}" needs either "selector" or "xpath"`);
}

/**
 * Creates the common item metadata shared by all scraper strategies.
 *
 * @param element - Element to inspect.
 * @param ctx - Current scraper context.
 * @param sourceSelector - Selector or XPath that found the element.
 * @returns Common metadata for a scraped item.
 */
export async function buildBaseItem(
  element: PageElementHandle,
  ctx: ScraperContext,
  sourceSelector: string,
): Promise<Omit<ScrapedItem, 'type'>> {
  const [attributes, tagName, text, outerHtml] = await Promise.all([
    element.getAllAttributes(),
    element.getTagName(),
    element.getText(),
    element.getOuterHtml(),
  ]);
  const cssClasses = (attributes['class'] ?? '').split(/\s+/).filter(Boolean);
  return {
    attributes,
    tagName,
    text,
    html: outerHtml,
    cssClasses,
    sourceSelector,
    sourcePageUrl: ctx.pageSource.url,
    depth: ctx.depth,
  };
}
