import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Logger } from '../../../src/logger/logger.js';
import { browserConfigSchema } from '../../../src/config/schema.js';

const mockPage = {
  setDefaultTimeout: vi.fn(),
  setDefaultNavigationTimeout: vi.fn(),
  goto: vi.fn().mockResolvedValue(undefined),
  waitForSelector: vi.fn().mockResolvedValue(undefined),
  waitForTimeout: vi.fn().mockResolvedValue(undefined),
  click: vi.fn().mockResolvedValue(undefined),
  fill: vi.fn().mockResolvedValue(undefined),
  mouse: { wheel: vi.fn().mockResolvedValue(undefined) },
  keyboard: { press: vi.fn().mockResolvedValue(undefined) },
  evaluate: vi.fn().mockResolvedValue(undefined),
  url: vi.fn().mockReturnValue('https://example.com/'),
  $$: vi.fn().mockResolvedValue([]),
  content: vi.fn().mockResolvedValue('<html></html>'),
  close: vi.fn().mockResolvedValue(undefined),
};

const mockContext = {
  addCookies: vi.fn().mockResolvedValue(undefined),
  newPage: vi.fn().mockResolvedValue(mockPage),
  close: vi.fn().mockResolvedValue(undefined),
};

const mockBrowser = {
  newContext: vi.fn().mockResolvedValue(mockContext),
  close: vi.fn().mockResolvedValue(undefined),
};

const launchMock = vi.fn().mockResolvedValue(mockBrowser);

vi.mock('playwright', () => ({
  chromium: { launch: (...args: unknown[]) => launchMock(...args) },
}));

const { DynamicEngine } = await import('../../../src/engines/dynamic-engine.js');

beforeEach(() => {
  vi.clearAllMocks();
  launchMock.mockResolvedValue(mockBrowser);
  mockBrowser.newContext.mockResolvedValue(mockContext);
  mockContext.newPage.mockResolvedValue(mockPage);
});

describe('DynamicEngine (playwright mocked)', () => {
  it('launches chromium once and reuses it across multiple openPage calls', async () => {
    const engine = new DynamicEngine(new Logger({ level: 'silent' }));
    await engine.openPage('https://example.com', browserConfigSchema.parse({}));
    await engine.openPage('https://example.com/2', browserConfigSchema.parse({}));
    expect(launchMock).toHaveBeenCalledTimes(1);
    await engine.close();
  });

  it('passes userAgent, headers, viewport and proxy through to newContext', async () => {
    const engine = new DynamicEngine(new Logger({ level: 'silent' }));
    const config = browserConfigSchema.parse({
      userAgent: 'test-ua',
      headers: { 'X-Test': '1' },
      viewport: { width: 800, height: 600 },
      proxy: { server: 'http://proxy:8080', username: 'u', password: 'p' },
    });
    await engine.openPage('https://example.com', config);
    expect(mockBrowser.newContext).toHaveBeenCalledWith(
      expect.objectContaining({
        userAgent: 'test-ua',
        extraHTTPHeaders: { 'X-Test': '1' },
        viewport: { width: 800, height: 600 },
        proxy: { server: 'http://proxy:8080', username: 'u', password: 'p' },
      }),
    );
    await engine.close();
  });

  it('injects configured cookies with the page hostname as the default domain', async () => {
    const engine = new DynamicEngine(new Logger({ level: 'silent' }));
    const config = browserConfigSchema.parse({ cookies: [{ name: 'session', value: 'abc' }] });
    await engine.openPage('https://example.com/path', config);
    expect(mockContext.addCookies).toHaveBeenCalledWith([
      { name: 'session', value: 'abc', domain: 'example.com', path: '/' },
    ]);
    await engine.close();
  });

  it('waits for a selector when waitForSelector is configured', async () => {
    const engine = new DynamicEngine(new Logger({ level: 'silent' }));
    const config = browserConfigSchema.parse({ waitForSelector: '#ready' });
    await engine.openPage('https://example.com', config);
    expect(mockPage.waitForSelector).toHaveBeenCalledWith(
      '#ready',
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
    await engine.close();
  });

  it('runs click/scroll/wait/type/press actions in order', async () => {
    const engine = new DynamicEngine(new Logger({ level: 'silent' }));
    const config = browserConfigSchema.parse({
      actions: [
        { type: 'click', selector: '#accept' },
        { type: 'scroll', toBottom: true },
        { type: 'wait', ms: 100 },
        { type: 'type', selector: '#q', text: 'hello' },
        { type: 'press', key: 'Enter' },
      ],
    });
    await engine.openPage('https://example.com', config);
    expect(mockPage.click).toHaveBeenCalledWith('#accept', expect.any(Object));
    expect(mockPage.evaluate).toHaveBeenCalled(); // scroll toBottom
    expect(mockPage.waitForTimeout).toHaveBeenCalledWith(100);
    expect(mockPage.fill).toHaveBeenCalledWith('#q', 'hello');
    expect(mockPage.keyboard.press).toHaveBeenCalledWith('Enter');
    await engine.close();
  });

  it('an optional click that fails to find its selector does not throw', async () => {
    mockPage.click.mockRejectedValueOnce(new Error('not found'));
    const engine = new DynamicEngine(new Logger({ level: 'silent' }));
    const config = browserConfigSchema.parse({
      actions: [{ type: 'click', selector: '#missing', optional: true }],
    });
    await expect(engine.openPage('https://example.com', config)).resolves.toBeDefined();
    await engine.close();
  });

  it('a required (non-optional) click that fails propagates as an EngineError', async () => {
    mockPage.click.mockRejectedValueOnce(new Error('not found'));
    const engine = new DynamicEngine(new Logger({ level: 'silent' }));
    const config = browserConfigSchema.parse({
      actions: [{ type: 'click', selector: '#missing' }],
    });
    await expect(engine.openPage('https://example.com', config)).rejects.toThrow(/click/);
    await engine.close();
  });

  it('wraps a launch failure in a clear EngineError with an install hint', async () => {
    launchMock.mockRejectedValueOnce(new Error('executable not found'));
    const engine = new DynamicEngine(new Logger({ level: 'silent' }));
    await expect(
      engine.openPage('https://example.com', browserConfigSchema.parse({})),
    ).rejects.toThrow(/playwright install/);
  });

  it('querySelectorAll and xpathAll delegate to page.$$ with the right selector syntax', async () => {
    const engine = new DynamicEngine(new Logger({ level: 'silent' }));
    const source = await engine.openPage('https://example.com', browserConfigSchema.parse({}));
    await source.querySelectorAll('.foo');
    await source.xpathAll('//div');
    expect(mockPage.$$).toHaveBeenCalledWith('.foo');
    expect(mockPage.$$).toHaveBeenCalledWith('xpath=//div');
    await engine.close();
  });

  it('close() is a no-op if the browser was never launched', async () => {
    const engine = new DynamicEngine(new Logger({ level: 'silent' }));
    await expect(engine.close()).resolves.toBeUndefined();
    expect(mockBrowser.close).not.toHaveBeenCalled();
  });
});
