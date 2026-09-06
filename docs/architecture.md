# Architecture

## Module map

| Module   | Path            | Responsibility                                                                                     |
| -------- | --------------- | -------------------------------------------------------------------------------------------------- |
| CLI      | `src/cli/`      | Commander wiring, flag parsing, progress bar, colored output                                       |
| Config   | `src/config/`   | Zod schemas, YAML/JSON loading, CLI-override merging                                               |
| Tree     | `src/tree/`     | Flattens a tree config into leaf tasks with inheritance resolved                                   |
| Core     | `src/core/`     | Shared types, error classes, the scrape orchestrator (crawl loop)                                  |
| Engines  | `src/engines/`  | `StaticEngine` (fetch + jsdom) and `DynamicEngine` (Playwright), behind one `PageSource` interface |
| Scrapers | `src/scrapers/` | One strategy per scrape type, registered in `ScraperRegistry`                                      |
| Filters  | `src/filters/`  | One class per filter category, composed into a `FilterChain`                                       |
| Download | `src/download/` | HTTP client (headers/UA/cookies/proxy) + concurrent download manager                               |
| Storage  | `src/storage/`  | File naming, conflict resolution, the actual `fs.writeFile`                                        |
| Logger   | `src/logger/`   | Leveled, colorized logging with child loggers per task                                             |

## Design principles

**Dependency inversion at the engine boundary.** Every scraper depends on
the `PageSource` interface (`querySelectorAll`, `xpathAll`, `getFullHtml`),
never on `StaticEngine` or `DynamicEngine` directly. `EngineFactory` decides
which concrete engine to hand back — scrapers, filters, and storage never
know or care which one rendered the page.

**Single Responsibility, one file per concern.** A scraper only turns DOM
elements into `ScrapedItem`s. A filter only answers "does this item pass?".
`StorageManager` only decides _where and how_ something is written; it
never fetches anything. `DownloadManager` decides _what_ to fetch/write and
calls `StorageManager` to do it.

**Open for extension.** Two concrete extension points:

- **New scraper type**: implement `IScraper` (`src/scrapers/scraper.interface.ts`)
  and call `scraperRegistry.register(new MyScraper())`. Nothing else changes.
- **New filter**: implement `ItemFilter` (`{ name, apply(item) }`) and either
  add it to `filter-factory.ts`'s built-ins, or register it as a **custom
  filter** at runtime — see [filters.md](filters.md#custom-filters) — no
  core code changes required for the latter.

**Config validated once, at the right time.** Zod schemas apply defaults
(`output.directory` defaults to `./downloads`, etc.). For a plain task this
happens once, right after loading. For a **tree**, this is subtler: each
node is parsed _structurally_ (is `children` an array? is `folder` a
string?) without applying field defaults, and a leaf's defaults are only
resolved _after_ inheritance merging (`tree/tree-runner.ts`). Applying
defaults per-node during the tree walk would make an unset child field
indistinguishable from "explicitly set to the default", breaking
inheritance — this was a real bug caught during integration testing (see
the regression test in `test/unit/config/schema.test.ts`).

## Request flow (`scraper scrape <url>`)

1. **CLI** parses flags → `config/cli-args.ts` turns them into a partial,
   pre-validation config object.
2. **Config** deep-merges that over any file config, then validates once
   with `taskConfigSchema` (`config/loader.ts#resolveTaskConfig`).
3. **Orchestrator** (`core/scrape-orchestrator.ts`) BFS-crawls from
   `config.url`, bounded by `filters.maxDepth` (default `0` = start page
   only) and a hard 500-page safety cap, and skips non-HTML-looking links
   (images, archives, media, ...) when discovering further pages.
4. For each visited page: **EngineFactory** opens it (static, dynamic, or
   auto-detected), then for every `target`, the matching **Scraper**
   extracts `ScrapedItem[]`.
5. Each item runs through that target's **FilterChain** (task-level filters
   deep-merged with target-level filters, target wins on conflicts).
6. Items that pass are handed to **DownloadManager**, which fetches
   binaries (images/files) or serializes non-binary types (text/CSV) with
   bounded concurrency, and calls **StorageManager** to name, resolve
   conflicts for, and write each one.
7. The CLI prints a summary and exits non-zero if anything failed.

`scraper tree <file>` is the same pipeline, run once per leaf task produced
by flattening the tree — see [tree.md](tree.md).

## Testing strategy

- **Unit tests** exercise filters, naming/conflict logic, URL utilities,
  and tree flattening in isolation — no network, no browser.
- **Integration tests** (`test/integration/`) run the _real_ orchestrator
  (crawl → scrape → filter → download → save) against mocked HTTP
  responses, so the whole pipeline is exercised without hitting the
  network.
- Playwright itself isn't unit-tested against a live browser in CI (that's
  what Playwright's own test suite is for); `DynamicEngine` is exercised
  through the same `PageSource` contract `StaticPageSource` satisfies, and
  the contract itself is what's tested.
