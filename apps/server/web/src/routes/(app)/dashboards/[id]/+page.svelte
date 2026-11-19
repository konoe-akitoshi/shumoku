<script lang="ts">
  import {
    FloppyDiskIcon,
    PencilSimpleIcon,
    PlusIcon,
    SpinnerIcon,
    SquaresFourIcon,
    XIcon,
  } from 'phosphor-svelte'
  import { goto } from '$app/navigation'
  import { api } from '$lib/api'
  import ShareButton from '$lib/components/ShareButton.svelte'
  import DashboardGrid from '$lib/dashboard/DashboardGrid.svelte'
  import { DashboardState } from '$lib/dashboard/dashboard.svelte'
  import { type DashboardLayout, parseLayout } from '$lib/dashboard/layout'
  import { dashboardNames } from '$lib/dashboard/names.svelte'
  import { readerFor } from '$lib/dashboard/reader'
  import { WIDGETS } from '$lib/dashboard/widgets'
  import { readOnlyAccess } from '$lib/stores/auth'
  import type { Dashboard } from '$lib/types'

  let { data } = $props()

  const dashboard = new DashboardState(readerFor({ kind: 'workspace' }))

  let current = $state<Dashboard | null>(null)
  let layout = $state<DashboardLayout | null>(null)
  /** The layout as saved, to go back to on Cancel. */
  let saved: DashboardLayout | null = null
  let loading = $state(true)
  let error = $state<string | null>(null)
  let saving = $state(false)
  let showWidgetPanel = $state(false)
  let grid = $state<ReturnType<typeof DashboardGrid>>()

  async function load(id: string) {
    loading = true
    error = null
    try {
      const fetched = await api.dashboards.get(id)
      if (id !== data.id) return
      current = fetched
      dashboardNames[fetched.id] = fetched.name
      layout = parseLayout(fetched.layoutJson)
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load dashboard'
    } finally {
      loading = false
    }
  }

  // SvelteKit reuses this page for another /dashboards/[id]: load that one, out of editing.
  $effect(() => {
    const id = data.id
    dashboard.editing = false
    layout = null
    void load(id)
  })

  // Someone who may only read never edits.
  $effect(() => {
    if ($readOnlyAccess) dashboard.editing = false
  })

  function startEditing() {
    if (!layout) return
    saved = $state.snapshot(layout)
    dashboard.editing = true
  }

  /**
   * Bumped to build the grid again. The grid settles one widget at a time, pushing others out of
   * the way, so putting every widget back at once (a cancel) would have one push another that is
   * not back yet; a new grid places them all as they were.
   */
  let gridVersion = $state(0)

  function cancel() {
    if (saved) {
      const moved =
        JSON.stringify(saved.widgets.map((w) => [w.id, w.position])) !==
        JSON.stringify($state.snapshot(layout)?.widgets.map((w) => [w.id, w.position]))
      layout = saved
      if (moved) gridVersion++
    }
    saved = null
    showWidgetPanel = false
    dashboard.editing = false
  }

  async function save() {
    if (!current || !layout) return
    saving = true
    try {
      current = await api.dashboards.update(current.id, {
        layoutJson: JSON.stringify($state.snapshot(layout)),
      })
      saved = null
      showWidgetPanel = false
      dashboard.editing = false
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to save dashboard'
    } finally {
      saving = false
    }
  }

  async function share() {
    if (!current) return
    await api.dashboards.share(current.id)
    current = await api.dashboards.get(current.id)
  }

  async function unshare() {
    if (!current) return
    await api.dashboards.unshare(current.id)
    current = await api.dashboards.get(current.id)
  }
</script>

<svelte:head> <title>{current?.name || 'Dashboard'} - Shumoku</title> </svelte:head>

