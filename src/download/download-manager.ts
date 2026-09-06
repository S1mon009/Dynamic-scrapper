import pLimit from 'p-limit';
import type { BrowserConfig } from '../config/schema.js';
import type { DownloadResult, ScrapedItem } from '../core/types.js';
import type { Logger } from '../logger/logger.js';
import type { StorageManager } from '../storage/storage-manager.js';
import { httpGetBinary, httpHead, type HttpRequestOptions } from './http-client.js';

const BINARY_TYPES = new Set<ScrapedItem['type']>(['image', 'file']);

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function rowsToCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
}

function textContentFor(item: ScrapedItem): string {
  if (item.type === 'table' && item.tableRows) return rowsToCsv(item.tableRows);
  return item.text ?? item.url ?? '';
}

function defaultExtensionFor(item: ScrapedItem): string | undefined {
  if (item.extension) return item.extension;
  return item.type === 'table' ? 'csv' : 'txt';
}

/** Downloads accepted items and delegates output to a storage manager. */
export class DownloadManager {
  constructor(
    private readonly storage: StorageManager,
    private readonly browserConfig: BrowserConfig,
    private readonly logger: Logger,
  ) {}

  private requestOptions(): HttpRequestOptions {
    return {
      headers: this.browserConfig.headers,
      userAgent: this.browserConfig.userAgent,
      cookies: this.browserConfig.cookies,
      proxy: this.browserConfig.proxy,
      timeoutMs: this.browserConfig.timeout,
    };
  }

  /**
   * Enriches binary items with HEAD-derived size and MIME metadata.
   *
   * @param item - Item whose remote metadata should be inspected.
   * @returns The original item or a copy containing discovered metadata.
   */
  async enrichSize(item: ScrapedItem): Promise<ScrapedItem> {
    if (!item.url || item.sizeBytes !== undefined || !BINARY_TYPES.has(item.type)) return item;
    const head = await httpHead(item.url, this.requestOptions());
    if (!head.ok) return item;
    const lengthHeader = head.headers.get('content-length');
    const typeHeader = head.headers.get('content-type');
    return {
      ...item,
      sizeBytes: lengthHeader ? Number(lengthHeader) : item.sizeBytes,
      mimeType: item.mimeType ?? typeHeader?.split(';')[0]?.trim(),
    };
  }

  /**
   * Downloads items with bounded concurrency and reports each completion.
   *
   * @param items - Items to save.
   * @param concurrency - Maximum number of simultaneous downloads.
   * @param onItemDone - Optional callback invoked after each item finishes.
   * @returns Results in the same order as the input items.
   */
  async downloadAll(
    items: ScrapedItem[],
    concurrency: number | undefined,
    onItemDone?: (result: DownloadResult) => void,
  ): Promise<DownloadResult[]> {
    const safeConcurrency =
      Number.isFinite(concurrency) && (concurrency as number) > 0 ? concurrency : 1;
    const limit = pLimit(Math.max(1, safeConcurrency as number));
    return Promise.all(
      items.map((item) =>
        limit(async () => {
          const result = await this.downloadOne(item);
          onItemDone?.(result);
          return result;
        }),
      ),
    );
  }

  private async downloadOne(item: ScrapedItem): Promise<DownloadResult> {
    try {
      if (!BINARY_TYPES.has(item.type)) {
        const withExt = item.extension ? item : { ...item, extension: defaultExtensionFor(item) };
        return await this.storage.save(withExt, textContentFor(item));
      }
      if (!item.url) {
        return { item, status: 'failed', error: 'item has no URL to download' };
      }
      const response = await httpGetBinary(item.url, this.requestOptions());
      if (response.status >= 400) {
        return { item, status: 'failed', error: `HTTP ${response.status}` };
      }
      return await this.storage.save(item, response.buffer);
    } catch (err) {
      const message = (err as Error).message;
      this.logger.debug(`download failed for ${item.url ?? item.name ?? item.type}: ${message}`);
      return { item, status: 'failed', error: message };
    }
  }
}
