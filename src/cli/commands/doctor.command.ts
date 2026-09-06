import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';

interface CheckResult {
  label: string;
  ok: boolean;
  detail: string;
}

const MIN_NODE_MAJOR = 18;
const MIN_NODE_MINOR = 18;

function checkNodeVersion(): CheckResult {
  const [major, minor] = process.versions.node.split('.').map(Number) as [number, number];
  const ok = major > MIN_NODE_MAJOR || (major === MIN_NODE_MAJOR && minor >= MIN_NODE_MINOR);
  return { label: 'Node.js version', ok, detail: `v${process.versions.node} (need >= 18.18)` };
}

async function checkWritableCwd(): Promise<CheckResult> {
  const probe = path.join(process.cwd(), `.scraper-write-test-${Date.now()}`);
  try {
    await fs.writeFile(probe, 'x');
    await fs.unlink(probe);
    return { label: 'Write access to current directory', ok: true, detail: process.cwd() };
  } catch (err) {
    return {
      label: 'Write access to current directory',
      ok: false,
      detail: (err as Error).message,
    };
  }
}

async function checkChromiumInstalled(): Promise<CheckResult> {
  try {
    const { chromium } = await import('playwright');
    const execPath = chromium.executablePath();
    await fs.access(execPath);
    return { label: 'Playwright Chromium binary', ok: true, detail: execPath };
  } catch {
    return {
      label: 'Playwright Chromium binary',
      ok: false,
      detail:
        'not found — run "npx playwright install --with-deps chromium" (only needed for engine: dynamic)',
    };
  }
}

function checkTempDir(): CheckResult {
  return { label: 'OS temp directory', ok: true, detail: os.tmpdir() };
}

/** Registers the environment diagnostics CLI command. */
export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Check that the environment is ready to run dynamic-scraper')
    .action(async () => {
      const results: CheckResult[] = [
        checkNodeVersion(),
        await checkWritableCwd(),
        await checkChromiumInstalled(),
        checkTempDir(),
      ];

      console.log(chalk.bold('dynamic-scraper doctor\n'));
      let allOk = true;
      for (const result of results) {
        allOk &&= result.ok;
        const icon = result.ok ? chalk.green('✔') : chalk.red('✖');
        console.log(`${icon} ${result.label}`);
        console.log(chalk.dim(`   ${result.detail}`));
      }

      console.log('');
      if (allOk) {
        console.log(chalk.green('Everything looks good.'));
      } else {
        console.log(
          chalk.yellow('Some checks failed — the static engine will still work either way.'),
        );
        process.exitCode = 1;
      }
    });
}
