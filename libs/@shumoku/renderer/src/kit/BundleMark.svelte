<script lang="ts">
  import type { Link } from '@shumoku/core'
  import type { RenderColors } from '../lib/render-colors'
  import { vlanStroke } from './geometry'
  import type { Mark } from './scene'
  import type { Tokens } from './tokens'

  /**
   * One mouth of a band, drawn as one of the candidate marks (research-shape §4.3). B is the
   * chamfer itself and draws nothing. The sizes come from the line's stroke and the band's width.
   */
  let {
    mark,
    link,
    stroke,
    style,
    colors,
    tokens,
  }: {
    mark: Mark
    link: Link
    stroke: number
    style: 'A' | 'B' | 'C' | 'D' | 'E'
    colors: RenderColors
    tokens: Tokens
  } = $props()

  const color = $derived(link.style?.stroke ?? vlanStroke(link.vlan) ?? colors.linkStroke)
  const em = $derived(tokens.em)
  const { at, along, across, band, run } = $derived(mark)
  // The band's edge across, with a half row of white beyond the farthest neighbour's centre.
  const lo = $derived(band.near - em / 2)
  const hi = $derived(band.far + em / 2)
  const p = (s: number, t: number) =>
    `${at.x + along.x * s + across.x * t} ${at.y + along.y * s + across.y * t}`
  // C: a funnel of the band's own width, opening back along the chamfer's side (two short strokes).
  const funnel = $derived(
    `M ${p(0, lo)} L ${p(-em, lo - em / 2)} M ${p(0, hi)} L ${p(-em, hi + em / 2)}`,
  )
  // D: a tick across the whole band at the mouth.
  const tick = $derived(`M ${p(0, lo)} L ${p(0, hi)}`)
  // E: the outline of the shared run (drawn once per band mouth; two mouths overlap on the same run).
  const outline = $derived.by(() => {
    const q = (pt: { x: number; y: number }, t: number) =>
      `${pt.x + across.x * t} ${pt.y + across.y * t}`
    return `M ${q(run.from, lo)} L ${q(run.to, lo)} L ${q(run.to, hi)} L ${q(run.from, hi)} Z`
  })
</script>

{#if style === 'A'}
  <circle cx={at.x} cy={at.y} r={stroke * 2} fill={color} />
{:else if style === 'C'}
  <path d={funnel} fill="none" stroke={colors.linkStroke} stroke-width={tokens.line.hair} />
{:else if style === 'D'}
  <path d={tick} fill="none" stroke={colors.linkStroke} stroke-width={tokens.line.hair} />
{:else if style === 'E'}
  <path
    d={outline}
    fill="none"
    stroke={colors.linkStroke}
    stroke-width={tokens.line.hair}
    stroke-dasharray={`${tokens.line.hair * 2} ${tokens.line.hair * 2}`}
  />
{/if}
