# Topology UI — information architecture (#362)

Status: **DESIGN** (approved direction; implementation pending). Supersedes the
"5→3 tabs" one-liner in [`topology-composition-store.md`](./topology-composition-store.md)
§ *Follow-ups*. Backend is done (composition store landed); this is the UI layer
that makes the as-built two-axis model legible.

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

## Decision: "A+" — Diagram-resident canvas, Composition as an on-demand drawer

A single principled synthesis, not a tab reshuffle. The canvas is always the
content; the machinery is a side concern you pull out when you need it.

```
┌──────────────────────────────────────────────┐
│ MyTopology              [⚙]   [ Composition ▸]│   top bar: title, settings, ONE toggle
├──────┬───────────────────────────────────────┤
│ Sour │                                        │
│ -ces │              DIAGRAM (表)              │   the result, full-bleed, always present
│ rail │           (read + feedback surface)    │
│ zbx  │                                        │
│ nb   │                                        │
│ man  │                                        │
│ [+]  │                                        │
└──────┴───────────────────────────────────────┘

   click [ Composition ▸ ]  → drawer slides from the right (裏):
   ┌─────────────────────────────────────┐
   │ Composition                      [✕] │
   │  ① Sources → ② Discovery → ③ Mapping → ④ Resolved   ← L→R pipeline stepper
   │  ┌───────────────────────────────┐  │
   │  │ active stage panel            │  │   one stage at a time, in context
   │  │ (e.g. Mapping: unbound ifaces)│  │
   │  └───────────────────────────────┘  │
   └─────────────────────────────────────┘
```

- **Sources** — a persistent left rail (compact list of attached data sources +
  "attach" affordance). Inputs are always visible because both axes start here.
- **Diagram (表)** — the canvas owns the screen. It is both the *output* and the
  *feedback surface*: a Mapping/Discovery edit reflects here immediately.
- **Composition (裏)** — a right-edge slide-over drawer, closed by default. Inside
  it, the four pipeline stages (Sources → Discovery → Mapping → Resolved) are an
  **L→R stepper**, showing one stage panel at a time. Mapping and Resolved are
  panels/inspectors here, not separate full-screen pages.
- **Settings** — a gear menu (general + danger zone), not a tab.

Top-level interactive choices collapse from six tabs to **two** (Composition
toggle + ⚙) plus the Sources rail.

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

**What option B got right is folded in, not discarded:** B's only real advantage
is making the `Sources → Discovery → Mapping → Resolved` *pipeline* visible
(good information scent for the dataflow). We keep that by putting an L→R stepper
*inside* the drawer instead of flipping the whole screen — exactly the move
Figma makes (canvas resident; only the right panel switches Design/Prototype/Dev
mode). Full-screen modeless, mode confined to the inspector.

## Interaction model: match the affordance to the operation's meaning (cross-cutting)

A Save button is a **good affordance** — it promises "nothing happens until you
commit," which is exactly what some operations want. The problem in the current UI
is not that Save exists; it's that Save is **overused** — applied uniformly,
including to operations that should just take effect. The goal is **"意味的なUI" /
semantic UI**: the interaction's *form* matches the operation's *meaning*, so the
UX is intuitive — a Save button appears exactly where you'd expect to need one,
and is absent where you'd expect direct effect.

### The rule

Choose the affordance by the operation's semantics:

- **Draft → commit (Save button is correct).** Multi-field or multi-step edits the
  user is *composing* before they should take effect, where atomic commit and
  "discard my draft" both make sense. Examples: editing the manual topology graph;
  building up a multi-field source connection config before first connect; a
  mapping session you want to confirm as a unit.
- **Atomic / direct / reversible (no Save — apply on commit).** A single-intent
  change that is meaningful on its own and easily undone. Examples: toggling a
  node's scheduler policy (auto/observe/disabled); attaching or detaching a
  source; setting merge priority; flipping a sync mode. A Save button here is
  ceremony that hides a one-step action behind two.

### What's wrong today (the abuse)

- **Batching many atomic ops behind one Save.** The Sources page collects
  attach/detach + priority + sync-mode + scope into an `editableSources` mirror and
  one **Save Changes** (`sources/+page.svelte`; `_context.svelte.ts`'s
  `hasSourceChanges`). Each of those is individually atomic and reversible — they
  should apply directly, not wait behind a page-level commit.
- **A cross-surface "save before you can act" wall.** Discovery's `Sync` is gated
  on `ctx.hasSourceChanges` — *"You have unsaved changes on the Sources page. Save
  them before syncing."* (`discovery/+page.svelte`). This is the clearest symptom:
  one surface's unsaved form blocks another surface's action. It disappears once
  atomic edits apply directly.

### Where Save stays

- **Manual editor** (drawing/editing the authored graph): a deliberate draft →
  Save (record observation). Correct as-is.
