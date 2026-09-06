/* eslint-disable @typescript-eslint/require-await -- */
import { JSDOM } from 'jsdom';
import type { BrowserConfig } from '../config/schema.js';
import { EngineError } from '../core/errors.js';
import type { PageElementHandle, PageSource } from '../core/types.js';
import { httpGetText } from '../download/http-client.js';

class JsdomElementHandle implements PageElementHandle {
  constructor(private readonly element: Element) {}

  async getAttribute(name: string): Promise<string | null> {
    return this.element.getAttribute(name);
  }

  async getAllAttributes(): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const attr of Array.from(this.element.attributes)) {
      result[attr.name] = attr.value;
    }
    return result;
  }

  async getText(): Promise<string> {
    return (this.element.textContent ?? '').trim();
  }

  async getOuterHtml(): Promise<string> {
    return this.element.outerHTML;
  }

  async getInnerHtml(): Promise<string> {
    return this.element.innerHTML;
  }

  async getTagName(): Promise<string> {
    return this.element.tagName.toLowerCase();
  }
}

/** In-memory page source backed by jsdom. */
export class StaticPageSource implements PageSource {
  private constructor(
    private readonly dom: JSDOM,
    readonly url: string,
  ) {}

  /**
   * Creates a static page source from HTML and its base URL.
   *
   * @param html - HTML document to parse.
   * @param url - Base URL associated with the document.
   * @returns A jsdom-backed page source.
   */
  static fromHtml(html: string, url: string): StaticPageSource {
    const dom = new JSDOM(html, { url });
    return new StaticPageSource(dom, url);
  }

  /**
   * Finds elements with a CSS selector.
   *
   * @param selector - CSS selector to evaluate.
   * @returns Matching element handles.
   * @throws EngineError when the selector is invalid.
   */
  async querySelectorAll(selector: string): Promise<PageElementHandle[]> {
    let elements: Element[];
    try {
      elements = Array.from(this.dom.window.document.querySelectorAll(selector));
    } catch (err) {
      throw new EngineError(`Invalid CSS selector "${selector}": ${(err as Error).message}`);
    }
    return elements.map((el) => new JsdomElementHandle(el));
  }

  /**
   * Finds elements with an XPath expression.
   *
   * @param expression - XPath expression to evaluate.
   * @returns Matching element handles.
   * @throws EngineError when the expression is invalid.
   */
  async xpathAll(expression: string): Promise<PageElementHandle[]> {
    const document = this.dom.window.document;
    let snapshot: XPathResult;
    try {
      snapshot = document.evaluate(
        expression,
        document,
        null,
        this.dom.window.XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null,
      );
    } catch (err) {
      throw new EngineError(`Invalid XPath expression "${expression}": ${(err as Error).message}`);
    }
    const elements: Element[] = [];
    for (let i = 0; i < snapshot.snapshotLength; i += 1) {
      const node = snapshot.snapshotItem(i);
      if (node && node.nodeType === 1) elements.push(node as Element);
    }
    return elements.map((el) => new JsdomElementHandle(el));
  }

  /** Returns the complete document HTML. */
  async getFullHtml(): Promise<string> {
    return this.dom.window.document.documentElement.outerHTML;
  }

  /** Releases the jsdom window. */
  async close(): Promise<void> {
    this.dom.window.close();
  }
}

/** Opens pages using HTTP and parses them with jsdom. */
export class StaticEngine {
  /**
   * Downloads and parses a page without executing JavaScript.
   *
   * @param targetUrl - Page URL to request.
   * @param config - HTTP and browser settings.
   * @returns Parsed static page source.
   * @throws EngineError when the request returns an HTTP error.
   */
  async openPage(targetUrl: string, config: BrowserConfig): Promise<StaticPageSource> {
    const response = await httpGetText(targetUrl, {
      headers: config.headers,
      userAgent: config.userAgent,
      cookies: config.cookies,
      proxy: config.proxy,
      timeoutMs: config.timeout,
    });
    if (response.status >= 400) {
      throw new EngineError(`GET ${targetUrl} returned HTTP ${response.status}`);
    }
    return StaticPageSource.fromHtml(response.body, response.finalUrl || targetUrl);
  }
}
