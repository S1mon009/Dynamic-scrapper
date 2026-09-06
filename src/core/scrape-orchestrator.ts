import { deepMerge } from '../config/merge.js';
import type { FilterConfig, TaskConfig } from '../config/schema.js';
import { CustomFilterRegistry } from '../filters/custom-filter.js';
import { buildFilterChain } from '../filters/filter-factory.js';
import { DownloadManager } from '../download/download-manager.js';
import { EngineFactory } from '../engines/engine-factory.js';
import type { Logger } from '../logger/logger.js';
import { defaultScraperRegistry, type ScraperRegistry } from '../scrapers/registry.js';
import { StorageManager } from '../storage/storage-manager.js';
import { getUrlExtension, resolveUrl, canonicalizeUrl, matchesDomain } from '../utils/url.utils.js';
import type {
  CrawlLink,
  DownloadResult,
  PageSource,
  ScrapedItem,
  ScrapeStats,
  TaskResult,
} from './types.js';

/** Maximum pages a single task will visit, regardless of maxDepth — a hard safety net against runaway crawls. */
const MAX_PAGES_PER_TASK = 500;

/** Anchors pointing at these extensions are almost never "pages" worth crawling into. */
const NON_CRAWLABLE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'svg',
  'ico',
  'bmp',
  'pdf',
  'zip',
  'rar',
  '7z',
  'gz',
  'tar',
  'mp4',
  'mp3',
  'wav',
  'avi',
  'mov',
  'webm',
  'css',
  'js',
  'json',
  'xml',
  'woff',
  'woff2',
  'ttf',
  'eot',
]);

function isCrawlable(
  candidateUrl: string,
  startUrl: string,
  filters: FilterConfig | undefined,
): boolean {
  const ext = getUrlExtension(candidateUrl);
  if (ext && NON_CRAWLABLE_EXTENSIONS.has(ext)) return false;
  if (filters?.domains?.length) {
    return filters.domains.some((d) => matchesDomain(candidateUrl, d));
  }
  return matchesDomain(candidateUrl, new URL(startUrl).hostname);
}

/** Optional callbacks and dependencies used during a task run. */
export interface TaskRunOptions {
  /** Registry used to resolve scraper implementations. */
  scraperRegistry?: ScraperRegistry;
  /** Base directory for relative custom-filter module paths. */
  baseDir?: string;
  /** Called after a page is opened successfully. */
  onPageVisited?: (url: string, depth: number) => void;
  /** Called when crawl links are added to the queue. */
  onBatchQueued?: (count: number) => void;
  /** Called after an item download completes. */
  onItemDownloaded?: (result: DownloadResult) => void;
}

/** Coordinates crawling, extraction, filtering, downloading and reporting. */
export class ScrapeOrchestrator {
  constructor(private readonly logger: Logger) {}

  /**
   * Runs one configured scraping task.
   *
   * @param config - Validated task configuration.
   * @param options - Optional registry, path and progress callbacks.
   * @returns Aggregate statistics, downloads, warnings and errors.
   * @throws Error when the task has no URL or an unrecoverable setup fails.
   */
  async runTask(config: TaskConfig, options: TaskRunOptions = {}): Promise<TaskResult> {
    if (!config.url) {
      throw new Error(`Task "${config.name ?? '(unnamed)'}" has no url`);
    }
    const taskName = config.name ?? config.url;
    const taskLogger = this.logger.child(taskName);
    taskLogger.setLevel(config.logging.level);

    const stats: ScrapeStats = {
      taskName,
      pagesVisited: 0,
      itemsFound: 0,
      itemsPassedFilters: 0,
      itemsSaved: 0,
      itemsSkipped: 0,
      itemsFailed: 0,
      startedAt: new Date(),
    };
    const warnings: string[] = [];
    const errors: string[] = [];
    const downloads: DownloadResult[] = [];

    const customRegistry = new CustomFilterRegistry();
    if (config.customFiltersPath) {
      await customRegistry.loadFromModule(
        config.customFiltersPath,
        options.baseDir ?? process.cwd(),
      );
    }

    const scraperRegistry = options.scraperRegistry ?? defaultScraperRegistry;
    const engineFactory = new EngineFactory(taskLogger);
    const storage = new StorageManager(config.output);
    const downloadManager = new DownloadManager(storage, config.browser, taskLogger);

    const maxDepth = config.filters?.maxDepth ?? 0;
    const visited = new Set<string>();
    const queue: CrawlLink[] = [{ url: config.url, depth: 0 }];

    try {
      while (queue.length > 0 && stats.pagesVisited < MAX_PAGES_PER_TASK) {
        const next = queue.shift();
        if (!next) break;
        const canonical = canonicalizeUrl(next.url);
        if (visited.has(canonical)) continue;
        visited.add(canonical);

        let pageSource: PageSource;
        try {
          pageSource = await engineFactory.openPage(next.url, config.browser);
        } catch (err) {
          const message = (err as Error).message;
          errors.push(`${next.url}: ${message}`);
          taskLogger.warn(`skipping ${next.url}: ${message}`);
          continue;
        }
        stats.pagesVisited += 1;
        taskLogger.info(`scraping ${next.url} (depth ${next.depth})`);
        options.onPageVisited?.(next.url, next.depth);

        try {
          for (const target of config.targets ?? []) {
            await this.runTarget(target, {
              pageSource,
              depth: next.depth,
              config,
              taskLogger,
              scraperRegistry,
              customRegistry,
              downloadManager,
              stats,
              warnings,
              errors,
              downloads,
              options,
            });
          }

          if (next.depth < maxDepth) {
            await this.enqueueLinks(pageSource, next, config, queue, visited);
          }
        } finally {
          await pageSource.close();
        }
      }
    } finally {
      await engineFactory.close();
    }

    for (const d of downloads) {
      if (d.status === 'failed') {
        stats.itemsFailed += 1;
        if (d.error) errors.push(d.error);
      } else if (d.status === 'skipped') {
        stats.itemsSkipped += 1;
      } else {
        stats.itemsSaved += 1;
      }
    }

    stats.finishedAt = new Date();
    return { taskName, stats, downloads, warnings, errors };
  }

