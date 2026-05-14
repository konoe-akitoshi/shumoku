<script lang="ts">
  import { getDeviceIcon, type Link, type Node, type NodeSpec, specDeviceType } from '@shumoku/core'
  import { X } from 'phosphor-svelte'
  import { diagramState } from '$lib/context.svelte'
  import type { PoEBudget } from '$lib/poe-analysis'

  let {
    node,
    poeBudget,
    links = [],
    nodes = new Map(),
  }: {
    node: Node
    poeBudget?: PoEBudget
    links: Link[]
    nodes?: Map<string, Node>
  } = $props()

  function stripHtml(s: string): string {
    return s.replace(/<[^>]*>/g, '')
  }

  /** Compact identity string for a NodeSpec — vendor / model
   *  (or vendor / service / resource) — used when the node carries a
   *  spec directly rather than a Product binding. Falls back to the
   *  device type (e.g. "internet", "router") when only kind+type are
   *  set, so generic placeholders still read sensibly. */
  function specSummary(spec: NodeSpec): string {
    if ('model' in spec) {
      const parts = [spec.vendor, spec.model].filter(Boolean).join(' / ')
      if (parts) return parts
    }
    if ('platform' in spec) {
      const parts = [spec.vendor, spec.platform].filter(Boolean).join(' / ')
      if (parts) return parts
    }
    if ('service' in spec) {
      const parts = [spec.vendor, spec.service, spec.resource].filter(Boolean).join(' / ')
      if (parts) return parts
    }
    return specDeviceType(spec) ?? spec.vendor ?? spec.kind
  }

  const iconPath = $derived(node.spec ? getDeviceIcon(specDeviceType(node.spec)) : undefined)

  function displayPort(nodeId: string, portId: string | undefined) {
    if (!portId) return ''
    const port = nodes.get(nodeId)?.ports?.find((p) => p.id === portId)
    if (!port) return portId
    return port.label || port.connectors?.join('/') || 'unnamed port'
  }

  const nodeLabel = $derived(
    node.label
      ? Array.isArray(node.label)
        ? node.label.map(stripHtml).join(' / ')
        : stripHtml(String(node.label))
      : '',
  )

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

  const ports = $derived(node.ports ?? [])

  // A port is "in use" when any link's endpoint references it by id.
  // Used to gate the custom-port delete button so we don't silently
  // break a wired connection (delete still works for already-orphan
  // custom ports the user added but never wired).
  const portUsage = $derived.by(() => {
    const used = new Set<string>()
    for (const link of links) {
      if (link.from.node === node.id && link.from.port) used.add(link.from.port)
      if (link.to.node === node.id && link.to.port) used.add(link.to.port)
    }
    return used
  })

  function removePort(portId: string) {
    // removeNodePort handles both routed and unrouted ports — orphan
    // custom ports that were never wired don't have a ResolvedPort
    // entry, so the layout-keyed `removePort` would no-op on them.
    diagramState.removeNodePort(node.id, portId)
  }

  const portConnections = $derived.by<PortConnection[]>(() => {
    if (!links.length) return []
    const conns: PortConnection[] = []

    for (const link of links) {
      const fromNode = link.from.node
      const toNode = link.to.node
      const fromPort = link.from.port
      const toPort = link.to.port
      const rawFromIp = link.from.ip
      const rawToIp = link.to.ip
      const fromIp = Array.isArray(rawFromIp) ? rawFromIp.join(', ') : rawFromIp
      const toIp = Array.isArray(rawToIp) ? rawToIp.join(', ') : rawToIp
      const vlan = link.vlan
        ? Array.isArray(link.vlan)
          ? link.vlan.join(', ')
          : String(link.vlan)
        : undefined
      const bw = link.from.plug?.module?.standard ?? link.to.plug?.module?.standard ?? undefined
      const label = Array.isArray(link.label) ? link.label.join(', ') : link.label

      if (fromNode === node.id && fromPort) {
        conns.push({
          portLabel: displayPort(fromNode, fromPort),
          peerNode: toNode,
          peerPort: displayPort(toNode, toPort),
          ip: fromIp,
          peerIp: toIp,
          bandwidth: bw,
          vlan,
          linkLabel: label,
          direction: 'out',
        })
      } else if (toNode === node.id && toPort) {
        conns.push({
          portLabel: displayPort(toNode, toPort),
          peerNode: fromNode,
          peerPort: displayPort(fromNode, fromPort),
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
    <!-- node.spec is the canonical identity source. For Product-bound
         nodes the spec was snapshotted from `Product.spec` at bind
         time, so a single `specSummary` call covers both Product-
         bound ("cisco / c9300") and generic placeholder ("internet")
         cases without a fallback branch. -->
    {#if node.spec}
      <div class="flex items-center gap-1.5 text-[11px]">
        <span
          class="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-700 text-[9px] font-medium uppercase text-neutral-500 dark:text-neutral-400"
          >{node.spec.kind}</span
        >
        <span class="text-neutral-600 dark:text-neutral-300">{specSummary(node.spec)}</span>
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

<!-- Ports — full list with cleanup affordance for custom ports -->
{#if ports.length > 0}
  <div>
    <div
      class="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5"
    >
      Ports ({ports.length})
    </div>
    <div class="space-y-0.5">
      {#each ports as port (port.id)}
        {@const display = port.label || port.connectors?.join('/') || 'unnamed'}
        {@const showPanel = port.faceplateLabel && port.faceplateLabel !== port.label}
        {@const inUse = portUsage.has(port.id)}
        {@const meta = [port.speed, port.connectors?.join('/'), port.poe ? 'PoE' : '']
          .filter(Boolean)
          .join(' · ')}
        <div
          class="flex items-center gap-1.5 px-2.5 py-1 rounded bg-neutral-50 dark:bg-neutral-700/30 text-[10px]"
        >
          <span class="font-mono font-semibold text-neutral-700 dark:text-neutral-200 truncate"
            >{display}</span
          >
          {#if showPanel}
            <span
              class="px-1 py-0.5 rounded bg-neutral-200 dark:bg-neutral-600 text-neutral-500 dark:text-neutral-300 text-[9px] font-mono"
              >panel {port.faceplateLabel}</span
            >
          {/if}
          {#if meta}
            <span class="text-neutral-500 dark:text-neutral-400 truncate">{meta}</span>
          {/if}
          <span class="ml-auto flex items-center gap-1">
            {#if inUse}
              <span
                class="px-1 py-0 rounded text-[9px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400"
                >linked</span
              >
            {/if}
            {#if port.source}
              <span
                class="px-1 py-0 rounded text-[9px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500"
                >{port.source}</span
              >
            {/if}
            {#if port.source === 'custom' && !inUse}
              <button
                type="button"
                class="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-950/40 text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
                onclick={() => removePort(port.id)}
                title="Remove this custom port"
                aria-label="Remove port"
              >
                <X class="w-3 h-3" />
              </button>
            {/if}
          </span>
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
