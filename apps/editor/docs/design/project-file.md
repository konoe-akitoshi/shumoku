# Project file (`.neted.zip`, format v1)

A neted project is a single zip archive carrying everything the
editor needs to reopen the project — diagram, products (catalog),
scenes, and the binary assets (floor-plan images, raster icons)
that those structures reference. JSON-only `.neted.json` (v3) is
gone; legacy files are not read.

## Layout

```
manifest.json     entry point — { format, version, name, settings, sceneIds }
diagram.json      NetworkGraph (nodes / links / subgraphs)
products.json     Product[] (catalog) — sorted in load order
scenes/
  <sceneId>.json  one Scene per file
assets/
  <hash>.<ext>    content-addressed binary blobs
```

Why split:

- **diagram.json** is a single file because nodes / links /
  subgraphs are tightly id-coupled; splitting hurts more than it
  helps.
- **products.json** is a single file. Products diff cleanly inside
  one JSON when sorted by id; the per-file alternative just adds
  an index-sync failure mode.
- **scenes/** is split per scene. Each scene corresponds to one
  floor / room edit and is the natural unit of human review — a
  PR that touches Floor 2 should not noise up Floor 1's diff.
- **assets/** is content-addressed. Same image referenced from
  multiple scenes / products is stored once, and the hash is the
  filename so reads do not need a separate lookup table.

## Asset references

Inside the zip, image-bearing fields hold an
`asset:<hash>.<ext>` URI:

```
Scene.background.src       "asset:1f2a…3b.png"
Product.icon               "asset:7c4e…01.jpg"  (raster only — SVG stays inline)
Node.spec.icon             "asset:7c4e…01.jpg"  (snapshot from Product)
```

`<hash>` is the first 16 hex chars (64 bits) of the SHA-256 of the
asset's bytes. That is more than enough collision resistance for
a single project's worth of images and short enough to keep
filenames pleasant.

`asset:` lives in **two storage tiers** but never in memory: the
zip file and IndexedDB rows both carry `asset:<hash>` strings;
state in the editor always holds runtime URLs (`blob:`,
`http(s):`, or inline SVG text).

- `serializeEntity(value)` — walks the value, replacing `blob:`
  URLs with `asset:` refs. Used by both the zip writer and the
  IDB sync layer before persisting.
- `rehydrateEntity(value)` — inverse. Used by both the zip reader
  and the IDB load path so render code only ever sees blob URLs.

Render paths never see the `asset:` scheme, so adding the format
did not require touching `classifyIcon` / `resolveIcon` / `<img>`
consumers.

## AssetStore

`apps/editor/src/lib/state/assets.svelte.ts` is the in-memory
session store:

- `put(blob)` — hashes, registers, returns `{ hash, ext, blob, url }`
- `putUserImage(file)` — SVG → text (no asset), raster → `put`
- `putWithHash(hash, ext, blob)` — used by the reader
- `byUrl(url)` / `byHash(hash)` — lookups
- `reset()` — revokes every blob URL; called when the active
  project changes

The store is **session-scoped**, not project-scoped per se —
mid-session, undoing a "set background" leaves the previous blob
addressable so redo works. Orphaned entries are not GC'd
mid-session; the writer simply walks live state for `asset:` refs
and writes only those. The durable copies of the asset bytes live
in IDB rows under `[projectId, hash]` (see `local-cache.md`); the
AssetStore is just a runtime cache.

## Writer / reader

Both live under `apps/editor/src/lib/persistence/`:

- `writer.ts` — `writeProjectZip({ name, diagram, products,
  scenes, resolveAsset? })` → `Blob`. Runs `serializeEntity` on
  each top-level slice (idempotent for already-`asset:` refs),
  collects referenced hashes, and packs everything via
  `fflate.zipSync`. The `resolveAsset` callback feeds asset
  bytes; defaults to the in-memory `AssetStore`. The DB-canonical
  export path passes a resolver built from per-project asset
  rows in IDB so the zip reflects what's actually persisted.
- `reader.ts` — `readProjectZip(blob | bytes)` → `NetedProject`.
  Two passes: register every `assets/<hash>.<ext>` into the
  AssetStore first so refs can resolve, then parse JSON and run
  `rehydrateEntity` on each tree, replacing `asset:` strings with
  the live blob URL.

Both pieces deliberately stay thin (~150 lines each); shape
checking lives in the `NetedProject` types.

## Where the zip comes from

Export is **DB-driven**. `exportProjectZip(name?)`:

1. `cache.drain()` — make sure any pending sync has landed so the
   DB reflects the latest state.
2. `projectsDb.loadSnapshot(id)` + `projectsDb.getAssets(id)` —
   read the canonical rows + per-project asset blobs.
3. Build a per-export `resolveAsset` from the asset rows.
4. `writeProjectZip(...)` with the loaded data.

This makes "what's in the .neted.zip" identical to "what loads on
reload". The in-memory state is a working copy; the DB and the
zip are both projections of the canonical store.

Sample (read-only) is the only exception: it's never cached, so
its export still falls back to in-memory state.

## Boundary contract

Three input sites convert user image uploads via
`assetStore.putUserImage`:

- `SceneSideToolbar` (background image)
- `materials/+page.svelte` (custom icon during product creation)
- `materials/[productId]/+page.svelte` (icon edit)

After this contract: `data:` URLs never enter editor state. SVG
stays as inline text (small + diagram-friendly snapshot model);
everything else flows through the AssetStore.

## Format versioning

`manifest.json` carries `{ format: "neted", version: 1 }`. The
reader rejects anything else with a clear message. Bumps:

- **patch / minor**: in-place fixes that the v1 reader still
  parses — keep version at 1.
- **major**: breaking layout change — bump to 2 and write a new
  reader branch. We do not carry old readers; `.neted.zip` is not a
  long-term archival format.
