import { describe, expect, it } from 'vitest';
import { looksLikeEmptyShell } from '../../../src/engines/engine-factory.js';

describe('looksLikeEmptyShell', () => {
  it('flags a typical SPA shell (empty root div + bundle script) as needing the dynamic engine', () => {
    const html = `<!DOCTYPE html><html><head><title>App</title></head>
      <body><div id="root"></div><script src="/bundle.js"></script></body></html>`;
    expect(looksLikeEmptyShell(html)).toBe(true);
  });

  it('does not flag a normal content-rich static page', () => {
    const html = `<html><body>${'<p>Real paragraph content. </p>'.repeat(10)}</body></html>`;
    expect(looksLikeEmptyShell(html)).toBe(false);
  });

  it('ignores script/style content when measuring visible text', () => {
    const html = `<html><body>
      <script>const data = ${JSON.stringify('x'.repeat(500))};</script>
      <style>.a { color: red; }</style>
      <div id="app"></div>
    </body></html>`;
    expect(looksLikeEmptyShell(html)).toBe(true);
  });
});
