import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScrapedItem } from '../../../src/core/types.js';
import { outputConfigSchema, browserConfigSchema } from '../../../src/config/schema.js';
import { StorageManager } from '../../../src/storage/storage-manager.js';
import { rootLogger } from '../../../src/logger/logger.js';

vi.mock('../../../src/download/http-client.js', () => ({
  httpGetBinary: vi.fn(),
  httpHead: vi.fn(),
}));

const { httpGetBinary, httpHead } = await import('../../../src/download/http-client.js');
const { DownloadManager } = await import('../../../src/download/download-manager.js');

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

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scraper-download-'));
  vi.mocked(httpGetBinary).mockReset();
  vi.mocked(httpHead).mockReset();
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('DownloadManager', () => {
  it('downloads a binary item and saves it via storage', async () => {
    vi.mocked(httpGetBinary).mockResolvedValue({
      buffer: Buffer.from('image-bytes'),
      status: 200,
      headers: new Headers(),
      finalUrl: 'https://x.com/a.jpg',
    });
    const storage = new StorageManager(
      outputConfigSchema.parse({ directory: tmpDir, numberingStyle: 'none' }),
    );
    const manager = new DownloadManager(storage, browserConfigSchema.parse({}), rootLogger);
    const [result] = await manager.downloadAll(
      [makeItem({ url: 'https://x.com/a.jpg', name: 'a', extension: 'jpg' })],
      3,
    );
    expect(result?.status).toBe('saved');
    await expect(fs.readFile(result!.filePath!, 'utf-8')).resolves.toBe('image-bytes');
  });

  it('marks an item failed on HTTP error status without throwing', async () => {
    vi.mocked(httpGetBinary).mockResolvedValue({
      buffer: Buffer.alloc(0),
      status: 404,
      headers: new Headers(),
      finalUrl: 'https://x.com/missing.jpg',
    });
    const storage = new StorageManager(outputConfigSchema.parse({ directory: tmpDir }));
    const manager = new DownloadManager(storage, browserConfigSchema.parse({}), rootLogger);
    const [result] = await manager.downloadAll([makeItem({ url: 'https://x.com/missing.jpg' })], 3);
    expect(result?.status).toBe('failed');
    expect(result?.error).toContain('404');
  });

  it('saves non-binary items (text/table) as text/CSV snapshots without any HTTP call', async () => {
    const storage = new StorageManager(
      outputConfigSchema.parse({ directory: tmpDir, numberingStyle: 'none' }),
    );
    const manager = new DownloadManager(storage, browserConfigSchema.parse({}), rootLogger);
    const [result] = await manager.downloadAll(
      [
        makeItem({
          type: 'table',
          name: 'stats',
          tableRows: [
            ['a', 'b'],
            ['1', '2'],
          ],
        }),
      ],
      3,
    );
    expect(result?.status).toBe('saved');
    expect(httpGetBinary).not.toHaveBeenCalled();
    await expect(fs.readFile(result!.filePath!, 'utf-8')).resolves.toBe('a,b\n1,2');
  });

  it('enrichSize only issues a HEAD request for binary items with an unknown size', async () => {
    vi.mocked(httpHead).mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers({ 'content-length': '12345', 'content-type': 'image/jpeg' }),
    });
    const storage = new StorageManager(outputConfigSchema.parse({ directory: tmpDir }));
    const manager = new DownloadManager(storage, browserConfigSchema.parse({}), rootLogger);

    const enriched = await manager.enrichSize(makeItem({ url: 'https://x.com/a.jpg' }));
    expect(enriched.sizeBytes).toBe(12345);
    expect(enriched.mimeType).toBe('image/jpeg');

    const textItem = await manager.enrichSize(makeItem({ type: 'text', text: 'hi' }));
    expect(httpHead).toHaveBeenCalledTimes(1); // not called again for the non-binary item
    expect(textItem.sizeBytes).toBeUndefined();
  });

  it('runs downloads with bounded concurrency', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    vi.mocked(httpGetBinary).mockImplementation(async () => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((resolve) => setTimeout(resolve, 20));
      concurrent -= 1;
      return {
        buffer: Buffer.from('x'),
        status: 200,
        headers: new Headers(),
        finalUrl: 'https://x.com/x',
      };
    });
    const storage = new StorageManager(outputConfigSchema.parse({ directory: tmpDir }));
    const manager = new DownloadManager(storage, browserConfigSchema.parse({}), rootLogger);
    const items = Array.from({ length: 6 }, (_, i) => makeItem({ url: `https://x.com/${i}.jpg` }));
    await manager.downloadAll(items, 2);
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });
});
