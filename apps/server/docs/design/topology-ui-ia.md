# Topology UI — information architecture (#362)

Status: **IMPLEMENTED (first pass)** on `feat/topology-ui-ia` (#362) — pending
review. Supersedes the "5→3 tabs" one-liner in
[`topology-composition-store.md`](./topology-composition-store.md) § *Follow-ups*.
Backend was already done (composition store); this is the UI layer that makes the
as-built two-axis model legible.

Zones (agreed): **Sources / Composition / Diagram** — Diagram is the resident
canvas; Sources and Composition open in a right drawer via a two-way switch. No
"Discovery / Mapping / Resolved" — those are absorbed (Discovery→Composition,
Mapping→per-entity section, Resolved→debug subview). Sync + scope live in Sources
(ingestion of the input). A single `ctx.revision` channel re-fetches the
diagram / debug views on commit (no manual reload). Deferred: full folding of
metrics-binding into per-entity detail (vs a Composition section); manual-editor
relocation; wiring the client revision to the backend `composition_revision`.

## Problem

The topology page is six flat tabs:

```
Diagram · Sources · Discovery · Mapping · Resolved · Settings
```

(`apps/server/web/src/routes/(app)/topologies/[id]/+layout.svelte`)

That shape predates the composition-store refactor. It exposes the *internal
algorithms* (Discovery, Mapping, Resolved) as if they were top-level
destinations, when they are really how **one field** — the resolved entity — gets
filled. Six peer tabs is also an accessibility/cognitive-load smell: every visit
re-presents six equal choices (Hick's law), and the high-frequency action (look
at the diagram) is given the same weight as rare machinery edits.

## Mental model (unchanged — this UI just reflects it)

From [`topology-composition-store.md`](./topology-composition-store.md) § *Mental
model*: the **resolved entity** is the hub; two axes meet on it.

- **Axis 1 — composition (structure):** `sources → entity → diagram`.
- **Axis 2 — metrics dependency:** `entity → metrics provider`.
- The **diagram** is axis-1 rendered with axis-2's live values painted on.

So the natural three *zones* are **Sources** (inputs to both axes), **Composition**
(the entity + how both axes resolve onto it), **Diagram** (presentation). The job
of the IA is to make those three legible *without* six equal tabs and *without*
hiding the dataflow.

## Decision: "A+" — Diagram-resident canvas; Sources + Composition in a drawer

The three zones are exactly the agreed ones from
[`topology-composition-store.md`](./topology-composition-store.md) § "Target (3
tabs)": **Sources / Composition / Diagram**. There is **no "Discovery" / "Mapping"
/ "Resolved"** — those old tabs are *absorbed*: "Discovery" is **renamed
Composition**, "Mapping" becomes a per-entity metrics-binding section inside
Composition, and "Resolved" becomes a Composition debug subview.

A+ keeps the canvas resident (the "Diagram" zone) and puts the other two zones in
an on-demand drawer with a **two-way switch — Sources | Composition** (NOT a
four-stage pipeline stepper; that was a drift back into the old tabs).

```
┌──────────────────────────────────────────────┐
│ MyTopology        [ Sources ] [ Composition ] [⚙]│  top-right: 2 zone toggles + gear
├──────────────────────────────────────────────┤
│                                              │
│                 DIAGRAM (表)                 │   the result, full-bleed, always present
│              (read + feedback surface)       │
│                                              │
└──────────────────────────────────────────────┘

   open a zone → drawer slides from the right (裏):
   ┌─────────────────────────────────────┐
   │ [ Sources | Composition ]        [✕] │   two-way zone switch
   │  ┌───────────────────────────────┐  │
   │  │ Sources: attached sources,    │  │   inputs: attach/priority/sync/scope
   │  │   each with sync + scope      │  │
   │  │ — or —                        │  │
   │  │ Composition: resolved-entity  │  │   curation: entity list + per-entity
   │  │   list + per-entity detail    │  │   detail (policy, metrics-binding,
   │  │   (+ resolved-JSON debug)     │  │   provenance, override, hide)
   │  └───────────────────────────────┘  │
   └─────────────────────────────────────┘
```

