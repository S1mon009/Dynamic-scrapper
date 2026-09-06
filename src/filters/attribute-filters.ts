import type { FilterResult, ItemFilter, ScrapedItem } from '../core/types.js';
import { matchesRegex, matchesWildcard } from '../utils/match.utils.js';

function valueMatches(actual: string, expected: string): boolean {
  if (expected.startsWith('/') && expected.length > 1) return matchesRegex(actual, expected);
  if (expected.includes('*') || expected.includes('?')) return matchesWildcard(actual, expected);
  return actual.toLowerCase() === expected.toLowerCase();
}

/** Matches configured attribute names and values. */
export class AttributeFilter implements ItemFilter {
  readonly name = 'attributes';
  /** Creates a filter for exact, wildcard or regex attribute values. */
  constructor(private readonly expected: Readonly<Record<string, string>>) {}
  /** Returns whether all configured attributes match. */
  apply(item: ScrapedItem): FilterResult {
    for (const [attrName, expectedValue] of Object.entries(this.expected)) {
      const actual = item.attributes[attrName];
      if (actual === undefined || !valueMatches(actual, expectedValue)) {
        return {
          passed: false,
          reason: `attribute "${attrName}" did not match "${expectedValue}"`,
        };
      }
    }
    return { passed: true };
  }
}

/** Accepts an item when it contains at least one configured CSS class. */
export class CssClassFilter implements ItemFilter {
  readonly name = 'cssClasses';
  /** Creates a filter for the allowed CSS classes. */
  constructor(private readonly classes: readonly string[]) {}
  /** Returns whether any configured class is present. */
  apply(item: ScrapedItem): FilterResult {
    const passed = this.classes.some((c) => item.cssClasses.includes(c));
    return passed ? { passed } : { passed, reason: `none of [${this.classes.join(', ')}] present` };
  }
}
