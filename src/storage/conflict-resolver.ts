import path from 'node:path';
import type { ConflictStrategy } from '../config/schema.js';
import { DownloadError } from '../core/errors.js';
import { pathExists } from '../utils/fs.utils.js';

/** Decision returned after inspecting a target path. */
export type ConflictDecision =
  { action: 'proceed'; finalPath: string; hadConflict: boolean } | { action: 'skip' };

/** Resolves output paths according to the configured conflict strategy. */
export class ConflictResolver {
  constructor(private readonly strategy: ConflictStrategy) {}

  /**
   * Determines whether to write, skip, rename or fail for a path.
   *
   * @param targetPath - Desired output path.
   * @returns Conflict decision and, when applicable, final output path.
   * @throws DownloadError when the strategy is `fail` and the path exists.
   */
  async resolve(targetPath: string): Promise<ConflictDecision> {
    const exists = await pathExists(targetPath);
    if (!exists) {
      return { action: 'proceed', finalPath: targetPath, hadConflict: false };
    }

    switch (this.strategy) {
      case 'overwrite':
        return { action: 'proceed', finalPath: targetPath, hadConflict: true };
      case 'skip':
        return { action: 'skip' };
      case 'fail':
        throw new DownloadError(`File already exists (onConflict="fail"): ${targetPath}`);
      case 'rename': {
        const finalPath = await this.findAvailableName(targetPath);
        return { action: 'proceed', finalPath, hadConflict: true };
      }
    }
  }

  private async findAvailableName(targetPath: string): Promise<string> {
    const dir = path.dirname(targetPath);
    const ext = path.extname(targetPath);
    const stem = path.basename(targetPath, ext);
    let counter = 1;
    let candidate = targetPath;
    while (await pathExists(candidate)) {
      candidate = path.join(dir, `${stem} (${counter})${ext}`);
      counter += 1;
    }
    return candidate;
  }
}
