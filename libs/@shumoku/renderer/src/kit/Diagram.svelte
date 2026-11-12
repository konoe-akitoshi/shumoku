<script lang="ts">
  import { lightTheme, type Theme } from '@shumoku/core'
  import type { Snippet } from 'svelte'
  import { type KitColors, kitColors } from './colors.js'
  import GroupFrame from './GroupFrame.svelte'
  import Hull from './Hull.svelte'
  import { createKit, type TextMetrics } from './measure.js'
  import NodeCard from './NodeCard.svelte'
  import Port from './Port.svelte'
  import PortCaption from './PortCaption.svelte'
  import { drawnPortKey } from './port-look.js'
  import type { Scene } from './scene.js'
  import { kitStyles } from './styles.js'
  import type { Base } from './tokens.js'
  import Wire from './Wire.svelte'
  import WireCaption from './WireCaption.svelte'
  import { vlanColors } from './wire-look.js'

  let {
    scene,
    theme = lightTheme,
    base,
    text,
    fit = false,
    styles = '',
    svgElement = $bindable<SVGSVGElement | null>(null),
    groupOverlay,
    wireOverlay,
    nodeOverlay,
    portOverlay,
    top,
  }: {
    scene: Scene
    theme?: Theme
    /** Body font size and base line width; the defaults when absent. */
    base?: Partial<Base>
    /** Measures text; an estimate from the base when absent. */
    text?: TextMetrics
    /** Fill the container instead of the size of the drawing (the viewer scales it with a camera). */
    fit?: boolean
    /** More style rules for the host, written after the kit's own. */
    styles?: string
    /** The drawn `<svg>`, for hosts that attach a camera or overlays to it. */
    svgElement?: SVGSVGElement | null
    /** Drawn over a group's frame, a wire, a card or a port, in the layer of the element. */
    groupOverlay?: Snippet<[Scene['groups'][number]]>
    wireOverlay?: Snippet<[Scene['wires'][number]]>
    nodeOverlay?: Snippet<[Scene['nodes'][number]]>
    portOverlay?: Snippet<[NonNullable<Scene['ports']>[number]]>
    /** Drawn above everything else, in the drawing's own coordinates (a selection marquee). */
    top?: Snippet
  } = $props()

  const kit = $derived(createKit(base, text))
  const tokens = $derived(kit.tokens)
  const colors: KitColors = $derived(kitColors(theme))
  const vlans = $derived(
    vlanColors(
      scene.wires.map((w) => w.link),
      colors.lineTone,
    ),
  )
  const bounds = $derived(scene.bounds)
  const styleTag = $derived(`<style>${kitStyles(tokens, colors)}${styles}</style>`)
  const margin = $derived(tokens.margin)
  const viewBox = $derived(
    `${bounds.x - margin} ${bounds.y - margin} ${bounds.width + margin * 2} ${bounds.height + margin * 2}`,
  )
</script>

<svg
  bind:this={svgElement}
  xmlns="http://www.w3.org/2000/svg"
  {viewBox}
  width={fit ? undefined : bounds.width + margin * 2}
  height={fit ? undefined : bounds.height + margin * 2}
  role="img"
  aria-label="Network topology diagram"
  style="{fit ? 'width: 100%; height: 100%; user-select: none; ' : ''}background: {colors.background};"
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
    {#each scene.groups as item (item.group.id)}
      <GroupFrame group={item.group} box={item.box} {colors} {tokens} />
      {@render groupOverlay?.(item)}
    {/each}
    {#each scene.hulls ?? [] as hull}
      <Hull boxes={hull.boxes} seams={hull.seams} kind={hull.kind} {colors} {tokens} />
    {/each}
    {#each scene.wires as wire}
      <Wire
        link={wire.link}
        points={wire.points}
        radii={wire.radii}
        stroke={wire.stroke}
        {vlans}
        {colors}
        {tokens}
      />
      {@render wireOverlay?.(wire)}
    {/each}
    {#each scene.wires as { link, label }}
      <WireCaption {link} at={label} {colors} {kit} />
    {/each}
    {#each scene.nodes as item (item.node.id)}
      <NodeCard node={item.node} box={item.box} header={item.header} {colors} {kit} />
      {@render nodeOverlay?.(item)}
    {/each}
    {#each scene.ports ?? [] as port (drawnPortKey(port))}
      <Port {...port} {colors} {kit} />
      {@render portOverlay?.(port)}
    {/each}
    {#each scene.captions ?? [] as caption (`${caption.nodeId}|${caption.side}`)}
      <PortCaption {...caption} {colors} {kit} />
    {/each}
    {@render top?.()}
  </g>
</svg>
