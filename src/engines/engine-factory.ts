import type { BrowserConfig } from '../config/schema.js';
import type { PageSource } from '../core/types.js';
import type { Logger } from '../logger/logger.js';
import { DynamicEngine } from './dynamic-engine.js';
import { StaticEngine } from './static-engine.js';

const EMPTY_SHELL_TEXT_THRESHOLD = 200;

/** Detects pages that contain too little server-rendered text to be useful. */
export function looksLikeEmptyShell(html: string): boolean {
  const bodyMatch = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
  const bodyHtml = bodyMatch?.[1] ?? html;
  const textOnly = bodyHtml
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return textOnly.length < EMPTY_SHELL_TEXT_THRESHOLD;
}

/** Selects and manages the static, dynamic or automatic page engine. */
export class EngineFactory {
  private readonly staticEngine = new StaticEngine();
  private dynamicEngine: DynamicEngine | undefined;

  constructor(private readonly logger: Logger) {}

  private getDynamicEngine(): DynamicEngine {
    this.dynamicEngine ??= new DynamicEngine(this.logger);
    return this.dynamicEngine;
  }

  /**
   * Opens a page using the configured engine, with automatic fallback.
   *
   * @param url - Page URL to open.
   * @param config - Browser and engine settings.
   * @returns Engine-independent page source.
   * @throws EngineError when no configured engine can open the page.
   */
  async openPage(url: string, config: BrowserConfig): Promise<PageSource> {
    if (config.engine === 'dynamic') {
      this.logger.verbose(`opening "${url}" with the dynamic (Playwright) engine`);
      return this.getDynamicEngine().openPage(url, config);
    }

    this.logger.verbose(`opening "${url}" with the static (HTTP + jsdom) engine`);
    const staticSource = await this.staticEngine.openPage(url, config);

    if (config.engine === 'static') {
      return staticSource;
    }

    const html = await staticSource.getFullHtml();
    if (!looksLikeEmptyShell(html)) {
      return staticSource;
    }
    this.logger.debug(
      `"${url}" looks like a JS-rendered shell under static fetch — retrying with the dynamic engine`,
    );
    await staticSource.close();
    return this.getDynamicEngine().openPage(url, config);
  }

  /** Closes the shared dynamic browser, when it was started. */
  async close(): Promise<void> {
    await this.dynamicEngine?.close();
  }
}
