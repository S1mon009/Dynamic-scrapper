import { z } from 'zod';

/** Valid logger verbosity levels. */
export const logLevelSchema = z.enum(['silent', 'error', 'warn', 'info', 'debug', 'verbose']);

/** Strategies for resolving an existing output file. */
export const conflictStrategySchema = z.enum(['overwrite', 'skip', 'rename', 'fail']);

/** Numbering schemes available for generated output names. */
export const numberingStyleSchema = z.enum(['sequential', 'timestamp', 'uuid', 'none']);

/** Available page rendering modes. */
export const engineModeSchema = z.enum(['static', 'dynamic', 'auto']);

/** Supported scraper target types. */
export const scraperTypeSchema = z.enum([
  'image',
  'link',
  'file',
  'text',
  'heading',
  'table',
  'attribute',
  'css',
  'xpath',
]);

/** Browser cookie passed to HTTP or Playwright requests. */
export const cookieSchema = z.object({
  name: z.string(),
  value: z.string(),
  domain: z.string().optional(),
  path: z.string().optional(),
});

/** Proxy connection settings for page and resource requests. */
export const proxyConfigSchema = z.object({
  server: z.string().min(1, 'proxy.server is required, e.g. "http://127.0.0.1:8080"'),
  username: z.string().optional(),
  password: z.string().optional(),
});

/** Action executed after a dynamic page has loaded. */
export const browserActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('click'),
    selector: z.string(),
    optional: z.boolean().default(false),
  }),
  z.object({
    type: z.literal('scroll'),
    amount: z.number().int().optional(),
    toBottom: z.boolean().default(false),
  }),
  z.object({
    type: z.literal('wait'),
    ms: z.number().int().optional(),
    selector: z.string().optional(),
  }),
  z.object({ type: z.literal('type'), selector: z.string(), text: z.string() }),
  z.object({ type: z.literal('press'), key: z.string() }),
]);

/** Optional filters applied to scraped items. */
export const filterConfigSchema = z
  .object({
    include: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional(),
    regex: z.array(z.string()).optional(),
    wildcard: z.array(z.string()).optional(),
    extensions: z.array(z.string()).optional(),
    mimeTypes: z.array(z.string()).optional(),
    minSize: z.number().nonnegative().optional(),
    maxSize: z.number().nonnegative().optional(),
    domains: z.array(z.string()).optional(),
    subdomains: z.array(z.string()).optional(),
    maxDepth: z.number().int().nonnegative().optional(),
    maxResults: z.number().int().positive().optional(),
    minResults: z.number().int().nonnegative().optional(),
    attributes: z.record(z.string(), z.string()).optional(),
    cssClasses: z.array(z.string()).optional(),
    namePattern: z.string().optional(),
    urlPattern: z.string().optional(),
    custom: z.array(z.string()).optional(),
  })
  .strict();

/** Output naming, conflict and concurrency settings. */
export const outputConfigSchema = z
  .object({
    directory: z.string().default('./downloads'),
    filename: z.string().optional(),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
    startIndex: z.number().int().nonnegative().default(1),
    numberPadding: z.number().int().min(0).max(10).default(0),
    numberingStyle: numberingStyleSchema.default('sequential'),
    onConflict: conflictStrategySchema.default('rename'),
    concurrency: z.number().int().positive().max(64).default(5),
    dryRun: z.boolean().default(false),
  })
  .default({});

/** HTTP and browser engine settings for a scraping task. */
export const browserConfigSchema = z
  .object({
    engine: engineModeSchema.default('auto'),
    headless: z.boolean().default(true),
    timeout: z.number().int().positive().default(30_000),
    navigationTimeout: z.number().int().positive().optional(),
    waitForSelector: z.string().optional(),
    waitForTimeoutMs: z.number().int().nonnegative().optional(),
    userAgent: z.string().optional(),
    headers: z.record(z.string(), z.string()).optional(),
    cookies: z.array(cookieSchema).optional(),
    proxy: proxyConfigSchema.optional(),
    actions: z.array(browserActionSchema).optional(),
    viewport: z.object({ width: z.number().int(), height: z.number().int() }).optional(),
  })
  .default({});

