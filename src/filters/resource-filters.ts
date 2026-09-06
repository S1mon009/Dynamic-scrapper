import mime from 'mime-types';
import type { FilterResult, ItemFilter, ScrapedItem } from '../core/types.js';
import { getUrlExtension } from '../utils/url.utils.js';

function resolveExtension(item: ScrapedItem): string | undefined {
  return item.extension ?? (item.url ? getUrlExtension(item.url) : undefined);
}

function resolveMimeType(item: ScrapedItem): string | undefined {
  if (item.mimeType) return item.mimeType;
  const ext = resolveExtension(item);
  return ext ? mime.lookup(ext) || undefined : undefined;
}

/** Accepts resources whose file extension is in the configured list. */
export class ExtensionFilter implements ItemFilter {
  readonly name = 'extensions';
  private readonly normalized: Set<string>;
  /** Creates an extension filter; leading dots are optional. */
  constructor(extensions: readonly string[]) {
    this.normalized = new Set(extensions.map((e) => e.replace(/^\./, '').toLowerCase()));
  }
  /** Checks the item's resolved extension. */
  apply(item: ScrapedItem): FilterResult {
    const ext = resolveExtension(item);
    if (!ext) return { passed: false, reason: 'item has no resolvable file extension' };
    const passed = this.normalized.has(ext.toLowerCase());
    return passed ? { passed } : { passed, reason: `extension ".${ext}" not in allowed list` };
  }
}

/** Accepts resources matching an exact MIME type or a type wildcard. */
export class MimeTypeFilter implements ItemFilter {
  readonly name = 'mimeTypes';
  /** Creates a MIME type filter. */
  constructor(private readonly allowed: readonly string[]) {}
  /** Checks the item's resolved MIME type. */
  apply(item: ScrapedItem): FilterResult {
    const mimeType = resolveMimeType(item);
    if (!mimeType) return { passed: false, reason: 'item has no resolvable MIME type' };
    const passed = this.allowed.some((pattern) =>
      pattern.endsWith('/*') ? mimeType.startsWith(pattern.slice(0, -1)) : mimeType === pattern,
    );
    return passed ? { passed } : { passed, reason: `mime type "${mimeType}" not in allowed list` };
  }
}

/** Restricts resources to an optional byte-size range. */
export class SizeFilter implements ItemFilter {
  readonly name = 'size';
  /** Creates a size filter with inclusive lower and upper bounds. */
  constructor(
    private readonly minSize?: number,
    private readonly maxSize?: number,
  ) {}
  /** Checks the item's size when it is known. */
  apply(item: ScrapedItem): FilterResult {
    if (item.sizeBytes === undefined) return { passed: true };
    if (this.minSize !== undefined && item.sizeBytes < this.minSize) {
      return { passed: false, reason: `${item.sizeBytes}B is below minSize ${this.minSize}B` };
    }
    if (this.maxSize !== undefined && item.sizeBytes > this.maxSize) {
      return { passed: false, reason: `${item.sizeBytes}B exceeds maxSize ${this.maxSize}B` };
    }
    return { passed: true };
  }
}
