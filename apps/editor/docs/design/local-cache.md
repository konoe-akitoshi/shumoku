# Local cache (beta)

The editor's in-memory state IS the project. There is no "save"
action. The local cache is a normalized IndexedDB mirror of state,
kept in sync after every commit. The cache is **local to one
browser** — no server, no sync between devices. Export
(`.neted.zip`) is the portable artifact for sharing / backup.

This shape is deliberately Supabase-ready: each IDB object store
maps 1:1 to a future Postgres table with a `project_id` foreign
key. Migrating means replacing IDB ops with PostgREST/RPC, not
reshaping data.

## Schema (IndexedDB v2)

```
projects   keyPath: 'id'
  { id, name, settings?, formatVersion, createdAt, updatedAt }

nodes      keyPath: ['projectId', 'id']    index: projectId
subgraphs  keyPath: ['projectId', 'id']    index: projectId
links      keyPath: ['projectId', 'id']    index: projectId
products   keyPath: ['projectId', 'id']    index: projectId
scenes     keyPath: ['projectId', 'id']    index: projectId
  { projectId, id, data: <entity> }

assets     keyPath: ['projectId', 'hash']  index: projectId
  { projectId, hash, ext, blob }
```

v1 (single-zip-blob row per project) is gone — the upgrade hook
drops the old store. No in-place migration; the user understands
the cache as ephemeral and Export is the portable form.

## Data flow

```
        UI
        │
        ▼ commit()
  in-memory state  ──────────► IndexedDB (canonical / durable)
        ▲                            │
        │ loadProject                │ exportProjectZip
        │ (rehydrate)                ▼
        │                       .neted.zip
        │
   undo / redo (memory only)
```

State writes flow into IndexedDB after every commit. Read paths
(reload, export) read from IndexedDB, then rehydrate into state.
The zip is never derived from in-memory state directly — Export
drains pending sync, then reads from the DB so "what's in the
zip" == "what would I get on reload".

Each commit produces a diff between the previous synced snapshot
and the new state. Reference equality is the unchanged predicate
— editor stores update immutably, so `before === after` for an
entity ID means "this row didn't change". Conservative
false-positives just cost an idempotent IDB put.

Image refs cross the storage boundary in serialized form. Entity
data going to IDB has its image fields rewritten from runtime
`blob:` URLs to `asset:<hash>.<ext>` (see
`serializeEntity` / `rehydrateEntity` in `state/assets.svelte.ts`).
The reverse runs after read so render code only sees blob URLs.
This keeps DB rows portable across reloads and sessions.

## Lifecycle

- `loadProject(id)` reads `projects/<id>` + every entity store
  filtered by `projectId` in one transaction → reconstructs an
  in-memory snapshot → applies it → records it as the
  last-synced baseline.
- `commit` / `commitAsync` calls `cache.touch()`.
- `cache.touch()` kicks the single-flight sync loop. While a
  sync is running, further touches set `pending` so the running
  loop iterates once more after the current write commits.
- `visibilitychange → hidden` and `pagehide` call `cache.drain()`
  so the mirror is consistent before tab-away events.
- Project switch flushes the previous project's pending sync,
  then resets the AssetStore + last-synced snapshot before
  loading the new one.

## Assets

Image blobs are content-addressed by the first 64 bits of the
SHA-256 of their bytes. Each asset is stored once per project
under `[projectId, hash]` so:

- the same image used in multiple scenes / products is one row,
- deleting the project drops every asset row in one transaction,
- re-uploading the same bytes is a no-op put.

Asset persistence happens at sync time: the loop walks the
in-memory `AssetStore` and idempotently upserts every entry under
the active project. Cheap because the AssetStore is small (10s of
items) and IDB puts of identical hashes are no-ops.

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

`formatVersion: 1` is stored on every project row. The current
loader only handles v1. When we ship a `.neted` v2:

- bump `formatVersion` on save,
- `loadProject` detects mismatch and surfaces "Cached project
  incompatible — clear or export" rather than auto-migrating.

In-place migration is intentionally not implemented during beta.

## Migration path to Supabase

When we add a server, the data shape stays:

```
projects        ⇆  projects table
nodes           ⇆  nodes table (project_id FK)
subgraphs       ⇆  subgraphs table
links           ⇆  links table
products        ⇆  products table
scenes          ⇆  scenes table
assets/<blob>   ⇆  Supabase Storage bucket (path = projectId/hash.ext)
```

Sync changes from "writes to local IDB" to "writes to local IDB
*and* enqueues a server mutation". The local-first read pipeline
stays untouched; the server reconciles via realtime subscription
on `project_id` and pulls remote changes back into IDB → state.

This is the Replicache / Linear sync engine pattern, lite — the
schema is already shaped for it.

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
