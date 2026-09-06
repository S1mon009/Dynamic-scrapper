# Filters reference

Filters can be set at the task level (apply to every target) and/or per
target (`targets[].filters`); the two deep-merge, with the target's own
values winning field by field (not replacing the whole `filters` block).
Within one item, every configured filter must pass — it's AND, not OR.

| Filter                | Type               | Matches against                                                                                         |
| --------------------- | ------------------ | ------------------------------------------------------------------------------------------------------- |
| `include`             | string[]           | Substring match (case-insensitive) on URL, name, or text — passes if _any_ pattern matches              |
| `exclude`             | string[]           | Same, but the item is rejected if _any_ pattern matches                                                 |
| `regex`               | string[]           | Regex (bare pattern, or `/pattern/flags`) on URL, name, or text                                         |
| `wildcard`            | string[]           | Shell-style glob (`*`, `?`) on URL, name, or text — `*` matches across `/` too                          |
| `extensions`          | string[]           | File extension, with or without a leading dot (`jpg`, `.png`)                                           |
| `mimeTypes`           | string[]           | MIME type, exact or `type/*` wildcard; derived from the extension if not otherwise known                |
| `minSize` / `maxSize` | number (bytes)     | Resource size — only enforced once known; see note below                                                |
| `domains`             | string[]           | Item's (or its source page's) hostname — matches the domain or any subdomain                            |
| `subdomains`          | string[]           | Like `domains`, but _excludes_ the bare root domain — subdomains only                                   |
| `maxDepth`            | number             | Crawl depth of the source page. **Also controls the crawler itself** — see [tree.md](tree.md#crawling-) |
| `maxResults`          | number             | Stop accepting items for this target once this many have passed                                         |
| `minResults`          | number             | Not enforced live — recorded as a warning if the target ends under this count                           |
| `attributes`          | map (name → value) | Exact string, wildcard, or `/regex/` per named HTML attribute — every configured attribute must match   |
| `cssClasses`          | string[]           | Passes if the item has _any_ of the listed classes                                                      |
| `namePattern`         | string             | Wildcard or regex against `item.name` only                                                              |
| `urlPattern`          | string             | Wildcard or regex against `item.url` only                                                               |
| `custom`              | string[]           | Names of predicates from `customFiltersPath` — see below                                                |

**Size filtering costs a request.** `minSize`/`maxSize` need to know a
resource's size before deciding, which the scraper doesn't know until it's
fetched. When either is configured, the orchestrator issues a `HEAD`
request per binary item first — this adds latency and only applies to
`image`/`file` items with a URL.

## Combining filters

```yaml
filters:
  extensions: [jpg, jpeg, png]
  minSize: 20000 # 20KB
  domains: [example.com]
  namePattern: '*hero*'
  maxResults: 100
```

An item must satisfy every one of these to be downloaded.

## Custom filters

Config is data (YAML/JSON), so a "custom filter" is a name that resolves to
a real predicate function loaded from a JS module:

```js
// filters.mjs
export function onlyLandscape(item) {
  // item: ScrapedItem — see src/core/types.ts
  return !item.name?.toLowerCase().includes('portrait');
}
```

```yaml
customFiltersPath: ./filters.mjs
filters:
  custom: [onlyLandscape]
```

`customFiltersPath` is resolved relative to the config file's directory (or
the current directory, for a bare-URL `scrape` call). Every exported
function in the module is registered by its export name; async functions
are supported.

## Depth vs. crawling

`maxDepth` at the **task level** is what actually controls how many
link-hops the crawler follows (default `0`: only the start URL). A
`maxDepth` set on an individual **target**'s filters can only further
_restrict_ which already-visited pages' items are kept — it can't make the
crawler go deeper than the task-level setting. See
[tree.md](tree.md#crawling-) for why, and for the crawler's other
safety limits (page cap, same-domain-by-default link following).
