<script lang="ts">
  import { lightTheme, type Theme } from '@shumoku/core'
  import { type RenderColors, themeToColors } from '../lib/render-colors'
  import GroupFrame from './GroupFrame.svelte'
  import Hull from './Hull.svelte'
  import { createKit, type TextMetrics } from './measure'
  import NodeCard from './NodeCard.svelte'
  import Port from './Port.svelte'
  import type { Scene } from './scene'
  import { kitStyles } from './styles'
  import type { Base } from './tokens'
  import Wire from './Wire.svelte'
  import WireCaption from './WireCaption.svelte'

  let {
    scene,
    theme = lightTheme,
    base,
    text,
  }: {
    scene: Scene
    theme?: Theme
    /** Body font size and base line width; the defaults when absent. */
    base?: Partial<Base>
    /** Measures text; an estimate from the base when absent. */
    text?: TextMetrics
  } = $props()

  const kit = $derived(createKit(base, text))
  const tokens = $derived(kit.tokens)
  const colors: RenderColors = $derived(themeToColors(theme))
  const bounds = $derived(scene.bounds)
  const styleTag = $derived(`<style>${kitStyles(tokens, colors)}</style>`)
  const margin = $derived(tokens.margin)
  const viewBox = $derived(
    `${bounds.x - margin} ${bounds.y - margin} ${bounds.width + margin * 2} ${bounds.height + margin * 2}`,
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
  width={bounds.width + margin * 2}
  height={bounds.height + margin * 2}
  role="img"
  aria-label="Network topology diagram"
  style="background: {colors.background};"
>
  <defs>
    <filter id="node-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow
        dx="0"
        dy={tokens.shadow.dy}
        stdDeviation={tokens.shadow.blur}
        flood-color="#101828"
        flood-opacity={tokens.opacity.shadow}
      />
    </filter>
  </defs>

  {@html styleTag}

  <g class="viewport">
    {#each scene.groups as { group, box } (group.id)}
      <GroupFrame {group} {box} {colors} {theme} {tokens} />
    {/each}
    {#each hulls as hull}
      <Hull members={hull.members} seams={hull.seams} kind={hull.kind} {colors} {tokens} />
    {/each}
    {#each scene.wires as { link, points }}
      <Wire {link} {points} {colors} {tokens} />
    {/each}
    {#each scene.wires as { link, points, captionAt }}
      <WireCaption {link} {points} at={captionAt} {colors} {kit} />
    {/each}
    {#each scene.nodes as { node, box } (node.id)}
      <NodeCard {node} {box} {colors} {kit} />
    {/each}
    {#each scene.ports ?? [] as port (port.id)}
      <Port {...port} {colors} {kit} />
    {/each}
  </g>
</svg>
