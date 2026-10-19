# Local cache (beta)

The editor's in-memory state IS the project. There is no "save"
action. The local cache is an IndexedDB mirror of state, kept in
sync after every commit. The cache is **local to one browser** —
no server, no sync between devices. Export (`.neted.zip`) is the
portable artifact for sharing / backup.

A project is cached in the shape its file has: the network model
(the configuration and its observation, design and drawing layers)
with the products and scenes beside it. The same document is what
undo snapshots and what the zip writer packs.

## Schema (IndexedDB v7)

```
projects   keyPath: 'id'
  { id, name, settings?, formatVersion, createdAt, updatedAt }

documents  keyPath: 'projectId'
  { projectId, model: NetworkModel, products: Product[], scenes: Scene[] }

assets     keyPath: ['projectId', 'hash']  index: projectId
  { projectId, hash, ext, blob }
```

DB v1 (single-zip-blob row per project) is gone. DB v2–v6 kept one
row per graph entity in `nodes` / `subgraphs` / `links` / `products`
/ `scenes` / `terminations`. Those stores stay in the schema only to
move old projects: opening a project that has no document reads its
entity rows (v2–v5 rows are first brought to the v6 encoding by the
upgrade), builds the model from them with `fromNetworkGraph`, writes
the document and deletes the rows, in one transaction.

## Data flow

```
        UI
        │ edits the drawn graph
        ▼ commit() — writes the edits back into the model
  network model + products + scenes ──────► IndexedDB `documents`
        ▲                                        │
        │ loadProject                            │ exportProjectZip
        │ (draws the graph from the model)       ▼
        │                                  .neted.zip
   undo / redo ──► cache.touch() ──► IndexedDB
```

The model is the project's truth. The canvas and panels edit the
graph drawn from it (`diagram.nodes` …); each commit writes what
changed on that graph back into the model with `applyGraphEdits`
from `@shumoku/core`, so what the YAML says beyond the graph (a
node's software, the host a VM runs on, routing domains, a link's
description) survives editing. Each sync then writes the whole
document. Editor projects are small enough that one put per commit
costs less than keeping per-entity rows of a second shape in step.

Export drains pending sync, then reads the document back, so
"what's in the zip" == "what would I get on reload".

Image refs cross the storage boundary in serialized form. Data
going to IDB has its image fields rewritten from runtime `blob:`
URLs to `asset:<hash>.<ext>` (see `serializeEntity` /
`rehydrateEntity` in `state/assets.svelte.ts`). The reverse runs
after read so render code only sees blob URLs.

## Lifecycle

- `loadProject(id)` registers the project's assets, reads its
  document (moving entity rows into it first if needed), draws the
  graph from the model, runs layout for nodes without a position and
  the legacy load-time migrations, and writes the result back into
  the model.
- `commit` / `commitAsync` write the edits back and call
  `cache.touch()`; an edit session or a drag writes back when it ends.
- Successful Undo/Redo restores the model, products and scenes,
  draws the graph again and calls `cache.touch()`.
- `cache.touch()` kicks the single-flight sync loop. While a
  sync is running, further touches set `pending` so the running
  loop iterates once more after the current write commits.
- `visibilitychange → hidden` and `pagehide` call `cache.drain()`
  so the mirror is consistent before tab-away events.
- Project switch resets the AssetStore before loading the new one.

## Assets

Image blobs are content-addressed by the first 64 bits of the
SHA-256 of their bytes. Each asset is stored once per project
under `[projectId, hash]` so:

- the same image used in multiple scenes / products is one row,
- deleting the project drops every asset row in one transaction,
- re-uploading the same bytes is a no-op put.

Asset persistence happens at sync time: the loop puts each
`AssetStore` entry the project has not persisted yet, once.

## User control

`/project/[id]/settings`:

- Project name + Rename (in-memory + DB, in one go).
- "Cache edits in this browser" toggle
  (`localStorage["shumoku.cache"]`, default on). Off means commits
  don't trigger sync; in-memory state still works as before.
- Storage usage from `navigator.storage.estimate()`.
- "Clear cache" — wipes every cached project and asset row.

Home page (`/`):

- "Recent projects" — lists rows newest-first with delete buttons.
- "Starter projects" — Sample (read-only, never cached).
- New / Import dropdown.

## Format versioning

New project rows use `formatVersion: 5`, the current ZIP archive version.
Existing metadata may still record its original archive version; the cache
layout is governed by the IndexedDB version, not this field.
Every new ZIP export writes v5; ZIP v4 is still read. ZIP v1/v2/v3 is rejected
by the archive reader.

## Migration path to a server

The document is the network model the server also keeps (its
configuration and layers), with the editor's products and scenes
beside it. A server sync sends that document, or the configuration
and layer entries a commit changed, rather than per-entity rows.

## Known limits / risks

- **Single-tab assumed.** Two tabs editing the same project race
  on the mirror (last-write-wins, no merge). Acceptable for
  beta; `BroadcastChannel` warning is a follow-up.
- **Storage quota.** Browsers cap origin storage (~10% of disk).
  Sync failure surfaces in console; in-memory state is
  unaffected and Export still works.
- **Private browsing.** IndexedDB may be ephemeral or blocked.
  `isAvailable()` returns false and every method no-ops, so the
  editor degrades to "no cache" mode automatically.
- **No conflict UI.** If a user opens an old `.neted.zip` whose
  `proj_id` collided with a cached one (impossible by nanoid
  collision odds, but possible by manual id duplication), the
  cached version is overwritten by the next sync.
