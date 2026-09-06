import { describe, expect, it } from 'vitest';
import {
  filterConfigSchema,
  taskConfigSchema,
  treeConfigSchema,
  isTreeConfig,
  rootConfigSchema,
} from '../../../src/config/schema.js';
import { flattenTree } from '../../../src/tree/tree-runner.js';

describe('taskConfigSchema', () => {
  it('applies defaults for an empty config', () => {
    const parsed = taskConfigSchema.parse({});
    expect(parsed.output.directory).toBe('./downloads');
    expect(parsed.output.startIndex).toBe(1);
    expect(parsed.output.onConflict).toBe('rename');
    expect(parsed.browser.engine).toBe('auto');
    expect(parsed.browser.headless).toBe(true);
    expect(parsed.logging.level).toBe('info');
  });

  it('rejects an invalid url', () => {
    const result = taskConfigSchema.safeParse({ url: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('rejects unknown filter keys (strict schema catches typos)', () => {
    const result = filterConfigSchema.safeParse({ includes: ['*.jpg'] }); // typo: should be `include`
    expect(result.success).toBe(false);
  });

  it('accepts a fully specified browser config including proxy, cookies and actions', () => {
    const result = taskConfigSchema.safeParse({
      url: 'https://example.com',
      browser: {
        engine: 'dynamic',
        userAgent: 'test-agent/1.0',
        proxy: { server: 'http://127.0.0.1:8080' },
        cookies: [{ name: 'session', value: 'abc' }],
        actions: [
          { type: 'click', selector: '#accept-cookies' },
          { type: 'scroll', toBottom: true },
          { type: 'wait', ms: 500 },
        ],
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('treeConfigSchema', () => {
  it('parses a nested tree structurally without prematurely applying per-node defaults', () => {
    const parsed = treeConfigSchema.parse({
      tree: {
        output: { directory: './downloads' },
        folder: 'Anime',
        children: [
          { name: 'Bleach', url: 'https://example.com/bleach', filters: { include: ['*.jpg'] } },
          { name: 'Naruto', url: 'https://example.com/naruto' },
        ],
      },
    });
    expect(parsed.tree.children).toHaveLength(2);
    expect(parsed.tree.children?.[0]?.name).toBe('Bleach');
    expect(parsed.tree.children?.[0]).not.toHaveProperty('output');
  });

  it('end to end: a child that does not set output.directory actually inherits the parent’s, through the real parse + flatten pipeline', () => {
    const parsed = treeConfigSchema.parse({
      tree: {
        output: { directory: './out-tree' },
        children: [
          { name: 'inherits', url: 'https://example.com/a' },
          {
            name: 'overrides',
            url: 'https://example.com/b',
            output: { directory: './somewhere-else' },
          },
        ],
      },
    });
    const tasks = flattenTree(parsed.tree);
    const inherits = tasks.find((t) => t.config.name === 'inherits');
    const overrides = tasks.find((t) => t.config.name === 'overrides');
    expect(inherits?.config.output.directory).toBe('./out-tree');
    expect(overrides?.config.output.directory).toBe('./somewhere-else');
  });

  it('supports arbitrarily deep nesting', () => {
    const parsed = treeConfigSchema.parse({
      tree: {
        folder: 'root',
        children: [{ folder: 'mid', children: [{ name: 'leaf', url: 'https://example.com' }] }],
      },
    });
    expect(parsed.tree.children?.[0]?.children?.[0]?.name).toBe('leaf');
  });
});

describe('isTreeConfig', () => {
  it('discriminates tree configs from plain task configs', () => {
    const tree = rootConfigSchema.parse({ tree: { url: 'https://example.com' } });
    const task = rootConfigSchema.parse({ url: 'https://example.com' });
    expect(isTreeConfig(tree)).toBe(true);
    expect(isTreeConfig(task)).toBe(false);
  });
});