- **Sources** — inputs. Which sources contribute (topology / metrics / manual),
  priority, **sync (now / all)**, and **scope** (what to pull, faceted from the
  source). Sync and scope live here because they are ingestion concerns of the
  input, co-located so there is no cross-surface seam.
- **Composition** — the human-curation surface over the **resolved entities**: an
  entity list + per-entity detail that holds identity + provenance, field
  overrides, **discovery policy** (auto/observe/disabled), **metrics-binding**
  (the old Mapping), and hide/exclude. Raw observations + the resolved-graph JSON
  are a **debug subview**. "Auto-map all" dissolves into a filter ("entities with
  no metrics binding") + per-entity override.
- **Diagram (表)** — the canvas owns the screen; output *and* feedback surface (a
  Composition edit reflects here immediately).
- **Settings** — a gear (general + danger zone), not a zone.

Top-level choices: the two zone toggles + gear; the canvas is always present.

## Why this shape (the theory)

The A-vs-B choice was resolved on established IA/HCI principles, not preference:

1. **Mode avoidance (Tesler "don't mode me in" / Raskin).** A full "front/back
   flip" (option B) is a *persistent mode*. The drawer is a *quasimode* —
   active only while open — which Raskin argues is safer and lower-load.
2. **Focus + context (Shneiderman's mantra: "overview first … details on
   demand").** The Composition drawer *is* details-on-demand laid over the
   diagram (context). Flipping the whole screen away from the diagram destroys
   that context.
3. **Task-frequency / Zipf optimization.** Viewing the diagram ≫ editing the
   composition. Keep the high-frequency surface always on; don't make it
   symmetric with rare machinery edits.
4. **Tight feedback loop (decisive).** Mapping a metric or fixing discovery
   needs immediate "did this node light up / did this link bind?" confirmation on
   the diagram. The diagram is output *and* the edit-feedback surface ⇒
   focus+context wins for coupled edits.
5. **Convergent evolution.** "Make a thing" pro tools (Figma, IDEs, DAWs) almost
   universally use *canvas-resident + side inspector*. This is the empirical
   optimum.

**What option B got right is folded in, not discarded:** B's advantage was making
the dataflow legible. We keep that with the drawer's two-way Sources | Composition
switch and the canvas always showing the result — exactly the move Figma makes
(canvas resident; only the right panel switches mode). Full-screen modeless, the
zone switch confined to the drawer. (An earlier draft put a four-stage
`Sources→Discovery→Mapping→Resolved` stepper here; that was a drift — it just
renamed the old tabs and contradicted the 3-zone collapse. Removed.)

## Interaction model: Save is fine — cross-surface state coupling is the bug (cross-cutting)

A Save button is a **good, preferred affordance**. Batching a set of edits behind
one explicit commit *reduces* wasteful behavior: fewer round-trips, and no
side-effect (re-resolve, and especially any re-sync / polling) firing on every
keystroke. It also gives a clear "nothing happens until you commit" point and a
natural "discard my draft." Using Save is encouraged.

The earlier framing ("Save is overused, make everything direct-apply") was wrong.
The real defect in the old UI was not the Save button — it was that the *dirty
state* of one surface reached across and changed the behavior of **another**
surface. That is the anti-pattern.

### The anti-pattern: dirty state that spans surfaces

The clearest symptom: Discovery's `Sync` was disabled by Sources' unsaved-edits
flag — *"You have unsaved changes on the Sources page. Save them before syncing."*
(`ctx.hasSourceChanges`, read by `discovery/+page.svelte`). When surface B's
behavior depends on surface A's *uncommitted* state, the cause becomes invisible:
standing on Discovery, nothing explains why Sync is greyed out. And the fact that
the coupling had to be plumbed through shared context (`ctx.hasSourceChanges`) is
itself the structural tell — uncommitted state leaked out of the surface that owns
it.

### The rule

- **Keep edit / dirty state local to the surface that owns it.** A page's
  editable mirror + its Save button live and die on that page; they are *not*
  written into the shared shell context. Other surfaces read only the
  **committed** state (`ctx.currentSources`, the resolved graph, …).
- **A "must commit before X" dependency is allowed only when X is on the same
  surface as the Save.** Then the gate is visible and diagnosable (the Save button
  and the thing it unlocks are in the same view). A gate that spans surfaces is
  forbidden — re-express it as "uncommitted edits simply aren't in effect yet,"
  contained to the owning surface.
- **Side-effectful verbs stay explicit** (`Sync`, `Rebuild`). They operate on the
  committed state; they are never gated on *another* surface's draft. If Sources
  has uncommitted edits, Discovery still syncs the last *saved* config — those
  edits just haven't happened from the system's point of view, and that fact is
  local to Sources.

### Consequences

- **Sources** edits apply directly via the granular `sources.{add,update,remove}`
  endpoints (partial updates). With scope no longer batched here, there is no
  multi-field draft worth a page-level Save — every remaining edit (attach /
  detach / sync-mode / priority / scope) is atomic. No editable mirror, no
  `replaceAll` (it would wipe scope, regenerate ids, reset webhook secrets), and
  `ctx.editableSources` / `ctx.hasSourceChanges` are removed.
- **No cross-surface gate exists** because config and the action consuming it are
  on the same surface (see the seam section). Nothing reaches into another
  surface's draft.
- **Manual editor** stays a deliberate draft → Save (record observation).
- **Reads stay reactive on a single revision channel** (`ctx.revision`, mirroring
  the backend's `composition_revision`): once an edit commits, the diagram + debug
  views re-fetch themselves — no manual reload.

## Responsibility split: Sources owns ingestion (the filter seam)

The old split cut at *declarative vs imperative* — scope filters in Sources, the
`Sync` button on a separate Discovery surface. That seam is in the wrong place: a
scope filter is only meaningful against the **facets that exist** (which sites /
tags / roles a source exposes), known only *after* a fetch; configuring it on one
surface while syncing on another breaks the loop (narrow → see result) and forces
cross-surface coordination.

Cut the seam at **input vs curation** instead:

- **Sources = the input, end-to-end.** What is attached (purpose, priority,
  credentials) **and** its ingestion: **`Sync`** and **`scope`** (faceted from the
  source via `getConfigOptions`, persisted to the attachment `optionsJson`). Sync
  and scope sit together, on the same surface, so any "set scope, then sync" flow
  is local and visible. This is why `Sync` and `scope` belong here and not on a
  separate Discovery surface — co-location is what makes a cross-surface gate
  impossible to construct.
- **Composition = curation of the result.** The resolved entities and their
  per-entity detail (policy, metrics-binding, provenance, override, hide); raw
  observations + resolved JSON as a debug subview. It reads committed state; it
  never depends on Sources' in-flight edits.

One line: **Sources = "who we connect to and what we pull"; Composition = "curate
what came back." Sync and scope are the former.**

## Routing / migration

Three zone routes under `/topologies/[id]`, the drawer is chrome around the active
one; deep links preserved:

- `/topologies/[id]` → Diagram, drawer closed (default).
- `/topologies/[id]/sources` → drawer open on Sources.
- `/topologies/[id]/composition` → drawer open on Composition.
- `/topologies/[id]/settings` → gear (drawer, switch hidden).
- Legacy `/topologies/[id]/{discovery,mapping,resolved}` **redirect to
  `/composition`** (discovery & resolved fold in directly; mapping becomes the
  per-entity metrics-binding section). `/settings#X` legacy hash links still map.

No data-layer change: the drawer reads the same `_context.svelte.ts` /
`api.topologies.*`. Presentation only.

## Accessibility notes

- The drawer is a disclosure with a focus trap while open and `Esc` to close; the
  zone toggles expose `aria-expanded`.
- The Sources | Composition switch is a `tablist`-like control scoped to the
  drawer, so the page's top-level landmark count stays low.
- The canvas is `main`; the drawer is a labelled `complementary`/`dialog` region.

## Out of scope (this doc)

- Manual-editor relocation *into* the topology context: the manual source's
  authored-graph edit surface moves from the standalone datasources page into the
  Sources zone (it is per-topology observation data now — see
  [`manual-source-unification.md`](./manual-source-unification.md)).
- Full folding of metrics-binding into per-entity detail (vs. a Composition
  section) — staged.
- Diagram canvas internals (render pipeline, client layout) — unchanged.
