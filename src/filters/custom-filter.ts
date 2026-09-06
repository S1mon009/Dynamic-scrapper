import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { FilterResult, ItemFilter, ScrapedItem } from '../core/types.js';
import { FilterError } from '../core/errors.js';

/** Predicate implemented by a user-defined item filter. */
export type CustomFilterPredicate = (item: ScrapedItem) => boolean | Promise<boolean>;

class CustomFilter implements ItemFilter {
  readonly name: string;
  constructor(
    name: string,
    private readonly predicate: CustomFilterPredicate,
  ) {
    this.name = `custom:${name}`;
  }
  async apply(item: ScrapedItem): Promise<FilterResult> {
    const passed = await this.predicate(item);
    return passed
      ? { passed: true }
      : { passed: false, reason: `custom filter "${this.name}" rejected item` };
  }
}

/** Registry for dynamically loaded custom filter predicates. */
export class CustomFilterRegistry {
  private readonly predicates = new Map<string, CustomFilterPredicate>();

  /**
   * Registers or replaces a named custom predicate.
   *
   * @param name - Name referenced by task configuration.
   * @param predicate - Function deciding whether an item passes.
   */
  register(name: string, predicate: CustomFilterPredicate): void {
    this.predicates.set(name, predicate);
  }

  /**
   * Imports a module and registers all function exports as predicates.
   *
   * @param modulePath - Absolute or base-directory-relative module path.
   * @param baseDir - Base directory for relative paths.
   * @returns A promise resolved after predicates are registered.
   * @throws FilterError when the module cannot be loaded or has no functions.
   */
  async loadFromModule(modulePath: string, baseDir: string): Promise<void> {
    const absolute = path.isAbsolute(modulePath) ? modulePath : path.resolve(baseDir, modulePath);
    let mod: Record<string, unknown>;
    try {
      mod = (await import(pathToFileURL(absolute).href)) as Record<string, unknown>;
    } catch (err) {
      throw new FilterError(
        `Failed to load custom filters from "${modulePath}": ${(err as Error).message}`,
      );
    }
    let registered = 0;
    for (const [exportName, value] of Object.entries(mod)) {
      if (typeof value === 'function') {
        this.register(exportName, value as CustomFilterPredicate);
        registered += 1;
      }
    }
    if (registered === 0) {
      throw new FilterError(`Custom filters module "${modulePath}" did not export any functions`);
    }
  }

  /**
   * Resolves configured predicate names into executable item filters.
   *
   * @param names - Registered predicate names.
   * @returns Executable filters in the requested order.
   * @throws FilterError when a name is not registered.
   */
  resolve(names: readonly string[]): ItemFilter[] {
    return names.map((name) => {
      const predicate = this.predicates.get(name);
      if (!predicate) {
        throw new FilterError(
          `Unknown custom filter "${name}" — register it or check customFiltersPath`,
        );
      }
      return new CustomFilter(name, predicate);
    });
  }
}
