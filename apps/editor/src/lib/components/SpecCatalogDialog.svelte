<script lang="ts">
  import type { Catalog, CatalogEntry, HardwareProperties } from '@shumoku/catalog'
  import { Dialog, ScrollArea, Tabs } from 'bits-ui'
  import { ArrowLeft } from 'phosphor-svelte'

  let {
    open = false,
    mode = 'view',
    catalog,
    currentSpec,
    onclose,
    onselect,
  }: {
    open?: boolean
    mode?: 'edit' | 'view'
    catalog?: Catalog
    // biome-ignore lint/suspicious/noExplicitAny: mixed spec data
    currentSpec?: Record<string, any> | null
    onclose?: () => void
    onselect?: (spec: Record<string, string>) => void
  } = $props()

  const editing = $derived(mode === 'edit')

  // Cascade select state
  let selectedKind = $state<string>('hardware')
  let selectedVendor = $state('')
  let selectedSeries = $state('')
  let selectedModelId = $state('')

  // Derive vendors filtered by kind
  const vendors = $derived.by(() => {
    if (!catalog) return []
    const set = new Set<string>()
    for (const e of catalog.listByKind(selectedKind as 'hardware' | 'compute' | 'service')) {
      if (e.spec.vendor) set.add(e.spec.vendor)
    }
    return [...set].sort()
  })

  // All entries for selected vendor+kind
  const vendorEntries = $derived.by(() => {
    if (!catalog || !selectedVendor) return []
    return catalog.listByVendor(selectedVendor).filter((e) => e.spec.kind === selectedKind)
  })

  // Series = entries that have children (other entries extend them)
  const seriesEntries = $derived.by(() => {
    const allIds = new Set(vendorEntries.map((e) => e.id))
    const parentIds = new Set(vendorEntries.filter((e) => e.extends).map((e) => e.extends))
    return vendorEntries.filter((e) => parentIds.has(e.id))
  })

  // Has series?
  const hasSeries = $derived(seriesEntries.length > 0)

  // Models = entries under selected series, or standalone entries (no extends, no children)
  const modelEntries = $derived.by(() => {
    if (hasSeries && selectedSeries) {
      return vendorEntries.filter((e) => e.extends === selectedSeries)
    }
    if (!hasSeries) {
      // No series — all vendor entries are directly selectable
      return vendorEntries
    }
    return []
  })

  // Resolved entry
  const resolvedEntry = $derived.by<CatalogEntry | null>(() => {
    if (!catalog) return null
    if (selectedModelId) return catalog.lookup(selectedModelId) ?? null
    if (selectedSeries) return catalog.lookup(selectedSeries) ?? null
    return null
  })

  const hwProps = $derived(
    resolvedEntry?.spec.kind === 'hardware'
      ? (resolvedEntry.properties as HardwareProperties)
      : null,
  )

  // Sync from currentSpec when dialog opens
  $effect(() => {
    if (open && catalog && currentSpec) {
      selectedKind = currentSpec.kind ?? 'hardware'
      if (currentSpec.vendor && currentSpec.model) {
        const entry = catalog.lookup(`${currentSpec.vendor}/${currentSpec.model}`)
        if (entry) {
          selectedVendor = entry.spec.vendor ?? ''
          selectedModelId = entry.id
          selectedSeries = entry.extends ?? ''
          return
        }
      }
      selectedVendor = currentSpec.vendor ?? ''
      selectedSeries = ''
      selectedModelId = ''
    }
  })

  function handleKindChange(kind: string) {
    selectedKind = kind
    selectedVendor = ''
    selectedSeries = ''
    selectedModelId = ''
  }

  function handleVendorChange(vendor: string) {
    selectedVendor = vendor
    selectedSeries = ''
    selectedModelId = ''
  }

  function handleSeriesChange(seriesId: string) {
    selectedSeries = seriesId
    selectedModelId = ''
  }

  function handleModelChange(modelId: string) {
    selectedModelId = modelId
  }

  function apply() {
    const entry = resolvedEntry
    if (!entry) return
    const spec: Record<string, string> = { kind: entry.spec.kind }
    if (entry.spec.vendor) spec.vendor = entry.spec.vendor
    if ('type' in entry.spec && entry.spec.type) spec.type = String(entry.spec.type)
    if ('model' in entry.spec && entry.spec.model) spec.model = entry.spec.model
    if ('service' in entry.spec && entry.spec.service) spec.service = entry.spec.service
    if ('resource' in entry.spec && entry.spec.resource) spec.resource = entry.spec.resource
    if (entry.spec.icon) spec.icon = entry.spec.icon
    onselect?.(spec)
    onclose?.()
  }

  // Custom tab
  let customKind = $state('hardware')
  let customType = $state('')
  let customVendor = $state('')
  let customModel = $state('')
  let customService = $state('')
  let customResource = $state('')
  let customIcon = $state('')

  $effect(() => {
    if (open && currentSpec) {
      customKind = currentSpec.kind ?? 'hardware'
      customType = currentSpec.type ?? ''
      customVendor = currentSpec.vendor ?? ''
      customModel = currentSpec.model ?? ''
      customService = currentSpec.service ?? ''
      customResource = currentSpec.resource ?? ''
      customIcon = currentSpec.icon ?? ''
    }
  })

  function applyCustom() {
    const spec: Record<string, string> = {}
    if (customKind) spec.kind = customKind
    if (customType) spec.type = customType
    if (customVendor) spec.vendor = customVendor
    if (customModel) spec.model = customModel
    if (customService) spec.service = customService
    if (customResource) spec.resource = customResource
    if (customIcon) spec.icon = customIcon
    onselect?.(spec)
    onclose?.()
  }

  const selectClass =
    'w-full px-2 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-lg outline-none focus:ring-1 focus:ring-blue-400 text-neutral-700 dark:text-neutral-200'
  const inputClass =
    'w-full px-2 py-1 text-[12px] font-mono bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded outline-none focus:ring-1 focus:ring-blue-400 text-neutral-700 dark:text-neutral-200'
  const labelClass =
    'text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider'
