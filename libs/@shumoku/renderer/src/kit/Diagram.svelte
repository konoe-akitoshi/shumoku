<script lang="ts">
  import { lightTheme, type Theme } from '@shumoku/core'
  import { type RenderColors, themeToColors } from '../lib/render-colors'
  import GroupFrame from './GroupFrame.svelte'
  import Hull from './Hull.svelte'
  import { estimateText, type TextMetrics } from './measure'
  import NodeCard from './NodeCard.svelte'
  import Port from './Port.svelte'
  import type { Scene } from './scene'
  import Wire from './Wire.svelte'
  import WireCaption from './WireCaption.svelte'

  let {
    scene,
    theme = lightTheme,
    text = estimateText,
  }: {
    scene: Scene
    theme?: Theme
    text?: TextMetrics
  } = $props()

  /** Air around the drawing so strokes and port labels at its edge are not cut. */
  const MARGIN = 50

  const colors: RenderColors = $derived(themeToColors(theme))
  const bounds = $derived(scene.bounds)
  const viewBox = $derived(
    `${bounds.x - MARGIN} ${bounds.y - MARGIN} ${bounds.width + MARGIN * 2} ${bounds.height + MARGIN * 2}`,
  )

  /** Each hull with its members' boxes (left to right) and where the wires between them cross. */
  const hulls = $derived.by(() => {
    const boxes = new Map(scene.nodes.map(({ node, box }) => [node.id, box]))
    return (scene.hulls ?? []).map((hull) => {
      const members = hull.members
        .flatMap((id) => {
          const box = boxes.get(id)
          return box ? [{ id, box }] : []
        })
        .sort((a, b) => a.box.x + a.box.width / 2 - (b.box.x + b.box.width / 2))
      const seams = members.flatMap((left, i) => {
        const right = members[i + 1]
        if (!right) return []
        const wire = scene.wires.find(({ link }) => {
          const ends = [link.from.node, link.to.node]
          return ends.includes(left.id) && ends.includes(right.id)
        })
        const first = wire?.points[0]
        const last = wire?.points[wire.points.length - 1]
        const y = first && last ? (first.y + last.y) / 2 : undefined
        return [
          { y: y ?? (left.box.y + left.box.height / 2 + right.box.y + right.box.height / 2) / 2 },
        ]
      })
      return { members: members.map((m) => m.box), seams, kind: hull.kind }
    })
  })
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  {viewBox}
  width={bounds.width + MARGIN * 2}
  height={bounds.height + MARGIN * 2}
  role="img"
  aria-label="Network topology diagram"
  style="background: {colors.background};"
>
  <defs>
    <filter id="node-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#101828" flood-opacity="0.06" />
    </filter>
  </defs>

  {@html `<style>
    .node-label { font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif; font-size: 14px; font-weight: 600; fill: ${colors.nodeText}; }
    .node-label-bold { font-weight: 700; }
    .node-label-secondary { font-family: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace; font-size: 10px; font-weight: 400; fill: ${colors.nodeTextSecondary}; }
    .node-subtitle, .node-fact-key { font-family: system-ui, "Segoe UI", Arial, sans-serif; font-size: 10px; fill: ${colors.nodeTextSecondary}; }
    .node-fact-value { font-family: ui-monospace, Consolas, monospace; font-size: 10px; fill: ${colors.nodeText}; }
    .node-badge text { font-family: ui-monospace, Consolas, monospace; font-size: 9px; font-weight: 600; fill: ${colors.nodeText}; }
    .node-icon { color: ${colors.nodeTextSecondary}; }
    .subgraph-label { font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .link-label { font-family: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace; font-size: 10px; fill: ${colors.textSecondary}; }
    .port-label-text { font-family: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace; }
    .ha-hull-label { font-family: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace; font-weight: 600; }
  </style>`}

  <g class="viewport">
    {#each scene.groups as { group, box } (group.id)}
      <GroupFrame {group} {box} {colors} {theme} />
    {/each}
    {#each hulls as hull}
      <Hull members={hull.members} seams={hull.seams} kind={hull.kind} {colors} />
    {/each}
    {#each scene.wires as { link, points }}
      <Wire {link} {points} {colors} />
    {/each}
    {#each scene.wires as { link, points, captionAt }}
      <WireCaption {link} {points} at={captionAt} {colors} {text} />
    {/each}
    {#each scene.nodes as { node, box } (node.id)}
      <NodeCard {node} {box} {colors} {text} />
    {/each}
    {#each scene.ports ?? [] as port (port.id)}
      <Port {...port} {colors} {text} />
    {/each}
  </g>
</svg>
