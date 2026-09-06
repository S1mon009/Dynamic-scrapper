import chalk from 'chalk';
import cliProgress from 'cli-progress';
import type { TaskResult } from '../core/types.js';
import type { TaskRunOptions } from '../core/scrape-orchestrator.js';
import { isScraperError } from '../core/errors.js';

/** Creates progress callbacks for a task run and a matching cleanup function. */
export function createProgressCallbacks(quiet: boolean): {
  options: Pick<TaskRunOptions, 'onPageVisited' | 'onBatchQueued' | 'onItemDownloaded'>;
  stop: () => void;
} {
  if (quiet) {
    return { options: {}, stop: () => undefined };
  }

  const bar = new cliProgress.SingleBar(
    {
      format: `  ${chalk.cyan('{bar}')} {percentage}% | {value}/{total} items | page {pages}`,
      hideCursor: true,
      clearOnComplete: false,
      barCompleteChar: '█',
      barIncompleteChar: '░',
    },
    cliProgress.Presets.shades_classic,
  );
  let started = false;
  let pages = 0;

  return {
    options: {
      onPageVisited: () => {
        pages += 1;
        if (started) bar.update({ pages });
      },
      onBatchQueued: (count) => {
        if (!started) {
          bar.start(count, 0, { pages });
          started = true;
        } else {
          bar.setTotal(bar.getTotal() + count);
        }
      },
      onItemDownloaded: () => {
        if (started) bar.increment(1, { pages });
      },
    },
    stop: () => {
      if (started) bar.stop();
    },
  };
}

const STATUS_COLOR: Record<string, (s: string) => string> = {
  saved: chalk.green,
  renamed: chalk.cyan,
  overwritten: chalk.yellow,
  skipped: chalk.gray,
  failed: chalk.red,
  'dry-run': chalk.blue,
};

/** Prints counters, warnings and errors for one completed task. */
export function printTaskSummary(result: TaskResult): void {
  const { stats } = result;
  const durationMs = (stats.finishedAt ?? new Date()).getTime() - stats.startedAt.getTime();

  console.log('');
  console.log(chalk.bold(`Summary — ${stats.taskName}`));
  console.log(`  pages visited     ${stats.pagesVisited}`);
  console.log(`  items found       ${stats.itemsFound}`);
  console.log(`  passed filters    ${stats.itemsPassedFilters}`);
  console.log(`  ${STATUS_COLOR.saved!('saved')}             ${stats.itemsSaved}`);
  console.log(`  ${STATUS_COLOR.skipped!('skipped')}           ${stats.itemsSkipped}`);
  console.log(`  ${STATUS_COLOR.failed!('failed')}            ${stats.itemsFailed}`);
  console.log(`  duration          ${(durationMs / 1000).toFixed(1)}s`);

  if (result.warnings.length > 0) {
    console.log(chalk.yellow(`\n  ${result.warnings.length} warning(s):`));
    for (const w of result.warnings) console.log(chalk.yellow(`   - ${w}`));
  }
  if (result.errors.length > 0) {
    console.log(chalk.red(`\n  ${result.errors.length} error(s):`));
    for (const e of result.errors) console.log(chalk.red(`   - ${e}`));
  }
}

/** Prints aggregate counters for completed tree tasks. */
export function printTreeSummary(tasks: Array<{ path: string[]; result: TaskResult }>): void {
  console.log('');
  console.log(chalk.bold(`Tree summary — ${tasks.length} task(s)`));
  let totalSaved = 0;
  let totalFailed = 0;
  for (const { path, result } of tasks) {
    totalSaved += result.stats.itemsSaved;
    totalFailed += result.stats.itemsFailed;
    const label = path.join(' / ') || result.taskName;
    const statusIcon = result.stats.itemsFailed > 0 ? chalk.yellow('⚠') : chalk.green('✔');
    console.log(
      `  ${statusIcon} ${label} — ${chalk.green(`${result.stats.itemsSaved} saved`)}${
        result.stats.itemsFailed > 0 ? `, ${chalk.red(`${result.stats.itemsFailed} failed`)}` : ''
      }`,
    );
  }
  console.log(chalk.bold(`\n  total: ${totalSaved} saved, ${totalFailed} failed`));
}

/** Applies the CLI color associated with a download status. */
export function statusLabel(status: string): string {
  const colorFn = STATUS_COLOR[status] ?? ((s: string) => s);
  return colorFn(status);
}

/** Prints a normalized scraper error, optionally including its stack. */
export function printError(err: unknown, debug = false): void {
  if (isScraperError(err)) {
    console.error(chalk.red(`✖ ${err.message}`));
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  console.error(chalk.red(`✖ Unexpected error: ${message}`));
  if (debug && err instanceof Error && err.stack) {
    console.error(chalk.dim(err.stack));
  } else {
    console.error(chalk.dim('  Run with --debug for a full stack trace.'));
  }
}
