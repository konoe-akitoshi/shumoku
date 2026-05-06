# Local autosave (beta)

Edits are persisted to IndexedDB so a reload picks up where the
user left off, without an explicit Save / Export. The cache is
**local to one browser** — no server, no sync. Export remains the
source of truth for sharing or backup.

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
- (legacy) `imported` — gone; the new code path generates a real
  `proj_` id at import and redirects the URL accordingly

`importProject` (zip blob, in-memory NetedProject, or YAML)
always returns the new project's id; `createNewProject` emits a
fresh empty project. Both round-trip through IndexedDB.

## Lifecycle

```
edit → commit() → autosave.schedule()  →  writeProjectZip + projectsDb.save
                                          (one save in flight at a time;
                                           further commits set a pending
                                           flag the running loop picks up)
```

Commits are user-action grained (drag end / blur / button click),
not 60Hz, so writing on every commit is fine. The single-flight
coalescer is just to avoid overlapping IDB writes from two rapid
commits — there's no time-based debounce to reason about.

Lifecycle hooks:

- `commit` / `commitAsync` — every undo step calls
  `autosave.schedule()`.
- `visibilitychange` → hidden — `flush()` to drain any pending
  write before the tab loses focus.
- `pagehide` — flush on close / navigation away.
- `[id]/+layout.svelte` $effect — flush before tearing down the
  active project to load a different one.

`autosave.register(flush)` is wired in `context.svelte.ts` because
that's the only place that knows how to assemble a zip from
current state.

## User control

`/project/[id]/settings` exposes:

- Project name + Rename (in-memory + DB).
- Autosave toggle (`localStorage["shumoku.autosave"]`, default on).
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
- detect mismatch in `loadProject` (TODO — currently rows just fail
  to parse and surface as an error status),
- show a "Cached project incompatible — clear or export" banner
  rather than auto-migrate.

In-place migration is intentionally not implemented during beta.

## Known limits / risks

- **Single-tab assumed.** Two tabs editing the same project race
  on save (last-write-wins, no merge). Acceptable for beta;
  `BroadcastChannel` warning is a follow-up.
- **Storage quota.** Browsers cap origin storage (~10% of disk).
  Save failure surfaces in console; the user keeps editing
  in-memory and can still Export.
- **Private browsing.** IndexedDB may be ephemeral or blocked.
  `projectsDb.isAvailable()` returns false and every method becomes
  a no-op so the editor degrades to "no cache" mode automatically.
- **No conflict UI.** If a user opens an old `.neted.zip` whose
  `proj_id` collided with a cached one (impossible by nanoid
  collision odds, but possible by manual id duplication), the
  cached version is overwritten on save.
