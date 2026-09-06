import path from 'node:path';
import { deepMerge } from '../config/merge.js';
import {
  taskConfigSchema,
  type TaskConfig,
  type TaskConfigInput,
  type TreeNodeInput,
} from '../config/schema.js';
import type { Logger } from '../logger/logger.js';
import type { TaskResult } from '../core/types.js';
import type { ScrapeOrchestrator, TaskRunOptions } from '../core/scrape-orchestrator.js';

/** A leaf task resolved from a configuration tree. */
export interface ResolvedTreeTask {
  /** Folder/name path leading to the task. */
  path: string[];
  /** Fully merged task configuration. */
  config: TaskConfig;
}

function omitTreeOnlyFields(node: TreeNodeInput): TaskConfigInput {
  const { children: _children, folder: _folder, ...rest } = node;
  return rest;
}

function flattenNode(
  node: TreeNodeInput,
  inherited: TaskConfigInput,
  pathSoFar: string[],
): ResolvedTreeTask[] {
  const ownFields = omitTreeOnlyFields(node);
  const merged = deepMerge(
    inherited as Record<string, unknown>,
    ownFields as Record<string, unknown>,
  ) as TaskConfigInput;

  const label = node.name ?? node.folder;
  const currentPath = label ? [...pathSoFar, label] : pathSoFar;

  if (!node.children || node.children.length === 0) {
    return [{ path: currentPath, config: taskConfigSchema.parse(merged) }];
  }

  let configForChildren = merged;
  if (node.folder) {
    const baseDir = merged.output?.directory ?? './downloads';
    configForChildren = deepMerge(merged as Record<string, unknown>, {
      output: { directory: path.join(baseDir, node.folder) },
    });
  }

  return node.children.flatMap((child) => flattenNode(child, configForChildren, currentPath));
}

/**
 * Flattens inherited tree configuration into executable leaf tasks.
 *
 * @param root - Root node of the configuration tree.
 * @returns Resolved leaf tasks with merged configurations.
 * @throws ConfigValidationError when a merged leaf is invalid.
 */
export function flattenTree(root: TreeNodeInput): ResolvedTreeTask[] {
  return flattenNode(root, {}, []);
}

/** Result of executing all runnable leaves in a task tree. */
export interface TreeRunResult {
  /** Results paired with their tree paths. */
  tasks: Array<{ path: string[]; result: TaskResult }>;
}

/**
 * Resolves and executes a configuration tree sequentially.
 *
 * @param root - Root node of the configuration tree.
 * @param orchestrator - Service used to execute each leaf task.
 * @param logger - Logger receiving tree progress messages.
 * @param options - Optional task callbacks and dependencies.
 * @returns Results for every runnable leaf task.
 */
export async function runTree(
  root: TreeNodeInput,
  orchestrator: ScrapeOrchestrator,
  logger: Logger,
  options: TaskRunOptions = {},
): Promise<TreeRunResult> {
  const resolved = flattenTree(root);
  logger.info(`tree resolved into ${resolved.length} task(s)`);

  const tasks: Array<{ path: string[]; result: TaskResult }> = [];
  for (const { path: taskPath, config } of resolved) {
    const label = taskPath.join(' / ') || config.name || config.url || '(unnamed)';
    if (!config.url) {
      logger.warn(`skipping "${label}" — no url configured on this branch`);
      continue;
    }
    logger.info(`▶ ${label}`);
    const result = await orchestrator.runTask(config, options);
    tasks.push({ path: taskPath, result });
  }
  return { tasks };
}
