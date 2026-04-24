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
      const bw = link.bandwidth !== undefined ? String(link.bandwidth) : undefined
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
  {@const drawPct = Math.min(100, Math.round((poeBudget.draw_w / poeBudget.budget_w) * 1000) / 10)}
  {@const reservedPct = Math.min(100, poeBudget.utilization_pct)}
  {@const barColor =
    reservedPct > 100
      ? 'bg-red-500'
      : reservedPct > 80
        ? 'bg-red-500'
        : reservedPct > 50
          ? 'bg-amber-500'
          : 'bg-green-500'}
  {@const drawColor =
    reservedPct > 100
      ? 'bg-red-700'
      : reservedPct > 80
        ? 'bg-red-700'
        : reservedPct > 50
          ? 'bg-amber-700'
          : 'bg-green-700'}
  <div>
    <div class="flex items-center justify-between mb-1.5">
      <span
        class="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500"
        >PoE Budget</span
      >
      <span class="text-[10px] font-mono text-neutral-600 dark:text-neutral-300">
        <span class="text-emerald-600 dark:text-emerald-400">{poeBudget.draw_w}W</span>
        <span class="text-neutral-400 dark:text-neutral-500"> / </span>
        <span class="text-amber-600 dark:text-amber-300">{poeBudget.reserved_w}W</span>
        <span class="text-neutral-400 dark:text-neutral-500"> / {poeBudget.budget_w}W</span>
      </span>
    </div>
    <div
      class="relative w-full h-2 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden mb-1"
      role="meter"
      aria-valuenow={poeBudget.reserved_w}
      aria-valuemax={poeBudget.budget_w}
    >
      <div
        class="absolute inset-y-0 left-0 {barColor} opacity-60 transition-all"
        style="width: {reservedPct}%"
      ></div>
      <div
        class="absolute inset-y-0 left-0 {drawColor} transition-all"
        style="width: {drawPct}%"
      ></div>
    </div>
    <div class="flex justify-between text-[9px] text-neutral-400 dark:text-neutral-500 mb-2">
      <span>draw · reserved · budget</span>
      <span>{poeBudget.remaining_w}W free ({reservedPct}%)</span>
    </div>
    {#if poeBudget.violations.length > 0}
      <div class="space-y-0.5 mb-2">
        {#each poeBudget.violations as v}
          <div
            class="flex items-start gap-1 text-[10px] text-red-600 dark:text-red-400 px-2 py-1 rounded bg-red-50 dark:bg-red-950/30"
          >
            <span class="font-bold">!</span>
            <span>{v.message}</span>
          </div>
        {/each}
      </div>
    {/if}
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
              {#if link.effective_class !== undefined}
                <span
                  class="ml-1 px-1 py-0 rounded bg-neutral-200 dark:bg-neutral-600 text-[8px] text-neutral-600 dark:text-neutral-300"
                  >C{link.effective_class}</span
                >
              {/if}
            </span>
            <span class="font-mono">
              <span class="text-emerald-600 dark:text-emerald-400">{link.draw_w}W</span>
              <span class="text-neutral-400"> / </span>
              <span class="text-amber-600 dark:text-amber-400">{link.reserved_w}W</span>
            </span>
          </div>
          {#if link.violations}
            {#each link.violations as v}
              <div class="mt-0.5 text-[9px] text-red-500 dark:text-red-400">! {v.message}</div>
            {/each}
          {/if}
          {#if link.passthrough}
            {#each link.passthrough as pt}
              <div
                class="flex justify-between mt-0.5 pl-3 border-l border-neutral-200 dark:border-neutral-600 ml-1 text-[9px] text-neutral-400 dark:text-neutral-500"
              >
                <span>{pt.nodeLabel}</span>
                <span class="font-mono">
                  <span class="text-emerald-500 dark:text-emerald-500">{pt.draw_w}W</span>
                  <span> / </span>
                  <span>{pt.reserved_w}W</span>
                </span>
              </div>
            {/each}
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}
