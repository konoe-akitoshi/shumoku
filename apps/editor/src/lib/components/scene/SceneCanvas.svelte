<script lang="ts">
  import { resolveIcon, specDeviceType } from '@shumoku/core'
  import { attachCamera } from '@shumoku/renderer'
  import { onDestroy, onMount } from 'svelte'
  import { Button } from '$lib/components/ui/button'
  import { diagramState, editorState } from '$lib/context.svelte'
  import { nodesInScope } from '$lib/scene/scope'
  import type { Scene } from '$lib/types'
  import { sceneAuthoring } from './scene-authoring.svelte'

  let {
    scene,
  }: {
    scene: Scene
  } = $props()

  let svgEl = $state<SVGSVGElement | null>(null)
  let camera: ReturnType<typeof attachCamera> | undefined

  // Authoring state (placement, wire waypoints, calibration capture)
  // is shared with SceneSideToolbar via this singleton.
  const auth = sceneAuthoring

  // Selection (single, by Node id for items / Link id for wires).
  let selectedItemId = $state<string | null>(null)
  let selectedWireId = $state<string | null>(null)

  // Drag state for items
  let dragging = $state<{ nodeId: string; offsetX: number; offsetY: number } | null>(null)
  // Drag state for wire control points
  let draggingControl = $state<{
    linkId: string
    index: number
    offsetX: number
    offsetY: number
  } | null>(null)

  const interactive = $derived(editorState.interactive)
  const bg = $derived(scene.background)
  const hiddenNodeIds = $derived(new Set(scene.hiddenNodeIds ?? []))
  const hiddenLinkIds = $derived(new Set(scene.hiddenLinkIds ?? []))
  // KiCad-style sheet semantics: scope filters to descendants, and
  // cross-boundary links render with the external endpoint shown as a
  // pill-shaped "export connector" labeled with the destination
  // subgraph (matches what Diagram does when drilled into a sheet).
  const inScope = $derived(
    nodesInScope(diagramState.nodes.values(), diagramState.subgraphs, scene.scopeSubgraphId),
  )
  const inScopeIds = $derived(new Set(inScope.map((n) => n.id)))
  const visibleNodes = $derived(inScope.filter((n) => !hiddenNodeIds.has(n.id)))
  const visibleLinks = $derived(
    diagramState.links.filter(
      (l) =>
        !!l.id &&
        !hiddenLinkIds.has(l.id) &&
        (inScopeIds.has(l.from.node) || inScopeIds.has(l.to.node)),
    ),
  )
  /** Pseudo node id for the export pill that represents "go to subgraph
   *  X" — KiCad merges multiple cross-boundary links to the same
   *  destination into a single pill. */
  function exportNodeId(destSubgraphId: string): string {
    return `__scene_export_${destSubgraphId}`
  }

  /** External Node → its destination subgraph (the pill it collapses
   *  into). Falls back to '__external__' for orphan nodes (no parent). */
  function destSubgraphFor(nodeId: string): string {
    const node = diagramState.nodes.get(nodeId)
    return node?.parent ?? '__external__'
  }

  /** Build the set of export pills (one per destination subgraph) and
   *  remember which external Node ids each pill represents. */
  const exportPills = $derived.by(() => {
    const groups = new Map<string, { destId: string; label: string; nodeIds: Set<string> }>()
    for (const l of visibleLinks) {
      for (const ep of [l.from.node, l.to.node]) {
        if (inScopeIds.has(ep)) continue
        const destId = destSubgraphFor(ep)
        const sg = diagramState.subgraphs.get(destId)
        const label =
          sg?.label ??
          (() => {
            const node = diagramState.nodes.get(ep)
            const lbl = Array.isArray(node?.label) ? node?.label[0] : node?.label
            return lbl ?? destId
          })()
        const existing = groups.get(destId) ?? { destId, label, nodeIds: new Set<string>() }
        existing.nodeIds.add(ep)
        groups.set(destId, existing)
      }
    }
    return [...groups.values()]
  })

  /** External Node id → the export pill (pseudo) id it maps to. */
  const externalToPill = $derived.by(() => {
    const m = new Map<string, string>()
    for (const pill of exportPills) {
      for (const id of pill.nodeIds) m.set(id, exportNodeId(pill.destId))
    }
    return m
  })

  function isCrossBoundary(linkFrom: string, linkTo: string): boolean {
    return !inScopeIds.has(linkFrom) || !inScopeIds.has(linkTo)
  }

  /**
   * Effective position for a node in this scene: a scene-local override
   * if present, otherwise the diagram (auto-layout) position. Lets a
   * freshly-added scene render every existing device at its diagram
   * position automatically — the user only sets overrides when they
   * want this scene to differ.
   */
  function positionFor(nodeId: string): { x: number; y: number } {
    // External Node → redirect to its export pill (one pill per
    // destination subgraph).
    const pillId = externalToPill.get(nodeId)
    if (pillId) return positionForPill(pillId)
    const override = scene.nodePlacements.find((p) => p.nodeId === nodeId)
    if (override) return override.position
    const node = diagramState.nodes.get(nodeId)
    return node?.position ?? { x: 100, y: 100 }
  }

  /** Resolve a pill's position. User-set placement wins; otherwise we
   *  spawn it near the average of in-scope endpoints connected to it. */
  function positionForPill(pillId: string): { x: number; y: number } {
    const override = scene.nodePlacements.find((p) => p.nodeId === pillId)
    if (override) return override.position
    // Default: average of connected in-scope nodes + offset so the
    // pill lands on the floor plan rather than at default coords.
    const inScopePartners: { x: number; y: number }[] = []
    for (const l of visibleLinks) {
      const fromIn = inScopeIds.has(l.from.node)
      const toIn = inScopeIds.has(l.to.node)
      if (fromIn && externalToPill.get(l.to.node) === pillId) {
        const placement = scene.nodePlacements.find((p) => p.nodeId === l.from.node)
        const pos = placement?.position ?? diagramState.nodes.get(l.from.node)?.position
        if (pos) inScopePartners.push(pos)
      } else if (toIn && externalToPill.get(l.from.node) === pillId) {
        const placement = scene.nodePlacements.find((p) => p.nodeId === l.to.node)
        const pos = placement?.position ?? diagramState.nodes.get(l.to.node)?.position
        if (pos) inScopePartners.push(pos)
      }
    }
    if (inScopePartners.length === 0) return { x: 100, y: 100 }
    const cx = inScopePartners.reduce((s, p) => s + p.x, 0) / inScopePartners.length
    const cy = inScopePartners.reduce((s, p) => s + p.y, 0) / inScopePartners.length
    return { x: cx + 80, y: cy - 60 }
  }

  // Compute viewBox: image extent (or fallback to derived bounds across
  // every node in the diagram, since they all show in the scene).
  const viewBox = $derived.by(() => {
    if (bg) return `0 0 ${bg.width} ${bg.height}`
    const nodeIds = [...diagramState.nodes.keys()]
    if (nodeIds.length === 0) return '0 0 800 600'
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    for (const id of nodeIds) {
      const p = positionFor(id)
      minX = Math.min(minX, p.x - 60)
      minY = Math.min(minY, p.y - 40)
      maxX = Math.max(maxX, p.x + 60)
      maxY = Math.max(maxY, p.y + 40)
    }
    return `${minX} ${minY} ${Math.max(maxX - minX, 200)} ${Math.max(maxY - minY, 200)}`
  })

  // Wire path generation (orthogonal / straight / free with optional waypoints)
  function wirePoints(link: { id?: string; from: { node: string }; to: { node: string } }): {
    points: { x: number; y: number }[]
    pathStyle: 'orthogonal' | 'straight' | 'free'
    controlPoints: { x: number; y: number }[]
  } | null {
    if (!link.id) return null
    const from = positionFor(link.from.node)
    const to = positionFor(link.to.node)
    const route = scene.wireRoutes.find((w) => w.linkId === link.id)
    const pathStyle = route?.pathStyle ?? 'orthogonal'
    const cps = route?.controlPoints ?? []
    if (pathStyle === 'orthogonal' && cps.length === 0) {
      return {
        points: [from, { x: to.x, y: from.y }, to],
        pathStyle,
        controlPoints: cps,
      }
    }
    return {
      points: [from, ...cps, to],
      pathStyle,
      controlPoints: cps,
    }
  }

  function pathD(points: { x: number; y: number }[]): string {
    if (points.length === 0) return ''
    const [first, ...rest] = points
    return `M ${first.x} ${first.y}${rest.map((p) => ` L ${p.x} ${p.y}`).join('')}`
  }

  // Convert client (mouse) coordinates to scene/SVG coordinates.
  function clientToScene(clientX: number, clientY: number): { x: number; y: number } {
    if (!svgEl) return { x: 0, y: 0 }
    const pt = svgEl.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const ctm = svgEl.getScreenCTM()
    if (!ctm) return { x: 0, y: 0 }
    const inv = ctm.inverse()
    const out = pt.matrixTransform(inv)
    return { x: out.x, y: out.y }
  }

  // ── interactions ──────────────────────────────────────────────

  function handleItemClick(nodeId: string, e: MouseEvent) {
    e.stopPropagation()
    if (!interactive) {
      selectedItemId = nodeId
      selectedWireId = null
      return
    }
    if (auth.pendingWireFrom && auth.pendingWireFrom !== nodeId) {
      // Final click on target item → create wire with accumulated
      // waypoints in 'free' style so the user's path is preserved.
      const waypoints = auth.pendingWireWaypoints
      const linkId = diagramState.addWireInScene(scene.id, auth.pendingWireFrom, nodeId, {
        pathStyle: waypoints.length > 0 ? 'free' : 'orthogonal',
        controlPoints: waypoints.length > 0 ? waypoints : undefined,
      })
      if (linkId) selectedWireId = linkId
      auth.pendingWireFrom = null
      auth.pendingWireWaypoints = []
      return
    }
    selectedItemId = nodeId
    selectedWireId = null
  }

  function handleItemPointerDown(nodeId: string, e: PointerEvent) {
    if (!interactive) return
    if (e.button !== 0) return
    const target = e.currentTarget as SVGGElement
    target.setPointerCapture(e.pointerId)
    const scenePt = clientToScene(e.clientX, e.clientY)
    const pos = positionFor(nodeId)
    dragging = {
      nodeId,
      offsetX: scenePt.x - pos.x,
      offsetY: scenePt.y - pos.y,
    }
  }

  function handlePointerMove(e: PointerEvent) {
    // Track cursor for live preview of pending wire / calibration.
    if (auth.pendingWireFrom || auth.calibrationMode) {
      auth.cursorScenePt = clientToScene(e.clientX, e.clientY)
    }
    if (dragging) {
      const scenePt = clientToScene(e.clientX, e.clientY)
      diagramState.placeNodeInScene(scene.id, dragging.nodeId, {
        x: scenePt.x - dragging.offsetX,
        y: scenePt.y - dragging.offsetY,
      })
    } else if (draggingControl) {
      const scenePt = clientToScene(e.clientX, e.clientY)
      const linkId = draggingControl.linkId
      const link = diagramState.links.find((l) => l.id === linkId)
      if (!link) return
      const route = scene.wireRoutes.find((w) => w.linkId === linkId) ?? {
        linkId,
        pathStyle: 'orthogonal' as const,
        controlPoints: [] as { x: number; y: number }[],
      }
      const cps = [...(route.controlPoints ?? [])]
      cps[draggingControl.index] = {
        x: scenePt.x - draggingControl.offsetX,
        y: scenePt.y - draggingControl.offsetY,
      }
      diagramState.setWireRoute(scene.id, { ...route, controlPoints: cps })
    }
  }

  function handlePointerUp() {
    dragging = null
    draggingControl = null
  }

  function handleBackgroundClick(e: MouseEvent) {
    const scenePt = clientToScene(e.clientX, e.clientY)
    if (auth.pendingPlacement) {
      if (auth.pendingPlacement.kind === 'product') {
        diagramState.placeProductInScene(scene.id, auth.pendingPlacement.productId, scenePt)
      } else {
        diagramState.addEmptyNodeInScene(scene.id, scenePt)
      }
      auth.pendingPlacement = null
      return
    }
    if (auth.calibrationMode) {
      if (!auth.calibrationMode.from) {
        auth.calibrationMode = { from: scenePt }
      } else {
        auth.calibrationPrompt = { from: auth.calibrationMode.from, to: scenePt }
        auth.calibrationMode = null
      }
      return
    }
    if (auth.pendingWireFrom) {
      // Background click while authoring a wire = add a waypoint.
      auth.pendingWireWaypoints = [...auth.pendingWireWaypoints, scenePt]
      return
    }
    selectedItemId = null
    selectedWireId = null
  }

  function commitCalibration() {
    if (!auth.calibrationPrompt) return
    const meters = Number(auth.calibrationMeters)
    if (!Number.isFinite(meters) || meters <= 0) {
      auth.calibrationPrompt = null
      auth.calibrationMeters = ''
      return
    }
    const dx = auth.calibrationPrompt.to.x - auth.calibrationPrompt.from.x
    const dy = auth.calibrationPrompt.to.y - auth.calibrationPrompt.from.y
    const px = Math.hypot(dx, dy)
    if (px <= 0) {
      auth.calibrationPrompt = null
      auth.calibrationMeters = ''
      return
    }
    diagramState.updateScene(scene.id, {
      calibration: {
        pxPerMeter: px / meters,
        reference: { from: auth.calibrationPrompt.from, to: auth.calibrationPrompt.to, meters },
      },
    })
    auth.calibrationPrompt = null
    auth.calibrationMeters = ''
  }

  /** Polyline length in scene px → meters (only when calibrated). */
  function polylineMeters(points: { x: number; y: number }[]): number | null {
    if (!scene.calibration) return null
    let len = 0
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]
      const b = points[i]
      if (!a || !b) continue
      len += Math.hypot(b.x - a.x, b.y - a.y)
    }
    return len / scene.calibration.pxPerMeter
  }

  function startWireFrom(nodeId: string) {
    auth.pendingWireFrom = nodeId
  }

  function handleControlPointerDown(linkId: string, index: number, e: PointerEvent) {
    if (!interactive) return
    if (e.button !== 0) return
    e.stopPropagation()
    const target = e.currentTarget as SVGElement
    target.setPointerCapture(e.pointerId)
    const route = scene.wireRoutes.find((w) => w.linkId === linkId)
    const cp = route?.controlPoints?.[index]
    if (!cp) return
    const scenePt = clientToScene(e.clientX, e.clientY)
    draggingControl = {
      linkId,
      index,
      offsetX: scenePt.x - cp.x,
      offsetY: scenePt.y - cp.y,
    }
  }

  function handleWireClick(linkId: string, e: MouseEvent) {
    e.stopPropagation()
    selectedWireId = linkId
    selectedItemId = null
  }

  // Add a midpoint when double-clicking the wire path. Creates a route
  // override on demand so the user doesn't need a pre-existing one.
  function handleWireDblClick(linkId: string, e: MouseEvent) {
    if (!interactive) return
    e.stopPropagation()
    const scenePt = clientToScene(e.clientX, e.clientY)
    const route = scene.wireRoutes.find((w) => w.linkId === linkId) ?? {
      linkId,
      pathStyle: 'orthogonal' as const,
      controlPoints: [] as { x: number; y: number }[],
    }
    const cps = [...(route.controlPoints ?? []), scenePt]
    diagramState.setWireRoute(scene.id, { ...route, controlPoints: cps })
    selectedWireId = linkId
  }

  function deleteSelected() {
    if (selectedWireId) {
      // Hide the wire from this scene only. Topology stays intact.
      diagramState.hideLinkInScene(scene.id, selectedWireId)
      selectedWireId = null
    } else if (selectedItemId) {
      // Hide the item from this scene only. Topology stays intact;
      // unhide via 'Show all' in the toolbar (TODO).
      diagramState.hideNodeInScene(scene.id, selectedItemId)
      selectedItemId = null
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!interactive) return
    if (e.key === 'Escape') {
      auth.pendingWireFrom = null
      auth.pendingWireWaypoints = []
      auth.pendingPlacement = null
      auth.calibrationMode = null
      auth.calibrationPrompt = null
      selectedItemId = null
      selectedWireId = null
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const target = e.target as HTMLElement | null
      if (target && /input|textarea/i.test(target.tagName)) return
      deleteSelected()
    }
  }

  // Camera
  onMount(() => {
    if (svgEl) camera = attachCamera(svgEl)
    window.addEventListener('keydown', handleKeydown)
  })
  onDestroy(() => {
    camera?.detach()
    window.removeEventListener('keydown', handleKeydown)
  })

  function pendingLabel(): string {
    const pending = auth.pendingPlacement
    if (!pending) return ''
    if (pending.kind === 'empty') return 'Click to place an empty node'
    const product = diagramState.products.find((p) => p.id === pending.productId)
    if (!product) return 'Click to place'
    const detail =
      product.kind === 'device' ? (product.spec.vendor ?? product.spec.kind) : product.kind
    return `Click to place: ${detail}`
  }