/** Description of one extraction target on a page. */
export const scrapeTargetSchema = z.object({
  type: scraperTypeSchema,
  selector: z.string().optional(),
  xpath: z.string().optional(),
  attribute: z.string().optional(),
  name: z.string().optional(),
  filters: filterConfigSchema.optional(),
});

/** Location of a module exporting custom filter predicates. */
export const customFiltersConfigSchema = z.object({
  path: z.string(),
});

const taskConfigShape = {
  name: z.string().optional(),
  url: z.string().url().optional(),
  output: outputConfigSchema,
  browser: browserConfigSchema,
  filters: filterConfigSchema.optional(),
  customFiltersPath: z.string().optional(),
  targets: z.array(scrapeTargetSchema).optional(),
  logging: z.object({ level: logLevelSchema.default('info') }).default({}),
};

/** Schema for a single scraping task. */
export const taskConfigSchema = z.object(taskConfigShape);

/** Fully parsed configuration for one scraping task. */
export type TaskConfig = z.infer<typeof taskConfigSchema>;

/** Input accepted before Zod applies defaults. */
export type TaskConfigInput = z.input<typeof taskConfigSchema>;

/** A task node with optional inherited folder and child tasks. */
export interface TreeNode extends TaskConfig {
  /** Output subdirectory relative to the inherited output directory. */
  folder?: string;
  /** Child nodes inheriting this node's configuration. */
  children?: TreeNode[];
}
/** Input form of a tree node, before defaults are applied. */
export interface TreeNodeInput extends TaskConfigInput {
  /** Output subdirectory relative to the inherited output directory. */
  folder?: string;
  /** Child nodes inheriting this node's configuration. */
  children?: TreeNodeInput[];
}

interface RawTreeNode {
  folder?: string;
  children?: RawTreeNode[];
  [key: string]: unknown;
}

const rawTreeNodeSchema: z.ZodType<RawTreeNode> = z.lazy(() =>
  z
    .object({
      folder: z.string().optional(),
      children: z.array(rawTreeNodeSchema).optional(),
    })
    .catchall(z.unknown()),
);

/** Schema for a recursive tree node. */
export const treeNodeSchema = rawTreeNodeSchema as unknown as z.ZodType<
  TreeNodeInput,
  z.ZodTypeDef,
  TreeNodeInput
>;

/** Root configuration containing a task tree. */
export const treeConfigSchema = z.object({
  tree: treeNodeSchema,
});

/** Accepts either a single task or a task tree. */
export const rootConfigSchema = z.union([treeConfigSchema, taskConfigSchema]);

/** Inferred logger level. */
export type LogLevel = z.infer<typeof logLevelSchema>;
/** Inferred conflict resolution strategy. */
export type ConflictStrategy = z.infer<typeof conflictStrategySchema>;
/** Inferred output numbering style. */
export type NumberingStyle = z.infer<typeof numberingStyleSchema>;
/** Inferred page engine mode. */
export type EngineMode = z.infer<typeof engineModeSchema>;
/** Inferred browser cookie shape. */
export type Cookie = z.infer<typeof cookieSchema>;
/** Inferred proxy settings. */
export type ProxyConfig = z.infer<typeof proxyConfigSchema>;
/** Inferred dynamic browser action. */
export type BrowserAction = z.infer<typeof browserActionSchema>;
/** Inferred filter settings. */
export type FilterConfig = z.infer<typeof filterConfigSchema>;
/** Inferred output settings. */
export type OutputConfig = z.infer<typeof outputConfigSchema>;
/** Inferred browser settings. */
export type BrowserConfig = z.infer<typeof browserConfigSchema>;
/** Inferred extraction target. */
export type ScrapeTarget = z.infer<typeof scrapeTargetSchema>;
/** Inferred tree root configuration. */
export type TreeConfig = z.infer<typeof treeConfigSchema>;
/** Input form of a tree root configuration. */
export type TreeConfigInput = z.input<typeof treeConfigSchema>;
/** Parsed single-task or tree configuration. */
export type RootConfig = z.infer<typeof rootConfigSchema>;
/** Input form of a single-task or tree configuration. */
export type RootConfigInput = z.input<typeof rootConfigSchema>;

/** Returns whether a parsed root configuration contains a task tree. */
export function isTreeConfig(config: RootConfig): config is TreeConfig {
  return Object.prototype.hasOwnProperty.call(config, 'tree');
}
