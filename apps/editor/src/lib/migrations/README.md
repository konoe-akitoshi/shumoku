# Load-time migrations

One-shot fix-ups that translate legacy persisted data into the current
in-memory shape. Runs once per project load via `runLoadTimeMigrations`
(see `./index.ts`) — never at runtime.

## Scope

This directory holds **legacy-only** transformations. Don't put things
here that any of:

- run on every state mutation (those belong with the store / state file)
- enforce runtime data integrity on fresh data (use a store-local
  `sanitize*` instead)
- exist to keep new code self-consistent (constructor invariants in
  context.svelte.ts)

## Order invariant: migration reads RAW, sanitize reads STORE

`migrateLegacyWireRoutes` is the canonical example. The legacy field
(`Scene.wireRoutes`) is stripped by `sanitizeScenes` when scenes are
written into the store, so the migration **must read from the raw
project payload** (`data.scenes`) rather than `scenesStore.list`. The
trade-off: the order in `applyProject` looks counter-intuitive — we
sanitize/populate the store first, then migrate from the raw input —
but this lets migrations call store helpers (e.g.
`diagramState.addTerminationInScene`) which require the scene to
already be in the store.

If you add a migration, document whether it reads raw or store data
in its file header so the next reader doesn't have to dig.

## Where load-time fix-ups live today

| Migration | File |
|---|---|
| `Scene.wireRoutes[].controlPoints` → bend Nodes + `Link.via` | `legacy-wire-routes.ts` |
| catalog → `Product.icon` inheritance for products with no icon | `product-icon-inheritance.ts` |
| `Node.spec.icon` resync from bound Product | (inline in `applyProject`, candidate to move) |
| `ensureProductSnapshot` (port template materialization) | `context.svelte.ts` — also used by `addProduct`, not load-only |
| `migrateLinkEndpointPortsForNode` (port id format) | `context.svelte.ts` — runtime invariant, fires per port edit |

## Schema vs data

IDB schema migrations (v1 → v2) live in `lib/persistence/idb.ts` next
to the schema definition. Those are about table shape, not record
contents.
