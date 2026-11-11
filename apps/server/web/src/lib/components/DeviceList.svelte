<script lang="ts">
  import { CaretDownIcon, CaretRightIcon, XIcon } from 'phosphor-svelte'
  import type { Device, DeviceState, TopologyCredential } from '$lib/api'
  import DeviceGroupMenu from '$lib/components/DeviceGroupMenu.svelte'
  import DeviceRow from '$lib/components/DeviceRow.svelte'
  import DeviceSelectionBar from '$lib/components/DeviceSelectionBar.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { canReadGroup, credentialBreakdown, selectionState, toggleIds } from '$lib/device-actions'
  import { STATE_META, STATE_ORDER, TONE_CLASS } from '$lib/devices'

  /**
   * The devices grouped by what happened to them. The server decides each
   * device's state; the groups that need a person come first and start open.
   * Each row edits its own credential; a group header and the selection bar act
   * on many devices at once. The page owns the mutations (and their undo).
   */
  interface Props {
    devices: Device[]
    credentials: TopologyCredential[]
    /** Show only this credential's devices; null shows all. */
    credentialFilter: string | null
    busy: boolean
    /** The ticked devices; the page may clear it. */
    selected: string[]
    formatAgo: (ts: number) => string
    onOpen: (device: Device) => void
    /** Resolves true when the change was applied. */
    onAssign: (ids: string[], credentialId: string | null) => Promise<boolean>
    onSetEnabled: (ids: string[], enabled: boolean) => Promise<boolean>
    onRead: (ids: string[]) => void
    /** Admin only: omitted for others. */
    onCreateCredential?: (ids: string[]) => void
  }

  let {
    devices,
    credentials,
    credentialFilter = $bindable(),
    busy,
    selected = $bindable(),
    formatAgo,
    onOpen,
    onAssign,
    onSetEnabled,
    onRead,
    onCreateCredential,
  }: Props = $props()

  let query = $state('')
  /** Groups the person toggled; absent = the state's default. */
  let toggled = $state<Partial<Record<DeviceState, boolean>>>({})

  function matches(d: Device, q: string): boolean {
    if (!q) return true
    return [d.label, d.mgmtIp, d.sysName, d.model]
      .filter((v): v is string => Boolean(v))
      .some((v) => v.toLowerCase().includes(q))
  }

  const groups = $derived.by(() => {
    const q = query.trim().toLowerCase()
    const visible = devices.filter(
      (d) => matches(d, q) && (credentialFilter === null || d.credentialId === credentialFilter),
    )
    return STATE_ORDER.map((state) => ({
      state,
      meta: STATE_META[state],
      items: visible.filter((d) => d.state === state),
    }))
      .map((g) => ({ ...g, ids: g.items.map((d) => d.id) }))
      .filter((g) => g.items.length > 0)
  })

  const filterName = $derived(credentials.find((c) => c.id === credentialFilter)?.name ?? null)

  // A filter whose credential is gone (removed, or another topology) cannot stay.
  $effect(() => {
    if (credentialFilter !== null && filterName === null) credentialFilter = null
  })

  /** Only the groups that need a person show who they are split between. */
  const breakdownStates: DeviceState[] = ['lost', 'partial']

  const selectedSet = $derived(new Set(selected))

  // A device that is gone after a refresh cannot stay selected.
  $effect(() => {
    const live = new Set(devices.map((d) => d.id))
    if (selected.some((id) => !live.has(id))) selected = selected.filter((id) => live.has(id))
  })

  const isOpen = (state: DeviceState) => toggled[state] ?? STATE_META[state].open
  const toggle = (state: DeviceState) => (toggled = { ...toggled, [state]: !isOpen(state) })

  async function clearAfter(done: Promise<boolean>) {
    if (await done) selected = []
  }
</script>

