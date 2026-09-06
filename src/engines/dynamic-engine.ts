import { chromium, type Browser, type ElementHandle, type Page } from 'playwright';
import type { BrowserAction, BrowserConfig } from '../config/schema.js';
import { EngineError } from '../core/errors.js';
import type { PageElementHandle, PageSource } from '../core/types.js';
import type { Logger } from '../logger/logger.js';

class PlaywrightElementHandle implements PageElementHandle {
  constructor(private readonly handle: ElementHandle) {}

  async getAttribute(name: string): Promise<string | null> {
    return this.handle.getAttribute(name);
  }

  async getAllAttributes(): Promise<Record<string, string>> {
    return this.handle.evaluate((el: Element) =>
      Object.fromEntries(Array.from(el.attributes).map((a) => [a.name, a.value])),
    );
  }

  async getText(): Promise<string> {
    const text = await this.handle.textContent();
    return (text ?? '').trim();
  }

  async getOuterHtml(): Promise<string> {
    return this.handle.evaluate((el: Element) => el.outerHTML);
  }

  async getInnerHtml(): Promise<string> {
    return this.handle.evaluate((el: Element) => el.innerHTML);
  }

  async getTagName(): Promise<string> {
    return this.handle.evaluate((el: Element) => el.tagName.toLowerCase());
  }
}

/** Page source backed by a Playwright page. */
export class DynamicPageSource implements PageSource {
  constructor(
    private readonly page: Page,
    readonly url: string,
  ) {}

  /**
   * Finds elements with a CSS selector.
   *
   * @param selector - CSS selector to evaluate.
   * @returns Matching element handles.
   * @throws EngineError when the selector is invalid.
   */
  async querySelectorAll(selector: string): Promise<PageElementHandle[]> {
    let handles: ElementHandle[];
    try {
      handles = await this.page.$$(selector);
    } catch (err) {
      throw new EngineError(`Invalid CSS selector "${selector}": ${(err as Error).message}`);
    }
    return handles.map((h) => new PlaywrightElementHandle(h));
  }

  /**
   * Finds elements with an XPath expression.
   *
   * @param expression - XPath expression to evaluate.
   * @returns Matching element handles.
   * @throws EngineError when the expression is invalid.
   */
  async xpathAll(expression: string): Promise<PageElementHandle[]> {
    const selector = expression.startsWith('xpath=') ? expression : `xpath=${expression}`;
    let handles: ElementHandle[];
    try {
      handles = await this.page.$$(selector);
    } catch (err) {
      throw new EngineError(`Invalid XPath expression "${expression}": ${(err as Error).message}`);
    }
    return handles.map((h) => new PlaywrightElementHandle(h));
  }

  /** Returns the current rendered document HTML. */
  async getFullHtml(): Promise<string> {
    return this.page.content();
  }

  /** Closes the Playwright page. */
  async close(): Promise<void> {
    await this.page.close().catch(() => undefined);
  }
}

/** Opens pages in Chromium and executes configured browser actions. */
export class DynamicEngine {
  private browser: Browser | undefined;

  constructor(private readonly logger: Logger) {}

  private async ensureBrowser(headless: boolean): Promise<Browser> {
    if (this.browser) return this.browser;
    this.logger.debug(`launching chromium (headless=${headless})`);
    try {
      this.browser = await chromium.launch({ headless });
    } catch (err) {
      throw new EngineError(
        `Could not launch Chromium — run "npx playwright install --with-deps chromium" first. (${(err as Error).message})`,
      );
    }
    return this.browser;
  }

  /**
   * Opens and prepares a rendered page.
   *
   * @param targetUrl - Page URL to navigate to.
   * @param config - Chromium, navigation and action settings.
   * @returns Playwright-backed page source.
   * @throws EngineError when Chromium cannot launch or navigation fails.
   */
  async openPage(targetUrl: string, config: BrowserConfig): Promise<DynamicPageSource> {
    const browser = await this.ensureBrowser(config.headless ?? true);
    const context = await browser.newContext({
      userAgent: config.userAgent,
      extraHTTPHeaders: config.headers,
      viewport: config.viewport ?? null,
      proxy: config.proxy
        ? {
            server: config.proxy.server,
            username: config.proxy.username,
            password: config.proxy.password,
          }
        : undefined,
    });

    try {
      if (config.cookies?.length) {
        const hostname = new URL(targetUrl).hostname;
        await context.addCookies(
          config.cookies.map((c) => ({
            name: c.name,
            value: c.value,
            domain: c.domain ?? hostname,
            path: c.path ?? '/',
          })),
        );
      }

      const page = await context.newPage();
      const timeout = config.timeout ?? 30_000;
      page.setDefaultTimeout(timeout);
      page.setDefaultNavigationTimeout(config.navigationTimeout ?? timeout);

      try {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
      } catch (err) {
        throw new EngineError(`Navigation to ${targetUrl} failed: ${(err as Error).message}`);
      }

      if (config.waitForSelector) {
        await page.waitForSelector(config.waitForSelector, { timeout });
      }
      if (config.waitForTimeoutMs) {
        await page.waitForTimeout(config.waitForTimeoutMs);
      }

      for (const action of config.actions ?? []) {
        await this.runAction(page, action);
      }

      return new DynamicPageSource(page, page.url());
    } catch (err) {
      await context.close().catch(() => undefined);
      throw err;
    }
  }

  private async runAction(page: Page, action: BrowserAction): Promise<void> {
    switch (action.type) {
      case 'click':
        try {
          await page.click(action.selector, { timeout: 5000 });
        } catch (err) {
          if (!action.optional) {
            throw new EngineError(`click "${action.selector}" failed: ${(err as Error).message}`);
          }
          this.logger.debug(`optional click on "${action.selector}" skipped (element not found)`);
        }
        return;
      case 'scroll':
        if (action.toBottom) {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        } else {
          await page.mouse.wheel(0, action.amount ?? 800);
        }
        return;
      case 'wait':
        if (action.selector) await page.waitForSelector(action.selector);
        else await page.waitForTimeout(action.ms ?? 1000);
        return;
      case 'type':
        await page.fill(action.selector, action.text);
        return;
      case 'press':
        await page.keyboard.press(action.key);
        return;
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = undefined;
    }
  }
}
