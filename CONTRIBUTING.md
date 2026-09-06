# Contributing

```bash
git clone <repo>
cd dynamic-scraper
npm install          # also sets up Husky git hooks
npm run dev -- --help  # runs the CLI from source via tsx, no build needed
```

## Before opening a PR

```bash
npm run validate   # lint + typecheck + test
```

The pre-commit hook runs lint-staged (ESLint + Prettier) on changed files
automatically; the commit-msg hook enforces Conventional Commits.

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) —
`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, etc. This isn't
just style: `type` drives automatic versioning and changelog generation on
release (see [docs/releasing.md](docs/releasing.md)).

## Adding a scraper type

Implement `IScraper` (`src/scrapers/scraper.interface.ts`), add it to
`ScraperRegistry`'s constructor (`src/scrapers/registry.ts`), extend
`scraperTypeSchema` in `src/config/schema.ts`, and add tests under
`test/unit/scrapers/`. See existing scrapers for the pattern — most are
under 30 lines.

## Adding a filter

Implement `ItemFilter` (`{ name, apply(item) }`), wire it into
`buildItemFilters` (`src/filters/filter-factory.ts`) if it's a built-in, or
document it as a `customFiltersPath` pattern if it's situational — see
[docs/filters.md](docs/filters.md#custom-filters).

## Tests

- `npm run test:unit` — fast, no network/browser
- `npm run test:integration` — full orchestrator pipeline, mocked HTTP
- `npm run test:coverage` — same, with a coverage report in `coverage/`

New code should come with tests in the matching `test/unit/<module>/` or
`test/integration/` directory — see `docs/architecture.md#testing-strategy`
for what belongs where.
