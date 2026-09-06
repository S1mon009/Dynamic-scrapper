import { promises as fs } from 'node:fs';
import type { OutputConfig } from '../config/schema.js';
import type { DownloadResult, ScrapedItem } from '../core/types.js';
import { ensureDir, joinOutputPath } from '../utils/fs.utils.js';
import { ConflictResolver } from './conflict-resolver.js';
import { NamingStrategy } from './naming-strategy.js';

/** Writes scraped content to disk with generated names and conflict handling. */
export class StorageManager {
  private readonly naming: NamingStrategy;
  private readonly conflictResolver: ConflictResolver;
  private position = 0;
  private dirEnsured = false;

  constructor(private readonly config: OutputConfig) {
    this.naming = new NamingStrategy(config);
    this.conflictResolver = new ConflictResolver(config.onConflict);
  }

  /**
   * Saves text or binary content and returns its output status.
   *
   * @param item - Item being stored.
   * @param content - Text or binary content to write.
   * @returns Result describing the output operation.
   * @throws Error when the output directory or file cannot be written.
   */
  async save(item: ScrapedItem, content: Buffer | string): Promise<DownloadResult> {
    const fileName = this.naming.generateFileName(item, this.position);
    this.position += 1;
    const targetPath = joinOutputPath(this.config.directory, fileName);

    if (this.config.dryRun) {
      return { item, filePath: targetPath, status: 'dry-run' };
    }

    if (!this.dirEnsured) {
      await ensureDir(this.config.directory);
      this.dirEnsured = true;
    }

    const decision = await this.conflictResolver.resolve(targetPath);
    if (decision.action === 'skip') {
      return { item, filePath: targetPath, status: 'skipped' };
    }

    await fs.writeFile(decision.finalPath, content);
    const bytesWritten = Buffer.isBuffer(content)
      ? content.length
      : Buffer.byteLength(content, 'utf-8');
    const renamed = decision.finalPath !== targetPath;
    return {
      item,
      filePath: decision.finalPath,
      status: renamed ? 'renamed' : decision.hadConflict ? 'overwritten' : 'saved',
      bytesWritten,
    };
  }
}
