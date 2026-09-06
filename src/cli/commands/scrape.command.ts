import path from 'node:path';
import type { Command } from 'commander';
import { buildCliOverrides, type ScrapeCliOptions } from '../../config/cli-args.js';
import { parseTreeConfig, readConfigFile, resolveTaskConfig } from '../../config/loader.js';
import { ScrapeOrchestrator } from '../../core/scrape-orchestrator.js';
import { rootLogger } from '../../logger/logger.js';
import { runTree } from '../../tree/tree-runner.js';
import { createProgressCallbacks, printError, printTaskSummary, printTreeSummary } from '../ui.js';

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

interface ScrapeCommandOptions extends ScrapeCliOptions {
  quiet?: boolean;
}

/** Registers the single-task scraping CLI command. */
export function registerScrapeCommand(program: Command): void {
  program
    .command('scrape')
    .argument('<target>', 'URL to scrape, or path to a YAML/JSON task config file')
    .description('Scrape a single URL, or run a task/tree defined in a config file')
    .option('-o, --output <dir>', 'output directory')
    .option('--filename <name>', 'base file name (numbered per item)')
    .option('--prefix <prefix>', 'file name prefix')
    .option('--suffix <suffix>', 'file name suffix')
    .option('--start-index <n>', 'starting number for sequential numbering')
    .option('--number-padding <n>', 'zero-pad numbers to this width')
    .option('--numbering <style>', 'sequential|timestamp|uuid|none')
    .option('--on-conflict <strategy>', 'overwrite|skip|rename|fail')
    .option('--concurrency <n>', 'parallel downloads')
    .option('--dry-run', 'do not write any files, just report what would happen')
    .option('--engine <mode>', 'static|dynamic|auto')
    .option('--no-headless', 'show the browser window (dynamic engine only)')
    .option('--timeout <ms>', 'navigation/selector timeout in ms')
    .option('--wait-for <selector>', 'wait for this CSS selector before scraping')
    .option('--wait-timeout <ms>', 'additional fixed wait after load, in ms')
    .option('--user-agent <ua>', 'custom User-Agent header')
    .option('--header <k:v>', 'extra HTTP header (repeatable)', collect, [] as string[])
    .option('--cookie <name=value>', 'cookie to send (repeatable)', collect, [] as string[])
    .option('--proxy <server>', 'proxy server, e.g. http://127.0.0.1:8080')
    .option(
      '--type <scraperType>',
      'single-target shortcut: image|link|file|text|heading|table|attribute|css|xpath',
    )
    .option('--selector <css>', 'CSS selector for the --type shortcut')
    .option('--xpath <expr>', 'XPath expression for the --type shortcut')
    .option('--attribute <name>', 'attribute name for the --type shortcut')
    .option('--include <pattern>', 'include filter (repeatable)', collect, [] as string[])
    .option('--exclude <pattern>', 'exclude filter (repeatable)', collect, [] as string[])
    .option('--regex <pattern>', 'regex filter (repeatable)', collect, [] as string[])
    .option('--wildcard <pattern>', 'wildcard filter (repeatable)', collect, [] as string[])
    .option('--ext <extension>', 'allowed file extension (repeatable)', collect, [] as string[])
    .option('--mime <type>', 'allowed MIME type (repeatable)', collect, [] as string[])
    .option('--min-size <bytes>', 'minimum file size in bytes')
    .option('--max-size <bytes>', 'maximum file size in bytes')
    .option('--domain <domain>', 'allowed domain (repeatable)', collect, [] as string[])
    .option('--subdomain <domain>', 'allowed subdomain root (repeatable)', collect, [] as string[])
    .option('--max-depth <n>', 'how many link-hops deep to crawl (default 0 = start page only)')
    .option('--max-results <n>', 'stop after this many items pass filters')
    .option('--min-results <n>', 'warn if fewer than this many items pass filters')
    .option('--name <name>', 'task name, used in logs and file naming')
    .option('--log-level <level>', 'silent|error|warn|info|debug|verbose')
    .option('--verbose', 'shortcut for --log-level verbose')
    .option('--debug', 'shortcut for --log-level debug')
    .option('--quiet', 'suppress the progress bar')
    .action(async (target: string, options: ScrapeCommandOptions) => {
      await runScrape(target, options);
    });
}

async function runScrape(target: string, options: ScrapeCommandOptions): Promise<void> {
  const filePath = isUrl(target) ? undefined : target;
  const url = isUrl(target) ? target : undefined;
  const baseDir = filePath ? path.dirname(path.resolve(filePath)) : process.cwd();

  try {
    if (filePath) {
      const raw = await readConfigFile(filePath);
      if (raw && typeof raw === 'object' && 'tree' in raw) {
        rootLogger.info(
          'config file defines a tree — delegating to the tree runner (see `scraper tree --help`)',
        );
        const treeConfig = parseTreeConfig(raw);
        const orchestrator = new ScrapeOrchestrator(rootLogger);
        const { tasks } = await runTree(treeConfig.tree, orchestrator, rootLogger, { baseDir });
        printTreeSummary(tasks);
        if (tasks.some((t) => t.result.stats.itemsFailed > 0)) process.exitCode = 1;
        return;
      }
    }

    const overrides = buildCliOverrides(options, url);
    const config = await resolveTaskConfig(filePath, overrides);
    rootLogger.setLevel(config.logging.level);

    const orchestrator = new ScrapeOrchestrator(rootLogger);
    const { options: progressCallbacks, stop } = createProgressCallbacks(
      Boolean(options.quiet) || config.logging.level !== 'info',
    );
    try {
      const result = await orchestrator.runTask(config, { baseDir, ...progressCallbacks });
      stop();
      printTaskSummary(result);
      if (result.stats.itemsFailed > 0) process.exitCode = 1;
    } finally {
      stop();
    }
  } catch (err) {
    printError(err, Boolean(options.debug));
    process.exitCode = 1;
  }
}
