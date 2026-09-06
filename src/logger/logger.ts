import chalk from 'chalk';
import type { LogLevel } from '../config/schema.js';

const LEVEL_ORDER: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  verbose: 5,
};

function safeStringify(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || value === null)
    return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

/** Options controlling logger output and formatting. */
export interface LoggerOptions {
  level?: LogLevel;
  color?: boolean;
  prefix?: string;
}

/** Small level-aware logger used by the scraper services and CLI. */
export class Logger {
  private level: LogLevel;
  private readonly color: boolean;
  private readonly prefix: string;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? 'info';
    this.color = options.color ?? true;
    this.prefix = options.prefix ?? '';
  }

  /**
   * Changes the minimum emitted log level.
   *
   * @param level - New minimum severity.
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /** Returns the current minimum log level. */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Creates a logger that prefixes messages with a child scope.
   *
   * @param prefix - Scope label to append.
   * @returns A child logger sharing the current settings.
   */
  child(prefix: string): Logger {
    const combined = this.prefix ? `${this.prefix} > ${prefix}` : prefix;
    return new Logger({ level: this.level, color: this.color, prefix: combined });
  }

  private enabled(level: LogLevel): boolean {
    return LEVEL_ORDER[this.level] >= LEVEL_ORDER[level];
  }

  private paint(text: string, fn: (s: string) => string): string {
    return this.color ? fn(text) : text;
  }

  private tag(label: string, fn: (s: string) => string): string {
    const prefixPart = this.prefix ? this.paint(`[${this.prefix}] `, chalk.dim) : '';
    return `${this.paint(label, fn)} ${prefixPart}`;
  }

  /**
   * Logs an error and optional diagnostic value.
   *
   * @param message - Error message.
   * @param err - Optional error or diagnostic value.
   */
  error(message: string, err?: unknown): void {
    if (!this.enabled('error')) return;
    console.error(this.tag('✖', chalk.red) + message);
    if (err instanceof Error && this.enabled('debug')) {
      console.error(this.paint(err.stack ?? err.message, chalk.dim));
    } else if (err !== undefined && this.enabled('debug')) {
      console.error(this.paint(safeStringify(err), chalk.dim));
    }
  }

  /**
   * Logs a warning message.
   *
   * @param message - Warning message.
   */
  warn(message: string): void {
    if (!this.enabled('warn')) return;
    console.warn(this.tag('⚠', chalk.yellow) + message);
  }

  /**
   * Logs an informational message.
   *
   * @param message - Informational message.
   */
  info(message: string): void {
    if (!this.enabled('info')) return;
    console.log(this.tag('ℹ', chalk.cyan) + message);
  }

  /**
   * Logs a success message.
   *
   * @param message - Success message.
   */
  success(message: string): void {
    if (!this.enabled('info')) return;
    console.log(this.tag('✔', chalk.green) + message);
  }

  /**
   * Logs a debug message.
   *
   * @param message - Debug message.
   */
  debug(message: string): void {
    if (!this.enabled('debug')) return;
    console.log(this.tag('•', chalk.magenta) + this.paint(message, chalk.dim));
  }

  /**
   * Logs a verbose diagnostic message.
   *
   * @param message - Verbose diagnostic message.
   */
  verbose(message: string): void {
    if (!this.enabled('verbose')) return;
    console.log(this.tag('··', chalk.gray) + this.paint(message, chalk.gray));
  }
}

/** Default application-wide logger. */
export const rootLogger = new Logger();
