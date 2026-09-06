import type { FilterResult, ItemFilter, ScrapedItem } from '../core/types.js';
import { isSubdomainOf, matchesDomain } from '../utils/url.utils.js';

/** Accepts items whose URL belongs to one of the configured domains. */
export class DomainFilter implements ItemFilter {
  readonly name = 'domains';
  /** Creates a domain filter. */
  constructor(private readonly domains: readonly string[]) {}
  /** Checks the item URL or source page URL. */
  apply(item: ScrapedItem): FilterResult {
    const url = item.url ?? item.sourcePageUrl;
    const passed = this.domains.some((d) => matchesDomain(url, d));
    return passed ? { passed } : { passed, reason: `"${url}" does not match any allowed domain` };
  }
}

/** Accepts items hosted on configured subdomains. */
export class SubdomainFilter implements ItemFilter {
  readonly name = 'subdomains';
  /** Creates a subdomain filter from root domains. */
  constructor(private readonly rootDomains: readonly string[]) {}
  /** Checks the item URL or source page URL. */
  apply(item: ScrapedItem): FilterResult {
    const url = item.url ?? item.sourcePageUrl;
    const passed = this.rootDomains.some((d) => isSubdomainOf(url, d));
    return passed
      ? { passed }
      : { passed, reason: `"${url}" is not a subdomain of the allowed roots` };
  }
}

/** Restricts items to a maximum crawl depth. */
export class DepthFilter implements ItemFilter {
  readonly name = 'maxDepth';
  /** Creates a depth filter. */
  constructor(private readonly maxDepth: number) {}
  /** Checks the item's crawl depth. */
  apply(item: ScrapedItem): FilterResult {
    const passed = item.depth <= this.maxDepth;
    return passed
      ? { passed }
      : { passed, reason: `depth ${item.depth} exceeds maxDepth ${this.maxDepth}` };
  }
}
