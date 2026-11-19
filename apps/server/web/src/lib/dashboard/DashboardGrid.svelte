<script lang="ts">
  /**
   * A dashboard's widgets on its grid: the same for a workspace dashboard and a shared one, which
   * differ only in the `DashboardState` given (its reader, and whether it can be edited).
   *
   * The widgets are Svelte components rendered here; `@appulsauce/svelte-grid` only places them
   * and, while editing, moves and resizes them (by the header) into `layout`, which is bound.
   */
  import Grid, { type GridController, GridItem } from '@appulsauce/svelte-grid'
  import { nanoid } from '$lib/utils/id'
  import { type DashboardState, provideDashboard } from './dashboard.svelte'
  import { type DashboardLayout, rowBelow } from './layout'
  import WidgetFrame from './WidgetFrame.svelte'
  import WidgetSettings from './WidgetSettings.svelte'
  import { type WidgetDefinition, withDefaults } from './widget-types'
  import { widgetDefinition } from './widgets'

  interface Props {
    layout: DashboardLayout
    dashboard: DashboardState
  }

  let { layout = $bindable(), dashboard }: Props = $props()
  // svelte-ignore state_referenced_locally
  provideDashboard(dashboard)

  let controller = $state<GridController>()
  /** The widget whose settings are open. */
  let settingsFor = $state<string | null>(null)
  const settingsWidget = $derived(layout.widgets.find((w) => w.id === settingsFor))
  const settingsDefinition = $derived(
    settingsWidget ? widgetDefinition(settingsWidget.type) : undefined,
  )

  /** Add a widget where it first fits, and open its settings when it needs any to show. */
  export function add(definition: WidgetDefinition): void {
    const { w, h } = definition.defaultSize
    const at = controller?.getFirstAvailablePosition(w, h) ?? { x: 0, y: rowBelow(layout.widgets) }
    const id = nanoid()
    layout.widgets.push({
      id,
      type: definition.type,
      config: withDefaults(definition, {}),
      position: { ...at, w, h },
    })
    if ((definition.configSchema.required ?? []).length > 0) settingsFor = id
  }

  function remove(id: string): void {
    layout.widgets = layout.widgets.filter((w) => w.id !== id)
    if (settingsFor === id) settingsFor = null
  }
</script>

<Grid
  cols={layout.columns}
  itemSize={{ height: layout.rowHeight }}
  gap={layout.margin}
  collision="push"
  readOnly={!dashboard.editing}
  skipOffscreen={false}
  bind:controller
>
  {#each layout.widgets as widget (widget.id)}
    {@const definition = widgetDefinition(widget.type)}
    <GridItem
      id={widget.id}
      bind:x={widget.position.x}
      bind:y={widget.position.y}
      bind:w={widget.position.w}
      bind:h={widget.position.h}
      min={definition?.minSize ?? { w: 2, h: 2 }}
      class="dashboard-item"
      activeClass="dashboard-item-active"
      previewClass="dashboard-item-preview"
    >
      {#snippet moveHandle({ moveStart })}
        <!-- Over the header, under its buttons: the widget's own content stays usable. -->
        <div class="dashboard-move-handle" onpointerdown={moveStart} aria-hidden="true"></div>
      {/snippet}
      {#snippet resizeHandle({ resizeStart })}
        <div
          class="dashboard-resize-handle"
          onpointerdown={resizeStart}
          aria-hidden="true"
        ></div>
      {/snippet}
      <WidgetFrame
        {widget}
        {definition}
        onsettings={() => (settingsFor = widget.id)}
        onremove={() => remove(widget.id)}
      />
    </GridItem>
  {/each}
</Grid>

{#if settingsWidget && settingsDefinition}
  <WidgetSettings
    bind:open={() => settingsFor !== null, (open) => {
      if (!open) settingsFor = null
    }}
    widget={settingsWidget}
    definition={settingsDefinition}
    onapply={(config) => {
      settingsWidget.config = config
    }}
  />
{/if}

<style>
  :global(.dashboard-item) {
    transition:
      left 0.2s ease-in-out,
      top 0.2s ease-in-out;
  }

  :global(.dashboard-item-active) {
    opacity: 0.8;
    z-index: 30;
  }

  :global(.dashboard-item-preview) {
    background-color: var(--color-primary);
    opacity: 0.2;
    border-radius: 0.5rem;
    transition: all 0.2s;
  }

  .dashboard-move-handle {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2.25rem; /* the frame's header (h-9) */
    z-index: 10;
    cursor: move;
    touch-action: none;
  }

  .dashboard-resize-handle {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 20px;
    height: 20px;
    z-index: 20;
    cursor: se-resize;
    touch-action: none;
  }

  .dashboard-resize-handle::after {
    content: '';
    position: absolute;
    right: 4px;
    bottom: 4px;
    width: 6px;
    height: 6px;
    border-right: 2px solid var(--color-text-muted, rgba(0, 0, 0, 0.4));
    border-bottom: 2px solid var(--color-text-muted, rgba(0, 0, 0, 0.4));
  }
</style>
