import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CustomFilterRegistry } from '../../../src/filters/custom-filter.js';
import type { ScrapedItem } from '../../../src/core/types.js';

function makeItem(overrides: Partial<ScrapedItem> = {}): ScrapedItem {
  return {
    type: 'image',
    attributes: {},
    cssClasses: [],
    sourcePageUrl: 'https://example.com',
    depth: 0,
    ...overrides,
  };
}

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scraper-customfilter-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('CustomFilterRegistry', () => {
  it('resolves a predicate registered programmatically', async () => {
    const registry = new CustomFilterRegistry();
    registry.register('big', (item) => (item.sizeBytes ?? 0) > 1000);
    const [filter] = registry.resolve(['big']);
    expect((await filter!.apply(makeItem({ sizeBytes: 2000 }))).passed).toBe(true);
    expect((await filter!.apply(makeItem({ sizeBytes: 10 }))).passed).toBe(false);
  });

  it('loads every exported function from a real JS module on disk', async () => {
    const modulePath = path.join(tmpDir, 'filters.mjs');
    await fs.writeFile(
      modulePath,
      `export function onlyJpg(item) { return item.url?.endsWith('.jpg') ?? false; }
       export async function alwaysTrue() { return true; }
       export const notAFunction = 42;`,
    );

    const registry = new CustomFilterRegistry();
    await registry.loadFromModule('filters.mjs', tmpDir);

    const [onlyJpg] = registry.resolve(['onlyJpg']);
    expect((await onlyJpg!.apply(makeItem({ url: 'https://x.com/a.jpg' }))).passed).toBe(true);
    expect((await onlyJpg!.apply(makeItem({ url: 'https://x.com/a.png' }))).passed).toBe(false);

    const [alwaysTrue] = registry.resolve(['alwaysTrue']);
    expect((await alwaysTrue!.apply(makeItem())).passed).toBe(true);
  });

  it('throws a clear error for a module that fails to load', async () => {
    const registry = new CustomFilterRegistry();
    await expect(registry.loadFromModule('./does-not-exist.mjs', tmpDir)).rejects.toThrow(
      /Failed to load custom filters/,
    );
  });

  it('throws a clear error for a module with no function exports', async () => {
    const modulePath = path.join(tmpDir, 'empty.mjs');
    await fs.writeFile(modulePath, 'export const notAFunction = 1;');
    const registry = new CustomFilterRegistry();
    await expect(registry.loadFromModule('empty.mjs', tmpDir)).rejects.toThrow(/did not export/);
  });

  it('throws a clear error when resolving an unregistered filter name', () => {
    const registry = new CustomFilterRegistry();
    expect(() => registry.resolve(['missing'])).toThrow(/Unknown custom filter/);
  });
});
