import { describe, expect, it, vi } from 'vitest';
import { runTree } from '../../../src/tree/tree-runner.js';
import { Logger } from '../../../src/logger/logger.js';
import type { TaskConfig, TreeNodeInput } from '../../../src/config/schema.js';
import type { ScrapeOrchestrator } from '../../../src/core/scrape-orchestrator.js';
import type { TaskResult } from '../../../src/core/types.js';

function fakeResult(taskName: string, itemsFailed = 0): TaskResult {
  return {
    taskName,
    stats: {
      taskName,
      pagesVisited: 1,
      itemsFound: 1,
      itemsPassedFilters: 1,
      itemsSaved: 1,
      itemsSkipped: 0,
      itemsFailed,
      startedAt: new Date(),
      finishedAt: new Date(),
    },
    downloads: [],
    warnings: [],
    errors: [],
  };
}

describe('runTree', () => {
  it('runs every leaf task in order and collects their results with breadcrumb paths', async () => {
    const tree: TreeNodeInput = {
      children: [
        { name: 'first', url: 'https://example.com/a' },
        { name: 'second', url: 'https://example.com/b' },
      ],
    };
    const runTask = vi.fn((config: TaskConfig) =>
      Promise.resolve(fakeResult(config.name ?? 'unnamed')),
    );
    const orchestrator = { runTask } as unknown as ScrapeOrchestrator;

    const { tasks } = await runTree(tree, orchestrator, new Logger({ level: 'silent' }));

    expect(runTask).toHaveBeenCalledTimes(2);
    expect(tasks.map((t) => t.path)).toEqual([['first'], ['second']]);
    expect(tasks.map((t) => t.result.taskName)).toEqual(['first', 'second']);
  });

  it('skips a leaf with no url anywhere in its inheritance chain, without calling the orchestrator', async () => {
    const tree: TreeNodeInput = { children: [{ name: 'no-url' }] };
    const runTask = vi.fn();
    const orchestrator = { runTask } as unknown as ScrapeOrchestrator;

    const { tasks } = await runTree(tree, orchestrator, new Logger({ level: 'silent' }));

    expect(runTask).not.toHaveBeenCalled();
    expect(tasks).toHaveLength(0);
  });

  it('runs tasks sequentially, not concurrently', async () => {
    const tree: TreeNodeInput = {
      children: [
        { name: 'slow', url: 'https://example.com/a' },
        { name: 'fast', url: 'https://example.com/b' },
      ],
    };
    const order: string[] = [];
    const runTask = vi.fn(async (config: TaskConfig) => {
      const name = config.name ?? 'unnamed';
      order.push(`start:${name}`);
      await new Promise((resolve) => setTimeout(resolve, name === 'slow' ? 20 : 0));
      order.push(`end:${name}`);
      return fakeResult(name);
    });
    const orchestrator = { runTask } as unknown as ScrapeOrchestrator;

    await runTree(tree, orchestrator, new Logger({ level: 'silent' }));

    expect(order).toEqual(['start:slow', 'end:slow', 'start:fast', 'end:fast']);
  });
});
