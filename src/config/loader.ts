import { promises as fs } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import type { z } from 'zod';
import { ConfigFileError, ConfigValidationError } from '../core/errors.js';
import { deepMerge } from './merge.js';
import {
  rootConfigSchema,
  taskConfigSchema,
  treeConfigSchema,
  type RootConfig,
  type TaskConfig,
  type TaskConfigInput,
  type TreeConfig,
} from './schema.js';

const YAML_EXTENSIONS = new Set(['.yaml', '.yml']);
const JSON_EXTENSIONS = new Set(['.json']);

/**
 * Reads and parses JSON or YAML configuration from disk.
 *
 * @param filePath - Configuration file path.
 * @returns Parsed configuration value.
 * @throws ConfigFileError when the file cannot be read or parsed.
 */
export async function readConfigFile(filePath: string): Promise<unknown> {
  const absolute = path.resolve(filePath);
  let raw: string;
  try {
    raw = await fs.readFile(absolute, 'utf-8');
  } catch (err) {
    throw new ConfigFileError(`Cannot read config file "${filePath}": ${(err as Error).message}`);
  }

  const ext = path.extname(absolute).toLowerCase();
  try {
    if (YAML_EXTENSIONS.has(ext)) {
      return yaml.load(raw);
    }
    if (JSON_EXTENSIONS.has(ext)) {
      return JSON.parse(raw);
    }

    try {
      return JSON.parse(raw);
    } catch {
      return yaml.load(raw);
    }
  } catch (err) {
    throw new ConfigFileError(`Cannot parse config file "${filePath}": ${(err as Error).message}`);
  }
}

function formatZodError(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const pathStr = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `${pathStr}: ${issue.message}`;
  });
}

function validate<Output, Input>(
  schema: z.ZodType<Output, z.ZodTypeDef, Input>,
  raw: unknown,
  context: string,
): Output {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = formatZodError(result.error);
    throw new ConfigValidationError(`Invalid ${context}:\n  - ${issues.join('\n  - ')}`, issues);
  }
  return result.data;
}

/**
 * Validates an unknown value as a single task configuration.
 *
 * @param raw - Value to validate.
 * @returns Parsed task configuration with defaults applied.
 * @throws ConfigValidationError when validation fails.
 */
export function parseTaskConfig(raw: unknown): TaskConfig {
  return validate(taskConfigSchema, raw, 'task config');
}

/**
 * Validates an unknown value as a task tree configuration.
 *
 * @param raw - Value to validate.
 * @returns Parsed tree configuration.
 * @throws ConfigValidationError when validation fails.
 */
export function parseTreeConfig(raw: unknown): TreeConfig {
  return validate(treeConfigSchema, raw, 'tree config');
}

/**
 * Validates an unknown value as either a task or tree configuration.
 *
 * @param raw - Value to validate.
 * @returns Parsed root configuration.
 * @throws ConfigValidationError when validation fails.
 */
export function parseRootConfig(raw: unknown): RootConfig {
  return validate(rootConfigSchema, raw, 'config');
}

/** Reads and validates a single task configuration file. */
export async function loadTaskConfig(filePath: string): Promise<TaskConfig> {
  return parseTaskConfig(await readConfigFile(filePath));
}

/** Reads and validates a task tree configuration file. */
export async function loadTreeConfig(filePath: string): Promise<TreeConfig> {
  return parseTreeConfig(await readConfigFile(filePath));
}

/** Reads and validates either supported root configuration shape. */
export async function loadRootConfig(filePath: string): Promise<RootConfig> {
  return parseRootConfig(await readConfigFile(filePath));
}

/** Merges CLI overrides into an optional file configuration and validates it. */
export async function resolveTaskConfig(
  filePath: string | undefined,
  cliOverrides: TaskConfigInput,
): Promise<TaskConfig> {
  const raw = filePath ? await readConfigFile(filePath) : {};
  const rawObject = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const merged = deepMerge(rawObject, cliOverrides as Record<string, unknown>);
  return parseTaskConfig(merged);
}
