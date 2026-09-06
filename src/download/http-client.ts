import { ProxyAgent, fetch as undiciFetch, type Dispatcher } from 'undici';
import type { Cookie, ProxyConfig } from '../config/schema.js';
import { DownloadError } from '../core/errors.js';

/** Request options shared by text, binary and HEAD requests. */
export interface HttpRequestOptions {
  headers?: Record<string, string>;
  userAgent?: string;
  cookies?: Cookie[];
  proxy?: ProxyConfig;
  timeoutMs?: number;
}

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; dynamic-scraper/0.1; +https://github.com/)';

function buildDispatcher(proxy?: ProxyConfig): Dispatcher | undefined {
  if (!proxy) return undefined;
  const proxyOptions: ConstructorParameters<typeof ProxyAgent>[0] =
    proxy.username !== undefined
      ? {
          uri: proxy.server,
          token: `Basic ${Buffer.from(`${proxy.username}:${proxy.password ?? ''}`).toString('base64')}`,
        }
      : proxy.server;
  return new ProxyAgent(proxyOptions);
}

function buildHeaders(options: HttpRequestOptions): Record<string, string> {
  const headers: Record<string, string> = { ...options.headers };
  headers['User-Agent'] ??= options.userAgent ?? DEFAULT_USER_AGENT;
  if (options.cookies?.length) {
    headers['Cookie'] = options.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  }
  return headers;
}

async function withTimeout<T>(
  timeoutMs: number | undefined,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : undefined;
  try {
    return await run(controller.signal);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Text response returned by an HTTP GET. */
export interface HttpTextResponse {
  body: string;
  status: number;
  headers: Headers;
  finalUrl: string;
}

/**
 * Downloads a URL as text.
 *
 * @param url - Resource URL.
 * @param options - Headers, cookies, proxy and timeout settings.
 * @returns HTTP response metadata and decoded body.
 * @throws DownloadError when the request fails.
 */
export async function httpGetText(
  url: string,
  options: HttpRequestOptions = {},
): Promise<HttpTextResponse> {
  try {
    return await withTimeout(options.timeoutMs, async (signal) => {
      const response = await undiciFetch(url, {
        headers: buildHeaders(options),
        dispatcher: buildDispatcher(options.proxy),
        signal,
      });
      const body = await response.text();
      return { body, status: response.status, headers: response.headers, finalUrl: response.url };
    });
  } catch (err) {
    throw new DownloadError(`GET ${url} failed: ${(err as Error).message}`);
  }
}

/** Binary response returned by an HTTP GET. */
export interface HttpBinaryResponse {
  buffer: Buffer;
  status: number;
  headers: Headers;
  finalUrl: string;
}

/**
 * Downloads a URL as a Buffer.
 *
 * @param url - Resource URL.
 * @param options - Headers, cookies, proxy and timeout settings.
 * @returns HTTP response metadata and binary body.
 * @throws DownloadError when the request fails.
 */
export async function httpGetBinary(
  url: string,
  options: HttpRequestOptions = {},
): Promise<HttpBinaryResponse> {
  try {
    return await withTimeout(options.timeoutMs, async (signal) => {
      const response = await undiciFetch(url, {
        headers: buildHeaders(options),
        dispatcher: buildDispatcher(options.proxy),
        signal,
      });
      const arrayBuffer = await response.arrayBuffer();
      return {
        buffer: Buffer.from(arrayBuffer),
        status: response.status,
        headers: response.headers,
        finalUrl: response.url,
      };
    });
  } catch (err) {
    throw new DownloadError(`GET ${url} failed: ${(err as Error).message}`);
  }
}

/** Response metadata returned by an HTTP HEAD request. */
export interface HttpHeadResponse {
  status: number;
  headers: Headers;
  ok: boolean;
}

/**
 * Retrieves resource metadata without downloading its body.
 *
 * @param url - Resource URL.
 * @param options - Headers, cookies, proxy and timeout settings.
 * @returns HEAD response metadata; failed requests return `ok: false`.
 */
export async function httpHead(
  url: string,
  options: HttpRequestOptions = {},
): Promise<HttpHeadResponse> {
  try {
    return await withTimeout(options.timeoutMs ?? 10_000, async (signal) => {
      const response = await undiciFetch(url, {
        method: 'HEAD',
        headers: buildHeaders(options),
        dispatcher: buildDispatcher(options.proxy),
        signal,
      });
      return { status: response.status, headers: response.headers, ok: response.ok };
    });
  } catch {
    return { status: 0, headers: new Headers(), ok: false };
  }
}
