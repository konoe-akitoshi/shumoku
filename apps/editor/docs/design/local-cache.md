# Local cache (beta)

The editor's in-memory state IS the project. There is no "save"
action. The local cache is just a disk-side mirror of state, kept
in sync so a reload can pick up where the user left off. The
cache is **local to one browser** — no server, no sync. Export
(`.neted.zip`) remains the source of truth for sharing / backup.

## Storage

`apps/editor/src/lib/persistence/idb.ts`

```
DB:    shumoku        version 1
Store: projects       keyPath: "id"
Index: updatedAt
Row:   { id, name, blob, updatedAt, createdAt, formatVersion, size }
```

`blob` is the byte-identical `.neted.zip` from `writeProjectZip`.
Storing the zip whole instead of split components keeps the DB
schema trivial — only the in-zip layout has format versioning.

## Project ids

- `proj_<nanoid>` — cached projects (real, persisted)
- `sample` — bundled read-only sample (never cached)
- (legacy) `imported` — gone; the new code path mints a real
  `proj_` id at import and the caller redirects the URL.

`importProject` (zip blob, in-memory NetedProject, or YAML)
always returns the new project's id; `createNewProject` mints a
fresh empty project. Both round-trip through IndexedDB.

## Sync model

```
edit → commit() → cache.touch()  →  writeProjectZip + projectsDb.save
                                    (single-flight; further touches
                                     set a pending flag the running
                                     loop picks up)
```

Every commit is a state change. Every state change calls
`cache.touch()`, which kicks the sync loop. If a sync is already
running, the new touch just sets `pending` so the loop iterates
once more. Commits are user-action grained (drag end / blur /
button click), not 60Hz, so writing per commit is fine — no
debounce.

Lifecycle hooks:

- `commit` / `commitAsync` — every undo step calls `cache.touch()`.
- `visibilitychange` → hidden — `cache.drain()` so the mirror is
  in sync before the tab loses focus.
- `pagehide` — drain on close / navigation away.
- `[id]/+layout.svelte` $effect — drain before tearing down the
  active project to load a different one.

`cache.register(syncFn)` is wired in `context.svelte.ts` because
that's the only place that knows how to assemble a zip from
current state.

## User control

`/project/[id]/settings` exposes:

- Project name + Rename (in-memory + DB).
- "Cache edits in this browser" toggle
  (`localStorage["shumoku.cache"]`, default on).
- Storage usage via `navigator.storage.estimate()`.
- "Clear cache" — wipes every cached project after a confirm.

Home page (`/`) surfaces:

- "Recent projects" with delete buttons.
- "Starter projects" (just Sample for now).
- New / Import dropdown.

## Format versioning

`formatVersion: 1` is stored on every row. The current reader
only handles v1. When we ship a `.neted` v2 we will:

- bump `formatVersion` on save,
- detect mismatch in `loadProject` (TODO — currently rows just
  fail to parse and surface as an error status),
- show a "Cached project incompatible — clear or export" banner
  rather than auto-migrate.

In-place migration is intentionally not implemented during beta.

## Known limits / risks

- **Single-tab assumed.** Two tabs editing the same project race
  on the mirror (last-write-wins, no merge). Acceptable for beta;
  `BroadcastChannel` warning is a follow-up.
- **Storage quota.** Browsers cap origin storage (~10% of disk).
  Sync failure surfaces in console; in-memory state is unaffected
  and the user can still Export.
- **Private browsing.** IndexedDB may be ephemeral or blocked.
  `projectsDb.isAvailable()` returns false and every method
  no-ops, so the editor degrades to "no cache" mode automatically.
- **No conflict UI.** If a user opens an old `.neted.zip` whose
  `proj_id` collided with a cached one (impossible by nanoid
  collision odds, but possible by manual id duplication), the
  cached version is overwritten by the next sync.
