<script lang="ts">
  /**
   * HA / stack glasses hull — one solid silhouette per redundancy group,
   * drawn behind the member nodes (between the subgraph fills and the
   * edges). Pure decoration: pointer-events none, so hit-testing on nodes,
   * ports and the seam link is untouched. Geometry comes from core's
   * `buildHaHullPath` so the static renderer can emit the exact same shape.
   */
  import type { Node, ResolvedEdge } from '@shumoku/core'
  import { buildHaHullPath, groupCouplingPairs, resolveNodeSize } from '@shumoku/core'
  import type { RenderColors } from '../../lib/render-colors'

  let {
    edges,
    nodes,
    colors,
  }: {
    edges: Map<string, ResolvedEdge>
    nodes: Map<string, Node>
    colors: RenderColors
  } = $props()

  interface HullGroup {
    id: string
    kind: string
    d: string
    labelX: number
    labelY: number
  }

  const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`)

  const groups: HullGroup[] = $derived.by(() => {
    const pairs: Array<{ a: string; b: string; kind?: string }> = []
    const seamYByPair = new Map<string, number>()
    for (const edge of edges.values()) {
      if (!edge.coupling) continue
      pairs.push({ a: edge.fromNodeId, b: edge.toNodeId, kind: edge.link?.redundancy })
      seamYByPair.set(
        pairKey(edge.fromNodeId, edge.toNodeId),
        (edge.fromPort.absolutePosition.y + edge.toPort.absolutePosition.y) / 2,
      )
    }
    if (pairs.length === 0) return []

    const out: HullGroup[] = []
    for (const group of groupCouplingPairs(pairs)) {
      const placed: Array<{ id: string; x: number; y: number; width: number; height: number }> = []
      for (const id of group.members) {
        const node = nodes.get(id)
        if (!node?.position) continue
        const size = resolveNodeSize(node)
        placed.push({
          id,
          x: node.position.x - size.width / 2,
          y: node.position.y - size.height / 2,
          width: size.width,
          height: size.height,
        })
      }
      if (placed.length === 0) continue
      placed.sort((a, b) => a.x + a.width / 2 - (b.x + b.width / 2))

      const seams: Array<{ y: number }> = []
      for (let i = 0; i < placed.length - 1; i++) {
        const left = placed[i]
        const right = placed[i + 1]
        if (!left || !right) continue
        const y = seamYByPair.get(pairKey(left.id, right.id))
        seams.push({ y: y ?? (left.y + left.height / 2 + right.y + right.height / 2) / 2 })
      }

      const hull = buildHaHullPath({ members: placed, seams })
      out.push({
        id: placed.map((m) => m.id).join('+'),
        kind: (group.kind ?? 'ha').toUpperCase(),
        d: hull.d,
        labelX: hull.bounds.x + 2,
        labelY: hull.bounds.y - 6,
      })
    }
    return out
  })
</script>

{#each groups as group (group.id)}
  <g class="ha-hull" pointer-events="none">
    <path d={group.d} fill={colors.haHullFill} />
    <text
      class="ha-hull-label"
      x={group.labelX}
      y={group.labelY}
      font-size="9"
      letter-spacing="0.08em"
      fill={colors.textSecondary}
    >
      {group.kind}
    </text>
  </g>
{/each}

<style>
  .ha-hull-label {
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-weight: 600;
    user-select: none;
  }
</style>
