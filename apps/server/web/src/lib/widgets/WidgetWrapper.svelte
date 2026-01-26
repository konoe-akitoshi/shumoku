<script lang="ts">
import X from 'phosphor-svelte/lib/X'
import GearSix from 'phosphor-svelte/lib/GearSix'
import { dashboardEditMode } from '$lib/stores/dashboards'

interface Props {
  title: string
  onRemove?: () => void
  onSettings?: () => void
  class?: string
}

let { title, onRemove, onSettings, class: className = '' }: Props = $props()

// Subscribe to edit mode store directly
let editMode = $derived($dashboardEditMode)
</script>

<div class="h-full flex flex-col bg-theme-bg-elevated rounded-lg border border-theme-border overflow-hidden {className}">
  <!-- Widget Header -->
  <div class="flex items-center justify-between px-3 py-2 border-b border-theme-border bg-theme-bg-canvas">
    <h3 class="text-sm font-medium text-theme-text-emphasis truncate">{title}</h3>
    {#if editMode}
      <div class="flex items-center gap-1">
        {#if onSettings}
          <button
            onclick={onSettings}
            class="w-6 h-6 flex items-center justify-center rounded hover:bg-theme-bg-elevated text-theme-text-muted hover:text-theme-text transition-colors"
            title="Widget settings"
          >
            <GearSix size={14} />
          </button>
        {/if}
        {#if onRemove}
          <button
            onclick={onRemove}
            class="w-6 h-6 flex items-center justify-center rounded hover:bg-danger/10 text-theme-text-muted hover:text-danger transition-colors"
            title="Remove widget"
          >
            <X size={14} />
          </button>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Widget Content -->
  <div class="flex-1 overflow-auto p-3">
    <slot />
  </div>
</div>
