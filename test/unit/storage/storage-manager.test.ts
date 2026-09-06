import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StorageManager } from '../../../src/storage/storage-manager.js';
import { outputConfigSchema } from '../../../src/config/schema.js';
import type { ScrapedItem } from '../../../src/core/types.js';

let tmpDir: string;

function makeItem(overrides: Partial<ScrapedItem> = {}): ScrapedItem {
  return {
    type: 'image',
    attributes: {},
    cssClasses: [],
    sourcePageUrl: 'https://example.com',
    depth: 0,
    ...overrides,
  };
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scraper-storage-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('StorageManager', () => {
  it('creates the output directory automatically and writes the file', async () => {
    const nested = path.join(tmpDir, 'a', 'b', 'c');
    const manager = new StorageManager(
      outputConfigSchema.parse({ directory: nested, numberingStyle: 'none' }),
    );
    const result = await manager.save(
      makeItem({ name: 'photo', extension: 'jpg' }),
      Buffer.from('data'),
    );
    expect(result.status).toBe('saved');
    expect(result.filePath).toBe(path.join(nested, 'photo.jpg'));
    await expect(fs.readFile(result.filePath!, 'utf-8')).resolves.toBe('data');
  });

  it('numbers items sequentially across multiple saves', async () => {
    const manager = new StorageManager(
      outputConfigSchema.parse({ directory: tmpDir, filename: 'img', numberPadding: 2 }),
    );
    const r1 = await manager.save(makeItem({ extension: 'jpg' }), Buffer.from('1'));
    const r2 = await manager.save(makeItem({ extension: 'jpg' }), Buffer.from('2'));
    expect(path.basename(r1.filePath!)).toBe('img-01.jpg');
    expect(path.basename(r2.filePath!)).toBe('img-02.jpg');
  });

  it('dry run reports the path it would have used without writing anything', async () => {
    const manager = new StorageManager(
      outputConfigSchema.parse({ directory: tmpDir, dryRun: true, numberingStyle: 'none' }),
    );
    const result = await manager.save(
      makeItem({ name: 'x', extension: 'jpg' }),
      Buffer.from('data'),
    );
    expect(result.status).toBe('dry-run');
    await expect(fs.access(result.filePath!)).rejects.toThrow();
  });

  it('respects onConflict: skip for an already-existing file', async () => {
    const manager = new StorageManager(
      outputConfigSchema.parse({ directory: tmpDir, onConflict: 'skip', numberingStyle: 'none' }),
    );
    await fs.writeFile(path.join(tmpDir, 'x.jpg'), 'old');
    const result = await manager.save(
      makeItem({ name: 'x', extension: 'jpg' }),
      Buffer.from('new'),
    );
    expect(result.status).toBe('skipped');
    await expect(fs.readFile(path.join(tmpDir, 'x.jpg'), 'utf-8')).resolves.toBe('old');
  });

  it('respects onConflict: rename for an already-existing file', async () => {
    const manager = new StorageManager(
      outputConfigSchema.parse({ directory: tmpDir, onConflict: 'rename', numberingStyle: 'none' }),
    );
    await fs.writeFile(path.join(tmpDir, 'x.jpg'), 'old');
    const result = await manager.save(
      makeItem({ name: 'x', extension: 'jpg' }),
      Buffer.from('new'),
    );
    expect(result.status).toBe('renamed');
    expect(result.filePath).toBe(path.join(tmpDir, 'x (1).jpg'));
  });
});
