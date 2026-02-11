<script lang="ts">
import { onMount, tick } from 'svelte'
import Logo from '$lib/components/Logo.svelte'
import { page } from '$app/stores'
import { browser } from '$app/environment'
import { mount, unmount } from 'svelte'
import { initializeWidgets, getWidget } from '$lib/widgets'
import { dashboardStore } from '$lib/stores/dashboards'
import type { WidgetInstance } from '$lib/types'
import type { GridStack, GridStackNode, GridStackWidget } from 'gridstack'

let name = $state('')
let loading = $state(true)
let error = $state('')
let widgets: WidgetInstance[] = $state([])
let layoutData: { columns?: number; rowHeight?: number; margin?: number; widgets: WidgetInstance[] } | null = $state(null)

let gridContainer: HTMLDivElement | null = $state(null)
let grid: GridStack | null = $state(null)
let mountedComponents = new Map<string, ReturnType<typeof mount>>()
let gridStackReady = false

let token = $derived($page.params.token)

onMount(() => {
  initializeWidgets()
  loadDashboard()

  return () => {
    cleanupAllWidgets()
    dashboardStore.clearCurrent()
    if (grid) {
      grid.destroy(true)
      grid = null
    }
  }
})

// Initialize grid when container is bound and data is ready
$effect(() => {
  if (browser && gridContainer && layoutData && !grid) {
    tick().then(() => initGrid(layoutData!))
  }
})

async function loadDashboard() {
  try {
    const res = await fetch(`/api/share/dashboards/${token}`)
    if (!res.ok) {
      error = res.status === 404 ? 'This shared link is no longer valid.' : 'Failed to load dashboard'
      return
    }
    const data = await res.json()
    name = data.name || 'Shared Dashboard'

    try {
      const layout = JSON.parse(data.layoutJson)
      widgets = layout.widgets || []
      layoutData = layout
      dashboardStore.setLayout(layout)
    } catch {
      error = 'Failed to parse dashboard layout'
    }
  } catch {
    error = 'Failed to load dashboard'
  } finally {
    loading = false
  }
}

function cleanupAllWidgets() {
  for (const [, component] of mountedComponents) {
    try {
      unmount(component)
    } catch {}
  }
  mountedComponents.clear()
}

async function initGrid(layout: { columns?: number; rowHeight?: number; margin?: number; widgets: WidgetInstance[] }) {
  if (!browser || !gridContainer) return

  try {
    const GridStackModule = await import('gridstack')
    const { GridStack } = GridStackModule
    await import('gridstack/dist/gridstack.min.css')

    if (!gridStackReady) {
      GridStack.renderCB = (el: HTMLElement, widget: GridStackNode) => {
        const widgetId = widget.id as string
        if (!widgetId) return

        const widgetData = widgets.find((w) => w.id === widgetId)
        if (!widgetData) return

        const widgetDef = getWidget(widgetData.type)
        if (!widgetDef) {
          el.innerHTML = `<div class="h-full flex items-center justify-center bg-theme-bg-elevated rounded-lg border border-theme-border text-theme-text-muted">Unknown widget: ${widgetData.type}</div>`
          return
        }

        try {
          const component = mount(widgetDef.component, {
            target: el,
            props: {
              id: widgetId,
              config: widgetData.config,
              editMode: false,
            },
          })
          mountedComponents.set(widgetId, component)
        } catch (e) {
          console.error(`Failed to mount widget ${widgetId}:`, e)
          el.innerHTML = `<div class="h-full flex items-center justify-center text-danger">Error loading widget</div>`
        }
      }
      gridStackReady = true
    }

    grid = GridStack.init(
      {
        column: layout.columns || 12,
        cellHeight: layout.rowHeight || 100,
        margin: layout.margin || 8,
        float: true,
        animate: true,
        staticGrid: true,
        disableResize: true,
        disableDrag: true,
      },
      gridContainer,
    )

    const gridWidgets: GridStackWidget[] = widgets.map((w) => ({
      id: w.id,
      x: w.position.x,
      y: w.position.y,
      w: w.position.w,
      h: w.position.h,
    }))

    grid.load(gridWidgets)
  } catch (e) {
    console.error('Failed to initialize GridStack:', e)
  }
}
</script>

<svelte:head>
  <title>{name || 'Shared Dashboard'} - Shumoku</title>
</svelte:head>

<div class="h-screen flex flex-col bg-theme-bg-canvas">
  <!-- Header -->
  <div class="flex items-center justify-between px-4 py-3 border-b border-theme-border bg-theme-bg-elevated">
    <div class="flex items-center gap-2">
      <Logo size={28} class="flex-shrink-0" />
      <span class="text-sm font-medium text-theme-text-emphasis">{name}</span>
      <span class="text-xs text-theme-text-muted px-2 py-0.5 bg-theme-bg rounded-full">Shared</span>
    </div>
  </div>

  <!-- Content -->
  <div class="flex-1 overflow-auto">
    {#if loading}
      <div class="flex items-center justify-center h-full">
        <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    {:else if error}
      <div class="flex items-center justify-center h-full">
        <p class="text-theme-text-muted">{error}</p>
      </div>
    {:else if widgets.length === 0}
      <div class="flex items-center justify-center h-full">
        <p class="text-theme-text-muted">This dashboard is empty.</p>
      </div>
    {:else}
      <div bind:this={gridContainer} class="grid-stack p-4">
        <!-- GridStack creates items via grid.load() and renderCB -->
      </div>
    {/if}
  </div>
</div>

<style>
  :global(.grid-stack) {
    background: transparent;
    min-height: 100%;
  }

  :global(.grid-stack-item-content) {
    background: transparent;
    overflow: hidden;
  }

  :global(.grid-stack-static > .grid-stack-item) {
    cursor: default;
  }
</style>