</script>

<Dialog.Root {open} onOpenChange={(o) => { if (!o) onclose?.() }}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-50 bg-black/20 dark:bg-black/40 backdrop-blur-[2px]" />
    <Dialog.Content
      class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-[520px] bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-2xl focus:outline-none"
    >
      <div
        class="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-700"
      >
        <div class="flex items-center gap-3">
          <Dialog.Close
            class="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:text-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            <ArrowLeft class="w-4 h-4" />
          </Dialog.Close>
          <Dialog.Title class="text-sm font-semibold text-neutral-800 dark:text-neutral-100"
            >Node Spec</Dialog.Title
          >
        </div>
        {#if editing && resolvedEntry}
          <button
            type="button"
            class="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors"
            onclick={apply}
          >
            Apply
          </button>
        {/if}
      </div>
      <Dialog.Description class="sr-only"
        >Select or customize node specification</Dialog.Description
      >

      <Tabs.Root value="overview">
        <!-- ============ Overview tab ============ -->
        <Tabs.Content value="overview">
          <ScrollArea.Root style="height: 45vh;">
            <ScrollArea.Viewport style="height: 100%;">
              <div class="px-5 py-4">
                <!-- Cascade selects (edit) / text display (view) -->
                <div class="space-y-2 mb-4">
                  <div>
                    <div class={labelClass}>Kind</div>
                    {#if editing}
                      <select
                        class={selectClass}
                        value={selectedKind}
                        onchange={(e) => handleKindChange((e.target as HTMLSelectElement).value)}
                      >
                        <option value="hardware">hardware</option>
                        <option value="compute">compute</option>
                        <option value="service">service</option>
                      </select>
                    {:else}
                      <div class="text-xs font-mono text-neutral-700 dark:text-neutral-200 py-1">
                        {selectedKind}
                      </div>
                    {/if}
                  </div>
                  <div>
                    <div class={labelClass}>Vendor</div>
                    {#if editing}
                      <select
                        class={selectClass}
                        value={selectedVendor}
                        onchange={(e) => handleVendorChange((e.target as HTMLSelectElement).value)}
                      >
                        <option value="">-- select --</option>
                        {#each vendors as v}
                          <option value={v}>{v}</option>
                        {/each}
                      </select>
                    {:else}
                      <div class="text-xs font-mono text-neutral-700 dark:text-neutral-200 py-1">
                        {selectedVendor || '—'}
                      </div>
                    {/if}
                  </div>
                  {#if selectedVendor && hasSeries}
                    <div>
                      <div class={labelClass}>Series</div>
                      {#if editing}
                        <select
                          class={selectClass}
                          value={selectedSeries}
                          onchange={(e) => handleSeriesChange((e.target as HTMLSelectElement).value)}
                        >
                          <option value="">-- select --</option>
                          {#each seriesEntries as s}
                            <option value={s.id}>{s.label}</option>
                          {/each}
                        </select>
                      {:else}
                        <div class="text-xs font-mono text-neutral-700 dark:text-neutral-200 py-1">
                          {catalog?.getRaw(selectedSeries)?.label ?? '—'}
                        </div>
                      {/if}
                    </div>
                  {/if}
                  {#if selectedVendor && modelEntries.length > 0}
                    <div>
                      <div class={labelClass}>Model</div>
                      {#if editing}
                        <select
                          class={selectClass}
                          value={selectedModelId}
                          onchange={(e) => handleModelChange((e.target as HTMLSelectElement).value)}
                        >
                          <option value="">-- select --</option>
                          {#each modelEntries as m}
                            <option value={m.id}>{m.label}</option>
                          {/each}
                        </select>
                      {:else}
                        <div class="text-xs font-mono text-neutral-700 dark:text-neutral-200 py-1">
                          {resolvedEntry?.label ?? '—'}
                        </div>
                      {/if}
                    </div>
                  {/if}
                </div>

                <!-- Product overview -->
                {#if resolvedEntry}
                  <div class="text-base font-semibold text-neutral-800 dark:text-neutral-100 mb-1">
                    {resolvedEntry.label}
                  </div>
                  <div class="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 mb-3">
                    {resolvedEntry.id}
                  </div>

                  {#if resolvedEntry.tags.length > 0}
                    <div class="flex flex-wrap gap-1 mb-3">
                      {#each resolvedEntry.tags as tag}
                        <span
                          class="px-1.5 py-0.5 text-[9px] font-medium rounded bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400"
                          >{tag}</span
                        >
                      {/each}
                    </div>
                  {/if}

                  {#if hwProps}
                    <!-- Summary line -->
                    <div
                      class="text-[11px] text-neutral-500 dark:text-neutral-400 mb-4 leading-relaxed"
                    >
                      {#if resolvedEntry.spec.kind === 'hardware' && 'type' in resolvedEntry.spec && resolvedEntry.spec.type}
                        <span class="capitalize">{resolvedEntry.spec.type}</span>
                      {/if}
                      {#if hwProps.power?.poe_out}
                        <span>
                          · PoE {hwProps.power.poe_out.standard} {hwProps.power.poe_out.budget_w}W ({hwProps.power.poe_out.ports}
                          ports)</span
                        >
                      {/if}
                      {#if hwProps.power?.poe_in}
                        <span> · PoE consumer class {hwProps.power.poe_in.class}</span>
                      {/if}
                      {#if hwProps.power?.max_draw_w}
                        <span> · {hwProps.power.max_draw_w}W max</span>
                      {/if}
                      {#if hwProps.switching?.capacity_gbps}
                        <span> · {hwProps.switching.capacity_gbps} Gbps</span>
                      {/if}
                      {#if hwProps.wireless?.standard}
                        <span> · {hwProps.wireless.standard} {hwProps.wireless.mimo ?? ''}</span>
                      {/if}
                      {#if hwProps.physical?.form_factor}
                        <span> · {hwProps.physical.form_factor}</span>
                      {/if}
                      {#if hwProps.physical?.fanless}
                        <span> · fanless</span>
                      {/if}
                    </div>

                    <!-- Spec cards -->
                    <div class="grid grid-cols-3 gap-2 mb-4">
                      {#if hwProps.power?.max_draw_w}
                        <div
                          class="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-700/50 text-center"
                        >
                          <div class="text-[8px] uppercase tracking-wider text-neutral-400">
                            Power
                          </div>
                          <div
                            class="text-xs font-mono font-semibold text-neutral-700 dark:text-neutral-200"
                          >
                            {hwProps.power.max_draw_w}W
                          </div>
                        </div>
                      {/if}
                      {#if hwProps.switching?.capacity_gbps}
                        <div
                          class="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-700/50 text-center"
                        >
                          <div class="text-[8px] uppercase tracking-wider text-neutral-400">
                            Switch
                          </div>
                          <div
                            class="text-xs font-mono font-semibold text-neutral-700 dark:text-neutral-200"
                          >
                            {hwProps.switching.capacity_gbps}G
                          </div>
                        </div>
                      {/if}
                      {#if hwProps.wireless?.standard}
                        <div
                          class="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-700/50 text-center"
                        >
                          <div class="text-[8px] uppercase tracking-wider text-neutral-400">
                            WiFi
                          </div>
                          <div
                            class="text-xs font-mono font-semibold text-neutral-700 dark:text-neutral-200"
                          >
                            {hwProps.wireless.standard}
                          </div>
                        </div>
                      {/if}
                      {#if hwProps.ports?.downlink}
                        <div
                          class="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-700/50 text-center"
                        >
                          <div class="text-[8px] uppercase tracking-wider text-neutral-400">
                            Ports
                          </div>
                          <div
                            class="text-xs font-mono font-semibold text-neutral-700 dark:text-neutral-200"
                          >
                            {hwProps.ports.downlink.reduce((s, p) => s + p.count, 0)}
                          </div>
                        </div>
                      {/if}
                      {#if hwProps.physical?.weight_g}
                        <div
                          class="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-700/50 text-center"
                        >
                          <div class="text-[8px] uppercase tracking-wider text-neutral-400">
                            Weight
                          </div>
                          <div
                            class="text-xs font-mono font-semibold text-neutral-700 dark:text-neutral-200"
                          >
                            {hwProps.physical.weight_g}g
                          </div>
                        </div>
                      {/if}
                    </div>

                    <!-- Ports -->
                    {#if hwProps.ports}
                      <div class="text-[10px] mb-3">
                        {#if hwProps.ports.downlink}
                          {#each hwProps.ports.downlink as pg}
                            <div class="flex justify-between py-0.5">
                              <span class="text-neutral-500">Downlink</span>
                              <span class="font-mono text-neutral-700 dark:text-neutral-200"
                                >{pg.count}× {pg.speed}
                                {pg.media}
                                {#if pg.poe}
                                  (PoE)
                                {/if}</span
                              >
                            </div>
                          {/each}
                        {/if}
                        {#if hwProps.ports.uplink}
                          {#each hwProps.ports.uplink as pg}
                            <div class="flex justify-between py-0.5">
                              <span class="text-neutral-500">Uplink</span>
                              <span class="font-mono text-neutral-700 dark:text-neutral-200"
                                >{pg.count}× {pg.speed} {pg.media}</span
                              >
                            </div>
                          {/each}
                        {/if}
                      </div>
                    {/if}
                  {/if}
                {:else if !selectedVendor}
                  <p class="text-xs text-neutral-400 dark:text-neutral-500 italic text-center py-8">
                    {editing ? 'Select a vendor to browse products' : 'No catalog match for this node'}
                  </p>
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

        <!-- ============ Custom tab ============ -->
        <Tabs.Content value="custom">
          <ScrollArea.Root style="height: 45vh;">
            <ScrollArea.Viewport style="height: 100%;">
              <div class="px-5 py-4 space-y-3">
                <div>
                  <label class={labelClass}>Kind</label>
                  <select class={inputClass} bind:value={customKind}>
                    <option value="hardware">hardware</option>
                    <option value="compute">compute</option>
                    <option value="service">service</option>
                  </select>
                </div>
                {#if customKind === 'hardware' || customKind === 'compute'}
                  <div>
                    <label class={labelClass}>Type</label>
                    <input
                      type="text"
                      class={inputClass}
                      bind:value={customType}
                      placeholder="switch, router, access-point..."
                    >
                  </div>
                {/if}
                <div>
                  <label class={labelClass}>Vendor</label>
                  <input
                    type="text"
                    class={inputClass}
                    bind:value={customVendor}
                    placeholder="cisco, hpe..."
                  >
                </div>
                {#if customKind === 'hardware'}
                  <div>
                    <label class={labelClass}>Model</label>
                    <input
                      type="text"
                      class={inputClass}
                      bind:value={customModel}
                      placeholder="ws-c3560cx-8pc-s..."
                    >
                  </div>
                {/if}
                {#if customKind === 'compute'}
                  <div>
                    <label class={labelClass}>Platform</label>
                    <input
                      type="text"
                      class={inputClass}
                      bind:value={customModel}
                      placeholder="ec2, esxi..."
                    >
                  </div>
                {/if}
                {#if customKind === 'service'}
                  <div>
                    <label class={labelClass}>Service</label>
                    <input
                      type="text"
                      class={inputClass}
                      bind:value={customService}
                      placeholder="lambda, s3..."
                    >
                  </div>
                  <div>
                    <label class={labelClass}>Resource</label>
                    <input
                      type="text"
                      class={inputClass}
                      bind:value={customResource}
                      placeholder="function, bucket..."
                    >
                  </div>
                {/if}
                <div>
                  <label class={labelClass}>Icon URL</label>
                  <input
                    type="text"
                    class={inputClass}
                    bind:value={customIcon}
                    placeholder="https://..."
                  >
                </div>
                <button
                  type="button"
                  class="w-full py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors"
                  onclick={applyCustom}
                >
                  Apply
                </button>
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
            value="custom"
            class="px-3 py-2 text-xs font-medium border-t-2 -mt-px transition-colors data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            Custom
          </Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
