import { randomUUID } from 'node:crypto';
import type { OutputConfig } from '../config/schema.js';
import type { ScrapedItem } from '../core/types.js';
import { sanitizeFileName } from '../utils/fs.utils.js';
import { getUrlBaseName } from '../utils/url.utils.js';

/** Generates sanitized output file names from items and output settings. */
export class NamingStrategy {
  constructor(private readonly config: OutputConfig) {}

  private formatNumber(position: number): string {
    switch (this.config.numberingStyle) {
      case 'none':
        return '';
      case 'timestamp':
        return String(Date.now());
      case 'uuid':
        return randomUUID();
      case 'sequential':
      default: {
        const startIndex = Number.isFinite(this.config.startIndex) ? this.config.startIndex : 1;
        const numberPadding = Number.isFinite(this.config.numberPadding)
          ? this.config.numberPadding
          : 0;
        const n = startIndex + position;
        return numberPadding > 0 ? String(n).padStart(numberPadding, '0') : String(n);
      }
    }
  }

  private stemFor(item: ScrapedItem): string {
    if (this.config.filename) return sanitizeFileName(this.config.filename);
    const fallback = item.name || (item.url ? getUrlBaseName(item.url) : undefined) || 'item';
    return sanitizeFileName(fallback);
  }

  /**
   * Generates the final file name for an item position.
   *
   * @param item - Item providing the fallback name and extension.
   * @param position - Zero-based item position for sequential numbering.
   * @returns Sanitized output filename.
   */
  generateFileName(item: ScrapedItem, position: number): string {
    const stem = this.stemFor(item);
    const number = this.formatNumber(position);
    const base = number ? `${stem}-${number}` : stem;
    const prefix = this.config.prefix ?? '';
    const suffix = this.config.suffix ?? '';
    const ext = item.extension ? `.${item.extension.replace(/^\./, '')}` : '';
    return `${prefix}${base}${suffix}${ext}`;
  }
}
