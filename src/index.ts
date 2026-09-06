/**
 * Public API for building integrations on top of dynamic-scraper.
 *
 * The command-line entrypoint lives in `src/cli`; this module contains the
 * reusable types and services that can be imported by other applications.
 */

export type {
  ScraperType,
  ScrapedItem,
  FilterResult,
  ItemFilter,
  DownloadStatus,
  DownloadResult,
  ScrapeStats,
  TaskResult,
  PageElementHandle,
  PageSource,
  CrawlLink,
} from './core/types.js';
export * from './core/errors.js';
export * from './core/scrape-orchestrator.js';
export * from './config/index.js';
export * from './filters/index.js';
export * from './scrapers/index.js';
export * from './engines/index.js';
export * from './download/index.js';
export * from './storage/index.js';
export * from './tree/index.js';
export * from './logger/logger.js';
