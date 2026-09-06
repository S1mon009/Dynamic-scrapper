import type { FilterConfig } from '../config/schema.js';
import type { ItemFilter } from '../core/types.js';
import { AttributeFilter, CssClassFilter } from './attribute-filters.js';
import type { CustomFilterRegistry } from './custom-filter.js';
import { FilterChain } from './filter-chain.js';
import { ExtensionFilter, MimeTypeFilter, SizeFilter } from './resource-filters.js';
import { DepthFilter, DomainFilter, SubdomainFilter } from './scope-filters.js';
import {
  ExcludeFilter,
  IncludeFilter,
  NamePatternFilter,
  RegexFilter,
  UrlPatternFilter,
  WildcardFilter,
} from './string-filters.js';

/**
 * Builds concrete filters from the declarative filter configuration.
 *
 * @param config - Filter configuration to translate.
 * @param customRegistry - Optional registry for custom filter names.
 * @returns Filters in the order in which they should be applied.
 * @throws Error when custom filters are configured without a registry.
 */
export function buildItemFilters(
  config: FilterConfig,
  customRegistry?: CustomFilterRegistry,
): ItemFilter[] {
  const filters: ItemFilter[] = [];

  if (config.domains?.length) filters.push(new DomainFilter(config.domains));
  if (config.subdomains?.length) filters.push(new SubdomainFilter(config.subdomains));
  if (config.maxDepth !== undefined) filters.push(new DepthFilter(config.maxDepth));
  if (config.extensions?.length) filters.push(new ExtensionFilter(config.extensions));
  if (config.mimeTypes?.length) filters.push(new MimeTypeFilter(config.mimeTypes));
  if (config.minSize !== undefined || config.maxSize !== undefined) {
    filters.push(new SizeFilter(config.minSize, config.maxSize));
  }
  if (config.cssClasses?.length) filters.push(new CssClassFilter(config.cssClasses));
  if (config.attributes && Object.keys(config.attributes).length > 0) {
    filters.push(new AttributeFilter(config.attributes));
  }
  if (config.namePattern) filters.push(new NamePatternFilter(config.namePattern));
  if (config.urlPattern) filters.push(new UrlPatternFilter(config.urlPattern));
  if (config.include?.length) filters.push(new IncludeFilter(config.include));
  if (config.exclude?.length) filters.push(new ExcludeFilter(config.exclude));
  if (config.wildcard?.length) filters.push(new WildcardFilter(config.wildcard));
  if (config.regex?.length) filters.push(new RegexFilter(config.regex));
  if (config.custom?.length) {
    if (!customRegistry) {
      throw new Error(
        `Config references custom filters [${config.custom.join(', ')}] but no customFiltersPath was resolved`,
      );
    }
    filters.push(...customRegistry.resolve(config.custom));
  }

  return filters;
}

/**
 * Builds an ordered filter chain from the declarative configuration.
 *
 * @param config - Filter configuration to translate.
 * @param customRegistry - Optional registry for custom filter names.
 * @returns Configured filter chain.
 * @throws Error when custom filters are configured without a registry.
 */
export function buildFilterChain(
  config: FilterConfig,
  customRegistry?: CustomFilterRegistry,
): FilterChain {
  return new FilterChain(buildItemFilters(config, customRegistry), {
    maxResults: config.maxResults,
    minResults: config.minResults,
  });
}
