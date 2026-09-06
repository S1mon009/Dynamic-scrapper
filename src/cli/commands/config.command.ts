import type { Command } from 'commander';
import { resolveTaskConfig } from '../../config/loader.js';
import { printError } from '../ui.js';

/** Registers the configuration inspection CLI command. */
export function registerConfigCommand(program: Command): void {
  program
    .command('config')
    .argument('<config>', 'path to a YAML/JSON task config file')
    .description('Print the fully resolved config (file + defaults) as JSON, for debugging')
    .action(async (configPath: string) => {
      try {
        const resolved = await resolveTaskConfig(configPath, {});
        console.log(JSON.stringify(resolved, null, 2));
      } catch (err) {
        printError(err);
        process.exitCode = 1;
      }
    });
}
