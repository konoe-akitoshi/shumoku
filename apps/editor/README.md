# @shumoku/editor

Visual editor for designing **physical** network topologies. Manage devices, modules, and cables as first-class *products*, lay them out on a canvas, and derive a bill of materials — then export a portable project file.

> Status: early and under active development (v0.1.0). Some pages are still being built out.

## Develop

```bash
bun install            # from the repo root
cd apps/editor
bun run dev            # http://localhost:5173
```

| Script | Purpose |
|--------|---------|
| `bun run dev` | Vite dev server |
| `bun run build` | Production build (SvelteKit) |
| `bun run preview` | Preview the production build |
| `bun run typecheck` | `svelte-check` + `tsc` |

## What it does

- **Projects** — a project list on the home page, with a built-in sample (a multi-site campus network with PoE) and file import.
- **Diagram canvas** — place and wire nodes with [@xyflow/svelte](https://svelteflow.dev), pan/zoom, with undo support.
- **Materials** — a product catalog of devices, modules, and cables with quantities and specs.
- **Bill of materials** — derived from the materials and the diagram.
- **PoE analysis** — power-budget calculations across the topology.

Projects persist locally in IndexedDB and export to a portable **`.neted`** file (a JSON snapshot of the project and its diagram). The editor can also import `.yaml` / `.json` network definitions.

## Stack

SvelteKit + Svelte 5, [@xyflow/svelte](https://svelteflow.dev) for the graph canvas, Tailwind CSS, and Vite. Rendering and layout reuse the shared Shumoku engine.

## Internals

Architecture and data-model design notes live in [`docs/`](docs/) (data structures, icon flow, layout, the sheet model, and per-page design). Start there before changing the project schema — migrations live in [`src/lib/migrations/`](src/lib/migrations).

## License

AGPL-3.0-only. For commercial licensing, contact contact@shumoku.dev.
