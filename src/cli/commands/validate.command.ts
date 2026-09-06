import chalk from 'chalk';
import type { Command } from 'commander';
import { flattenTree } from '../../tree/tree-runner.js';
import { parseRootConfig, readConfigFile } from '../../config/loader.js';
import { isTreeConfig } from '../../config/schema.js';
import { printError } from '../ui.js';

/** Registers the configuration validation CLI command. */
export function registerValidateCommand(program: Command): void {
  program
    .command('validate')
    .argument('<config>', 'path to a YAML/JSON task or tree config file')
    .description('Validate a config file against the schema without running it')
    .action(async (configPath: string) => {
      try {
        const raw = await readConfigFile(configPath);
        const config = parseRootConfig(raw);

        if (isTreeConfig(config)) {
          const tasks = flattenTree(config.tree);
          console.log(chalk.green(`✔ valid tree config — resolves into ${tasks.length} task(s):`));
          for (const { path: taskPath, config: taskConfig } of tasks) {
            const label = taskPath.join(' / ') || taskConfig.name || '(unnamed)';
            const urlNote = taskConfig.url
              ? taskConfig.url
              : chalk.red('(no url — will be skipped)');
            console.log(`  - ${label}: ${urlNote} → ${taskConfig.output.directory}`);
          }
        } else {
          console.log(chalk.green('✔ valid task config'));
          console.log(`  url:       ${config.url ?? chalk.red('(missing)')}`);
          console.log(`  output:    ${config.output.directory}`);
          console.log(`  engine:    ${config.browser.engine}`);
          console.log(`  targets:   ${config.targets?.length ?? 0}`);
        }
      } catch (err) {
        printError(err);
        process.exitCode = 1;
      }
    });
}
