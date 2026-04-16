<script lang="ts">
  import { getDeviceIcon, type Link, type Node, specDeviceType } from '@shumoku/core'
  import type { PoEBudget } from '$lib/poe-analysis'
  import type { BomItem, SpecPaletteEntry } from '$lib/types'
  import { paletteEntryLabel } from '$lib/types'

  let {
    node,
    poeBudget,
    palette = [],
    bomItems = [],
    links = [],
  }: {
    node: Node
    poeBudget?: PoEBudget
    palette: SpecPaletteEntry[]
    bomItems: BomItem[]
    links: Link[]
  } = $props()

  function stripHtml(s: string): string {
    return s.replace(/<[^>]*>/g, '')
  }

  const iconPath = $derived(node.spec ? getDeviceIcon(specDeviceType(node.spec)) : undefined)

  const nodeLabel = $derived(
    node.label
      ? Array.isArray(node.label)
        ? node.label.map(stripHtml).join(' / ')
        : stripHtml(String(node.label))
      : '',
  )

  const boundPalette = $derived.by(() => {
    const bom = bomItems.find((b) => b.nodeId === node.id)
    if (!bom?.paletteId) return null
    return palette.find((e) => e.id === bom.paletteId) ?? null
  })

  interface PortConnection {
    portLabel: string
    peerNode: string
    peerPort: string
    ip?: string
    peerIp?: string
    bandwidth?: string
    vlan?: string
    linkLabel?: string
    direction: 'out' | 'in'
  }

  const portConnections = $derived.by<PortConnection[]>(() => {
    if (!links.length) return []
    const conns: PortConnection[] = []

    for (const link of links) {
      const fromNode = typeof link.from === 'string' ? link.from : link.from.node
      const toNode = typeof link.to === 'string' ? link.to : link.to.node
      const fromPort = typeof link.from === 'object' ? link.from.port : undefined
      const toPort = typeof link.to === 'object' ? link.to.port : undefined
      const rawFromIp = typeof link.from === 'object' ? link.from.ip : undefined
      const rawToIp = typeof link.to === 'object' ? link.to.ip : undefined
      const fromIp = Array.isArray(rawFromIp) ? rawFromIp.join(', ') : rawFromIp
      const toIp = Array.isArray(rawToIp) ? rawToIp.join(', ') : rawToIp
      const vlan = link.vlan
        ? Array.isArray(link.vlan)
          ? link.vlan.join(', ')
          : String(link.vlan)
        : undefined
      const bw = link.bandwidth ?? undefined
      const label = Array.isArray(link.label) ? link.label.join(', ') : link.label

      if (fromNode === node.id && fromPort) {
        conns.push({
          portLabel: fromPort,
          peerNode: toNode,
          peerPort: toPort ?? '',
          ip: fromIp,
          peerIp: toIp,
          bandwidth: bw,
          vlan,
          linkLabel: label,
          direction: 'out',
        })
      } else if (toNode === node.id && toPort) {
        conns.push({
          portLabel: toPort,
          peerNode: fromNode,
          peerPort: fromPort ?? '',
          ip: toIp,
          peerIp: fromIp,
          bandwidth: bw,
          vlan,
          linkLabel: label,
          direction: 'in',
        })
      }
    }
    return conns
  })
</script>