<div class="h-full flex flex-col">
  <!-- Header -->
  <div
    class="flex items-center justify-between px-4 py-3 border-b border-theme-border bg-theme-bg-elevated"
  >
    <div class="flex items-center gap-3">
      <SquaresFourIcon size={24} class="text-primary" />
      <h1 class="text-lg font-semibold text-theme-text-emphasis">
        {current?.name || 'Dashboard'}
      </h1>
    </div>

    {#if !$readOnlyAccess && layout}
      <div class="flex items-center gap-2">
        {#if dashboard.editing}
          <button
            type="button"
            onclick={() => (showWidgetPanel = !showWidgetPanel)}
            class="flex items-center gap-2 px-3 py-1.5 bg-theme-bg-canvas border border-theme-border rounded-lg hover:border-primary/50 transition-colors text-sm"
          >
            <PlusIcon size={16} />
            <span>Add Widget</span>
          </button>
          <button
            type="button"
            onclick={cancel}
            class="flex items-center gap-2 px-3 py-1.5 text-theme-text-muted hover:text-theme-text transition-colors text-sm"
          >
            <XIcon size={16} />
            <span>Cancel</span>
          </button>
          <button
            type="button"
            onclick={save}
            disabled={saving}
            class="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary-dark transition-colors text-sm disabled:opacity-50"
          >
            {#if saving}
              <SpinnerIcon size={16} class="animate-spin" />
            {:else}
              <FloppyDiskIcon size={16} />
            {/if}
            <span>Save</span>
          </button>
        {:else}
          <ShareButton
            shareToken={current?.shareToken}
            shareType="dashboards"
            onShare={share}
            onUnshare={unshare}
          />
          <button
            type="button"
            onclick={startEditing}
            class="flex items-center gap-2 px-3 py-1.5 bg-theme-bg-canvas border border-theme-border rounded-lg hover:border-primary/50 transition-colors text-sm"
          >
            <PencilSimpleIcon size={16} />
            <span>Edit</span>
          </button>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Main Content -->
  <div class="flex-1 overflow-auto relative">
    {#if loading && !layout}
      <div class="flex items-center justify-center h-full">
        <SpinnerIcon size={32} class="animate-spin text-theme-text-muted" />
      </div>
    {:else if error && !layout}
      <div class="flex flex-col items-center justify-center h-full text-danger gap-2">
        <span>{error}</span>
        <button
          type="button"
          onclick={() => goto('/dashboards')}
          class="text-primary hover:underline text-sm"
        >
          Back to Dashboards
        </button>
      </div>
    {:else if layout}
      {#if error}
        <div class="mx-4 mt-4 px-3 py-2 rounded border border-danger/30 bg-danger/10 text-sm text-danger">
          {error}
        </div>
      {/if}
      <div class="p-4 min-h-full">
        {#key gridVersion}
          <DashboardGrid bind:this={grid} bind:layout={layout} {dashboard} />
        {/key}
      </div>

      {#if layout.widgets.length === 0 && !dashboard.editing}
        <div
          class="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-theme-bg-canvas/80"
        >
          <SquaresFourIcon size={64} class="text-theme-text-muted mb-4" />
          <h2 class="text-xl font-semibold text-theme-text-emphasis mb-2">
            This dashboard is empty
          </h2>
          {#if !$readOnlyAccess}
            <p class="text-theme-text-muted mb-6 max-w-md">
              Click "Edit" and then "Add Widget" to add widgets to your dashboard.
            </p>
            <button
              type="button"
              onclick={startEditing}
              class="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-dark transition-colors"
            >
              <PencilSimpleIcon size={20} />
              <span>Start Editing</span>
            </button>
          {/if}
        </div>
      {/if}
    {/if}

    <!-- Widget Panel (Slide-over) -->
    {#if showWidgetPanel && dashboard.editing}
      <div
        class="absolute inset-y-0 right-0 w-72 bg-theme-bg-elevated border-l border-theme-border shadow-xl flex flex-col z-40"
      >
        <div class="flex items-center justify-between px-4 py-3 border-b border-theme-border">
          <h3 class="font-semibold text-theme-text-emphasis">Add Widget</h3>
          <button
            type="button"
            onclick={() => (showWidgetPanel = false)}
            class="w-6 h-6 flex items-center justify-center rounded hover:bg-theme-bg-canvas text-theme-text-muted hover:text-theme-text transition-colors"
            aria-label="Close"
          >
            <XIcon size={16} />
          </button>
        </div>
        <div class="flex-1 overflow-auto p-3">
          <div class="space-y-2">
            {#each WIDGETS as definition (definition.type)}
              {@const Icon = definition.icon}
              <button
                type="button"
                onclick={() => {
                  grid?.add(definition)
                  showWidgetPanel = false
                }}
                class="w-full flex items-center gap-3 p-3 rounded-lg bg-theme-bg-canvas hover:bg-theme-bg border border-theme-border hover:border-primary/50 transition-colors text-left"
              >
                <div
                  class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary"
                >
                  <Icon size={20} />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-theme-text-emphasis text-sm">
                    {definition.displayName}
                  </div>
                  <div class="text-xs text-theme-text-muted truncate">{definition.description}</div>
                </div>
              </button>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
