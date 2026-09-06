# CLI reference

Global: `scraper --version` / `scraper -V` prints the version (same as
`scraper version`). `scraper --help` / `scraper <command> --help` prints
usage for any command.

## `scraper scrape <target>`

`<target>` is either a URL (`https://...`) or a path to a task **or tree**
config file (tree files are auto-detected and delegated to the tree
runner). Flags below only apply when scraping a single task; a delegated
tree run uses the tree file's own config.

**Output**

| Flag                       | Config field            |
| -------------------------- | ----------------------- |
| `-o, --output <dir>`       | `output.directory`      |
| `--filename <name>`        | `output.filename`       |
| `--prefix <prefix>`        | `output.prefix`         |
| `--suffix <suffix>`        | `output.suffix`         |
| `--start-index <n>`        | `output.startIndex`     |
| `--number-padding <n>`     | `output.numberPadding`  |
| `--numbering <style>`      | `output.numberingStyle` |
| `--on-conflict <strategy>` | `output.onConflict`     |
| `--concurrency <n>`        | `output.concurrency`    |
| `--dry-run`                | `output.dryRun`         |

**Browser**

| Flag                                 | Config field               |
| ------------------------------------ | -------------------------- |
| `--engine <mode>`                    | `browser.engine`           |
| `--no-headless`                      | `browser.headless = false` |
| `--timeout <ms>`                     | `browser.timeout`          |
| `--wait-for <selector>`              | `browser.waitForSelector`  |
| `--wait-timeout <ms>`                | `browser.waitForTimeoutMs` |
| `--user-agent <ua>`                  | `browser.userAgent`        |
| `--header <k:v>` (repeatable)        | `browser.headers`          |
| `--cookie <name=value>` (repeatable) | `browser.cookies`          |
| `--proxy <server>`                   | `browser.proxy.server`     |

**Single-target shortcut** (for scraping without a config file at all)

| Flag                   | Notes                                                                            |
| ---------------------- | -------------------------------------------------------------------------------- |
| `--type <scraperType>` | Builds one `targets[]` entry — required to scrape anything without a config file |
| `--selector <css>`     |                                                                                  |
| `--xpath <expr>`       |                                                                                  |
| `--attribute <name>`   |                                                                                  |

**Filters**

| Flag                                        | Config field                                |
| ------------------------------------------- | ------------------------------------------- |
| `--include <pattern>` (repeatable)          | `filters.include`                           |
| `--exclude <pattern>` (repeatable)          | `filters.exclude`                           |
| `--regex <pattern>` (repeatable)            | `filters.regex`                             |
| `--wildcard <pattern>` (repeatable)         | `filters.wildcard`                          |
| `--ext <extension>` (repeatable)            | `filters.extensions`                        |
| `--mime <type>` (repeatable)                | `filters.mimeTypes`                         |
| `--min-size <bytes>` / `--max-size <bytes>` | `filters.minSize` / `filters.maxSize`       |
| `--domain <domain>` (repeatable)            | `filters.domains`                           |
| `--subdomain <domain>` (repeatable)         | `filters.subdomains`                        |
| `--max-depth <n>`                           | `filters.maxDepth`                          |
| `--max-results <n>` / `--min-results <n>`   | `filters.maxResults` / `filters.minResults` |

**Other**

| Flag                    | Notes                                       |
| ----------------------- | ------------------------------------------- |
| `--name <name>`         | Task name                                   |
| `--log-level <level>`   | `silent\|error\|warn\|info\|debug\|verbose` |
| `--verbose` / `--debug` | Shortcuts for `--log-level verbose`/`debug` |
| `--quiet`               | Suppress the progress bar                   |

**Examples**

```bash
# No config file at all:
scraper scrape https://example.com --type image --selector img \
  --ext jpg --ext png --max-results 100 --output ./downloads

# Config file, with a couple of ad-hoc overrides:
scraper scrape task.yaml --dry-run --max-results 5

# Behind a proxy, with a custom UA and a cookie banner to dismiss:
scraper scrape https://example.com --type link --selector a \
  --proxy http://127.0.0.1:8080 --user-agent "Mozilla/5.0 ..." \
  --engine dynamic
```

## `scraper tree <config>`

Runs every leaf task resolved from a `tree:` config, sequentially, printing
a per-task and total summary. Flags: `--log-level`, `--verbose`, `--debug`,
`--quiet` (same meaning as above).

## `scraper validate <config>`

Validates a task **or** tree config against the schema and prints either
the resolved task summary or the list of tasks a tree resolves into
(including which directory each will write to) — without scraping
anything. Exits non-zero on invalid config.

## `scraper config <config>`

Prints the fully resolved task config (file content merged with every
default) as JSON — useful for confirming what a config actually evaluates
to before running it.

## `scraper doctor`

Checks: Node.js version, write access to the current directory, whether
Playwright's Chromium binary is installed, OS temp directory. Exits
non-zero if any check fails (the static engine still works regardless of
the Chromium check).

## `scraper init [path]`

Writes a starter YAML config (default: `scraper.config.yaml`). `--force`
overwrites an existing file.

## `scraper version`

Prints `<name> v<version>`.
