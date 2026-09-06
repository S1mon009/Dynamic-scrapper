/**
 * Resolves an HTTP(S) URL against a base URL.
 *
 * @param maybeRelative - Absolute or relative URL candidate.
 * @param baseUrl - URL used to resolve relative references.
 * @returns The resolved URL, or null for unsupported or invalid values.
 */
export function resolveUrl(
  maybeRelative: string | null | undefined,
  baseUrl: string,
): string | null {
  if (!maybeRelative) return null;
  const trimmed = maybeRelative.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  try {
    const resolved = new URL(trimmed, baseUrl);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return null;
    return resolved.toString();
  } catch {
    return null;
  }
}

/**
 * Returns the registrable-looking root domain from a hostname.
 *
 * @param hostname - Hostname to reduce.
 * @returns The final two hostname labels, or the full hostname when shorter.
 */
export function getRootDomain(hostname: string): string {
  const parts = hostname.split('.').filter(Boolean);
  if (parts.length <= 2) return hostname.toLowerCase();
  return parts.slice(-2).join('.').toLowerCase();
}

/**
 * Extracts a normalized hostname or returns null for invalid URLs.
 *
 * @param url - URL to inspect.
 * @returns Lowercase hostname, or null when parsing fails.
 */
export function getHostname(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Checks whether a URL belongs to a domain or one of its subdomains.
 *
 * @param url - URL to inspect.
 * @param domain - Allowed domain, optionally prefixed with `*.`.
 * @returns Whether the URL belongs to the domain.
 */
export function matchesDomain(url: string, domain: string): boolean {
  const host = getHostname(url);
  if (!host) return false;
  const target = domain.toLowerCase().replace(/^\*\./, '');
  return host === target || host.endsWith(`.${target}`);
}

/**
 * Checks whether a URL belongs to a strict subdomain of a root domain.
 *
 * @param url - URL to inspect.
 * @param rootDomain - Root domain that must not equal the URL hostname.
 * @returns Whether the URL is a strict subdomain.
 */
export function isSubdomainOf(url: string, rootDomain: string): boolean {
  const host = getHostname(url);
  if (!host) return false;
  const target = rootDomain.toLowerCase();
  return host !== target && host.endsWith(`.${target}`);
}

/**
 * Extracts a lowercase file extension from a URL path.
 *
 * @param url - URL to inspect.
 * @returns Extension without a leading dot, or undefined when absent.
 */
export function getUrlExtension(url: string): string | undefined {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split('/').pop() ?? '';
    const dot = last.lastIndexOf('.');
    if (dot === -1 || dot === last.length - 1) return undefined;
    return last.slice(dot + 1).toLowerCase();
  } catch {
    return undefined;
  }
}

/**
 * Extracts a decoded base name from a URL path without its extension.
 *
 * @param url - URL to inspect.
 * @returns Decoded base name, or undefined when absent or invalid.
 */
export function getUrlBaseName(url: string): string | undefined {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split('/').filter(Boolean).pop();
    if (!last) return undefined;
    const dot = last.lastIndexOf('.');
    const decoded = decodeURIComponent(dot === -1 ? last : last.slice(0, dot));
    return decoded || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Checks whether a value has the shape of a relative or absolute URL.
 *
 * @param value - Value to inspect.
 * @returns Whether the value resembles a URL reference.
 */
export function looksLikeUrlValue(value: string): boolean {
  return (
    /^(https?:)?\/\//i.test(value) ||
    value.startsWith('/') ||
    value.startsWith('./') ||
    value.startsWith('../')
  );
}

/**
 * Removes the URL fragment for crawl deduplication.
 *
 * @param url - URL to canonicalize.
 * @returns URL without its fragment, or the original value when invalid.
 */
export function canonicalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.toString();
  } catch {
    return url;
  }
}
