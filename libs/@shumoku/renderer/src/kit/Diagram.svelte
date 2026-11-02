<script lang="ts">
  import { lightTheme, type Theme } from '@shumoku/core'
  import { type KitColors, kitColors } from './colors'
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
  import { vlanColors } from './wire-look'

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
  const colors: KitColors = $derived(kitColors(theme))
  const vlans = $derived(
    vlanColors(
      scene.wires.map((w) => w.link),
      colors.vlans,
    ),
  )
  const bounds = $derived(scene.bounds)
  const styleTag = $derived(`<style>${kitStyles(tokens, colors)}</style>`)
  const margin = $derived(tokens.margin)
  const viewBox = $derived(
    `${bounds.x - margin} ${bounds.y - margin} ${bounds.width + margin * 2} ${bounds.height + margin * 2}`,
  )
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
        flood-color={colors.shadow}
        flood-opacity={tokens.opacity.shadow}
      />
    </filter>
  </defs>

  {@html styleTag}

  <g class="viewport">
    {#each scene.groups as { group, box } (group.id)}
      <GroupFrame {group} {box} {colors} {tokens} />
    {/each}
    {#each scene.hulls ?? [] as hull}
      <Hull boxes={hull.boxes} seams={hull.seams} kind={hull.kind} {colors} {tokens} />
    {/each}
    {#each scene.wires as { link, points, radii, stroke }}
      <Wire {link} {points} {radii} {stroke} {vlans} {colors} {tokens} />
    {/each}
    {#each scene.wires as { link, label }}
      <WireCaption {link} at={label} {colors} {kit} />
    {/each}
    {#each scene.nodes as { node, box } (node.id)}
      <NodeCard {node} {box} {colors} {kit} />
    {/each}
    {#each scene.ports ?? [] as port (port.id)}
      <Port {...port} {colors} {kit} />
    {/each}
  </g>
</svg>