- **A source's connection config** while first composing it (host/token/TLS):
  reasonable to commit as a unit, *then* the row's lightweight knobs (priority,
  mode, scope) are direct.
- **Mapping**, *if* a mapping session is genuinely a compose-then-confirm unit —
  decide per the rule above; if individual bindings are atomic, drop the page-level
  Save Mapping and apply per binding.

### Still true regardless of Save

- **Side-effectful verbs stay explicit** (`Sync`, `Rebuild`) — and are **never
  gated on unsaved config**, because atomic edits are already applied and
  draft-commits are the user's own deliberate Save.
- **Reads are reactive on `composition_revision`** (backend already bumps it O(1)
  per mutation). Change anything → dependent views (Resolved, Diagram) refresh
  themselves; no manual reload. This removes the "reload to see the effect" half of
  the friction independently of the Save question.
- The granular endpoints for direct apply already exist (attach / detach /
  priority / options, each calling `clearCacheEntry`).

## Responsibility split: Sources vs Discovery (the filter seam)

The current split draws the line at *declarative vs imperative*: Sources holds
all config (including per-source scope filters — `siteFilter` / `tagFilter` /
`roleFilter` / `exclude*`), Discovery holds the `Sync` button and results
(`sources/+page.svelte` header comment; `discovery/+page.svelte`). That seam is
cut in the wrong place:

> A scope filter is only meaningful against the *facets that exist* (which sites,
> tags, roles a source actually exposes) — and those are known only **after** the
> first fetch, which happens in Discovery. So the filter is configured blind, in
> Sources, away from both the data it narrows and the feedback on its effect. The
> loop (narrow → see result) is broken across two surfaces.

Redraw the line at **identity/connection vs ingestion/scope**:

- **Sources (the noun — the connection).** What is attached, `purpose`
  (topology/metrics), merge priority, sync mode (manual / scheduled / webhook),
  credentials/connection. "The relationship exists, and how/when it feeds."
- **Composition › Discovery (the verb + its reach).** `Sync now`; see what came
  back (grid + identity-quality); **set the scope filter against the real
  observed facets** (faceted multi-select, not blind free-text); set per-node
  scheduler policy (auto / observe / disabled). "What we actually pull in and
  adopt from each source."

Consequences for the implementation:

1. **Move the scope filter out of the Sources rail into the Discovery stage**, co-
   located with `Sync` and the result grid → one closed feedback loop.
2. **Faceted, not free-text.** The filter offers the observed `site`/`tag`/`role`
   values as a multi-select. Cold start (no fetch yet): show "no data — Sync to
   discover," scope permissive; facets appear after the first fetch — which is the
   *correct* ordering the current UI violates.
3. **Scope is still persisted config** (it shapes future scheduled syncs), so the
   value edited in the Discovery stage **writes back to the source-attachment
   options** (`optionsJson`). The declarative/imperative distinction survives —
   it is just re-seamed: connection-config (Sources) vs ingestion-scope
   (Discovery), rather than all-config vs all-action.

One line: **Sources = "who do we connect to"; Discovery = "what, and how much, do
we pull from them." The scope filter is the latter.**

## Routing / migration

Current routes (`/topologies/[id]/{discovery,mapping,resolved,settings,sources}`)
become drawer states rather than separate workspaces. Preserve deep links:

- `/topologies/[id]` → Diagram with drawer closed (default).
- `/topologies/[id]/composition?stage=mapping` (or a hash) → Diagram with the
  drawer open on that stage. The existing per-stage routes redirect here so
  bookmarks/`/settings#X` legacy links (already handled in the current layout)
  keep working.
- `/topologies/[id]/settings` → opens the ⚙ menu/sheet; keep the route for
  direct links.

No data-layer change: the drawer reads the same `_context.svelte.ts` /
`api.topologies.*` the tabs read today. This is presentation only (mirrors the
composition-store doc's "data model only" scope boundary).

## Accessibility notes

- The drawer is a `role="dialog"`/disclosure with focus trap while open, `Esc` to
  close, and a labelled toggle that exposes `aria-expanded`.
- The stage stepper is a `tablist`-like control *scoped to the drawer* (not the
  page), so the page's top-level landmark count stays low.
- The Sources rail is a `navigation` landmark; the canvas is `main`.
- Keyboard: one accelerator toggles the drawer; arrow keys move between pipeline
  stages once focus is in the stepper.

## Out of scope (this doc)

- Manual-editor relocation *into* the topology context is part of #362's spirit
  and lands here: the manual source's authored-graph edit surface moves from the
  standalone datasources page into the Sources rail / Composition drawer (it is
  per-topology observation data now — see
  [`manual-source-unification.md`](./manual-source-unification.md)). Tracked as a
  sub-task of this work.
- Diagram canvas internals (render pipeline, client layout) — unchanged.
