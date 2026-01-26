<script lang="ts">
import { onMount, tick } from 'svelte'
import { page } from '$app/stores'
import { goto } from '$app/navigation'
import { browser } from '$app/environment'
import { mount, unmount } from 'svelte'
import {
  dashboardStore,
  currentDashboard,
  currentLayout,
  dashboardLoading,
  dashboardError,
  dashboardEditMode,
} from '$lib/stores/dashboards'
import { initializeWidgets, getAllWidgets, getWidget } from '$lib/widgets'
import type { WidgetPosition } from '$lib/types'
import PencilSimple from 'phosphor-svelte/lib/PencilSimple'
import FloppyDisk from 'phosphor-svelte/lib/FloppyDisk'
import X from 'phosphor-svelte/lib/X'
import Plus from 'phosphor-svelte/lib/Plus'
import Spinner from 'phosphor-svelte/lib/Spinner'
import SquaresFour from 'phosphor-svelte/lib/SquaresFour'
import TreeStructure from 'phosphor-svelte/lib/TreeStructure'
import ChartLine from 'phosphor-svelte/lib/ChartLine'
import Heart from 'phosphor-svelte/lib/Heart'
import Database from 'phosphor-svelte/lib/Database'
import Cpu from 'phosphor-svelte/lib/Cpu'
import type { GridStack, GridStackNode, GridStackWidget } from 'gridstack'

let id = $derived($page.params.id)

// UI State
let showWidgetPanel = $state(false)
let saving = $state(false)

// Grid state
let gridContainer: HTMLDivElement | null = $state(null)
let grid: GridStack | null = $state(null)
let mountedComponents = new Map<string, ReturnType<typeof mount>>()
let gridStackReady = false

// Initialize on mount
onMount(() => {
  initializeWidgets()
  dashboardStore.get(id)

  return () => {
    cleanupAllWidgets()
    if (grid) {
      grid.destroy(true)
      grid = null
    }
    dashboardStore.clearCurrent()
  }
})

// --- Helper Functions ---

function cleanupAllWidgets() {
  for (const [, component] of mountedComponents) {
    try {
      unmount(component)
    } catch {}
  }
  mountedComponents.clear()
}

function layoutToGridWidgets(widgets: typeof $currentLayout.widgets): GridStackWidget[] {
  return widgets.map((w) => ({
    id: w.id,
    x: w.position.x,
    y: w.position.y,
    w: w.position.w,
    h: w.position.h,
    minW: getWidget(w.type)?.minSize?.w || 2,
    minH: getWidget(w.type)?.minSize?.h || 2,
  }))
}

function setGridEditMode(editMode: boolean) {
  if (!grid) return
  grid.setStatic(!editMode)
  grid.enableMove(editMode)
  grid.enableResize(editMode)
}

// --- Grid Initialization ---

