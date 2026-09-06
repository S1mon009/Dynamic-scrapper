import { describe, expect, it } from 'vitest';
import { buildCliOverrides } from '../../../src/config/cli-args.js';

describe('buildCliOverrides', () => {
  it('returns an empty object when nothing was passed', () => {
    expect(buildCliOverrides({})).toEqual({});
  });

  it('maps output-related flags', () => {
    const result = buildCliOverrides({
      output: './out',
      filename: 'photo',
      prefix: 'a_',
      suffix: '_b',
      startIndex: '5',
      numberPadding: '3',
      numbering: 'timestamp',
      onConflict: 'skip',
      concurrency: '10',
      dryRun: true,
    });
    expect(result.output).toEqual({
      directory: './out',
      filename: 'photo',
      prefix: 'a_',
      suffix: '_b',
      startIndex: 5,
      numberPadding: 3,
      numberingStyle: 'timestamp',
      onConflict: 'skip',
      concurrency: 10,
      dryRun: true,
    });
  });

  it('maps browser-related flags, including headers and cookies parsed from k:v / name=value pairs', () => {
    const result = buildCliOverrides({
      engine: 'dynamic',
      headless: false,
      timeout: '15000',
      waitFor: '#content',
      userAgent: 'test-agent',
      header: ['Accept: text/html', 'X-Test:1'],
      cookie: ['session=abc123', 'theme=dark'],
      proxy: 'http://127.0.0.1:8080',
    });
    expect(result.browser).toEqual({
      engine: 'dynamic',
      headless: false,
      timeout: 15000,
      waitForSelector: '#content',
      userAgent: 'test-agent',
      headers: { Accept: 'text/html', 'X-Test': '1' },
      cookies: [
        { name: 'session', value: 'abc123' },
        { name: 'theme', value: 'dark' },
      ],
      proxy: { server: 'http://127.0.0.1:8080' },
    });
  });

  it('builds a single-target shortcut from --type/--selector/--attribute', () => {
    const result = buildCliOverrides({ type: 'image', selector: 'img', attribute: 'data-src' });
    expect(result.targets).toEqual([
      { type: 'image', selector: 'img', xpath: undefined, attribute: 'data-src' },
    ]);
  });

  it('does not build a target shortcut when --type is absent', () => {
    const result = buildCliOverrides({ selector: 'img' });
    expect(result.targets).toBeUndefined();
  });

  it('maps filter flags', () => {
    const result = buildCliOverrides({
      include: ['banner'],
      ext: ['jpg', 'png'],
      domain: ['example.com'],
      maxDepth: '2',
      maxResults: '50',
    });
    expect(result.filters).toEqual({
      include: ['banner'],
      extensions: ['jpg', 'png'],
      domains: ['example.com'],
      maxDepth: 2,
      maxResults: 50,
    });
  });

  it('--debug wins over --verbose and --log-level for the logging level', () => {
    expect(buildCliOverrides({ debug: true, verbose: true, logLevel: 'error' }).logging).toEqual({
      level: 'debug',
    });
    expect(buildCliOverrides({ verbose: true, logLevel: 'error' }).logging).toEqual({
      level: 'verbose',
    });
    expect(buildCliOverrides({ logLevel: 'error' }).logging).toEqual({ level: 'error' });
  });

  it('sets url from the second argument when a bare URL is scraped', () => {
    const result = buildCliOverrides({}, 'https://example.com');
    expect(result.url).toBe('https://example.com');
  });

  it('ignores malformed header/cookie pairs instead of throwing', () => {
    const result = buildCliOverrides({ header: ['not-a-pair'], cookie: ['also-not-a-pair'] });
    expect(result.browser?.headers).toEqual({});
    expect(result.browser?.cookies).toEqual([]);
  });
});
