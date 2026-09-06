import type {
  ConflictStrategy,
  Cookie,
  EngineMode,
  FilterConfig,
  LogLevel,
  NumberingStyle,
  ScrapeTarget,
  TaskConfigInput,
} from './schema.js';

/** Raw command-line values before conversion to task configuration types. */
export interface ScrapeCliOptions {
  name?: string;
  output?: string;
  filename?: string;
  prefix?: string;
  suffix?: string;
  startIndex?: string;
  numberPadding?: string;
  numbering?: NumberingStyle;
  onConflict?: ConflictStrategy;
  concurrency?: string;
  dryRun?: boolean;

  engine?: EngineMode;
  headless?: boolean;
  timeout?: string;
  waitFor?: string;
  waitTimeout?: string;
  userAgent?: string;
  header?: string[];
  cookie?: string[];
  proxy?: string;

  type?: string;
  selector?: string;
  xpath?: string;
  attribute?: string;

  include?: string[];
  exclude?: string[];
  regex?: string[];
  wildcard?: string[];
  ext?: string[];
  mime?: string[];
  minSize?: string;
  maxSize?: string;
  domain?: string[];
  subdomain?: string[];
  maxDepth?: string;
  maxResults?: string;
  minResults?: string;

  logLevel?: LogLevel;
  verbose?: boolean;
  debug?: boolean;
}

function toInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? undefined : n;
}

function parseHeaderPairs(pairs: string[] | undefined): Record<string, string> | undefined {
  if (!pairs || pairs.length === 0) return undefined;
  const headers: Record<string, string> = {};
  for (const pair of pairs) {
    const idx = pair.indexOf(':');
    if (idx === -1) continue;
    headers[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
  return headers;
}

function parseCookiePairs(pairs: string[] | undefined): Cookie[] | undefined {
  if (!pairs || pairs.length === 0) return undefined;
  return pairs
    .map((pair): Cookie | null => {
      const idx = pair.indexOf('=');
      if (idx === -1) return null;
      return { name: pair.slice(0, idx).trim(), value: pair.slice(idx + 1).trim() };
    })
    .filter((c): c is Cookie => c !== null);
}

function buildFilterOverrides(options: ScrapeCliOptions): FilterConfig | undefined {
  const filters: FilterConfig = {};
  if (options.include) filters.include = options.include;
  if (options.exclude) filters.exclude = options.exclude;
  if (options.regex) filters.regex = options.regex;
  if (options.wildcard) filters.wildcard = options.wildcard;
  if (options.ext) filters.extensions = options.ext;
  if (options.mime) filters.mimeTypes = options.mime;
  if (options.minSize !== undefined) filters.minSize = toInt(options.minSize);
  if (options.maxSize !== undefined) filters.maxSize = toInt(options.maxSize);
  if (options.domain) filters.domains = options.domain;
  if (options.subdomain) filters.subdomains = options.subdomain;
  if (options.maxDepth !== undefined) filters.maxDepth = toInt(options.maxDepth);
  if (options.maxResults !== undefined) filters.maxResults = toInt(options.maxResults);
  if (options.minResults !== undefined) filters.minResults = toInt(options.minResults);
  return Object.keys(filters).length > 0 ? filters : undefined;
}

function buildTargetShortcut(options: ScrapeCliOptions): ScrapeTarget[] | undefined {
  if (!options.type) return undefined;
  return [
    {
      type: options.type as ScrapeTarget['type'],
      selector: options.selector,
      xpath: options.xpath,
      attribute: options.attribute,
    },
  ];
}

/** Converts parsed CLI flags into task configuration overrides. */
export function buildCliOverrides(options: ScrapeCliOptions, url?: string): TaskConfigInput {
  const override: TaskConfigInput = {};

  if (options.name) override.name = options.name;
  if (url) override.url = url;

  const output: NonNullable<TaskConfigInput['output']> = {};
  if (options.output) output.directory = options.output;
  if (options.filename) output.filename = options.filename;
  if (options.prefix) output.prefix = options.prefix;
  if (options.suffix) output.suffix = options.suffix;
  if (options.startIndex !== undefined) output.startIndex = toInt(options.startIndex);
  if (options.numberPadding !== undefined) output.numberPadding = toInt(options.numberPadding);
  if (options.numbering) output.numberingStyle = options.numbering;
  if (options.onConflict) output.onConflict = options.onConflict;
  if (options.concurrency !== undefined) output.concurrency = toInt(options.concurrency);
  if (options.dryRun !== undefined) output.dryRun = options.dryRun;
  if (Object.keys(output).length > 0) override.output = output;

  const browser: NonNullable<TaskConfigInput['browser']> = {};
  if (options.engine) browser.engine = options.engine;
  if (options.headless !== undefined) browser.headless = options.headless;
  if (options.timeout !== undefined) browser.timeout = toInt(options.timeout);
  if (options.waitFor) browser.waitForSelector = options.waitFor;
  if (options.waitTimeout !== undefined) browser.waitForTimeoutMs = toInt(options.waitTimeout);
  if (options.userAgent) browser.userAgent = options.userAgent;
  const headers = parseHeaderPairs(options.header);
  if (headers) browser.headers = headers;
  const cookies = parseCookiePairs(options.cookie);
  if (cookies) browser.cookies = cookies;
  if (options.proxy) browser.proxy = { server: options.proxy };
  if (Object.keys(browser).length > 0) override.browser = browser;

  const filters = buildFilterOverrides(options);
  if (filters) override.filters = filters;

  const targets = buildTargetShortcut(options);
  if (targets) override.targets = targets;

  if (options.debug) {
    override.logging = { level: 'debug' };
  } else if (options.verbose) {
    override.logging = { level: 'verbose' };
  } else if (options.logLevel) {
    override.logging = { level: options.logLevel };
  }

  return override;
}
