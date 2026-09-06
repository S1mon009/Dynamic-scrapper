/** Supported strategies used to extract items from a page. */
export type ScraperType =
  'image' | 'link' | 'file' | 'text' | 'heading' | 'table' | 'attribute' | 'css' | 'xpath';

/** A single item produced by a scraper before it is filtered and stored. */
export interface ScrapedItem {
  /** Kind of content represented by the item. */
  type: ScraperType;
  /** Absolute URL associated with the item, when available. */
  url?: string;
  /** Plain-text representation of the item. */
  text?: string;
  /** HTML representation of the source element. */
  html?: string;
  /** Attributes read from the source element. */
  attributes: Record<string, string>;
  /** Lowercase HTML tag name of the source element. */
  tagName?: string;
  /** CSS classes assigned to the source element. */
  cssClasses: string[];
  /** Selector or XPath that produced the item. */
  sourceSelector?: string;
  /** URL of the page from which the item was extracted. */
  sourcePageUrl: string;
  /** Crawl depth at which the item was found. */
  depth: number;
  /** Human-readable name used for output naming. */
  name?: string;
  /** File extension without the leading dot. */
  extension?: string;
  /** MIME type detected for the item. */
  mimeType?: string;
  /** Resource size in bytes, when known. */
  sizeBytes?: number;
  /** Parsed rows for table items. */
  tableRows?: string[][];
}

/** Behaviour to use when an output file already exists. */
export type ConflictStrategy = 'overwrite' | 'skip' | 'rename' | 'fail';
/** Scheme used to add a unique or sequential number to output names. */
export type NumberingStyle = 'sequential' | 'timestamp' | 'uuid' | 'none';
/** Rendering engine selection mode. */
export type EngineMode = 'static' | 'dynamic' | 'auto';
/** Minimum severity emitted by a logger. */
export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug' | 'verbose';

/** Outcome of applying one filter to an item. */
export interface FilterResult {
  /** Whether the item passed the filter. */
  passed: boolean;
  /** Optional explanation shown when the item is rejected. */
  reason?: string;
}

/** Contract implemented by item filters. */
export interface ItemFilter {
  /** Stable name used in rejection messages. */
  readonly name: string;
  /** Evaluates an item synchronously or asynchronously. */
  apply(item: ScrapedItem): FilterResult | Promise<FilterResult>;
}

/** Result status reported by the storage layer. */
export type DownloadStatus = 'saved' | 'skipped' | 'overwritten' | 'renamed' | 'failed' | 'dry-run';

/** Result of saving one scraped item. */
export interface DownloadResult {
  /** Item that was saved or attempted. */
  item: ScrapedItem;
  /** Final output path, when a file was written. */
  filePath?: string;
  /** Operation outcome. */
  status: DownloadStatus;
  /** Human-readable error for failed operations. */
  error?: string;
  /** Number of bytes written. */
  bytesWritten?: number;
}

/** Counters and timing information for one scraping task. */
export interface ScrapeStats {
  /** Configured task name. */
  taskName: string;
  /** Number of pages visited. */
  pagesVisited: number;
  /** Number of items produced by scrapers. */
  itemsFound: number;
  /** Number of items accepted by filters. */
  itemsPassedFilters: number;
  /** Number of items saved successfully. */
  itemsSaved: number;
  /** Number of items skipped. */
  itemsSkipped: number;
  /** Number of items that failed to save. */
  itemsFailed: number;
  /** Time at which processing started. */
  startedAt: Date;
  /** Time at which processing finished. */
  finishedAt?: Date;
}

/** Complete result of running one scraping task. */
export interface TaskResult {
  /** Configured task name. */
  taskName: string;
  /** Aggregate task counters. */
  stats: ScrapeStats;
  /** Results for individual downloaded items. */
  downloads: DownloadResult[];
  /** Non-fatal warnings collected during the run. */
  warnings: string[];
  /** Errors collected during the run. */
  errors: string[];
}

/** Minimal DOM element abstraction shared by static and dynamic engines. */
export interface PageElementHandle {
  /** Reads one attribute from the element. */
  getAttribute(name: string): Promise<string | null>;
  /** Reads all element attributes as a name/value map. */
  getAllAttributes(): Promise<Record<string, string>>;
  /** Returns trimmed text content. */
  getText(): Promise<string>;
  /** Returns the element including its own tag. */
  getOuterHtml(): Promise<string>;
  /** Returns the element contents without its own tag. */
  getInnerHtml(): Promise<string>;
  /** Returns the lowercase tag name. */
  getTagName(): Promise<string>;
}

/** Page abstraction used by scrapers independently of the rendering engine. */
export interface PageSource {
  /** Final URL after navigation and redirects. */
  readonly url: string;
  /** Finds elements using a CSS selector. */
  querySelectorAll(selector: string): Promise<PageElementHandle[]>;
  /** Finds elements using an XPath expression. */
  xpathAll(expression: string): Promise<PageElementHandle[]>;
  /** Returns the complete current document HTML. */
  getFullHtml(): Promise<string>;
  /** Releases resources owned by the page. */
  close(): Promise<void>;
}

/** Link discovered while crawling pages. */
export interface CrawlLink {
  /** Absolute link URL. */
  url: string;
  /** Crawl depth of the linked page. */
  depth: number;
}
