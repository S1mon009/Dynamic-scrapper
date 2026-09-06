function escapeRegExpChar(char: string): string {
  return /[.+^${}()|[\]\\]/.test(char) ? `\\${char}` : char;
}

/**
 * Converts `*` and `?` wildcards into a case-insensitive regular expression.
 *
 * @param pattern - Wildcard pattern to compile.
 * @returns A regular expression matching the complete value.
 */
export function wildcardToRegExp(pattern: string): RegExp {
  let body = '';
  for (const char of pattern) {
    if (char === '*') body += '.*';
    else if (char === '?') body += '.';
    else body += escapeRegExpChar(char);
  }
  return new RegExp(`^${body}$`, 'i');
}

/**
 * Checks a value against one wildcard pattern.
 *
 * @param value - Value to test.
 * @param pattern - Wildcard pattern.
 * @returns Whether the value matches the pattern.
 */
export function matchesWildcard(value: string, pattern: string): boolean {
  return wildcardToRegExp(pattern).test(value);
}

/**
 * Checks a value against any wildcard pattern.
 *
 * @param value - Value to test.
 * @param patterns - Wildcard patterns to test.
 * @returns Whether at least one pattern matches.
 */
export function matchesAnyWildcard(value: string, patterns: readonly string[]): boolean {
  return patterns.some((p) => matchesWildcard(value, p));
}

/**
 * Compiles slash-delimited or plain regular-expression syntax.
 *
 * @param pattern - Regular-expression pattern.
 * @returns The compiled regular expression.
 * @throws SyntaxError when the pattern is invalid.
 */
export function compileRegex(pattern: string): RegExp {
  const literalMatch = /^\/(.+)\/([a-z]*)$/i.exec(pattern);
  if (literalMatch) {
    const [, body, flags] = literalMatch;
    return new RegExp(body ?? '', flags);
  }
  return new RegExp(pattern, 'i');
}

/**
 * Safely checks a value against one regular expression.
 *
 * @param value - Value to test.
 * @param pattern - Regular-expression pattern.
 * @returns Whether the pattern matches; invalid patterns return false.
 */
export function matchesRegex(value: string, pattern: string): boolean {
  try {
    return compileRegex(pattern).test(value);
  } catch {
    return false;
  }
}

/**
 * Safely checks a value against any regular-expression pattern.
 *
 * @param value - Value to test.
 * @param patterns - Regular-expression patterns to test.
 * @returns Whether at least one pattern matches.
 */
export function matchesAnyRegex(value: string, patterns: readonly string[]): boolean {
  return patterns.some((p) => matchesRegex(value, p));
}

/**
 * Performs a case-insensitive substring check.
 *
 * @param haystack - Text to search.
 * @param needle - Substring to find.
 * @returns Whether the substring occurs in the text.
 */
export function containsSubstring(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/**
 * Checks whether any substring occurs in a value.
 *
 * @param haystack - Text to search.
 * @param needles - Substrings to find.
 * @returns Whether at least one substring occurs.
 */
export function matchesAnySubstring(haystack: string, needles: readonly string[]): boolean {
  return needles.some((n) => containsSubstring(haystack, n));
}
