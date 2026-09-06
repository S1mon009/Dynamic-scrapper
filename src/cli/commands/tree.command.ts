import path from 'node:path';
import type { Command } from 'commander';
import { loadTreeConfig } from '../../config/loader.js';
import { ScrapeOrchestrator } from '../../core/scrape-orchestrator.js';
import { rootLogger } from '../../logger/logger.js';
import { runTree } from '../../tree/tree-runner.js';
import { createProgressCallbacks, printError, printTreeSummary } from '../ui.js';
import type { LogLevel } from '../../config/schema.js';

interface TreeCommandOptions {
  logLevel?: LogLevel;
  verbose?: boolean;
  debug?: boolean;
  quiet?: boolean;
}

/** Registers the tree execution CLI command. */
export function registerTreeCommand(program: Command): void {
  program
    .command('tree')
    .argument('<config>', 'path to a YAML/JSON file containing a `tree:` definition')
    .description('Run every task in a hierarchical (tree) config, with automatic inheritance')
    .option('--log-level <level>', 'silent|error|warn|info|debug|verbose')
    .option('--verbose', 'shortcut for --log-level verbose')
    .option('--debug', 'shortcut for --log-level debug')
    .option('--quiet', 'suppress the progress bar')
    .action(async (configPath: string, options: TreeCommandOptions) => {
      const level: LogLevel | undefined = options.debug
        ? 'debug'
        : options.verbose
          ? 'verbose'
          : options.logLevel;
      if (level) rootLogger.setLevel(level);

      try {
        const treeConfig = await loadTreeConfig(configPath);
        const orchestrator = new ScrapeOrchestrator(rootLogger);
        const baseDir = path.dirname(path.resolve(configPath));

        const { tasks } = await runTree(treeConfig.tree, orchestrator, rootLogger, {
          baseDir,
          ...(options.quiet ? {} : createProgressCallbacks(false).options),
        });

        printTreeSummary(tasks);
        if (tasks.length === 0) {
          rootLogger.warn('tree resolved to zero runnable tasks (every branch was missing a url?)');
        }
        if (tasks.some((t) => t.result.stats.itemsFailed > 0)) process.exitCode = 1;
      } catch (err) {
        printError(err, Boolean(options.debug));
        process.exitCode = 1;
      }
    });
}