  private async runTarget(
    target: NonNullable<TaskConfig['targets']>[number],
    ctx: {
      pageSource: PageSource;
      depth: number;
      config: TaskConfig;
      taskLogger: Logger;
      scraperRegistry: ScraperRegistry;
      customRegistry: CustomFilterRegistry;
      downloadManager: DownloadManager;
      stats: ScrapeStats;
      warnings: string[];
      errors: string[];
      downloads: DownloadResult[];
      options: TaskRunOptions;
    },
  ): Promise<void> {
    const scraper = ctx.scraperRegistry.get(target.type);
    let items: ScrapedItem[];
    try {
      items = await scraper.scrape({ pageSource: ctx.pageSource, target, depth: ctx.depth });
    } catch (err) {
      const message = (err as Error).message;
      ctx.errors.push(
        `target "${target.name ?? target.type}" on ${ctx.pageSource.url}: ${message}`,
      );
      ctx.taskLogger.warn(`target "${target.name ?? target.type}" failed: ${message}`);
      return;
    }
    ctx.stats.itemsFound += items.length;

    const mergedFilters = deepMerge(
      (ctx.config.filters ?? {}) as Record<string, unknown>,
      (target.filters ?? {}) as Record<string, unknown>,
    ) as FilterConfig;
    const filterChain = buildFilterChain(mergedFilters, ctx.customRegistry);
    const needsSizeCheck =
      mergedFilters.minSize !== undefined || mergedFilters.maxSize !== undefined;

    const passed: ScrapedItem[] = [];
    for (const item of items) {
      const enriched = needsSizeCheck ? await ctx.downloadManager.enrichSize(item) : item;
      const result = await filterChain.evaluate(enriched);
      if (result.passed) {
        passed.push(enriched);
      } else {
        ctx.taskLogger.verbose(
          `filtered: ${enriched.url ?? enriched.name ?? enriched.type} — ${result.reason}`,
        );
      }
    }
    ctx.stats.itemsPassedFilters += passed.length;

    const minCheck = filterChain.checkMinResults();
    if (!minCheck.passed) {
      ctx.warnings.push(
        `target "${target.name ?? target.type}" on ${ctx.pageSource.url}: ${minCheck.reason}`,
      );
    }

    ctx.options.onBatchQueued?.(passed.length);
    const results = await ctx.downloadManager.downloadAll(
      passed,
      ctx.config.output.concurrency ?? 5,
      (result) => ctx.options.onItemDownloaded?.(result),
    );
    ctx.downloads.push(...results);
  }

  private async enqueueLinks(
    pageSource: PageSource,
    current: CrawlLink,
    config: TaskConfig,
    queue: CrawlLink[],
    visited: Set<string>,
  ): Promise<void> {
    const anchors = await pageSource.querySelectorAll('a[href]');
    for (const anchor of anchors) {
      const href = await anchor.getAttribute('href');
      const resolved = resolveUrl(href, pageSource.url);
      if (!resolved) continue;
      if (!isCrawlable(resolved, config.url ?? current.url, config.filters)) continue;
      if (visited.has(canonicalizeUrl(resolved))) continue;
      queue.push({ url: resolved, depth: current.depth + 1 });
    }
  }
}
