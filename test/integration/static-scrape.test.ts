/* eslint-disable @typescript-eslint/require-await -- */
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/download/http-client.js', () => ({
  httpGetText: vi.fn(),
  httpGetBinary: vi.fn(),
  httpHead: vi.fn(),
}));

const { httpGetText, httpGetBinary } = await import('../../src/download/http-client.js');
const { ScrapeOrchestrator } = await import('../../src/core/scrape-orchestrator.js');
const { taskConfigSchema } = await import('../../src/config/schema.js');
const { Logger } = await import('../../src/logger/logger.js');

const PAGE_1 = `<!DOCTYPE html><html><body>
  <img src="/img/one.jpg" alt="one" />
  <img src="/img/two.png" alt="two" />
  <a href="/page2">next page</a>
</body></html>`;

const PAGE_2 = `<!DOCTYPE html><html><body>
  <img src="/img/three.jpg" alt="three" />
</body></html>`;

function textResponse(body: string, finalUrl: string) {
  return { body, status: 200, headers: new Headers(), finalUrl };
}

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scraper-orchestrator-'));
  vi.mocked(httpGetText).mockReset();
  vi.mocked(httpGetBinary).mockReset();
  vi.mocked(httpGetBinary).mockResolvedValue({
    buffer: Buffer.from('fake-bytes'),
    status: 200,
    headers: new Headers(),
    finalUrl: 'https://example.com/img/x',
  });
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('ScrapeOrchestrator (static engine, mocked HTTP)', () => {
  it('scrapes a single page, filters by extension, and saves matching files', async () => {
    vi.mocked(httpGetText).mockImplementation(async (_url: string) =>
      textResponse(PAGE_1, 'https://example.com/'),
    );

    const config = taskConfigSchema.parse({
      name: 'single-page',
      url: 'https://example.com/',
      output: { directory: tmpDir, numberingStyle: 'none' },
      browser: { engine: 'static' },
      targets: [{ type: 'image', selector: 'img' }],
      filters: { extensions: ['jpg'] },
    });

    const orchestrator = new ScrapeOrchestrator(new Logger({ level: 'silent' }));
    const result = await orchestrator.runTask(config);

    expect(result.stats.pagesVisited).toBe(1);
    expect(result.stats.itemsFound).toBe(2);
    expect(result.stats.itemsPassedFilters).toBe(1);
    expect(result.downloads).toHaveLength(1);
    expect(result.downloads[0]?.status).toBe('saved');

    const files = await fs.readdir(tmpDir);
    expect(files).toEqual(['one.jpg']);
  });

  it('crawls to depth 1 and aggregates results from every visited page', async () => {
    vi.mocked(httpGetText).mockImplementation(async (url: string) => {
      if (url.includes('/page2')) return textResponse(PAGE_2, 'https://example.com/page2');
      return textResponse(PAGE_1, 'https://example.com/');
    });

    const config = taskConfigSchema.parse({
      name: 'crawl-depth-1',
      url: 'https://example.com/',
      output: { directory: tmpDir, numberingStyle: 'sequential', numberPadding: 2 },
      browser: { engine: 'static' },
      targets: [{ type: 'image', selector: 'img' }],
      filters: { maxDepth: 1 },
    });

    const orchestrator = new ScrapeOrchestrator(new Logger({ level: 'silent' }));
    const result = await orchestrator.runTask(config);

    expect(result.stats.pagesVisited).toBe(2);
    expect(result.stats.itemsFound).toBe(3);
    expect(result.downloads).toHaveLength(3);
  });

  it('does not crawl beyond maxDepth (default 0 = start page only)', async () => {
    vi.mocked(httpGetText).mockImplementation(async () =>
      textResponse(PAGE_1, 'https://example.com/'),
    );

    const config = taskConfigSchema.parse({
      url: 'https://example.com/',
      output: { directory: tmpDir },
      browser: { engine: 'static' },
      targets: [{ type: 'image', selector: 'img' }],
    });

    const orchestrator = new ScrapeOrchestrator(new Logger({ level: 'silent' }));
    const result = await orchestrator.runTask(config);
    expect(result.stats.pagesVisited).toBe(1);
  });

  it('honors maxResults across a target and reports a minResults shortfall as a warning', async () => {
    vi.mocked(httpGetText).mockImplementation(async () =>
      textResponse(PAGE_1, 'https://example.com/'),
    );

    const config = taskConfigSchema.parse({
      url: 'https://example.com/',
      output: { directory: tmpDir },
      browser: { engine: 'static' },
      targets: [{ type: 'image', selector: 'img' }],
      filters: { maxResults: 1, minResults: 5 },
    });

    const orchestrator = new ScrapeOrchestrator(new Logger({ level: 'silent' }));
    const result = await orchestrator.runTask(config);

    expect(result.stats.itemsPassedFilters).toBe(1);
    expect(result.warnings.some((w) => w.includes('minimum required is 5'))).toBe(true);
  });

  it('records a page-open failure without crashing the whole task', async () => {
    vi.mocked(httpGetText).mockRejectedValue(new Error('connection refused'));

    const config = taskConfigSchema.parse({
      url: 'https://example.com/',
      output: { directory: tmpDir },
      browser: { engine: 'static' },
      targets: [{ type: 'image', selector: 'img' }],
    });

    const orchestrator = new ScrapeOrchestrator(new Logger({ level: 'silent' }));
    const result = await orchestrator.runTask(config);

    expect(result.stats.pagesVisited).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
