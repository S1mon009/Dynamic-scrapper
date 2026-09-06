# Configuration reference

A task config is YAML or JSON, auto-detected by extension (`.yaml`/`.yml`/`.json`;
an unrecognized extension is sniffed as JSON first, then YAML). CLI flags
passed to `scraper scrape` deep-merge **on top of** the file — the file sets
the baseline, flags override specific fields without needing to repeat the
whole file as flags.

## Top-level fields

| Field               | Type         | Default | Notes                                                                               |
| ------------------- | ------------ | ------- | ----------------------------------------------------------------------------------- |
| `name`              | string       | —       | Shown in logs; used as a fallback for `output.filename`                             |
| `url`               | string (URL) | —       | Required to actually run (not required to `validate`)                               |
| `output`            | see below    | `{}`    | File naming, numbering, conflict handling                                           |
| `browser`           | see below    | `{}`    | Engine choice, headers, cookies, proxy, actions                                     |
| `filters`           | see below    | —       | Task-level filters, deep-merged with each target's own                              |
| `customFiltersPath` | string       | —       | Path (relative to the config file) to a JS module exporting named filter predicates |
| `targets`           | array        | —       | What to scrape — see [Targets](#targets)                                            |
| `logging.level`     | enum         | `info`  | `silent \| error \| warn \| info \| debug \| verbose`                               |

## `output`

| Field               | Type    | Default       | Notes                                                                                                                   |
| ------------------- | ------- | ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `directory`         | string  | `./downloads` | Created automatically if missing                                                                                        |
| `filename`          | string  | —             | Shared base name for every item (disambiguated by numbering). Omit to derive a name per item (alt text, link text, URL) |
| `prefix` / `suffix` | string  | —             | Concatenated directly — include your own separator if you want one                                                      |
| `startIndex`        | number  | `1`           | First number used for `sequential` numbering                                                                            |
| `numberPadding`     | number  | `0`           | Zero-pad numbers to this width (`3` → `007`)                                                                            |
| `numberingStyle`    | enum    | `sequential`  | `sequential \| timestamp \| uuid \| none`                                                                               |
| `onConflict`        | enum    | `rename`      | `overwrite \| skip \| rename \| fail` — see below                                                                       |
| `concurrency`       | number  | `5`           | Parallel downloads within one task (1-64)                                                                               |
| `dryRun`            | boolean | `false`       | Report what would be saved without writing anything                                                                     |

`onConflict` semantics: `overwrite` replaces the existing file; `skip`
leaves it and reports the item as skipped; `rename` appends ` (1)`, ` (2)`,
... until a free name is found; `fail` throws immediately.

## `browser`

| Field               | Type                                     | Default     | Notes                                                      |
| ------------------- | ---------------------------------------- | ----------- | ---------------------------------------------------------- |
| `engine`            | enum                                     | `auto`      | `static` (fetch+jsdom) \| `dynamic` (Playwright) \| `auto` |
| `headless`          | boolean                                  | `true`      | Dynamic engine only                                        |
| `timeout`           | number (ms)                              | `30000`     | Navigation + selector wait timeout                         |
| `navigationTimeout` | number (ms)                              | = `timeout` | Override just the navigation timeout                       |
| `waitForSelector`   | string                                   | —           | Wait for this CSS selector before scraping                 |
| `waitForTimeoutMs`  | number                                   | —           | Extra fixed wait after load/selector (use sparingly)       |
| `userAgent`         | string                                   | —           | Sent on every request                                      |
| `headers`           | map                                      | —           | Extra HTTP headers                                         |
| `cookies`           | array of `{name, value, domain?, path?}` | —           | Sent on every request                                      |
| `proxy`             | `{server, username?, password?}`         | —           | e.g. `server: "http://127.0.0.1:8080"`                     |
| `viewport`          | `{width, height}`                        | —           | Dynamic engine only                                        |
| `actions`           | array                                    | —           | Run in order before scraping — see below                   |

`auto` fetches the page statically first; if the visible text left after
stripping `<script>`/`<style>`/tags is under ~200 characters, it's treated
as an unrendered SPA shell and retried with the dynamic engine. It's a
heuristic, not magic — set `engine` explicitly when you already know.

### `actions`

Run in order, once, before any target is scraped:

```yaml
browser:
  actions:
    - type: click
      selector: '#accept-cookies'
      optional: true # don't fail the task if the selector isn't found
    - type: scroll
      toBottom: true
    - type: wait
      selector: '.results-loaded'
    - type: type
      selector: '#search'
      text: 'wallpapers'
    - type: press
      key: Enter
```

## Targets

Each entry in `targets` scrapes one thing:

```yaml
targets:
  - type: image # image | link | file | text | heading | table | attribute | css | xpath
    selector: '.gallery img' # CSS — or use `xpath:` instead
    # xpath: "//div[@class='gallery']//img"
    attribute: data-src # which attribute to read (image/link/file/attribute types)
    name: gallery-photos # logical name, used in logs
    filters: {} # target-level filters — see filters.md
```

- `image`, `link`, `file` resolve a URL (from `src`/`href`/the attribute you
  name) to an absolute URL and download it.
- `text`, `heading` extract trimmed text content; not downloaded from a URL
  — saved as a `.txt` snapshot.
- `table` re-parses the matched element's HTML and saves it as CSV.
- `attribute` reads one named attribute's raw value (requires `attribute`).
- `css` / `xpath` are the generic, unopinionated forms — whatever matches,
  with no special URL/attribute resolution.

`selector` and `xpath` work on _any_ target type — `type` picks the
_extraction_ semantics, `selector`/`xpath` picks _which elements_.

## Filters

See [filters.md](filters.md) for the full list and examples. Filters can be
set at the task level (`filters:` alongside `output`/`browser`) and/or per
target (`targets[].filters`) — they deep-merge, with the target's own
values winning field-by-field.

## Tree configs

A file with a top-level `tree:` key instead of `url:`/`targets:` directly —
see [tree.md](tree.md). `scraper scrape` on such a file auto-detects it and
delegates to the tree runner; `scraper tree` is the explicit form.

## CLI overrides

Every `scraper scrape` flag maps to one config field (see
[cli.md](cli.md)) and deep-merges on top of the file the same way a tree
child overrides its parent: set fields replace the file's value, arrays
replace wholesale (a `--include` flag replaces the file's `filters.include`
list, it doesn't append to it), and anything you don't pass is left as the
file (or its defaults) had it.
