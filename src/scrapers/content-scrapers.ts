import { JSDOM } from 'jsdom';
import type { ScrapedItem } from '../core/types.js';
import {
  buildBaseItem,
  resolveElements,
  type IScraper,
  type ScraperContext,
} from './scraper.interface.js';

/** Extracts non-empty text from selected elements. */
export class TextScraper implements IScraper {
  readonly type = 'text' as const;

  /**
   * Extracts text items from the configured target.
   *
   * @param ctx - Current page, target and crawl depth.
   * @returns Extracted non-empty text items.
   * @throws Error when the target selector is invalid or missing.
   */
  async scrape(ctx: ScraperContext): Promise<ScrapedItem[]> {
    const { elements, sourceSelector } = await resolveElements(ctx.pageSource, ctx.target);
    const items: ScrapedItem[] = [];
    for (const el of elements) {
      const base = await buildBaseItem(el, ctx, sourceSelector);
      if (!base.text) continue;
      items.push({ type: 'text', ...base, name: ctx.target.name ?? base.text.slice(0, 60) });
    }
    return items;
  }
}

/** Extracts non-empty heading text from selected elements. */
export class HeadingScraper implements IScraper {
  readonly type = 'heading' as const;

  /**
   * Extracts heading items from the configured target.
   *
   * @param ctx - Current page, target and crawl depth.
   * @returns Extracted non-empty heading items.
   * @throws Error when the target selector is invalid or missing.
   */
  async scrape(ctx: ScraperContext): Promise<ScrapedItem[]> {
    const { elements, sourceSelector } = await resolveElements(ctx.pageSource, ctx.target);
    const items: ScrapedItem[] = [];
    for (const el of elements) {
      const base = await buildBaseItem(el, ctx, sourceSelector);
      if (!base.text) continue;
      items.push({ type: 'heading', ...base, name: ctx.target.name ?? base.text.slice(0, 60) });
    }
    return items;
  }
}

function parseTableRows(fragmentHtml: string): string[][] {
  const dom = new JSDOM(fragmentHtml);
  const rows = Array.from(dom.window.document.querySelectorAll('tr'));
  return rows.map((row) =>
    Array.from(row.querySelectorAll('td, th')).map((cell) => (cell.textContent ?? '').trim()),
  );
}

/** Extracts structured rows from selected HTML tables. */
export class TableScraper implements IScraper {
  readonly type = 'table' as const;

  /**
   * Extracts table items and their cell values.
   *
   * @param ctx - Current page, target and crawl depth.
   * @returns Extracted tables with parsed rows.
   * @throws Error when the target selector is invalid or missing.
   */
  async scrape(ctx: ScraperContext): Promise<ScrapedItem[]> {
    const { elements, sourceSelector } = await resolveElements(ctx.pageSource, ctx.target);
    const items: ScrapedItem[] = [];
    for (const [index, el] of elements.entries()) {
      const base = await buildBaseItem(el, ctx, sourceSelector);
      const tableRows = parseTableRows(base.html ?? '');
      if (tableRows.length === 0) continue;
      items.push({
        type: 'table',
        ...base,
        tableRows,
        name: ctx.target.name ? `${ctx.target.name}-${index + 1}` : `table-${index + 1}`,
      });
    }
    return items;
  }
}
