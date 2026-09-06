/** Base error for expected scraper failures. */
export class ScraperError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    Error.captureStackTrace?.(this, new.target);
  }
}

/** Indicates that configuration values failed schema validation. */
export class ConfigValidationError extends ScraperError {
  constructor(
    message: string,
    public readonly issues: string[] = [],
  ) {
    super(message);
  }
}

/** Indicates that a configuration file could not be read or parsed. */
export class ConfigFileError extends ScraperError {}

/** Indicates that a page engine could not open or process a page. */
export class EngineError extends ScraperError {}

/** Indicates that a resource download or output operation failed. */
export class DownloadError extends ScraperError {}

/** Indicates that a filter configuration or custom filter failed. */
export class FilterError extends ScraperError {}

/** Checks whether an unknown value is a scraper-specific error. */
export function isScraperError(error: unknown): error is ScraperError {
  return error instanceof ScraperError;
}
