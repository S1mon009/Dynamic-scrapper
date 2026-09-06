import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  loadTaskConfig,
  loadTreeConfig,
  readConfigFile,
  resolveTaskConfig,
} from '../../../src/config/loader.js';
import { ConfigFileError, ConfigValidationError } from '../../../src/core/errors.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scraper-loader-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

async function writeFile(name: string, content: string): Promise<string> {
  const filePath = path.join(tmpDir, name);
  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

describe('readConfigFile', () => {
  it('parses .yaml files', async () => {
    const filePath = await writeFile('a.yaml', 'url: https://example.com\nname: test\n');
    await expect(readConfigFile(filePath)).resolves.toEqual({
      url: 'https://example.com',
      name: 'test',
    });
  });

  it('parses .json files', async () => {
    const filePath = await writeFile('a.json', JSON.stringify({ url: 'https://example.com' }));
    await expect(readConfigFile(filePath)).resolves.toEqual({ url: 'https://example.com' });
  });

  it('sniffs an unrecognized extension as JSON, falling back to YAML', async () => {
    const jsonish = await writeFile('a.conf', JSON.stringify({ url: 'https://example.com' }));
    await expect(readConfigFile(jsonish)).resolves.toEqual({ url: 'https://example.com' });

    const yamlish = await writeFile('b.conf', 'url: https://example.com\n');
    await expect(readConfigFile(yamlish)).resolves.toEqual({ url: 'https://example.com' });
  });

  it('throws ConfigFileError for a missing file', async () => {
    await expect(readConfigFile(path.join(tmpDir, 'missing.yaml'))).rejects.toThrow(
      ConfigFileError,
    );
  });

  it('throws ConfigFileError for malformed YAML', async () => {
    const filePath = await writeFile('bad.yaml', 'url: [this is not\n  valid: yaml');
    await expect(readConfigFile(filePath)).rejects.toThrow(ConfigFileError);
  });
});

describe('loadTaskConfig / loadTreeConfig', () => {
  it('loads and validates a task config, applying defaults', async () => {
    const filePath = await writeFile('task.yaml', 'url: https://example.com\n');
    const config = await loadTaskConfig(filePath);
    expect(config.url).toBe('https://example.com');
    expect(config.output.directory).toBe('./downloads');
  });

  it('throws ConfigValidationError with a readable message for an invalid task config', async () => {
    const filePath = await writeFile('bad-task.yaml', 'url: not-a-url\n');
    await expect(loadTaskConfig(filePath)).rejects.toThrow(ConfigValidationError);
  });

  it('loads a tree config without prematurely applying per-node defaults', async () => {
    const filePath = await writeFile(
      'tree.yaml',
      [
        'tree:',
        '  output:',
        '    directory: ./custom',
        '  children:',
        '    - name: child',
        '      url: https://example.com',
      ].join('\n'),
    );
    const config = await loadTreeConfig(filePath);
    expect(config.tree.output).toEqual({ directory: './custom' });
    expect(config.tree.children?.[0]).not.toHaveProperty('output');
  });
});

describe('resolveTaskConfig', () => {
  it('merges CLI overrides on top of the file config before validating once', async () => {
    const filePath = await writeFile(
      'task.yaml',
      'url: https://example.com\noutput:\n  directory: ./from-file\n  prefix: file_\n',
    );
    const config = await resolveTaskConfig(filePath, { output: { directory: './from-cli' } });
    expect(config.output.directory).toBe('./from-cli'); // CLI wins
    expect(config.output.prefix).toBe('file_'); // untouched fields survive
  });

  it('works with no file at all (bare URL scrape)', async () => {
    const config = await resolveTaskConfig(undefined, { url: 'https://example.com' });
    expect(config.url).toBe('https://example.com');
    expect(config.output.directory).toBe('./downloads');
  });
});
