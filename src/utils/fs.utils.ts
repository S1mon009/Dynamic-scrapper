import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Creates a directory and all missing parent directories.
 *
 * @param dirPath - Directory path to create.
 * @returns A promise resolved after the directory exists.
 * @throws Error when the directory cannot be created.
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Returns whether a filesystem path is accessible.
 *
 * @param targetPath - Path to inspect.
 * @returns Whether the path can be accessed.
 */
export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Replaces unsafe filename characters and limits the resulting length.
 *
 * @param name - Candidate filename.
 * @param maxLength - Maximum length of the sanitized name.
 * @returns A filesystem-safe filename.
 */
export function sanitizeFileName(name: string, maxLength = 150): string {
  const cleaned = name
    // eslint-disable-next-line no-control-regex
    .replace(/[/\\?%*:|"<>\x00-\x1f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  const fallback = cleaned.length > 0 ? cleaned : 'file';
  return fallback.length > maxLength ? fallback.slice(0, maxLength) : fallback;
}

/**
 * Joins an output directory and generated file name.
 *
 * @param directory - Output directory.
 * @param fileName - Generated filename.
 * @returns The combined output path.
 */
export function joinOutputPath(directory: string, fileName: string): string {
  return path.join(directory, fileName);
}