async function initGrid() {
  if (!browser || !gridContainer || !$currentLayout || grid) return

  try {
    const GridStackModule = await import('gridstack')
    const { GridStack } = GridStackModule
    await import('gridstack/dist/gridstack.min.css')

    // Set renderCB once (it's a static property)
    if (!gridStackReady) {
      GridStack.renderCB = (el: HTMLElement, widget: GridStackNode) => {
        const widgetId = widget.id as string
        if (!widgetId) return

        const widgetData = $currentLayout?.widgets.find((w) => w.id === widgetId)
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
              onRemove: () => removeWidget(widgetId),
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

    // Initialize grid
    const isEditMode = $dashboardEditMode
    grid = GridStack.init(
      {
        column: $currentLayout.columns || 12,
        cellHeight: $currentLayout.rowHeight || 100,
        margin: $currentLayout.margin || 8,
        float: true,
        animate: true,
        staticGrid: !isEditMode,
        disableResize: !isEditMode,
        disableDrag: !isEditMode,
      },
      gridContainer,
    )

    // Always set up event listeners (they respect static mode)
    grid.on('change', (_event: Event, items: GridStackNode[]) => {
      if (!items?.length) return
      const positions = items
        .filter((item) => item.id)
        .map((item) => ({
          id: item.id as string,
          position: {
            x: item.x ?? 0,
            y: item.y ?? 0,
            w: item.w ?? 4,
            h: item.h ?? 3,
          } as WidgetPosition,
        }))
      dashboardStore.updateWidgetPositions(positions)
    })

    grid.on('removed', (_event: Event, items: GridStackNode[]) => {
      for (const item of items) {
        const widgetId = item.id as string
        const component = mountedComponents.get(widgetId)
        if (component) {
          try {
            unmount(component)
          } catch {}
          mountedComponents.delete(widgetId)
        }
      }
    })

    // Load widgets
    grid.load(layoutToGridWidgets($currentLayout.widgets))
  } catch (e) {
    console.error('Failed to initialize GridStack:', e)
  }
}

// --- Effects ---

// Initialize grid when layout loads
$effect(() => {
  const layout = $currentLayout
  if (browser && gridContainer && layout && !grid) {
    tick().then(() => initGrid())
  }
})

// Toggle edit mode
$effect(() => {
  const editMode = $dashboardEditMode
  if (grid) {
    setGridEditMode(editMode)
  }
})

// --- Event Handlers ---

async function addWidgetToGrid(type: string) {
  if (!grid || !$currentLayout) return

  const widgetDef = getWidget(type)
  const defaultSize = widgetDef?.defaultSize || { w: 4, h: 3 }

  // Add to store
  dashboardStore.addWidget(type)
  showWidgetPanel = false

  await tick()

  // Add new widget directly to grid
  const newWidget = $currentLayout.widgets[$currentLayout.widgets.length - 1]
  if (newWidget) {
    grid.addWidget({
      id: newWidget.id,
      x: newWidget.position.x,
      y: newWidget.position.y,
      w: newWidget.position.w,
      h: newWidget.position.h,
      minW: widgetDef?.minSize?.w || 2,
      minH: widgetDef?.minSize?.h || 2,
    })
  }
}

async function handleSave() {
  saving = true
  const success = await dashboardStore.save()
  saving = false
  if (success) {
    dashboardStore.setEditMode(false)
  }
}

async function handleCancel() {
  if (!grid) return

  // Clean up and remove all widgets
  cleanupAllWidgets()
  grid.removeAll(false)

  // Restore layout
  dashboardStore.cancelEdit()
  await tick()

  // Reload widgets
  if ($currentLayout) {
    grid.load(layoutToGridWidgets($currentLayout.widgets))
  }
}

function removeWidget(widgetId: string) {
  if (grid) {
    const el = gridContainer?.querySelector(`[gs-id="${widgetId}"]`)
    if (el) grid.removeWidget(el as HTMLElement)
  }
  dashboardStore.removeWidget(widgetId)
}

// --- UI Helpers ---

function getWidgetIcon(type: string) {
  const icons: Record<string, typeof SquaresFour> = {
    topology: TreeStructure,
    'metrics-gauge': ChartLine,
    'health-status': Heart,
    'datasource-status': Database,
    'device-status': Cpu,
  }
  return icons[type] || SquaresFour
}
</script>

<svelte:head>
  <title>{$currentDashboard?.name || 'Dashboard'} - Shumoku</title>
</svelte:head>

<div class="h-full flex flex-col">
  <!-- Header -->
  <div class="flex items-center justify-between px-4 py-3 border-b border-theme-border bg-theme-bg-elevated">
    <div class="flex items-center gap-3">
      <SquaresFour size={24} class="text-primary" />
      <h1 class="text-lg font-semibold text-theme-text-emphasis">
        {$currentDashboard?.name || 'Dashboard'}
      </h1>
    </div>

    <div class="flex items-center gap-2">
      {#if $dashboardEditMode}
        <!-- Edit Mode Actions -->
        <button
          onclick={() => (showWidgetPanel = !showWidgetPanel)}
          class="flex items-center gap-2 px-3 py-1.5 bg-theme-bg-canvas border border-theme-border rounded-lg hover:border-primary/50 transition-colors text-sm"
        >
          <Plus size={16} />
          <span>Add Widget</span>
        </button>
        <button
          onclick={handleCancel}
          class="flex items-center gap-2 px-3 py-1.5 text-theme-text-muted hover:text-theme-text transition-colors text-sm"
        >
          <X size={16} />
          <span>Cancel</span>
        </button>
        <button
          onclick={handleSave}
          disabled={saving}
          class="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm disabled:opacity-50"
        >
          {#if saving}
            <Spinner size={16} class="animate-spin" />
          {:else}
            <FloppyDisk size={16} />
          {/if}
          <span>Save</span>
        </button>
      {:else}
        <!-- View Mode Actions -->
        <button
          onclick={() => dashboardStore.setEditMode(true)}
          class="flex items-center gap-2 px-3 py-1.5 bg-theme-bg-canvas border border-theme-border rounded-lg hover:border-primary/50 transition-colors text-sm"
        >
          <PencilSimple size={16} />
          <span>Edit</span>
        </button>
      {/if}
    </div>
  </div>

  <!-- Main Content -->
  <div class="flex-1 overflow-auto relative">
    {#if $dashboardLoading && !$currentLayout}
      <div class="flex items-center justify-center h-full">
        <Spinner size={32} class="animate-spin text-theme-text-muted" />
      </div>
    {:else if $dashboardError}
      <div class="flex flex-col items-center justify-center h-full text-danger gap-2">
        <span>{$dashboardError}</span>
        <button onclick={() => goto('/dashboards')} class="text-primary hover:underline text-sm">
          Back to Dashboards
        </button>
      </div>
    {:else if $currentLayout}
      <!-- Widget Grid - always render for GridStack -->
      <div
        bind:this={gridContainer}
        class="grid-stack p-4"
      >
        <!-- GridStack creates items via grid.load() and renderCB -->
      </div>

      {#if $currentLayout.widgets.length === 0 && !$dashboardEditMode}
        <!-- Empty Dashboard Overlay -->
        <div class="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-theme-bg-canvas/80">
          <SquaresFour size={64} class="text-theme-text-muted mb-4" />
          <h2 class="text-xl font-semibold text-theme-text-emphasis mb-2">
            This dashboard is empty
          </h2>
          <p class="text-theme-text-muted mb-6 max-w-md">
            Click "Edit" and then "Add Widget" to add widgets to your dashboard.
          </p>
          <button
            onclick={() => dashboardStore.setEditMode(true)}
            class="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            <PencilSimple size={20} />
            <span>Start Editing</span>
          </button>
        </div>
      {/if}
    {/if}

    <!-- Widget Panel (Slide-over) -->
    {#if showWidgetPanel}
      <div class="absolute inset-y-0 right-0 w-72 bg-theme-bg-elevated border-l border-theme-border shadow-xl flex flex-col z-10">
        <div class="flex items-center justify-between px-4 py-3 border-b border-theme-border">
          <h3 class="font-semibold text-theme-text-emphasis">Add Widget</h3>
          <button
            onclick={() => (showWidgetPanel = false)}
            class="w-6 h-6 flex items-center justify-center rounded hover:bg-theme-bg-canvas text-theme-text-muted hover:text-theme-text transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div class="flex-1 overflow-auto p-3">
          <div class="space-y-2">
            {#each getAllWidgets() as widgetDef}
              {@const IconComponent = getWidgetIcon(widgetDef.type)}
              <button
                onclick={() => addWidgetToGrid(widgetDef.type)}
                class="w-full flex items-center gap-3 p-3 rounded-lg bg-theme-bg-canvas hover:bg-theme-bg border border-theme-border hover:border-primary/50 transition-colors text-left"
              >
                <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <IconComponent size={20} />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-theme-text-emphasis text-sm">
                    {widgetDef.displayName}
                  </div>
                  <div class="text-xs text-theme-text-muted truncate">
                    {widgetDef.description}
                  </div>
                </div>
              </button>
            {/each}
          </div>
        </div>
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

  :global(.grid-stack-placeholder > .placeholder-content) {
    background-color: var(--color-primary);
    opacity: 0.2;
    border-radius: 0.5rem;
  }

  /* Static mode cursor */
  :global(.grid-stack-static > .grid-stack-item) {
    cursor: default;
  }

  /* Edit mode cursor */
  :global(.grid-stack:not(.grid-stack-static) > .grid-stack-item) {
    cursor: move;
  }
</style>
