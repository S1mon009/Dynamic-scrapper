import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import chalk from 'chalk';
import { Command } from 'commander';
import { rootLogger } from '../logger/logger.js';
import { registerConfigCommand } from './commands/config.command.js';
import { registerDoctorCommand } from './commands/doctor.command.js';
import { registerInitCommand } from './commands/init.command.js';
import { registerScrapeCommand } from './commands/scrape.command.js';
import { registerTreeCommand } from './commands/tree.command.js';
import { registerValidateCommand } from './commands/validate.command.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(moduleDir, '../../package.json'), 'utf-8')) as {
  name: string;
  version: string;
};

/** Builds the configured scraper command-line program. */
export function createProgram(): Command {
  const program = new Command();

  program
    .name('scraper')
    .description('Professional CLI for scraping static and JavaScript-rendered websites')
    .version(pkg.version, '-V, --version', 'output the current version')
    .configureOutput({ outputError: (str, write) => write(chalk.red(str)) });

  registerScrapeCommand(program);
  registerTreeCommand(program);
  registerValidateCommand(program);
  registerDoctorCommand(program);
  registerInitCommand(program);
  registerConfigCommand(program);

  program
    .command('version')
    .description('Print the current version')
    .action(() => {
      console.log(`${pkg.name} v${pkg.version}`);
    });

  return program;
}

/** Parses CLI arguments and reports unexpected failures through the root logger. */
export async function main(argv: string[] = process.argv): Promise<void> {
  const program = createProgram();
  try {
    await program.parseAsync(argv);
  } catch (err) {
    rootLogger.error('Unexpected error', err);
    process.exitCode = 1;
  }
}

const isDirectExecution =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectExecution) {
  void main(process.argv);
}