</script>

<div class="relative h-full w-full">
  <svg
    bind:this={svgEl}
    xmlns="http://www.w3.org/2000/svg"
    {viewBox}
    role="img"
    aria-label="Scene canvas"
    class="h-full w-full select-none"
    style="background: #f8fafc; cursor: {auth.pendingPlacement ? 'crosshair' : 'default'};"
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onclick={handleBackgroundClick}
  >
    <g class="viewport">
      {#if bg}
        <image
          href={bg.src}
          x={0}
          y={0}
          width={bg.width}
          height={bg.height}
          pointer-events="none"
        />
      {/if}

      <!-- Wires (under items): every visible diagram link renders here -->
      {#each visibleLinks as link (link.id)}
        {#if link.id}
          {@const linkId = link.id}
          {@const wp = wirePoints(link)}
          {#if wp}
            {@const isSelected = selectedWireId === linkId}
            {@const crossBoundary = isCrossBoundary(link.from.node, link.to.node)}
            <g class="wire">
              <!-- hit area -->
              <path
                d={pathD(wp.points)}
                stroke="transparent"
                stroke-width="14"
                fill="none"
                style:cursor={interactive ? 'pointer' : 'default'}
                onclick={(e) => handleWireClick(linkId, e)}
                ondblclick={(e) => handleWireDblClick(linkId, e)}
              />
              <path
                d={pathD(wp.points)}
                stroke={isSelected ? '#3b82f6' : '#475569'}
                stroke-width={isSelected ? 2.5 : 2}
                fill="none"
                stroke-dasharray={crossBoundary ? '5 3' : ''}
                pointer-events="none"
              />
              {#if isSelected}
                {#each wp.controlPoints as cp, idx (idx)}
                  <circle
                    cx={cp.x}
                    cy={cp.y}
                    r="5"
                    fill="white"
                    stroke="#3b82f6"
                    stroke-width="1.5"
                    style:cursor="grab"
                    onpointerdown={(e) => handleControlPointerDown(linkId, idx, e)}
                  />
                {/each}
              {/if}
              <!-- Length label at the polyline midpoint (calibrated only) -->
              {#if scene.calibration}
                {@const meters = polylineMeters(wp.points)}
                {#if meters !== null && wp.points.length >= 2}
                  {@const midIdx = Math.floor(wp.points.length / 2)}
                  {@const a = wp.points[midIdx - 1] ?? wp.points[0]}
                  {@const b = wp.points[midIdx] ?? wp.points[wp.points.length - 1]}
                  {#if a && b}
                    {@const mx = (a.x + b.x) / 2}
                    {@const my = (a.y + b.y) / 2}
                    {@const text = `${meters.toFixed(meters < 10 ? 1 : 0)} m`}
                    {@const tw = text.length * 6 + 8}
                    <rect
                      x={mx - tw / 2}
                      y={my - 8}
                      width={tw}
                      height={14}
                      rx="3"
                      ry="3"
                      fill="rgba(255,255,255,0.92)"
                      stroke="rgba(15,23,42,0.12)"
                      stroke-width="0.5"
                      pointer-events="none"
                    />
                    <text
                      x={mx}
                      y={my + 2}
                      text-anchor="middle"
                      font-size="10"
                      fill="#475569"
                      pointer-events="none"
                    >
                      {text}
                    </text>
                  {/if}
                {/if}
              {/if}
            </g>
          {/if}
        {/if}
      {/each}

      <!-- Pending wire preview: source halo + accumulated polyline +
           ghost segment to the cursor -->
      {#if auth.pendingWireFrom}
        {@const fromPos = positionFor(auth.pendingWireFrom)}
        {@const previewPoints = [
          fromPos,
          ...auth.pendingWireWaypoints,
          ...(auth.cursorScenePt ? [auth.cursorScenePt] : []),
        ]}
        <path
          d={pathD(previewPoints)}
          stroke="#3b82f6"
          stroke-width="2"
          stroke-dasharray="6 4"
          fill="none"
          pointer-events="none"
          opacity="0.7"
        />
        <circle
          cx={fromPos.x}
          cy={fromPos.y}
          r="14"
          fill="rgba(59,130,246,0.18)"
          stroke="#3b82f6"
          stroke-dasharray="3 3"
        />
        {#each auth.pendingWireWaypoints as wp, idx (idx)}
          <circle cx={wp.x} cy={wp.y} r="3" fill="#3b82f6" pointer-events="none" />
        {/each}
      {/if}

      <!-- Calibration capture preview -->
      {#if auth.calibrationMode?.from && auth.cursorScenePt}
        <line
          x1={auth.calibrationMode.from.x}
          y1={auth.calibrationMode.from.y}
          x2={auth.cursorScenePt.x}
          y2={auth.cursorScenePt.y}
          stroke="#f59e0b"
          stroke-width="2"
          stroke-dasharray="6 4"
          pointer-events="none"
        />
        <circle
          cx={auth.calibrationMode.from.x}
          cy={auth.calibrationMode.from.y}
          r="4"
          fill="#f59e0b"
        />
      {/if}
      {#if auth.calibrationPrompt}
        <line
          x1={auth.calibrationPrompt.from.x}
          y1={auth.calibrationPrompt.from.y}
          x2={auth.calibrationPrompt.to.x}
          y2={auth.calibrationPrompt.to.y}
          stroke="#f59e0b"
          stroke-width="2"
          pointer-events="none"
        />
      {/if}
      {#if scene.calibration?.reference}
        <!-- Persistent reference indicator: thin, faint amber line. -->
        {@const ref = scene.calibration.reference}
        <line
          x1={ref.from.x}
          y1={ref.from.y}
          x2={ref.to.x}
          y2={ref.to.y}
          stroke="rgba(245,158,11,0.5)"
          stroke-width="1"
          stroke-dasharray="3 3"
          pointer-events="none"
        />
      {/if}

      <!-- Items: rendered as floor-plan pins (icon + label, no box).
           Position falls through to Node.position when the scene has
           no per-node override yet. -->
      {#each visibleNodes as node (node.id)}
        {@const pos = positionFor(node.id)}
        {@const icon = resolveIcon(node.spec)}
        {@const label = Array.isArray(node.label) ? node.label[0] : (node.label ?? node.id)}
        {@const isSelected = selectedItemId === node.id}
        {@const isWireSrc = auth.pendingWireFrom === node.id}
        {@const iconSize = 36}
        {@const half = iconSize / 2}
        {@const labelChars = (label ?? '').length}
        {@const labelW = Math.max(28, labelChars * 6 + 8)}
        <g
          class="scene-item"
          transform="translate({pos.x}, {pos.y})"
          style:cursor={interactive ? 'grab' : 'default'}
          onpointerdown={(e) => handleItemPointerDown(node.id, e)}
          onclick={(e) => handleItemClick(node.id, e)}
          ondblclick={(e) => {
            e.stopPropagation()
            startWireFrom(node.id)
          }}
        >
          <!-- Selection / wire-source halo (under the icon) -->
          {#if isSelected || isWireSrc}
            <circle
              cx="0"
              cy="0"
              r={half + 4}
              fill="none"
              stroke={isSelected ? '#3b82f6' : '#10b981'}
              stroke-width="2"
              stroke-dasharray={isWireSrc ? '4 3' : ''}
            />
          {/if}

          {#if icon}
            {#if icon.kind === 'inline'}
              <svg
                x={-half}
                y={-half}
                width={iconSize}
                height={iconSize}
                viewBox="0 0 24 24"
                fill="currentColor"
                role="img"
                aria-label={specDeviceType(node.spec) ?? 'icon'}
                style:color="#1e293b"
                style:filter="drop-shadow(0 1px 1px rgba(0,0,0,0.25))"
              >
                {@html icon.svg}
              </svg>
            {:else}
              <image
                href={icon.url}
                x={-half}
                y={-half}
                width={iconSize}
                height={iconSize}
                preserveAspectRatio="xMidYMid meet"
                style:filter="drop-shadow(0 1px 1px rgba(0,0,0,0.25))"
              />
            {/if}
          {:else}
            <!-- Iconless fallback: subtle dot so the pin is still grabbable -->
            <circle cx="0" cy="0" r={half - 6} fill="white" stroke="#94a3b8" stroke-width="1.5" />
          {/if}

          <!-- Label background pill (so text reads on busy floor plans) -->
          {#if label}
            <rect
              x={-labelW / 2}
              y={half + 2}
              width={labelW}
              height={14}
              rx="3"
              ry="3"
              fill="rgba(255,255,255,0.92)"
              stroke="rgba(15,23,42,0.08)"
              stroke-width="0.5"
              pointer-events="none"
            />
            <text
              x="0"
              y={half + 12}
              text-anchor="middle"
              font-size="10"
              fill="#0f172a"
              pointer-events="none"
            >
              {label}
            </text>
          {/if}
        </g>
      {/each}

      <!-- Boundary export connectors: one stadium-pill per destination
           subgraph (mirrors Diagram drill-down — multiple cross-boundary
           links to the same subgraph collapse into a single pill). -->
      {#each exportPills as pill (pill.destId)}
        {@const pillId = exportNodeId(pill.destId)}
        {@const pos = positionForPill(pillId)}
        {@const label = pill.label}
        {@const isSelected = selectedItemId === pillId}
        {@const isWireSrc = auth.pendingWireFrom === pillId}
        {@const labelChars = label.length}
        {@const w = Math.max(56, labelChars * 6.5 + 18)}
        {@const h = 22}
        {@const r = h / 2}
        <g
          class="scene-export"
          transform="translate({pos.x}, {pos.y})"
          style:cursor={interactive ? 'grab' : 'default'}
          onpointerdown={(e) => handleItemPointerDown(pillId, e)}
          onclick={(e) => handleItemClick(pillId, e)}
          ondblclick={(e) => {
            e.stopPropagation()
            startWireFrom(pillId)
          }}
        >
          {#if isSelected || isWireSrc}
            <rect
              x={-w / 2 - 3}
              y={-h / 2 - 3}
              width={w + 6}
              height={h + 6}
              rx={r + 3}
              ry={r + 3}
              fill="none"
              stroke={isSelected ? '#3b82f6' : '#10b981'}
              stroke-width="2"
              stroke-dasharray={isWireSrc ? '4 3' : ''}
            />
          {/if}
          <rect
            x={-w / 2}
            y={-h / 2}
            width={w}
            height={h}
            rx={r}
            ry={r}
            fill="white"
            stroke="#94a3b8"
            stroke-width="1.25"
          />
          <text
            x="0"
            y="3.5"
            text-anchor="middle"
            font-size="10.5"
            fill="#475569"
            pointer-events="none"
          >
            {label}
          </text>
        </g>
      {/each}
    </g>
  </svg>

  <!-- Authoring affordances (Place / Calibrate / Show hidden) live in
       the right-side SceneSideToolbar. The canvas only owns this
       small status hint and the in-context calibration prompt. -->
  {#if auth.pendingPlacement || auth.calibrationMode || auth.pendingWireFrom}
    <div
      class="pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-neutral-200 bg-white/90 px-3 py-1 text-[11px] text-neutral-700 shadow backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-800/90 dark:text-neutral-200"
    >
      {#if auth.pendingPlacement}
        {pendingLabel()}
      {:else if auth.calibrationMode && !auth.calibrationMode.from}
        Click the first reference point
      {:else if auth.calibrationMode?.from}
        Click the second reference point
      {:else if auth.pendingWireFrom}
        Click waypoints, then the target item (Esc to cancel)
      {/if}
    </div>
  {/if}

  <!-- Calibration distance prompt -->
  {#if auth.calibrationPrompt}
    <div
      class="absolute top-16 left-1/2 z-10 -translate-x-1/2 rounded-xl border border-neutral-200 bg-white p-3 shadow-2xl dark:border-neutral-700 dark:bg-neutral-800"
    >
      <div class="mb-2 text-xs font-medium">How long is this segment?</div>
      <div class="flex items-center gap-2">
        <input
          type="number"
          min="0"
          step="0.1"
          inputmode="decimal"
          class="w-24 rounded border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
          placeholder="meters"
          bind:value={auth.calibrationMeters}
          onkeydown={(e) => {
              if (e.key === 'Enter') commitCalibration()
            }}
        >
        <span class="text-xs text-muted-foreground">m</span>
        <Button size="sm" onclick={commitCalibration}>Save</Button>
        <Button
          size="sm"
          variant="ghost"
          onclick={() => {
              auth.calibrationPrompt = null
              auth.calibrationMeters = ''
            }}
        >
          Cancel
        </Button>
      </div>
    </div>
  {/if}
</div>
