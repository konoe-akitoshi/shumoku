<script lang="ts">
  import type { HardwareProperties } from '@shumoku/catalog'
  import { getDeviceIcon, type Link } from '@shumoku/core'
  import { Combobox, Dialog, ScrollArea, Tabs } from 'bits-ui'
  import { CaretUpDown, X } from 'phosphor-svelte'
  import type { PoEBudget } from '$lib/poe-analysis'
  import type { SpecPaletteEntry } from '$lib/types'
  import { paletteEntryLabel } from '$lib/types'

  let {
    open = false,
    data,
    mode = 'view',
    poeBudget,
    boundPaletteId,
    palette = [],
    links = [],
    onclose,
    onupdate,
    onbindpalette,
  }: {
    open?: boolean
    // biome-ignore lint/suspicious/noExplicitAny: mixed element data
    data: Record<string, any> | null
    mode?: 'edit' | 'view'
    poeBudget?: PoEBudget
    boundPaletteId?: string
    palette?: SpecPaletteEntry[]
    links?: Link[]
    onclose?: () => void
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

  function handleComboSelect(paletteId: string) {
    if (!data?.id) return
    // Bind node to palette via BOM — spec propagation happens in context
    onbindpalette?.(data.id, paletteId)
  }

  // Bound palette entry — looked up via BomItem binding (parent passes boundPaletteId)
  const boundPalette = $derived(
    boundPaletteId ? (palette.find((e) => e.id === boundPaletteId) ?? null) : null,
  )

  const hwProps = $derived(
    boundPalette?.spec.kind === 'hardware' && boundPalette.properties
      ? (boundPalette.properties as HardwareProperties)
      : null,
  )

  const kind = $derived((data?.kind as string) ?? 'unknown')
  const editing = $derived(mode === 'edit')

  function kindColor(k: string) {
    if (k === 'node') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
    if (k === 'subgraph')
      return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
    if (k === 'edge') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
    return 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'
  }

  function stripHtml(s: string): string {
    return s.replace(/<[^>]*>/g, '')
  }

  const iconPath = $derived(data?.spec?.type ? getDeviceIcon(data.spec.type) : undefined)
  const nodeLabel = $derived(
    data?.label
      ? Array.isArray(data.label)
        ? data.label.map(stripHtml).join(' / ')
        : stripHtml(String(data.label))
      : '',
  )
  const ports = $derived(data?.ports ?? [])

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

  // Derive port connections from links
  const portConnections = $derived.by<PortConnection[]>(() => {
    if (!data?.id || !links?.length || !ports?.length) return []
    const nodeId = data.id as string
    const conns: PortConnection[] = []

    // biome-ignore lint/suspicious/noExplicitAny: port data is untyped
    const portMap = new Map<string, any>()
    // biome-ignore lint/suspicious/noExplicitAny: port data is untyped
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
        const port = portMap.get(fromPort)
        conns.push({
          portLabel: fromPort,
          side: port?.side ?? '',
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
        const port = portMap.get(toPort)
        conns.push({
          portLabel: toPort,
          side: port?.side ?? '',
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

  function handleFieldChange(key: string, value: string) {
    if (!data?.id) return
    onupdate?.(data.id, key, value)
  }

  // Properties tab: non-spec editable fields
  function getEditableFields(
    // biome-ignore lint/suspicious/noExplicitAny: mixed element data
    d: Record<string, any>,
  ): { key: string; label: string; value: string; editable: boolean }[] {
    const fields: { key: string; label: string; value: string; editable: boolean }[] = []
    const k = d.kind as string

    if (k === 'node') {
      const raw = d.label
        ? Array.isArray(d.label)
          ? d.label.map(stripHtml).join('\n')
          : stripHtml(String(d.label))
        : ''
      fields.push({ key: 'label', label: 'Label', value: raw, editable: true })
      fields.push({ key: 'shape', label: 'Shape', value: d.shape ?? '', editable: true })
      fields.push({ key: 'parent', label: 'Parent', value: d.parent ?? '', editable: false })
      fields.push({
        key: 'rank',
        label: 'Rank',
        value: d.rank != null ? String(d.rank) : '',
        editable: true,
      })
      if (d.position)
        fields.push({
          key: 'position',
          label: 'Position',
          value: `${d.position.x.toFixed(1)}, ${d.position.y.toFixed(1)}`,
          editable: false,
        })
      if (d.size)
        fields.push({
          key: 'size',
          label: 'Size',
          value: `${d.size.width} × ${d.size.height}`,
          editable: false,
        })
    } else if (k === 'subgraph') {
      fields.push({ key: 'label', label: 'Label', value: d.label ?? '', editable: true })
      fields.push({
        key: 'direction',
        label: 'Direction',
        value: d.direction ?? '',
        editable: true,
      })
      fields.push({ key: 'parent', label: 'Parent', value: d.parent ?? '', editable: false })
      if (d.bounds)
        fields.push({
          key: 'bounds',
          label: 'Bounds',
          value: `${d.bounds.width.toFixed(0)} × ${d.bounds.height.toFixed(0)}`,
          editable: false,
        })
      if (d.children)
        fields.push({
          key: 'children',
          label: 'Children',
          value: `${d.children.nodes} nodes, ${d.children.subgraphs} groups`,
          editable: false,
        })
    } else if (k === 'edge') {
      if (d.from)
        fields.push({
          key: 'from',
          label: 'From',
          value: `${d.from.node}:${d.from.port}`,
          editable: false,
        })
      if (d.to)
        fields.push({
          key: 'to',
          label: 'To',
          value: `${d.to.node}:${d.to.port}`,
          editable: false,
        })
    } else if (k === 'port') {
      fields.push({ key: 'label', label: 'Label', value: d.label ?? '', editable: true })
      if (d.nodeId) fields.push({ key: 'nodeId', label: 'Node', value: d.nodeId, editable: false })
      if (d.side) fields.push({ key: 'side', label: 'Side', value: d.side, editable: false })
    }

    return fields
  }

  const editableFields = $derived(data ? getEditableFields(data) : [])

  // Ports not in any connection
  const unconnectedPorts = $derived.by(() => {
    const connectedLabels = new Set(portConnections.map((c) => c.portLabel))
    // biome-ignore lint/suspicious/noExplicitAny: port data untyped
    return ports.filter((p: any) => !connectedLabels.has(p.label))
  })

  const inputClass =
    'w-full px-1.5 py-0.5 text-[12px] font-mono bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded outline-none focus:ring-1 focus:ring-blue-400 text-neutral-700 dark:text-neutral-200'
</script>

<Dialog.Root {open} onOpenChange={(o) => { if (!o) onclose?.() }}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 backdrop-blur-[2px]" />
    <Dialog.Content
      class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[480px] bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-2xl focus:outline-none"
    >
      {#if data}
        <!-- Header -->
        <div
          class="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-700"
        >
          <div class="flex items-center gap-2.5">
            <span
              class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md {kindColor(kind)}"
            >
              {kind}
            </span>
            <Dialog.Title
              class="text-sm font-mono text-neutral-600 dark:text-neutral-300 truncate max-w-[300px]"
            >
              {data.id ?? ''}
            </Dialog.Title>
          </div>
          <Dialog.Close
            class="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:text-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            <X class="w-4 h-4" />
          </Dialog.Close>
        </div>

        <Dialog.Description class="sr-only">
          Properties of {kind} element {data.id ?? ''}
        </Dialog.Description>

        <Tabs.Root value="overview">
          <!-- ============ Overview tab ============ -->
          <Tabs.Content value="overview">
            <ScrollArea.Root style="height: 45vh;">
              <ScrollArea.Viewport style="height: 100%;">
                <div class="px-5 py-4 text-xs space-y-3">
                  <!-- Node identity: icon + label + spec -->
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
                          aria-label={data?.spec?.type ?? 'icon'}
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
                      <!-- Label -->
                      {#if editing && (kind === 'node' || kind === 'subgraph')}
                        <input
                          type="text"
                          class="w-full text-sm font-semibold px-2 py-0.5 -ml-2 bg-transparent border border-transparent hover:border-neutral-200 focus:border-neutral-300 dark:hover:border-neutral-600 dark:focus:border-neutral-500 rounded outline-none focus:ring-1 focus:ring-blue-400 text-neutral-800 dark:text-neutral-100"
                          value={nodeLabel || ''}
                          placeholder="Label"
                          onblur={(e) => { if (data?.id) onupdate?.(data.id, 'label', (e.target as HTMLInputElement).value) }}
                          onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        >
                      {:else}
                        <div
                          class="text-sm font-semibold text-neutral-800 dark:text-neutral-100 truncate"
                        >
                          {nodeLabel || data.id}
                        </div>
                      {/if}

                      <!-- Spec binding -->
                      {#if kind === 'node' || kind === 'subgraph'}
                        {#if editing}
                          <Combobox.Root
                            type="single"
                            onValueChange={(v) => { if (v) handleComboSelect(v) }}
                          >
                            <div class="relative">
                              <Combobox.Input
                                placeholder="Assign spec..."
                                defaultValue={boundPalette ? paletteEntryLabel(boundPalette) : ''}
                                class="w-full pl-2 pr-7 py-0.5 -ml-2 text-[11px] bg-transparent border border-transparent hover:border-neutral-200 focus:border-neutral-300 dark:hover:border-neutral-600 dark:focus:border-neutral-500 rounded outline-none focus:ring-1 focus:ring-blue-400 text-neutral-600 dark:text-neutral-300"
                                oninput={(e) => { comboSearchValue = (e.target as HTMLInputElement).value }}
                              />
                              <CaretUpDown
                                class="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-400"
                              />
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
                          <div class="text-[11px] text-neutral-400 dark:text-neutral-500 italic">
                            No spec assigned
                          </div>
                        {/if}
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
                          <div
                            class="px-2.5 py-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-700/30 text-[10px]"
                          >
                            <div class="flex items-center gap-1.5">
                              <span class="font-mono font-semibold text-blue-600 dark:text-blue-400"
                                >{conn.portLabel}</span
                              >
                              <span class="text-neutral-300 dark:text-neutral-600"
                                >{conn.direction === 'out' ? '→' : '←'}</span
                              >
                              <span class="font-mono text-neutral-700 dark:text-neutral-200"
                                >{conn.peerNode}</span
                              >
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
                              <div
                                class="flex gap-2 mt-0.5 text-[9px] text-neutral-400 dark:text-neutral-500"
                              >
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
                            <span class="text-neutral-300 dark:text-neutral-600"
                              >({port.side})</span
                            ></span
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
                          <div
                            class="px-2.5 py-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-700/30 text-[10px]"
                          >
                            <div class="flex items-center justify-between">
                              <span class="text-neutral-700 dark:text-neutral-200">
                                {#if link.fromPort}
                                  <span class="font-mono text-blue-500 dark:text-blue-400"
                                    >{link.fromPort}</span
                                  >
                                  →
                                {/if}
                                {link.toNodeLabel}
                                {#if link.toPort}
                                  <span class="text-neutral-400">:{link.toPort}</span>
                                {/if}
                              </span>
                              <span class="font-mono text-amber-600 dark:text-amber-400"
                                >{link.draw_w}W</span
                              >
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
                </div>
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar
                orientation="vertical"
                class="flex w-2 touch-none select-none rounded-full bg-neutral-100 dark:bg-neutral-700/50 p-px"
              >
                <ScrollArea.Thumb
                  class="flex-1 rounded-full bg-neutral-300 dark:bg-neutral-500 hover:bg-neutral-400 dark:hover:bg-neutral-400 transition-colors"
                />
              </ScrollArea.Scrollbar>
            </ScrollArea.Root>
          </Tabs.Content>

          <!-- ============ Properties tab (editable) ============ -->
          <Tabs.Content value="properties">
            <ScrollArea.Root style="height: 45vh;">
              <ScrollArea.Viewport style="height: 100%;">
                <div class="px-5 py-4 space-y-3 text-xs">
                  {#each editableFields as field}
                    <div class="flex gap-3 items-start">
                      <span
                        class="shrink-0 w-16 text-right text-neutral-400 dark:text-neutral-500 font-medium pt-1"
                      >
                        {field.label}
                      </span>
                      {#if editing && field.editable}
                        <input
                          type="text"
                          class={inputClass}
                          value={field.value}
                          onblur={(e) => handleFieldChange(field.key, (e.target as HTMLInputElement).value)}
                          onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        >
                      {:else}
                        <span
                          class="text-neutral-700 dark:text-neutral-200 font-mono break-all leading-relaxed pt-0.5"
                        >
                          {field.value}
                        </span>
                      {/if}
                    </div>
                  {/each}
                </div>
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar
                orientation="vertical"
                class="flex w-2 touch-none select-none rounded-full bg-neutral-100 dark:bg-neutral-700/50 p-px"
              >
                <ScrollArea.Thumb
                  class="flex-1 rounded-full bg-neutral-300 dark:bg-neutral-500 hover:bg-neutral-400 dark:hover:bg-neutral-400 transition-colors"
                />
              </ScrollArea.Scrollbar>
            </ScrollArea.Root>
          </Tabs.Content>

          <!-- ============ Raw tab ============ -->
          <Tabs.Content value="raw">
            <ScrollArea.Root style="height: 45vh;">
              <ScrollArea.Viewport style="height: 100%;">
                <div class="px-5 py-4">
                  <pre
                    class="text-[11px] font-mono text-neutral-600 dark:text-neutral-300 whitespace-pre-wrap break-all leading-relaxed"
                  >{JSON.stringify(data, null, 2)}</pre>
                </div>
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar
                orientation="vertical"
                class="flex w-2 touch-none select-none rounded-full bg-neutral-100 dark:bg-neutral-700/50 p-px"
              >
                <ScrollArea.Thumb
                  class="flex-1 rounded-full bg-neutral-300 dark:bg-neutral-500 hover:bg-neutral-400 dark:hover:bg-neutral-400 transition-colors"
                />
              </ScrollArea.Scrollbar>
            </ScrollArea.Root>
          </Tabs.Content>

          <Tabs.List class="flex border-t border-neutral-200 dark:border-neutral-700">
            <Tabs.Trigger
              value="overview"
              class="px-3 py-2 text-xs font-medium border-t-2 -mt-px transition-colors data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              Overview
            </Tabs.Trigger>
            <Tabs.Trigger
              value="properties"
              class="px-3 py-2 text-xs font-medium border-t-2 -mt-px transition-colors data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              Properties
            </Tabs.Trigger>
            <Tabs.Trigger
              value="raw"
              class="px-3 py-2 text-xs font-medium border-t-2 -mt-px transition-colors data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              Raw
            </Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      {/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
