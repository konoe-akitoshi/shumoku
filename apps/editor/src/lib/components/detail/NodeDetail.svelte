<script lang="ts">
  import type { HardwareProperties } from '@shumoku/catalog'
  import { getDeviceIcon, type Link } from '@shumoku/core'
  import { Combobox } from 'bits-ui'
  import { CaretUpDown } from 'phosphor-svelte'
  import type { PoEBudget } from '$lib/poe-analysis'
  import type { SpecPaletteEntry } from '$lib/types'
  import { paletteEntryLabel } from '$lib/types'

  let {
    data,
    editing = false,
    poeBudget,
    boundPaletteId,
    palette = [],
    links = [],
    onupdate,
    onbindpalette,
  }: {
    // biome-ignore lint/suspicious/noExplicitAny: mixed element data
    data: Record<string, any>
    editing?: boolean
    poeBudget?: PoEBudget
    boundPaletteId?: string
    palette?: SpecPaletteEntry[]
    links?: Link[]
    onupdate?: (id: string, field: string, value: string) => void
    onbindpalette?: (nodeId: string, paletteId: string) => void
  } = $props()

  let comboSearchValue = $state('')

  const comboResults = $derived.by(() => {
    if (!palette.length) return []
    if (!comboSearchValue.trim()) return palette.slice(0, 10)
    const q = comboSearchValue.toLowerCase()
    return palette.filter((e) => paletteEntryLabel(e).toLowerCase().includes(q)).slice(0, 10)
  })

  const boundPalette = $derived(
    boundPaletteId ? (palette.find((e) => e.id === boundPaletteId) ?? null) : null,
  )

  function stripHtml(s: string): string {
    return s.replace(/<[^>]*>/g, '')
  }

  const iconPath = $derived(data.spec?.type ? getDeviceIcon(data.spec.type) : undefined)
  const nodeLabel = $derived(
    data.label
      ? Array.isArray(data.label)
        ? data.label.map(stripHtml).join(' / ')
        : stripHtml(String(data.label))
      : '',
  )
  const ports = $derived(data.ports ?? [])

  interface PortConnection {
    portLabel: string
    side: string
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
    if (!data.id || !links.length || !ports.length) return []
    const nodeId = data.id as string
    const conns: PortConnection[] = []
    // biome-ignore lint/suspicious/noExplicitAny: port data untyped
    const portMap = new Map<string, any>()
    // biome-ignore lint/suspicious/noExplicitAny: port data untyped
    for (const p of ports) portMap.set((p as any).label, p)

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

      if (fromNode === nodeId && fromPort) {
        conns.push({
          portLabel: fromPort,
          side: portMap.get(fromPort)?.side ?? '',
          peerNode: toNode,
          peerPort: toPort ?? '',
          ip: fromIp,
          peerIp: toIp,
          bandwidth: bw,
          vlan,
          linkLabel: label,
          direction: 'out',
        })
      } else if (toNode === nodeId && toPort) {
        conns.push({
          portLabel: toPort,
          side: portMap.get(toPort)?.side ?? '',
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

  const unconnectedPorts = $derived.by(() => {
    const connectedLabels = new Set(portConnections.map((c) => c.portLabel))
    // biome-ignore lint/suspicious/noExplicitAny: port data untyped
    return ports.filter((p: any) => !connectedLabels.has(p.label))
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
        aria-label={data.spec?.type ?? 'icon'}
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
    {#if editing}
      <input
        type="text"
        class="w-full text-sm font-semibold px-2 py-0.5 -ml-2 bg-transparent border border-transparent hover:border-neutral-200 focus:border-neutral-300 dark:hover:border-neutral-600 dark:focus:border-neutral-500 rounded outline-none focus:ring-1 focus:ring-blue-400 text-neutral-800 dark:text-neutral-100"
        value={nodeLabel || ''}
        placeholder="Label"
        onblur={(e) => { if (data.id) onupdate?.(data.id, 'label', (e.target as HTMLInputElement).value) }}
        onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      >
    {:else}
      <div class="text-sm font-semibold text-neutral-800 dark:text-neutral-100 truncate">
        {nodeLabel || data.id}
      </div>
    {/if}

    {#if editing}
      <Combobox.Root
        type="single"
        onValueChange={(v) => { if (v && data.id) onbindpalette?.(data.id, v) }}
      >
        <div class="relative">
          <Combobox.Input
            placeholder="Assign spec..."
            defaultValue={boundPalette ? paletteEntryLabel(boundPalette) : ''}
            class="w-full pl-2 pr-7 py-0.5 -ml-2 text-[11px] bg-transparent border border-transparent hover:border-neutral-200 focus:border-neutral-300 dark:hover:border-neutral-600 dark:focus:border-neutral-500 rounded outline-none focus:ring-1 focus:ring-blue-400 text-neutral-600 dark:text-neutral-300"
            oninput={(e) => { comboSearchValue = (e.target as HTMLInputElement).value }}
          />
          <CaretUpDown class="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-400" />
        </div>
        <Combobox.Content
          class="z-[70] mt-1 max-h-48 w-full overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg"
        >
          {#each comboResults as palEntry}
            <Combobox.Item
              value={palEntry.id}
              label={paletteEntryLabel(palEntry)}
              class="px-3 py-1.5 text-[11px] cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-700/50 data-[highlighted]:bg-neutral-50 dark:data-[highlighted]:bg-neutral-700/50"
            >
              <div class="font-medium text-neutral-800 dark:text-neutral-100">
                {paletteEntryLabel(palEntry)}
              </div>
              <div class="text-[9px] font-mono text-neutral-400">
                {palEntry.spec.kind}
                / {palEntry.spec.vendor ?? ''}
              </div>
            </Combobox.Item>
          {/each}
        </Combobox.Content>
      </Combobox.Root>
    {:else if boundPalette}
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
              >{conn.direction === 'out' ? '→' : '←'}</span
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

<!-- Unconnected ports -->
{#if unconnectedPorts.length > 0}
  <div>
    <div
      class="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5"
    >
      Ports
    </div>
    <div class="flex flex-wrap gap-1">
      {#each unconnectedPorts as port}
        <span
          class="px-1.5 py-0.5 rounded text-[9px] font-mono bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400"
          >{port.label}
          <span class="text-neutral-300 dark:text-neutral-600">({port.side})</span></span
        >
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
                →
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
