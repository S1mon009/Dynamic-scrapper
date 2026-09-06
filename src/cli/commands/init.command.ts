import { promises as fs } from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { pathExists } from '../../utils/fs.utils.js';

const STARTER_CONFIG = `# dynamic-scraper task config — see docs/configuration.md for every field.
name: my-first-task
url: https://example.com

output:
  directory: ./downloads
  onConflict: rename # overwrite | skip | rename | fail
  numberingStyle: sequential # sequential | timestamp | uuid | none
  numberPadding: 3

browser:
  engine: auto # static | dynamic | auto
  headless: true
  timeout: 30000
  # waitForSelector: "#content"
  # userAgent: "Mozilla/5.0 ..."
  # proxy:
  #   server: "http://127.0.0.1:8080"

targets:
  - type: image
    selector: img
    filters:
      extensions: [jpg, jpeg, png, webp]
      maxResults: 50

logging:
  level: info
`;

/** Registers the starter configuration CLI command. */
export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .argument('[path]', 'where to write the starter config', 'scraper.config.yaml')
    .description('Scaffold a starter YAML config in the current directory')
    .option('-f, --force', 'overwrite the file if it already exists')
    .action(async (targetPath: string, options: { force?: boolean }) => {
      const resolved = path.resolve(targetPath);
      if (!options.force && (await pathExists(resolved))) {
        console.error(chalk.red(`✖ ${targetPath} already exists — use --force to overwrite`));
        process.exitCode = 1;
        return;
      }
      await fs.writeFile(resolved, STARTER_CONFIG, 'utf-8');
      console.log(chalk.green(`✔ wrote ${targetPath}`));
      console.log(
        chalk.dim(`  next: scraper validate ${targetPath}   or   scraper scrape ${targetPath}`),
      );
    });
}
