import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { flattenTree } from '../../../src/tree/tree-runner.js';
import type { TreeNodeInput } from '../../../src/config/schema.js';

describe('flattenTree', () => {
  it('flattens the spec example: children that override output keep their own value', () => {
    const tree: TreeNodeInput = {
      output: { directory: './downloads' },
      folder: 'Anime',
      children: [
        {
          name: 'Bleach',
          url: 'https://example.com/bleach',
          output: { directory: './downloads/anime' },
          filters: { include: ['*.jpg'] },
        },
        { name: 'Naruto', url: 'https://example.com/naruto' },
      ],
    };

    const tasks = flattenTree(tree);
    expect(tasks).toHaveLength(2);

    const bleach = tasks.find((t) => t.config.name === 'Bleach');
    expect(bleach?.config.output.directory).toBe('./downloads/anime');
    expect(bleach?.config.filters?.include).toEqual(['*.jpg']);

    const naruto = tasks.find((t) => t.config.name === 'Naruto');
    expect(naruto?.config.output.directory).toBe(path.join('./downloads', 'Anime'));
  });

  it('lets a child override any single inherited field without losing the rest', () => {
    const tree: TreeNodeInput = {
      browser: { headless: true, timeout: 10_000 },
      children: [{ name: 'fast', url: 'https://example.com', browser: { timeout: 5000 } }],
    };
    const [task] = flattenTree(tree);
    expect(task?.config.browser.headless).toBe(true);
    expect(task?.config.browser.timeout).toBe(5000);
  });

  it('supports arbitrarily deep nesting, accumulating inheritance at each level', () => {
    const tree: TreeNodeInput = {
      output: { onConflict: 'skip' },
      children: [
        {
          folder: 'mid',
          filters: { maxResults: 10 },
          children: [{ name: 'leaf', url: 'https://example.com' }],
        },
      ],
    };
    const [task] = flattenTree(tree);
    expect(task?.config.output.onConflict).toBe('skip');
    expect(task?.config.filters?.maxResults).toBe(10);
    expect(task?.path).toEqual(['mid', 'leaf']);
  });

  it('array-valued config (like filters.include) is replaced, not merged, down the tree', () => {
    const tree: TreeNodeInput = {
      filters: { include: ['*.jpg', '*.png'] },
      children: [{ name: 'child', url: 'https://example.com', filters: { include: ['*.gif'] } }],
    };
    const [task] = flattenTree(tree);
    expect(task?.config.filters?.include).toEqual(['*.gif']);
  });

  it('a leaf with no url is still returned (the caller decides how to handle a missing url)', () => {
    const tree: TreeNodeInput = { children: [{ name: 'no-url' }] };
    const tasks = flattenTree(tree);
    expect(tasks[0]?.config.url).toBeUndefined();
  });
});
