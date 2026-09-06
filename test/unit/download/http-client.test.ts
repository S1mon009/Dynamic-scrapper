import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { httpGetBinary, httpGetText, httpHead } from '../../../src/download/http-client.js';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/text') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('hello world');
      return;
    }
    if (req.url === '/binary') {
      res.writeHead(200, { 'content-type': 'application/octet-stream' });
      res.end(Buffer.from([1, 2, 3, 4]));
      return;
    }
    if (req.url === '/echo-headers') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(req.headers));
      return;
    }
    if (req.url === '/not-found') {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('nope');
      return;
    }
    if (req.url === '/slow') {
      setTimeout(() => {
        res.writeHead(200);
        res.end('too slow');
      }, 500);
      return;
    }
    res.writeHead(200);
    res.end('ok');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(() => {
  server.close();
});

describe('httpGetText', () => {
  it('fetches text content and reports the status', async () => {
    const res = await httpGetText(`${baseUrl}/text`);
    expect(res.status).toBe(200);
    expect(res.body).toBe('hello world');
  });

  it('sends a default User-Agent when none is configured', async () => {
    const res = await httpGetText(`${baseUrl}/echo-headers`);
    const headers = JSON.parse(res.body) as Record<string, string>;
    expect(headers['user-agent']).toContain('dynamic-scraper');
  });

  it('sends a custom User-Agent, extra headers, and a cookie header when configured', async () => {
    const res = await httpGetText(`${baseUrl}/echo-headers`, {
      userAgent: 'my-agent/1.0',
      headers: { 'X-Custom': 'yes' },
      cookies: [
        { name: 'a', value: '1' },
        { name: 'b', value: '2' },
      ],
    });
    const headers = JSON.parse(res.body) as Record<string, string>;
    expect(headers['user-agent']).toBe('my-agent/1.0');
    expect(headers['x-custom']).toBe('yes');
    expect(headers['cookie']).toBe('a=1; b=2');
  });

  it('reports non-2xx status without throwing', async () => {
    const res = await httpGetText(`${baseUrl}/not-found`);
    expect(res.status).toBe(404);
  });

  it('aborts and throws a DownloadError past the configured timeout', async () => {
    await expect(httpGetText(`${baseUrl}/slow`, { timeoutMs: 50 })).rejects.toThrow(/failed/);
  });
});

describe('httpGetBinary', () => {
  it('returns a Buffer with the exact bytes received', async () => {
    const res = await httpGetBinary(`${baseUrl}/binary`);
    expect(Buffer.compare(res.buffer, Buffer.from([1, 2, 3, 4]))).toBe(0);
  });
});

describe('httpHead', () => {
  it('resolves ok:true for a 200 response', async () => {
    const res = await httpHead(`${baseUrl}/text`);
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
  });

  it('never throws — resolves ok:false on a network-level failure', async () => {
    const res = await httpHead('http://127.0.0.1:1'); // nothing listens on port 1
    expect(res.ok).toBe(false);
    expect(res.status).toBe(0);
  });
});
