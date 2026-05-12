<script lang="ts">
  import { diagramState } from '$lib/context.svelte'
  import { sceneNodeSize } from '$lib/scene/node-geometry'
  import { nodesInScope } from '$lib/scene/scope'
  import type { Scene } from '$lib/types'

  /**
   * Static, print-only composite of one Scene.
   *
   * The interactive Svelte Flow canvas (`<SceneCanvas>`) has its
   * own viewport (`x`, `y`, `zoom`) state, which makes "what does
   * Cmd+P render?" ambiguous: it could be whatever's currently
   * panned-into-view, often only a fraction of the floor plan.
   * For print we want the **whole scene** every time, scaled to
   * fit a single A4 landscape page.
   *
   * Implementation: render an `<img>` for the background (so the
   * browser handles raster decoding the same way it does onscreen)
   * with an absolutely-positioned SVG overlay above it. The SVG
   * uses the scene's native pixel coordinates as its viewBox, and
   * the CSS `width / height` of both layers fills the container —
   * `@media print` constrains the container itself to the printable
   * area.
   *
   * What's deliberately simple here:
   *   - Nodes render as a rect + a single text line (label). No
   *     icon, no per-device colour. The user wants something
   *     they can write on with a pen; icon fidelity isn't worth
   *     the extra surface area.
   *   - Wires are straight lines between node centres. The
   *     interactive bezier shape is purely visual; for a print-
   *     out used as a cabling worksheet, a straight chord is
   *     less ambiguous about which node connects to which.
   */
  let { scene }: { scene: Scene } = $props()

  // Background image dimensions; everything else lives in this
  // coordinate space.
  const bg = $derived(scene.background)

  // Same scope filter as the interactive scene canvas — only nodes
  // inside the scene's bound subgraph render as pins, plus any
  // external endpoint pulled in by a cross-boundary link.
  const inScope = $derived(
    nodesInScope(diagramState.nodes.values(), diagramState.subgraphs, scene.scopeSubgraphId),
  )
  const inScopeIds = $derived(new Set(inScope.map((n) => n.id)))
  const hiddenLinkIds = $derived(new Set(scene.hiddenLinkIds ?? []))
  const hiddenNodeIds = $derived(new Set(scene.hiddenNodeIds ?? []))

  const visibleLinks = $derived(
    diagramState.links.filter(
      (l) =>
        !!l.id &&
        !hiddenLinkIds.has(l.id) &&
        (inScopeIds.has(l.from.node) || inScopeIds.has(l.to.node)),
    ),
  )

  const visibleNodes = $derived.by(() => {
    const ids = new Set<string>()
    const out: typeof inScope = []
    for (const n of inScope) {
      if (hiddenNodeIds.has(n.id)) continue
      ids.add(n.id)
      out.push(n)
    }
    for (const l of visibleLinks) {
      for (const ep of [l.from.node, l.to.node]) {
        if (ids.has(ep)) continue
        const node = diagramState.nodes.get(ep)
        if (!node) continue
        ids.add(ep)
        out.push(node)
      }
    }
    return out
  })

  // Position resolution: explicit placement → node.position
  // fallback. Mirrors `SceneCanvas.positionFor`.
  const placementById = $derived.by(() => {
    const m = new Map<string, { x: number; y: number }>()
    for (const p of scene.nodePlacements) m.set(p.nodeId, p.position)
    return m
  })

  function positionFor(nodeId: string): { x: number; y: number } {
    const override = placementById.get(nodeId)
    if (override) return override
    const node = diagramState.nodes.get(nodeId)
    return node?.position ?? { x: 100, y: 100 }
  }

  const sceneNodeScale = $derived(scene.display?.nodeScale ?? 1)
  function effSize(nodeId: string): { w: number; h: number } {
    const base = sceneNodeSize(diagramState.nodes.get(nodeId))
    const ov = diagramState.nodes.get(nodeId)?.metadata?.['displayScale']
    const s = typeof ov === 'number' && ov > 0 ? ov : sceneNodeScale
    return { w: base.w * s, h: base.h * s }
  }

  // Node centres for drawing cable lines.
  function centerOf(nodeId: string): { x: number; y: number } {
    const tl = positionFor(nodeId)
    const { w, h } = effSize(nodeId)
    return { x: tl.x + w / 2, y: tl.y + h / 2 }
  }

  // Fallback viewBox when there's no background: tight box around
  // node positions with padding.
  const fallbackBox = $derived.by(() => {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const n of visibleNodes) {
      const p = positionFor(n.id)
      const { w, h } = effSize(n.id)
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x + w)
      maxY = Math.max(maxY, p.y + h)
    }
    if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 1000, h: 700 }
    const pad = 40
    return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 }
  })

  const sceneW = $derived(bg?.width ?? fallbackBox.w)
  const sceneH = $derived(bg?.height ?? fallbackBox.h)
  const viewBox = $derived(
    bg
      ? `0 0 ${bg.width} ${bg.height}`
      : `${fallbackBox.x} ${fallbackBox.y} ${fallbackBox.w} ${fallbackBox.h}`,
  )
</script>

<div class="scene-print" style:--scene-aspect={`${sceneW} / ${sceneH}`}>
  {#if bg}
    <img class="scene-print__bg" src={bg.src} alt="" loading="eager" decoding="sync">
  {/if}
  <svg
    class="scene-print__overlay"
    {viewBox}
    preserveAspectRatio="xMidYMid meet"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Scene cabling overlay"
  >
    <!-- Cables: straight chords between node centres. -->
    {#each visibleLinks as link (link.id)}
      {@const a = centerOf(link.from.node)}
      {@const b = centerOf(link.to.node)}
      <line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke="#1f2937"
        stroke-width={1.5}
        vector-effect="non-scaling-stroke"
      />
    {/each}

    <!-- Nodes: rect + label. -->
    {#each visibleNodes as n (n.id)}
      {@const p = positionFor(n.id)}
      {@const s = effSize(n.id)}
      {@const label = Array.isArray(n.label) ? (n.label[0] ?? n.id) : (n.label ?? n.id)}
      <g transform={`translate(${p.x}, ${p.y})`}>
        <rect
          x={0}
          y={0}
          width={s.w}
          height={s.h}
          fill="#ffffff"
          fill-opacity={0.85}
          stroke="#111827"
          stroke-width={1}
          vector-effect="non-scaling-stroke"
          rx={4}
        />
        <text
          x={s.w / 2}
          y={s.h / 2 + 4}
          text-anchor="middle"
          font-size={12}
          font-family="ui-sans-serif, system-ui, sans-serif"
          fill="#111827"
        >
          {label}
        </text>
      </g>
    {/each}
  </svg>
</div>

<style>
  .scene-print {
    position: relative;
    width: 100%;
    aspect-ratio: var(--scene-aspect, auto);
    max-width: 100%;
    max-height: 100%;
  }
  .scene-print__bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .scene-print__overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
</style>