{#snippet breakdown(
    shares: { id: string; name: string; count: number }[],
  )}
  {#if shares.length > 0}
    <p class="flex flex-wrap items-center gap-x-1 pb-2 pl-11 text-xs text-muted-foreground">
      {#each shares as c, i (c.id)}
        {#if i > 0}
          <span aria-hidden="true">·</span>
        {/if}
        <button
          type="button"
          class="min-h-8 rounded px-1 underline-offset-2 hover:bg-accent hover:underline"
          aria-label="{c.name}の機器だけを表示"
          onclick={() => (credentialFilter = c.id)}
        >
          {c.name} {c.count}
        </button>
      {/each}
    </p>
  {/if}
{/snippet}

<div class="space-y-3">
  <Input
    type="search"
    placeholder="名前・アドレスで検索"
    aria-label="機器を検索"
    bind:value={query}
  />

  {#if filterName !== null}
    <button
      type="button"
      class="inline-flex min-h-8 items-center gap-1 rounded-full border border-border bg-muted px-3 text-xs hover:bg-accent"
      aria-label="絞り込みを解除: {filterName}"
      onclick={() => (credentialFilter = null)}
    >
      絞り込み: {filterName}
      <XIcon class="size-3" />
    </button>
  {/if}

  {#if groups.length === 0}
    <p class="py-6 text-center text-sm text-muted-foreground">該当する機器がありません。</p>
  {/if}

  {#each groups as g (g.state)}
    <section>
      <div class="flex items-center">
        <label class="flex size-11 shrink-0 cursor-pointer items-center justify-center">
          <input
            type="checkbox"
            class="size-4"
            aria-label="{g.meta.label}の機器をすべて選択"
            checked={selectionState(g.ids, selectedSet) === 'all'}
            indeterminate={selectionState(g.ids, selectedSet) === 'some'}
            onchange={(e) => (selected = toggleIds(selected, g.ids, e.currentTarget.checked))}
          >
        </label>
        <button
          type="button"
          class="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={isOpen(g.state)}
          onclick={() => toggle(g.state)}
        >
          {#if isOpen(g.state)}
            <CaretDownIcon class="size-4 shrink-0" />
          {:else}
            <CaretRightIcon class="size-4 shrink-0" />
          {/if}
          <span class="min-w-0 flex-1">
            <span class="text-sm font-medium {TONE_CLASS[g.meta.tone]}">{g.meta.label}</span>
            <span class="ml-1 text-xs text-muted-foreground">{g.items.length}</span>
            {#if g.meta.hint && isOpen(g.state)}
              <span class="block text-xs text-muted-foreground">{g.meta.hint}</span>
            {/if}
          </span>
        </button>
        <DeviceGroupMenu
          label={g.meta.label}
          count={g.ids.length}
          {credentials}
          {busy}
          isDisabledGroup={g.state === 'disabled'}
          canRead={canReadGroup(g.state)}
          disableFirst={g.state === 'silent'}
          onRead={() => onRead(g.ids)}
          onAssign={(credentialId) => onAssign(g.ids, credentialId)}
          onSetEnabled={(enabled) => onSetEnabled(g.ids, enabled)}
        />
      </div>
      {#if breakdownStates.includes(g.state)}
        {@render breakdown(credentialBreakdown(g.items, credentials))}
      {/if}
      {#if g.state === 'silent' && isOpen(g.state)}
        <div class="pb-2 pl-11">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onclick={() => onSetEnabled(g.ids, false)}
          >
            {g.ids.length}
            台を対象外にする
          </Button>
        </div>
      {/if}

      {#if isOpen(g.state)}
        <ul class="@container divide-y divide-border rounded-lg border border-border">
          {#each g.items as d (d.id)}
            <DeviceRow
              device={d}
              {credentials}
              {busy}
              {formatAgo}
              selected={selectedSet.has(d.id)}
              {onOpen}
              onSelect={(device, on) => (selected = toggleIds(selected, [device.id], on))}
              onAssign={(device, credentialId) => onAssign([device.id], credentialId)}
            />
          {/each}
        </ul>
      {/if}
    </section>
  {/each}

  <!-- After the groups, stuck to the bottom of the panel: showing it must not push the
       rows down (that moves the next checkbox out from under the pointer). -->
  {#if selected.length > 0}
    <DeviceSelectionBar
      count={selected.length}
      {credentials}
      {busy}
      onAssign={(credentialId) => clearAfter(onAssign(selected, credentialId))}
      onCreateCredential={onCreateCredential ? () => onCreateCredential(selected) : undefined}
      onSetEnabled={(enabled) => clearAfter(onSetEnabled(selected, enabled))}
      onRead={() => onRead(selected)}
      onClear={() => (selected = [])}
    />
  {/if}
</div>
