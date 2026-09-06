import type { FilterResult, ItemFilter, ScrapedItem } from '../core/types.js';
import { matchesAnyRegex, matchesAnySubstring, matchesAnyWildcard } from '../utils/match.utils.js';

function searchableText(item: ScrapedItem): string {
  return [item.url, item.name, item.text].filter((v): v is string => Boolean(v)).join(' | ');
}

/** Includes items matching at least one case-insensitive substring. */
export class IncludeFilter implements ItemFilter {
  readonly name = 'include';
  /** Creates an inclusion filter. */
  constructor(private readonly patterns: readonly string[]) {}
  /** Checks URL, name and text content. */
  apply(item: ScrapedItem): FilterResult {
    const passed = matchesAnySubstring(searchableText(item), this.patterns);
    return passed
      ? { passed }
      : { passed, reason: `none of [${this.patterns.join(', ')}] matched` };
  }
}

/** Rejects items matching any configured case-insensitive substring. */
export class ExcludeFilter implements ItemFilter {
  readonly name = 'exclude';
  /** Creates an exclusion filter. */
  constructor(private readonly patterns: readonly string[]) {}
  /** Checks URL, name and text content. */
  apply(item: ScrapedItem): FilterResult {
    const hit = matchesAnySubstring(searchableText(item), this.patterns);
    return hit ? { passed: false, reason: `matched excluded pattern` } : { passed: true };
  }
}

/** Includes items matching at least one regular expression. */
export class RegexFilter implements ItemFilter {
  readonly name = 'regex';
  /** Creates a regular-expression filter. */
  constructor(private readonly patterns: readonly string[]) {}
  /** Checks URL, name and text content. */
  apply(item: ScrapedItem): FilterResult {
    const passed = matchesAnyRegex(searchableText(item), this.patterns);
    return passed
      ? { passed }
      : { passed, reason: `no regex in [${this.patterns.join(', ')}] matched` };
  }
}

/** Includes items matching at least one wildcard pattern. */
export class WildcardFilter implements ItemFilter {
  readonly name = 'wildcard';
  /** Creates a wildcard filter. */
  constructor(private readonly patterns: readonly string[]) {}
  /** Checks URL, name and text content. */
  apply(item: ScrapedItem): FilterResult {
    const passed = matchesAnyWildcard(searchableText(item), this.patterns);
    return passed
      ? { passed }
      : { passed, reason: `no wildcard in [${this.patterns.join(', ')}] matched` };
  }
}

/** Matches an item's name using wildcard or regular-expression syntax. */
export class NamePatternFilter implements ItemFilter {
  readonly name = 'namePattern';
  /** Creates a name pattern filter. */
  constructor(private readonly pattern: string) {}
  /** Checks the item's name. */
  apply(item: ScrapedItem): FilterResult {
    const value = item.name ?? '';
    const passed =
      matchesAnyWildcard(value, [this.pattern]) || matchesAnyRegex(value, [this.pattern]);
    return passed
      ? { passed }
      : { passed, reason: `name "${value}" did not match "${this.pattern}"` };
  }
}

/** Matches an item's URL using wildcard or regular-expression syntax. */
export class UrlPatternFilter implements ItemFilter {
  readonly name = 'urlPattern';
  /** Creates a URL pattern filter. */
  constructor(private readonly pattern: string) {}
  /** Checks the item's URL. */
  apply(item: ScrapedItem): FilterResult {
    const value = item.url ?? '';
    const passed =
      matchesAnyWildcard(value, [this.pattern]) || matchesAnyRegex(value, [this.pattern]);
    return passed
      ? { passed }
      : { passed, reason: `url "${value}" did not match "${this.pattern}"` };
  }
}
