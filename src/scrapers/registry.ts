import type { ScraperType } from '../core/types.js';
import { FileScraper, ImageScraper } from './media-scrapers.js';
import { HeadingScraper, TableScraper, TextScraper } from './content-scrapers.js';
import type { IScraper } from './scraper.interface.js';
import { AttributeScraper, CssScraper, LinkScraper, XPathScraper } from './selector-scrapers.js';

/** Registry mapping scraper types to extraction strategies. */
export class ScraperRegistry {
  private readonly scrapers = new Map<ScraperType, IScraper>();

  /** Creates a registry and optionally installs all built-in scrapers. */
  constructor(registerDefaults = true) {
    if (registerDefaults) {
      for (const scraper of [
        new ImageScraper(),
        new FileScraper(),
        new LinkScraper(),
        new TextScraper(),
        new HeadingScraper(),
        new TableScraper(),
        new AttributeScraper(),
        new CssScraper(),
        new XPathScraper(),
      ]) {
        this.register(scraper);
      }
    }
  }

  /** Registers a scraper under its declared type. */
  register(scraper: IScraper): void {
    this.scrapers.set(scraper.type, scraper);
  }

  /** Returns the scraper registered for a type. */
  get(type: ScraperType): IScraper {
    const scraper = this.scrapers.get(type);
    if (!scraper) {
      throw new Error(`No scraper registered for type "${type}"`);
    }
    return scraper;
  }

  /** Checks whether a scraper type is registered. */
  has(type: ScraperType): boolean {
    return this.scrapers.has(type);
  }
}

/** Shared registry containing all built-in scraper strategies. */
export const defaultScraperRegistry = new ScraperRegistry();
