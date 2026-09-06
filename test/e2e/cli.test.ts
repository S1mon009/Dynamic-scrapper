import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProgram, main } from '../../src/cli/index.js';

let tmpDir: string;
let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scraper-cli-e2e-'));
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  process.exitCode = undefined;
});

afterEach(async () => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
  process.exitCode = undefined;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function loggedOutput(spy: ReturnType<typeof vi.spyOn>): string {
  return spy.mock.calls.map((call: any) => String(call[0])).join('\n');
}

describe('CLI: scraper validate', () => {
  it('reports a valid task config with its resolved fields', async () => {
    const filePath = path.join(tmpDir, 'task.yaml');
    await fs.writeFile(
      filePath,
      'url: https://example.com\ntargets:\n  - type: image\n    selector: img\n',
    );

    await createProgram().parseAsync(['node', 'scraper', 'validate', filePath]);

    expect(process.exitCode).toBeUndefined();
    expect(loggedOutput(logSpy)).toContain('valid task config');
    expect(loggedOutput(logSpy)).toContain('https://example.com');
  });

  it('reports how a tree config resolves, with each leaf’s output directory', async () => {
    const filePath = path.join(tmpDir, 'tree.yaml');
    await fs.writeFile(
      filePath,
      [
        'tree:',
        '  output:',
        '    directory: ./out-tree',
        '  children:',
        '    - name: leaf-one',
        '      url: https://example.com/a',
      ].join('\n'),
    );

    await createProgram().parseAsync(['node', 'scraper', 'validate', filePath]);

    const output = loggedOutput(logSpy);
    expect(output).toContain('valid tree config');
    expect(output).toContain('leaf-one');
    expect(output).toContain('out-tree');
  });

  it('exits non-zero with a readable error for an invalid config', async () => {
    const filePath = path.join(tmpDir, 'bad.yaml');
    await fs.writeFile(filePath, 'url: not-a-url\n');

    await createProgram().parseAsync(['node', 'scraper', 'validate', filePath]);

    expect(process.exitCode).toBe(1);
    expect(loggedOutput(errorSpy)).toContain('Invalid');
  });
});

describe('CLI: scraper doctor', () => {
  it('runs every environment check and prints a result for each', async () => {
    await createProgram().parseAsync(['node', 'scraper', 'doctor']);

    const output = loggedOutput(logSpy);
    expect(output).toContain('Node.js version');
    expect(output).toContain('Write access to current directory');
    expect(output).toContain('Playwright Chromium binary');
  });
});

describe('CLI: scraper init', () => {
  it('scaffolds a starter config file that scraper validate then accepts', async () => {
    const target = path.join(tmpDir, 'scraper.config.yaml');
    await createProgram().parseAsync(['node', 'scraper', 'init', target]);
    await expect(fs.access(target)).resolves.toBeUndefined();

    logSpy.mockClear();
    await createProgram().parseAsync(['node', 'scraper', 'validate', target]);
    expect(loggedOutput(logSpy)).toContain('valid task config');
  });

  it('refuses to overwrite an existing file without --force', async () => {
    const target = path.join(tmpDir, 'scraper.config.yaml');
    await fs.writeFile(target, 'existing content');

    await createProgram().parseAsync(['node', 'scraper', 'init', target]);

    expect(process.exitCode).toBe(1);
    await expect(fs.readFile(target, 'utf-8')).resolves.toBe('existing content');
  });
});

describe('CLI: scraper config', () => {
  it('prints the fully resolved config as JSON', async () => {
    const filePath = path.join(tmpDir, 'task.yaml');
    await fs.writeFile(filePath, 'url: https://example.com\n');

    await createProgram().parseAsync(['node', 'scraper', 'config', filePath]);

    const printed = JSON.parse(loggedOutput(logSpy)) as {
      url: string;
      output: { directory: string };
    };
    expect(printed.url).toBe('https://example.com');
    expect(printed.output.directory).toBe('./downloads');
  });
});

describe('CLI: scraper version', () => {
  it('prints the package name and version', async () => {
    await createProgram().parseAsync(['node', 'scraper', 'version']);
    expect(loggedOutput(logSpy)).toMatch(/dynamic-scraper v\d+\.\d+\.\d+/);
  });

  it('runs the CLI entrypoint when main() is invoked', async () => {
    await main(['node', 'scraper', 'version']);
    expect(loggedOutput(logSpy)).toMatch(/dynamic-scraper v\d+\.\d+\.\d+/);
  });
});
