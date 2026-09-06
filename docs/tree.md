# Tree mode

A tree config runs many tasks from one file, each able to inherit —
and selectively override — settings from its parent.

```yaml
tree:
  output:
    directory: ./downloads
  browser:
    engine: static
  folder: Anime
  children:
    - name: Bleach
      url: https://example.com/bleach
      output:
        directory: ./downloads/anime
      filters:
        include: ['*.jpg']
    - name: Naruto
      url: https://example.com/naruto
```

Run it with `scraper tree tree.yaml`, or `scraper scrape tree.yaml` (which
auto-detects the `tree:` key and delegates).

## How inheritance works

Every node (the root, and each entry in `children`) can set any task field
— `output`, `browser`, `filters`, `targets`, `logging`, etc. A child
inherits everything its parent resolved to, then its own fields are
deep-merged on top: objects merge key by key, arrays replace wholesale, and
a field the child doesn't mention at all is left exactly as the parent had
it. This is recursive — a grandchild inherits its parent's _already merged_
result, which inherited from _its_ parent, and so on.

In the example above, **Bleach** sets its own `output.directory` and
`filters.include`, so those are exactly what it gets. **Naruto** sets
neither, so it inherits `browser.engine: static` from the root, and its
`output.directory` — see `folder`, next.

## `folder`

A node's `folder` doesn't change _that node's own_ output directory — it
changes what children who _don't set their own_ `output.directory` inherit:
they get `{this node's resolved directory}/{folder}` instead of the bare
inherited directory. In the example, Naruto (no `output` of its own)
resolves to `./downloads/Anime`, because the root has `folder: Anime` and
Naruto didn't override it. Bleach's explicit `./downloads/anime` simply
wins over that, same as any other field-level override.

`folder` is optional — omit it and children with no `output` of their own
just inherit the parent's `output.directory` verbatim, with no nesting.

## Execution

Tasks run **sequentially**, not in parallel — each task still downloads
its own items concurrently (`output.concurrency`), but running whole tasks
in parallel would multiply browser instances and outbound requests against
the same sites for no clear benefit. A task with no `url` anywhere in its
inheritance chain is skipped with a warning rather than failing the whole
tree.

## Crawling & `maxDepth`

`filters.maxDepth` set anywhere up a node's inheritance chain controls how
many link-hops _that leaf task's own crawl_ follows from its `url` (default
`0`: just that one page) — it does not cause the tree itself to visit other
_tree nodes_; tree nodes are already an explicit list you wrote. Crawling
within a single task is capped at 500 pages regardless of `maxDepth`, and
by default only follows links on the same domain as that task's own `url`
(override with `filters.domains`).

## Validating a tree before running it

```bash
scraper validate tree.yaml
```

prints exactly which leaf tasks the tree resolves into and where each will
write, without scraping anything — the fastest way to check inheritance did
what you expected before it makes real requests.