<!-- Identity: icon + label + spec -->
<div class="flex items-start gap-3">
  <div
    class="shrink-0 w-12 h-12 rounded-lg bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center"
  >
    {#if iconPath}
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="currentColor"
        role="img"
        aria-label={node.spec?.kind ?? 'icon'}
        class="text-neutral-500 dark:text-neutral-400"
      >
        {@html iconPath}
      </svg>
    {:else}
      <div
        class="w-5 h-5 rounded border-2 border-dashed border-neutral-300 dark:border-neutral-600"
      ></div>
    {/if}
  </div>
  <div class="min-w-0 flex-1 space-y-1.5">
    <div class="text-sm font-semibold text-neutral-800 dark:text-neutral-100 truncate">
      {nodeLabel || node.id}
    </div>
    {#if boundPalette}
      <div class="flex items-center gap-1.5 text-[11px]">
        <span
          class="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-700 text-[9px] font-medium uppercase text-neutral-500 dark:text-neutral-400"
          >{boundPalette.spec.kind}</span
        >
        <span class="text-neutral-600 dark:text-neutral-300"
          >{paletteEntryLabel(boundPalette)}</span
        >
      </div>
    {:else}
      <div class="text-[11px] text-neutral-400 dark:text-neutral-500 italic">No spec assigned</div>
    {/if}
  </div>
</div>

<!-- Connections -->
{#if portConnections.length > 0}
  <div>
    <div
      class="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5"
    >
      Connections
    </div>
    <div class="space-y-1">
      {#each portConnections as conn}
        <div class="px-2.5 py-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-700/30 text-[10px]">
          <div class="flex items-center gap-1.5">
            <span class="font-mono font-semibold text-blue-600 dark:text-blue-400"
              >{conn.portLabel}</span
            >
            <span class="text-neutral-300 dark:text-neutral-600"
              >{conn.direction === 'out' ? '\u2192' : '\u2190'}</span
            >
            <span class="font-mono text-neutral-700 dark:text-neutral-200">{conn.peerNode}</span>
            {#if conn.peerPort}
              <span class="text-neutral-400">:{conn.peerPort}</span>
            {/if}
            {#if conn.bandwidth}
              <span
                class="ml-auto px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-mono text-[9px]"
                >{conn.bandwidth}</span
              >
            {/if}
          </div>
          {#if conn.ip || conn.vlan || conn.linkLabel}
            <div class="flex gap-2 mt-0.5 text-[9px] text-neutral-400 dark:text-neutral-500">
              {#if conn.ip}
                <span>{conn.ip}</span>
              {/if}
              {#if conn.vlan}
                <span>VLAN {conn.vlan}</span>
              {/if}
              {#if conn.linkLabel}
                <span>{conn.linkLabel}</span>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}

<!-- PoE Budget -->
{#if poeBudget}
  <div>
    <div class="flex items-center justify-between mb-1.5">
      <span
        class="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500"
        >PoE Budget</span
      >
      <span class="text-[10px] font-mono text-amber-600 dark:text-amber-300"
        >{poeBudget.used_w}W / {poeBudget.budget_w}W</span
      >
    </div>
    <div
      class="w-full h-2 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden mb-1.5"
      role="meter"
      aria-valuenow={poeBudget.used_w}
      aria-valuemax={poeBudget.budget_w}
    >
      <div
        class="h-full rounded-full transition-all {poeBudget.utilization_pct > 80 ? 'bg-red-500' : poeBudget.utilization_pct > 50 ? 'bg-amber-500' : 'bg-green-500'}"
        style="width: {Math.min(100, poeBudget.utilization_pct)}%"
      ></div>
    </div>
    <div class="text-[9px] text-neutral-400 dark:text-neutral-500 mb-2">
      {poeBudget.remaining_w}W remaining ({poeBudget.utilization_pct}%)
    </div>
    <div class="space-y-1">
      {#each poeBudget.links as link}
        <div class="px-2.5 py-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-700/30 text-[10px]">
          <div class="flex items-center justify-between">
            <span class="text-neutral-700 dark:text-neutral-200">
              {#if link.fromPort}
                <span class="font-mono text-blue-500 dark:text-blue-400">{link.fromPort}</span>
                {'\u2192'}
              {/if}
              {link.toNodeLabel}
              {#if link.toPort}
                <span class="text-neutral-400">:{link.toPort}</span>
              {/if}
            </span>
            <span class="font-mono text-amber-600 dark:text-amber-400">{link.draw_w}W</span>
          </div>
          {#if link.passthrough}
            {#each link.passthrough as pt}
              <div
                class="flex justify-between mt-0.5 pl-3 border-l border-neutral-200 dark:border-neutral-600 ml-1 text-[9px] text-neutral-400 dark:text-neutral-500"
              >
                <span>{pt.nodeLabel}</span>
                <span class="font-mono">{pt.draw_w}W</span>
              </div>
            {/each}
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}
