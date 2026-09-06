# dynamic-scraper

**A dependable, scriptable CLI for extracting structured content and files from modern websites.**

`dynamic-scraper` handles both ordinary HTML pages and JavaScript-rendered applications. Choose the static HTTP engine, launch a real Chromium browser, or let the tool detect when a static response is only an empty application shell. Define extraction targets declaratively, compose precise filters, and write predictable output files without maintaining a one-off script for every website.

```bash
scraper scrape https://example.com \
  --type image \
  --selector "img" \
  --output ./downloads
```

The project is intentionally a CLI. It is designed for shell pipelines, scheduled jobs, CI workflows, Docker containers, and applications that need a typed TypeScript API rather than a GUI.

## Contents

- [Why dynamic-scraper](#why-dynamic-scraper)
- [Capabilities](#capabilities)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Extraction model](#extraction-model)
- [Configuration](#configuration)
- [Filtering](#filtering)
- [Tree mode](#tree-mode)
- [Commands](#commands)
- [Rendering engines](#rendering-engines)
- [Docker](#docker)
- [TypeScript API](#typescript-api)
- [Development](#development)
- [Documentation](#documentation)
- [License](#license)

## Why dynamic-scraper

Many scraping tasks are neither a full web crawl nor a throwaway script. They are focused jobs such as:

- download every image from a gallery;
- collect links or files from a set of pages;
- export headings, text, attributes, or tables;
- interact with a JavaScript page before extracting its content;
- run the same extraction across several sites or sections;
- repeat the job safely without overwriting existing files.

`dynamic-scraper` keeps those jobs in configuration and gives them the operational details that ad-hoc scripts usually lack: validation, bounded concurrency, conflict policies, progress reporting, structured results, and deterministic task composition.

## Capabilities

- **Static and dynamic pages**: HTTP plus jsdom for fast pages, Playwright and Chromium for rendered applications, or automatic fallback between them.
- **Nine extraction strategies**: `image`, `link`, `file`, `text`, `heading`, `table`, `attribute`, `css`, and `xpath`.
- **CSS and XPath selection**: every target can use either a CSS selector or an XPath expression.
- **Composable filters**: text, regex, wildcard, URL, domain, depth, extension, MIME type, size, attributes, CSS classes, result counts, and custom predicates.
- **Browser actions**: click, scroll, wait, type, and press actions for cookie banners, search forms, lazy loading, and interactive pages.
- **Predictable file output**: numbering, prefixes, suffixes, sanitization, automatic directory creation, dry runs, and configurable conflict handling.
- **Tree execution**: define shared defaults once and override them at any level of a task hierarchy.
- **YAML and JSON**: use readable configuration files while retaining CLI overrides for one-off changes.
- **Typed extension points**: register custom scrapers and custom filters through the TypeScript API.
- **Operational visibility**: progress bars, task summaries, warnings, errors, and configurable log levels.

## Installation

Requires **Node.js 18.18 or newer**.

```bash
npm install -g dynamic-scraper
scraper --help
```

The static engine requires no browser installation. To use the dynamic engine or `engine: auto` on JavaScript-rendered pages, install Chromium once:

```bash
npx playwright install --with-deps chromium
```

For local development, install the repository dependencies instead:

```bash
npm install
```

## Quick start

### Scrape without a configuration file

```bash
scraper scrape https://example.com/gallery \
  --type image \
  --selector ".gallery img" \
  --ext jpg \
  --ext png \
  --max-results 100 \
  --output ./downloads
```

### Create and validate a configuration

```bash
scraper init scraper.config.yaml
scraper validate scraper.config.yaml
scraper config scraper.config.yaml
scraper scrape scraper.config.yaml
```

`config` prints the fully resolved configuration, including defaults. This is useful for reviewing what will actually run before making requests.

### Use a JavaScript-rendered page

```bash
scraper scrape https://example.com/app \
  --engine dynamic \
  --type text \
  --selector "main" \
  --wait-for ".results" \
  --output ./downloads
```

### Preview output without writing files

```bash
scraper scrape scraper.config.yaml --dry-run
```

## Extraction model

A task follows one consistent pipeline:

```text
configuration
    -> page engine
    -> scraper targets
    -> filter chain
    -> download manager
    -> naming and conflict resolution
    -> files and task summary
```

Each target has a `type` that defines what is extracted and a `selector` or `xpath` that defines where it is extracted from.

| Type        | Extracts                                                   | Typical output                           |
| ----------- | ---------------------------------------------------------- | ---------------------------------------- |
| `image`     | Image URLs from image elements and supported embedded data | Binary image file                        |
| `link`      | Resolved links from elements, usually `href`               | URL text or downloaded resource metadata |
| `file`      | Downloadable file URLs                                     | Binary file                              |
| `text`      | Trimmed text content                                       | `.txt`                                   |
| `heading`   | Trimmed heading content                                    | `.txt`                                   |
| `table`     | Table rows and cells                                       | `.csv`                                   |
| `attribute` | A named HTML attribute                                     | `.txt`                                   |
| `css`       | Selected elements without special URL semantics            | `.html` or text content                  |
| `xpath`     | XPath-selected elements without special URL semantics      | `.html` or text content                  |

Example target configuration:

```yaml
targets:
  - type: image
    selector: '.gallery img'
    attribute: data-src
    name: gallery-images
    filters:
      extensions: [jpg, jpeg, png, webp]
      minSize: 10000

  - type: table
    selector: 'table.results'
    name: results

  - type: heading
    xpath: '//main//h2'
```

## Configuration

Configuration can be written in YAML or JSON. CLI flags are deep-merged on top of file configuration, so a one-off override does not require duplicating the whole task.

```yaml
name: product-images
url: https://example.com/products

output:
  directory: ./downloads/products
  onConflict: rename
  numberingStyle: sequential
  numberPadding: 3
  concurrency: 5

browser:
  engine: auto
  timeout: 30000
  waitForSelector: '.product-grid'

targets:
  - type: image
    selector: '.product-card img'
    attribute: data-src
    filters:
      extensions: [jpg, png, webp]
      maxResults: 200

logging:
  level: info
```

Important defaults:

| Setting                 | Default       |
| ----------------------- | ------------- |
| `output.directory`      | `./downloads` |
| `output.startIndex`     | `1`           |
| `output.numberingStyle` | `sequential`  |
| `output.onConflict`     | `rename`      |
| `output.concurrency`    | `5`           |
| `output.dryRun`         | `false`       |
| `browser.engine`        | `auto`        |
| `browser.headless`      | `true`        |
| `browser.timeout`       | `30000` ms    |
| `logging.level`         | `info`        |

For the complete schema, browser actions, output naming rules, and target semantics, see the [configuration reference](docs/configuration.md).

## Filtering

Filters can be declared at task level and target level. Target filters are deep-merged over task filters, allowing shared defaults with local exceptions.

```yaml
filters:
  domains: [example.com]
  maxDepth: 2
  exclude: ['placeholder', 'tracking']

targets:
  - type: file
    selector: 'a.download'
    filters:
      extensions: [pdf, zip]
      maxSize: 50000000
      maxResults: 25
```

Available filter categories include:

- `include`, `exclude`, `regex`, and `wildcard` for URL, name, and text matching;
- `extensions`, `mimeTypes`, `minSize`, and `maxSize` for resources;
- `domains`, `subdomains`, and `maxDepth` for crawl scope;
- `attributes`, `cssClasses`, `namePattern`, and `urlPattern` for item metadata;
- `minResults` and `maxResults` for task-level result guarantees;
- `custom` for predicates exported by a user module.

See the [filters reference](docs/filters.md) for matching rules and custom filter examples.

## Tree mode

Tree mode is useful when several tasks share browser, output, or filter settings. Parent values are inherited and child values override them.

```yaml
tree:
  name: catalog
  url: https://example.com/catalog
  output:
    directory: ./downloads/catalog
  browser:
    engine: auto
  children:
    - folder: electronics
      targets:
        - type: image
          selector: '.electronics img'
    - folder: books
      targets:
        - type: image
          selector: '.books img'
```

Run a tree explicitly or let `scrape` detect a file with a top-level `tree` key:

```bash
scraper tree tree.yaml
scraper scrape tree.yaml
```

See the [tree mode guide](docs/tree.md) for inheritance behavior and examples.

## Commands

| Command                      | Purpose                                                           |
| ---------------------------- | ----------------------------------------------------------------- |
| `scraper scrape <url\|file>` | Run a URL, task config, or detected tree config                   |
| `scraper tree <file>`        | Run every leaf task in a tree sequentially                        |
| `scraper validate <file>`    | Validate a task or tree without scraping                          |
| `scraper config <file>`      | Print the fully resolved task configuration                       |
| `scraper doctor`             | Check Node.js, Chromium, filesystem, and temp directory readiness |
| `scraper init [path]`        | Create a starter YAML configuration                               |
| `scraper version`            | Print the installed version                                       |

Use built-in help for the current flag set:

```bash
scraper --help
scraper scrape --help
```

The full flag reference is available in [docs/cli.md](docs/cli.md).

## Rendering engines

### Static

The static engine performs an HTTP request and parses the response with jsdom. It is fast, lightweight, and appropriate for pages whose content is present in the initial HTML.

### Dynamic

The dynamic engine uses Playwright and Chromium. It supports browser actions, cookies, custom headers, proxies, waiting, and rendered DOM extraction.

### Auto

The auto mode tries the static engine first. When the response looks like a JavaScript application shell with too little visible text, it retries with the dynamic engine. Use an explicit engine when the site behavior is known or when deterministic execution matters more than convenience.

## Docker

Build the lightweight image for static scraping:

```bash
docker build --target runtime-slim -t dynamic-scraper .
docker run --rm \
  -v "$PWD/downloads:/app/downloads" \
  dynamic-scraper \
  scrape https://example.com --type image --selector img
```

Build the full image when Chromium is required:

```bash
docker build --target runtime-full -t dynamic-scraper:full .
```

The repository also contains a Docker Compose setup in [docker/docker-compose.yml](docker/docker-compose.yml).

## TypeScript API

The package exposes reusable types and services from `src/index.ts`, including:

- configuration schemas and loaders;
- `ScrapeOrchestrator` and task result types;
- page engines and `PageSource` abstractions;
- scraper interfaces and `ScraperRegistry`;
- filter contracts, implementations, and factories;
- download, storage, tree, logger, and error services.

Build the package and inspect the generated declarations with:

```bash
npm run build
npm run docs
```

The generated API reference is written to `docs/api`.

## Development

```bash
npm install
npm run dev -- scrape https://example.com --type link --selector "a"
npm run typecheck
npm test
npm run test:coverage
npm run build
npm run docs
```

Useful test scopes:

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
```

The architecture, dependency boundaries, request flow, and testing strategy are described in [docs/architecture.md](docs/architecture.md). Contributions should follow the conventions in [CONTRIBUTING.md](CONTRIBUTING.md).

## Documentation

- [Architecture](docs/architecture.md)
- [CLI reference](docs/cli.md)
- [Configuration reference](docs/configuration.md)
- [Filters](docs/filters.md)
- [Tree mode](docs/tree.md)
- [Generated API reference](docs/api/index.html)
- [Releasing](docs/releasing.md)
- [Publishing](docs/publishing.md)

Additional complete examples are available in [examples/](examples/):

- [basic-config.yaml](examples/basic-config.yaml)
- [basic-config.json](examples/basic-config.json)
- [tree-example.yaml](examples/tree-example.yaml)
- [tree-example.json](examples/tree-example.json)

## License

MIT. See [LICENSE](LICENSE).
