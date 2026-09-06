import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '../../../src/logger/logger.js';
import { browserConfigSchema } from '../../../src/config/schema.js';

vi.mock('../../../src/download/http-client.js', () => ({
  httpGetText: vi.fn(),
}));

const mockPage = {
  setDefaultTimeout: vi.fn(),
  setDefaultNavigationTimeout: vi.fn(),
  goto: vi.fn().mockResolvedValue(undefined),
  url: vi.fn().mockReturnValue('https://example.com/'),
  $$: vi.fn().mockResolvedValue([]),
  content: vi.fn().mockResolvedValue('<html></html>'),
  close: vi.fn().mockResolvedValue(undefined),
};
const mockContext = {
  addCookies: vi.fn(),
  newPage: vi.fn().mockResolvedValue(mockPage),
  close: vi.fn(),
};
const mockBrowser = {
  newContext: vi.fn().mockResolvedValue(mockContext),
  close: vi.fn().mockResolvedValue(undefined),
};
const launchMock = vi.fn().mockResolvedValue(mockBrowser);

vi.mock('playwright', () => ({
  chromium: { launch: (...args: unknown[]) => launchMock(...args) },
}));

const { httpGetText } = await import('../../../src/download/http-client.js');
const { EngineFactory } = await import('../../../src/engines/engine-factory.js');

function textResponse(body: string) {
  return { body, status: 200, headers: new Headers(), finalUrl: 'https://example.com/' };
}

beforeEach(() => {
  vi.clearAllMocks();
  launchMock.mockResolvedValue(mockBrowser);
  mockBrowser.newContext.mockResolvedValue(mockContext);
  mockContext.newPage.mockResolvedValue(mockPage);
});

describe('EngineFactory', () => {
  it('engine: dynamic skips the static fetch entirely and goes straight to Playwright', async () => {
    const factory = new EngineFactory(new Logger({ level: 'silent' }));
    await factory.openPage('https://example.com', browserConfigSchema.parse({ engine: 'dynamic' }));
    expect(httpGetText).not.toHaveBeenCalled();
    expect(launchMock).toHaveBeenCalledTimes(1);
    await factory.close();
  });

  it('engine: static never launches a browser, even for shell-looking content', async () => {
    vi.mocked(httpGetText).mockResolvedValue(
      textResponse('<html><body><div id="root"></div></body></html>'),
    );
    const factory = new EngineFactory(new Logger({ level: 'silent' }));
    await factory.openPage('https://example.com', browserConfigSchema.parse({ engine: 'static' }));
    expect(launchMock).not.toHaveBeenCalled();
  });

  it('engine: auto stays static when the fetched page has real content', async () => {
    const richHtml = `<html><body>${'<p>Real content here. </p>'.repeat(20)}</body></html>`;
    vi.mocked(httpGetText).mockResolvedValue(textResponse(richHtml));
    const factory = new EngineFactory(new Logger({ level: 'silent' }));
    const source = await factory.openPage(
      'https://example.com',
      browserConfigSchema.parse({ engine: 'auto' }),
    );
    expect(launchMock).not.toHaveBeenCalled();
    expect(source.url).toBe('https://example.com/');
  });

  it('engine: auto falls back to dynamic when the static fetch looks like an empty SPA shell', async () => {
    vi.mocked(httpGetText).mockResolvedValue(
      textResponse(
        '<html><body><div id="root"></div><script src="/app.js"></script></body></html>',
      ),
    );
    const factory = new EngineFactory(new Logger({ level: 'silent' }));
    const source = await factory.openPage(
      'https://example.com',
      browserConfigSchema.parse({ engine: 'auto' }),
    );
    expect(launchMock).toHaveBeenCalledTimes(1);
    expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', expect.any(Object));
    expect(source.url).toBe('https://example.com/');
  });

  it('reuses one dynamic engine instance across repeated dynamic-fallback calls', async () => {
    vi.mocked(httpGetText).mockResolvedValue(
      textResponse('<html><body><div id="root"></div></body></html>'),
    );
    const factory = new EngineFactory(new Logger({ level: 'silent' }));
    await factory.openPage('https://example.com/a', browserConfigSchema.parse({ engine: 'auto' }));
    await factory.openPage('https://example.com/b', browserConfigSchema.parse({ engine: 'auto' }));
    expect(launchMock).toHaveBeenCalledTimes(1);
    await factory.close();
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });
});
