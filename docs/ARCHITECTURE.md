# Architecture

Cross-cutting overview of how the shumoku monorepo fits together.
Editor-specific data model details live in
[`apps/editor/docs/design/data-model.md`](../apps/editor/docs/design/data-model.md);
link composition (port / plug / module / cable) is in
[`apps/editor/docs/design/connection-model.md`](../apps/editor/docs/design/connection-model.md);
this doc focuses on the flows that span packages.

## Contents

- [Bird's-eye view](#birds-eye-view)
- [Load pipeline (editor)](#load-pipeline-editor)
- [Layout engine (core)](#layout-engine-core)
- [Runtime state and mutations](#runtime-state-and-mutations)
- [Placement APIs — when to use which](#placement-apis--when-to-use-which)
- [End-to-end use cases](#end-to-end-use-cases)
- [Package boundaries](#package-boundaries)
  - [Plugin contract](#plugin-contract)
- [Camera (pan/zoom)](#camera-panzoom)
- [Known gaps](#known-gaps)

---

## Bird's-eye view

```mermaid
flowchart LR
  subgraph IN[External inputs]
    YT[YAML text]
    JF[.neted.json file]
    CLK[User click / paste]
    DRG[User drag]
    BTN[SideToolbar buttons]
  end

  subgraph EDITOR[@shumoku/editor]
    LP[Load pipeline]
    RT[Runtime state]
    UI[Diagram UI]
  end

  subgraph CORE[@shumoku/core]
    LN[computeNetworkLayout<br/>tiered / composite]
    PN[placeNode<br/>collision]
    PP[placePorts]
    RE[routeEdges<br/>port-anchored edges]
  end

  subgraph RNDR[@shumoku/renderer]
    SR[ShumokuRenderer<br/>SVG]
  end

  YT --> LP
  JF --> LP
  LP --> RT
  RT --> SR
  SR --> UI

  CLK --> PN
  DRG --> SR
  BTN --> LN

  PN --> RT
  LN --> RT
  PP --> RT
  RE --> RT

  RT -->|export| JF
```

**Reading guide:**

- User input flows in from the left (YAML text, JSON file, direct UI
  interactions).
- The editor's load pipeline converts external input into runtime
  state; runtime state is also the sink for every interactive edit.
- Core exposes the pure-function primitives (layout, placement, port
  placement, edge derivation) that the editor calls into. Drawn edge
  geometry is cubic Béziers computed from port positions in the
  renderer — there is no routing solver.
- The renderer reads runtime state via `$bindable` and emits events
  back when the user drags or clicks.

---

## Load pipeline (editor)

Every route to runtime state is a linear pipeline — conversion on each
step, `loadProject` as the single terminal that resets state and
applies project data.

```mermaid
flowchart TD
  subgraph EXT[External inputs]
    YT[YAML text]
    JSTR[JSON string]
    JOBJ[NetedProject object]
    SPF[sampleProject const]
  end

  YT -->|HierarchicalParser.parse| NG1[NetworkGraph<br/>unpositioned]
  NG1 --> APY[applyYaml]
  APY -->|wrap w/ current palette + bom| NP1[NetedProject]
  NP1 --> IPJ[importProject]

  JSTR -->|JSON.parse| JOBJ
  JOBJ --> IPJ

  IPJ -->|loadProject 'imported' data| LP
  SPF -->|loadProject 'sample'| LP

  LP[loadProject<br/>TERMINAL]
  LP -->|1 reset state| RST[reset everything<br/>maps / arrays / status / initialized]
  LP -->|2 apply| APP[applyProject]
  LP -->|3 status 'Ready'| READY((Ready))

  APP --> APG[applyGraph]
  APP --> SPB[sanitizePaletteAndBom]

  APG --> SG[sanitizeGraph<br/>drop orphan refs + dups]
  SG --> BR{any node<br/>unpositioned?}
  BR -->|yes YAML case| FULL[computeNetworkLayout<br/>full auto-layout pass]
  BR -->|no all positioned| PPS[placePorts]
  FULL --> STT
  PPS --> REE[rerouteEdges<br/>rebuild port-anchored edges]
  REE --> STT
  SPB --> STT[Runtime state<br/>nodes / subgraphs / links / ports / edges / palette / bom]
```

**Key properties:**

- One entry point per input shape, never multiple (`applyYaml` is the
  only YAML entry; `importProject` the only JSON entry).
- State reset happens exactly once per load, inside `loadProject`.
- Any fix to load-time derivation (port placement, edge routing,
  bounds) lands in `applyGraph` and benefits every path.

---

## Layout engine (core)

`computeNetworkLayout()` (`libs/@shumoku/core/src/layout/unified-engine.ts`)
is the single entry point. It dispatches between the flat-tree /
compound layouts and the composite zone layout, all built on the
spatial-rule engine in `layout/engine/` (`LayoutRules` for sizing /
separation / framing, `PlacementPolicy` for `tryPlace` / `snapTo`,
injectable `TextMeasurer`). It returns both a `ResolvedLayout` and a
legacy `LayoutResult`.

```mermaid
flowchart TD
  IN[NetworkGraph input] --> CNL[computeNetworkLayout]

  CNL --> DISP{composite?<br/>shouldUseComposite:<br/>broad zone metadata}

  DISP -->|yes — discovered networks| SCL[searchCompositeLayout<br/>layout/composite/]
  SCL --> LPI[buildLayoutProblem<br/>LayoutProblem IR<br/>role-tiers TierHint]
  LPI --> PLC[layered quotient placement<br/>zones from location metadata]
  PLC --> OCT[octilinear edge routing<br/>place-and-route search:<br/>routed-geometry score arbitrates]
  OCT --> RES

  DISP -->|no — hand-drawn / flat| ENG[createEngine<br/>layout/engine/ spatial rules]
  ENG --> FT{opts.compound?}
  FT -->|yes| LC[layoutCompound<br/>fold subgraphs into boxes]
  FT -->|no| ALF[autoLayoutFlatTree]

  subgraph FLAT[Flat-tree pipeline]
    direction TB
    S1["1. decidePortSides<br/>direction-aware + tier flips"]
    S2["2. node footprints via engine<br/>TextMeasurer for port labels"]
    S3["3. layoutFlatTree<br/>tidy-tree placement"]
    S4["4. placePorts"]
    S5["5. honour fixed / hints options"]
    S1 --> S2 --> S3 --> S4 --> S5
  end

  ALF --> FLAT
  LC --> FLAT
  FLAT --> RTE[routeEdges<br/>2-point port-anchored ResolvedEdge<br/>+ lane offsets + bus routing]
  RTE --> RES[assertLayoutConstraints<br/>→ ResolvedLayout + LayoutResult]
```

**Highlights:**

- **No routing solver** — the previous libavoid-js WASM router was
  removed (PR #227). `routeEdges` is a trivial pass that attaches
  port-anchored `ResolvedEdge` records with 2-point polylines; the
  renderer draws cubic Béziers from the port positions and sides.
  The points remain only for non-rendering consumers (label midpoint,
  hit testing, cable length). Post-processes fan out edges sharing a
  port (lane offsets) and merge same-layer fans into T-shaped buses.
- **Composite auto-select** — `shouldUseComposite` enables the
  composite zone layout for graphs with broad zone (location)
  metadata, i.e. discovered networks. It builds a `LayoutProblem` IR
  (`layout/problem.ts`, PR #533) with role-tier hints
  (`layout/role-tiers.ts`, sparse 0–100 device-role tiers), places
  layered zone bands, then runs a place-and-route search where routed
  octilinear geometry scores the placement variants.
- **Engine as policy authority** — sizing, gaps, and label widths come
  from one `createEngine()` instance shared conceptually with manual
  placement (`engine.tryPlace`), so auto-layout and drag-snap stay
  consistent.
- **Constraint assertion** — `assertLayoutConstraints` (#482) throws
  on BLOCKING violations in dev/test and logs in production, so a
  broken figure never ships silently.

---

## Runtime state and mutations

The editor's diagram state is intentionally reactive-friendly. Nodes,
subgraphs, ports, and edges live in `SvelteMap`s inside a single
`$state` object; ports and edges are treated as derived and rebuilt
via `rerouteEdges`.

```mermaid
flowchart LR
  subgraph STATE["Runtime state (context.svelte.ts / diagram object)"]
    direction TB
    N[SvelteMap&lt;id, Node&gt;]
    SG[SvelteMap&lt;id, Subgraph&gt;]
    L[Link array]
    P[SvelteMap&lt;id, ResolvedPort&gt;<br/>DERIVED]
    E[SvelteMap&lt;id, ResolvedEdge&gt;<br/>DERIVED]
    B[bounds]
  end

  subgraph AUX["Separate $state"]
    PAL[palette array]
    BOM[bomItems array]
    POE[poeBudgets<br/>$derived]
  end

  subgraph MUT[Mutation API]
    direction TB
    AL[addLink]
    UL[updateLink]
    RL[removeLink]
    UN[updateNode]
    US[updateSubgraph]
    MG[moveNodeToGroup]
    UB[unbindNodes]
    RB[removeBomItem]
    AA[autoArrange]
  end

  subgraph RE[Re-derivation]
    REJ[rerouteEdges<br/>async, rebuilds port-anchored edges]
  end

  subgraph RND[Rendering]
    SR[ShumokuRenderer SVG]
  end

  AL --> L
  UL --> L
  RL --> L
  UN --> N
  US --> SG
  MG --> N
  MG --> REJ
  UB --> N
  RB --> BOM
  RB --> N
  AA -->|computeNetworkLayout| N
  AA --> SG
  AA --> P
  AA --> E
  AA --> B

  AL --> REJ
  UL --> REJ
  RL --> REJ
  REJ --> E

  N <-->|$bindable| SR
  SG <-->|$bindable| SR
  P <-->|$bindable| SR
  E <-->|$bindable| SR
  B <-->|$bindable| SR

  N --> POE
  L --> POE
  BOM --> POE
  PAL --> POE
```

**Notes:**

- `SvelteMap.set()` / `.delete()` trigger Svelte 5 reactivity
  directly — no copy-on-write needed.
- Ports and edges are "derived" conceptually; operationally they're
  rebuilt by explicit calls. A future PR could move this to `$effect`
  once the drag-path's atomicity concerns are resolved.
- `ResolvedPort` remains node-owned, while `ResolvedEdge` carries
  `fromPort` / `toPort` endpoint references. This keeps Port ownership
  canonical on the node side, but lets link rendering and link-level
  overlays consume the resolved endpoint ports without reverse-looking
  them up from the ports map.
- `$bindable` on the renderer is bidirectional: the canvas writes
  back directly when the user drags or creates a link.

---

## Placement APIs — when to use which

Two primitives, different intents, deliberately kept separate:

```mermaid
flowchart TD
  NEED{What do you need?}

  NEED -->|place one node at a specific point| PN_CASE
  NEED -->|re-layout the whole diagram| LN_AUTO
  NEED -->|re-layout but keep some nodes pinned| LN_FIXED
  NEED -->|nudge some nodes toward specific x| LN_HINTS

  subgraph PN_CASE[Geometric]
    PN[placeNode node, graph, initial, gap]
    PN --> PNR[Returns collision-free position<br/>near initial, ignores link flow]
  end

  subgraph LN_AUTO[Structural — auto-arrange]
    LN1[computeNetworkLayout graph]
    LN1 --> LN1R[Full auto-layout pass,<br/>all positions recomputed]
  end

  subgraph LN_FIXED[Structural — partial]
    LN2[autoLayoutFlatTree graph, engine,<br/>opts.fixed Set]
    LN2 --> LN2R[Layout + post-process snap<br/>hard pin listed nodes]
  end

  subgraph LN_HINTS[Structural — guided]
    LN3[autoLayoutFlatTree graph, engine,<br/>opts.hints Map]
    LN3 --> LN3R[Layout with preferred x<br/>soft nudge, packing wins on overlap]
  end

  subgraph USE_PN[Typical callers of placeNode]
    ANN[ShumokuRenderer.addNewNode<br/>SideToolbar Add button]
    PST[context menu Paste]
    PNB[placeNodeForBom<br/>BOM → diagram]
  end

  subgraph USE_LN[Typical callers of computeNetworkLayout]
    AUA[autoArrange<br/>SideToolbar button]
    YML[YAML import fallback]
    ASL[Future: arrange-selection]
  end

  USE_PN --> PN
  USE_LN --> LN1
```

**Rule of thumb:**

- Does the user know *exactly* where they want the node? → `placeNode`.
- Do you want the algorithm to decide based on graph topology? →
  `computeNetworkLayout`.
- Somewhere in between? The lower-level `autoLayoutFlatTree` accepts
  `fixed` (hard pin) and `hints` (soft x-nudge) options; note that
  `computeNetworkLayout` does not currently plumb these through — its
  options are `{ compound?, composite? }`.

---

## End-to-end use cases

### Add node via SideToolbar

```mermaid
sequenceDiagram
  actor User
  participant STB as SideToolbar
  participant Page as diagram/+page.svelte
  participant SR as ShumokuRenderer
  participant DS as diagramState
  participant Core as @shumoku/core

  User->>STB: click "Add Router"
  STB->>Page: onaddnode({kind:'hardware', type:'router'})
  Page->>SR: addNewNode({id:newId('node'), spec})
  SR->>Core: placeNode(node, graph, initial, gap)
  Core-->>SR: { x, y }
  SR->>DS: diagram.nodes.set(id, {...node, position})
  DS-->>SR: reactive update
  SR-->>User: node appears on canvas
  SR->>Page: onnodeadd(id)
  Page->>DS: addBomItem({id:newId('bom'), nodeId:id})
```

### Drag node

```mermaid
sequenceDiagram
  actor User
  participant SR as ShumokuRenderer
  participant Core as @shumoku/core
  participant DS as diagramState

  User->>SR: drag node
  SR->>Core: moveNode(id, x, y, {nodes, ports, subgraphs}, links)
  Core->>Core: resolve collisions, shift ports, rebalance, routeEdges
  Core-->>SR: {nodes, ports, edges, subgraphs}
  SR->>DS: replaceMap nodes/ports/edges/subgraphs
  DS-->>SR: $bindable update
  SR-->>User: diagram re-renders
```

### Save to JSON

```mermaid
sequenceDiagram
  actor User
  participant Menu as ExportMenu
  participant DS as diagramState
  participant Blob as BrowserBlob/Download

  User->>Menu: click "Export JSON"
  Menu->>DS: exportProject('diagram-name')
  DS->>DS: exportGraph() → NetworkGraph
  DS->>DS: wrap w/ palette + bom → NetedProject
  DS-->>Menu: JSON string
  Menu->>Blob: URL.createObjectURL + download
  Blob-->>User: .neted.json file
```

### Import JSON

```mermaid
sequenceDiagram
  actor User
  participant Top as Top page
  participant DS as diagramState
  participant Route as route layout

  User->>Top: drop .neted.json
  Top->>DS: importProject(jsonString)
  DS->>DS: JSON.parse
  DS->>DS: loadProject('imported', data)
  DS->>DS: reset all state
  DS->>DS: applyProject(data)
  DS->>DS: applyGraph + sanitizePaletteAndBom
  DS-->>Top: state populated, status='Ready'
  Top->>Route: goto('/project/imported/diagram')
  Route->>DS: loadProject('imported')<br/>sees initialized=true, skips
```

### Auto-arrange

```mermaid
sequenceDiagram
  actor User
  participant STB as SideToolbar
  participant Page as diagram/+page.svelte
  participant DS as diagramState
  participant Core as @shumoku/core

  User->>STB: click Auto-arrange
  STB->>Page: onautoarrange()
  Page->>DS: autoArrange()
  DS->>DS: exportGraph() and strip all positions
  DS->>Core: computeNetworkLayout(strippedGraph)
  Core->>Core: autoLayoutFlatTree (or composite search)
  Core->>Core: placePorts + routeEdges
  Core-->>DS: { nodes, ports, edges, subgraphs, bounds }
  DS->>DS: replaceMap everything
  DS-->>User: diagram re-rendered with fresh layout
```

---

## Package boundaries

What each package owns, and what it doesn't:

```mermaid
flowchart TB
  subgraph apps[apps/]
    ED[editor<br/>SvelteKit UI, state, routes]
    DOC[docs<br/>Next.js, playground]
    CLI[cli<br/>shumoku render]
    SRV[server<br/>topology API]
  end

  subgraph libs[libs/@shumoku/]
    COR[core<br/>models, layout, parser]
    CAT[catalog<br/>device/service catalog]
    SDK[plugin-sdk<br/>HTTP client, pagination]
    RND[renderer<br/>Svelte SVG]
    RSV[renderer-svg<br/>SSR SVG]
    RHT[renderer-html<br/>embeddable]
    RPN[renderer-png<br/>resvg]
    SHU[shumoku<br/>umbrella]
  end

  subgraph libp[libs/plugins/]
    PAI[aruba-instant-on]
    PGF[grafana]
    PNB[netbox]
    PNS[network-scan]
    PPR[prometheus]
    PZB[zabbix]
  end

  ED --> COR
  ED --> CAT
  ED --> RND
  ED --> RSV

  DOC --> COR
  DOC --> RSV
  DOC --> RHT

  CLI --> COR
  CLI --> RSV
  CLI --> RPN
  CLI --> RHT

  SRV --> COR
  SRV --> RSV
  SRV --> RHT
  SRV --> RND

  CAT --> COR
  RND --> COR
  RSV --> COR
  RHT --> RSV
  RPN --> RSV
  SHU --> COR
  SHU --> RSV
  SHU --> RHT

  PAI --> COR
  PGF --> COR
  PNB --> COR
  PNB --> SDK
  PNS --> COR
  PNS --> CAT
  PPR --> COR
  PZB --> COR
  PZB --> SDK
```

**Invariants:**

- **Plugins depend only on `core`** (plus the shared `plugin-sdk`
  runtime helpers, and `catalog` where device identification needs
  it) — never on renderers, never on editor. Keeps them embeddable
  anywhere.
- **Renderers depend on `core`** — never on editor. Core models are
  the lingua franca.
- **Editor depends on core + catalog + renderer** — plus
  `renderer-svg` for SVG export.
- **Server consumes renderers, not just core** — the API side uses
  `renderer-svg` / `renderer-html` for baked layouts and static
  export; the web side uses the Svelte `renderer`.
- **Apps don't cross-depend** — editor doesn't import from docs, etc.

The **canonical data shape** at every boundary is `NetworkGraph`
(core's type). YAML and the project JSON (`NetedProject`, which wraps
`NetworkGraph`) are boundary formats; everything inside the system
speaks `NetworkGraph`.

### Plugin contract

Data-source plugins (Zabbix, NetBox, Prometheus, Grafana, Aruba
Instant On, network-scan) connect shumoku to external systems through a small
contract in `@shumoku/core`. The rule is **core defines the display
contract; plugins conform**. Concretely:

- Core types describe what the UI consumes — `Host`, `Alert`,
  `LinkMetrics`, etc. — and contain no plugin-name enums.
- Plugins translate upstream vocabularies (Zabbix priorities,
  Prometheus severities, Aruba health tokens) into core vocab at
  their own boundary — never the other way.
- The web app renders plugins generically via `configSchema`; it
  must not branch on `plugin.type`. (#270 is resolved — the
  invariant is now enforced by a vitest guard,
  `apps/server/api/src/plugins/host-branch-guard.test.ts`, which
  fails the build if a `type === '<plugin>'` branch reappears in
  the config surfaces.)

For the full author-facing reference — capability mixins, data
shapes, severity translation table, the three node-state axes, the
passthrough `discoverMetrics` pattern, dev-only `nativeApi` — see
[`plugin-authoring.md`](./plugin-authoring.md).

---

## Camera (pan/zoom)

Camera behaviour — how wheel events, trackpad gestures, pinch and
pointer drags translate into viewport transforms — is deliberately
**not** baked into `@shumoku/renderer`. Different apps want different
policies (the editor wants mouse-wheel-zoom like a CAD tool; a static
share preview wants no camera at all; SSR/CLI has no DOM to attach
to), and a renderer that picks a default for everyone ends up either
wrong-by-default or stuffed with opt-out props.

```mermaid
flowchart LR
  subgraph RND[@shumoku/renderer]
    SVG[SVG output<br/>stable DOM:<br/>g.viewport, g.node[data-id], path.link]
    AC[attachCamera<br/>utility<br/>opt-in]
  end

  subgraph WG[wheel-gestures]
    START[isStart marker]
    MOM[isMomentum marker]
  end

  subgraph D3[d3-zoom]
    ST[__zoom state]
    TRF[transform on g.viewport]
  end

  subgraph APP[Host app]
    EDT[editor]
    WID[dashboard widget]
    DET[detail page]
    SHR[share page]
  end

  SVG -.- AC
  AC --> WG
  AC --> D3
  D3 --> TRF
  WG --> AC

  EDT --> AC
  WID --> AC
  DET --> AC
  SHR --> AC
```

### API shape

```ts
import { attachCamera } from '@shumoku/renderer'

const camera = attachCamera(svgEl, {
  scaleExtent: [0.2, 10],           // zoom bounds
  panFilter: (e) => e.altKey,       // which pointer-down events pan
  wheelZoomSensitivity: 1.0015,     // mouse tick feel
  pinchZoomSensitivity: 1.01,       // trackpad pinch feel
})
camera.zoomBy(1.5)
camera.panToNode('device-42')
camera.reset()
camera.detach()                     // cleanup on unmount
```

The renderer always emits a `<g class="viewport">` as its zoom target;
`attachCamera` throws if that element isn't present. Apps that want
**no** camera simply don't call `attachCamera`.

### UX policy (Figma / Miro style)

| Input | Result |
|---|---|
| Mouse wheel (plain) | zoom at cursor |
| Mouse ctrl+wheel | zoom at cursor (explicit) |
| Trackpad two-finger | pan (with natural momentum) |
| Trackpad pinch | zoom at cursor (browser synthesises `ctrlKey=true`) |
| Middle-click drag / Alt+left-drag | pan (via `panFilter`) |
| Node drag (edit mode) | move node (handled per-element in `SvgNode`) |

### Why we need three layers (d3-zoom + wheel-gestures + sticky detection)

Each layer solves a problem the others can't:

1. **d3-zoom** owns the transform state (`svg.__zoom`). It's a stable
   base: attaching to the svg once and routing all transform changes
   through `zoomBehavior` keeps state consistent regardless of whether
   a change came from a wheel event, imperative `zoomBy`, or external
   `panToNode` call. A previous version bypassed d3-zoom by writing
   `transform=` directly on the viewport — d3-zoom's state went stale
   and the next gesture jumped to wherever d3-zoom last remembered.

2. **wheel-gestures** classifies each event as "user input", "momentum
   tail", or "gesture start". We use two specific signals:
   - `state.isStart` — the first event of a gesture. That's when we
     decide "mouse or trackpad" and stick with the verdict. Per-event
     classification doesn't work because Chrome's smooth-scrolling
     makes mouse wheel ticks indistinguishable from trackpad scrolls
     frame-by-frame (both can emit fractional deltaY with varying
     magnitudes).
   - `state.isMomentum` — OS-generated inertia events that continue
     after the user's fingers have lifted. Critically, these often
     drop `ctrlKey` partway through a pinch's decay. Skipping momentum
     for zoom prevents phantom pans after a pinch; keeping it for
     pan preserves the natural trackpad feel.

3. **Sticky device detection** (inside `attachCamera`) runs at
   `isStart` only, using `deltaMode`, presence of `deltaX`, and
   magnitude of `deltaY` as signals. Once picked — `mouse` or
   `trackpad` — the whole gesture uses that mode, so mid-flight
   event ambiguity can't flip the verdict.

### Coordinate-system discipline

The renderer's SVG uses a `viewBox` sized to the layout bounds with
`width="100%"` — so one viewBox user-space unit is NOT one CSS pixel.
d3-zoom's transform is applied as an SVG `transform=` attribute on
the viewport group, which is interpreted in user-space. The wheel
event's `clientX/Y` is in screen pixels. Passing the cursor to
d3-zoom directly drifts the zoom focus by the viewBox scale factor.

`attachCamera` converts cursor to user-space via
`svg.getScreenCTM().inverse()` and declares `zoom.extent` in user-space
too, so d3-zoom's internal math and the applied transform agree.

### Consumer summary

- **editor** — `attachCamera(svg)` with defaults (Miro/Figma UX).
- **docs/editor** — same, attached after the WebComponent's
  `customElements.whenDefined('shumoku-renderer')` resolves.
- **server/web TopologyViewer** — takes `camera?: CameraOptions | false`
  as a prop; passes through to `attachCamera`. Widget, detail page
  and share page all use this.
- **CLI / PNG / SSR** — don't mount a Svelte component, so never see
  `attachCamera`. d3-zoom isn't loaded at all in those paths.

---

## Known gaps

### Hierarchical / multi-sheet editing

`@shumoku/core` ships a `buildHierarchicalSheets()` function that
generates one sheet per top-level subgraph with boundary pins for
cross-sheet links. `@shumoku/renderer-html` uses this for static
multi-page export with click-through navigation.

**The editor does not yet drive the interactive flavour.** The Svelte
renderer (`@shumoku/renderer`) has no concept of "active sheet"; it
always renders the whole graph. The editor's runtime state now tracks
`currentSheetId` and the `SheetBar` lets users switch between the
root and each top-level subgraph, but the renderer keeps showing the
full graph regardless.

**Landed:**
- `diagramState.currentSheetId: string | null`
- `diagramState.availableSheets` — root + top-level subgraphs
- `diagramState.switchSheet(id | null)` — runs
  `buildHierarchicalSheets` for non-null ids, populates `sheetView`
- `diagramState.activeView` — root state or `sheetView`, bound by
  the editor's diagram page
- `SheetBar` renders the real tabs, click drills KiCad-style

When drilled in, the renderer sees the subgraph's filtered graph
with export-connector nodes for cross-boundary links. The editor
forces View mode while drilled in so the renderer's `$bindable`
writes don't land on the ephemeral sheet maps — edits stay on the
root sheet only for now.

**Not yet landed:**
- **Write-through editing on a sub-sheet.** Requires the renderer to
  stop relying on `$bindable` writes and become a pure view that
  emits events, which the editor then routes to the canonical root
  state (tracked under #98 "operations separation"). Until then,
  edits happen on the root sheet; sub-sheets are read-only.
- **Nested drill-down.** Clicking into a subgraph that is itself
  inside a sub-sheet would require another level of
  `buildHierarchicalSheets` or equivalent. Top-level only for now.
- **Sheet-specific autoarrange / add-node defaults / sheet-local
  positions.** Polish once write-through lands.

Why this wasn't finished earlier: the editor's MVP was a single
diagram, `SheetBar` was a UI placeholder during early iteration, and
subsequent refactors (#130-#142) focused on the single-diagram happy
path. No principled decision to defer — it was plain technical debt,
now partly paid down.
