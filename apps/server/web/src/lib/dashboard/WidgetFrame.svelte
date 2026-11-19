<script lang="ts">
  /**
   * The card a widget sits in: a header with its title (and, while editing, settings and remove),
   * and the widget. The grid lays a drag handle over the header while editing, so the widget
   * itself stays usable. A widget that fails shows its error here, not over the dashboard.
   */
  import { GearSixIcon, XIcon } from 'phosphor-svelte'
  import { useDashboard } from './dashboard.svelte'
  import type { WidgetInstance } from './layout'
  import { configString, type WidgetDefinition, withDefaults } from './widget-types'

  interface Props {
    widget: WidgetInstance
    definition: WidgetDefinition | undefined
    onsettings: () => void
    onremove: () => void
  }

  let { widget, definition, onsettings, onremove }: Props = $props()
  const dashboard = useDashboard()

  /** What the widget named itself (a topology's name), under a title the config gives. */
  let ownTitle = $state('')
  const title = $derived(
    configString(widget.config, 'title') || ownTitle || definition?.displayName || widget.type,
  )
  const config = $derived(definition ? withDefaults(definition, widget.config) : {})
  const unavailable = $derived(
    !definition
      ? `Unknown widget: ${widget.type}`
      : dashboard.reader.shared && !definition.shareable
        ? 'Not available in a shared view'
        : null,
  )
</script>

<div
  class="h-full flex flex-col bg-theme-bg-elevated rounded-lg border border-theme-border overflow-hidden"
>
  <div
    class="h-9 shrink-0 flex items-center justify-between gap-2 px-3 border-b border-theme-border bg-theme-bg-canvas"
  >
    <h3 class="text-sm font-medium text-theme-text-emphasis truncate">{title}</h3>
    {#if dashboard.editing}
      <!-- Above the grid's drag handle, which covers the header. -->
      <div class="relative z-20 flex items-center gap-1">
        {#if definition}
          <button
            type="button"
            onclick={onsettings}
            class="w-6 h-6 flex items-center justify-center rounded hover:bg-theme-bg-elevated text-theme-text-muted hover:text-theme-text transition-colors"
            title="Widget settings"
            aria-label="Widget settings"
          >
            <GearSixIcon size={14} />
          </button>
        {/if}
        <button
          type="button"
          onclick={onremove}
          class="w-6 h-6 flex items-center justify-center rounded hover:bg-danger/10 text-theme-text-muted hover:text-danger transition-colors"
          title="Remove widget"
          aria-label="Remove widget"
        >
          <XIcon size={14} />
        </button>
      </div>
    {/if}
  </div>

  <div class="flex-1 min-h-0 relative {definition?.bleed ? 'overflow-hidden' : 'overflow-auto p-3'}">
    {#if unavailable || !definition}
      <div class="h-full flex items-center justify-center text-sm text-theme-text-muted p-3">
        {unavailable}
      </div>
    {:else}
      {@const Widget = definition.component}
      <svelte:boundary>
        <Widget
          id={widget.id}
          {config}
          setTitle={(t) => (ownTitle = t)}
          openSettings={dashboard.editing ? onsettings : undefined}
        />
        {#snippet failed(error, reset)}
          <div class="h-full flex flex-col items-center justify-center gap-2 text-danger p-3">
            <span class="text-sm text-center">
              {error instanceof Error ? error.message : 'This widget failed'}
            </span>
            <button type="button" onclick={reset} class="text-xs text-primary hover:underline">
              Retry
            </button>
          </div>
        {/snippet}
      </svelte:boundary>
    {/if}
  </div>
</div>
