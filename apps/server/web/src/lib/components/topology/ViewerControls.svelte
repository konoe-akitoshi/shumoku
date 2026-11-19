<script lang="ts">
  /**
   * The camera buttons every topology view shows: zoom in, zoom out, and fit (the whole drawing
   * back in view, followed again as the drawing and the box change). `children` adds a group of
   * the host's own buttons below. `compact` is for a view inside a dashboard widget: smaller, and
   * shown only while the pointer is over the view (`TopologyView`'s root) or a button has focus.
   */
  import {
    CornersOutIcon,
    MagnifyingGlassMinusIcon,
    MagnifyingGlassPlusIcon,
  } from 'phosphor-svelte'
  import type { Snippet } from 'svelte'

  interface Props {
    onzoom: (factor: number) => void
    onfit: () => void
    compact?: boolean
    children?: Snippet
  }

  let { onzoom, onfit, compact = false, children }: Props = $props()

  const iconSize = $derived(compact ? 14 : 18)
</script>

<div class="controls" class:compact>
  <div class="control-group">
    <button type="button" onclick={() => onzoom(1.5)} title="Zoom in" aria-label="Zoom in">
      <MagnifyingGlassPlusIcon size={iconSize} />
    </button>
    <button type="button" onclick={() => onzoom(1 / 1.5)} title="Zoom out" aria-label="Zoom out">
      <MagnifyingGlassMinusIcon size={iconSize} />
    </button>
  </div>
  <div class="control-group">
    <button type="button" onclick={onfit} title="Fit to view" aria-label="Fit to view">
      <CornersOutIcon size={iconSize} />
    </button>
    {@render children?.()}
  </div>
</div>

<style>
  .controls {
    position: absolute;
    bottom: 16px;
    right: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 5;
  }

  .controls.compact {
    bottom: 8px;
    right: 8px;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.15s;
  }

  /* Shown while the pointer is over the view, or keyboard focus is on a button. Always shown where
     there is no hover (touch). */
  :global(.topology-view:hover) .controls.compact,
  .controls.compact:focus-within {
    opacity: 1;
  }

  @media (hover: none) {
    .controls.compact {
      opacity: 1;
    }
  }

  .control-group {
    display: flex;
    flex-direction: column;
    background: var(--color-bg-elevated, #ffffff);
    border: 1px solid var(--border, #e5e7eb);
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .control-group :global(button),
  .control-group :global(a) {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--color-text, #111827);
    transition: background 0.15s;
  }

  .compact .control-group :global(button),
  .compact .control-group :global(a) {
    width: 28px;
    height: 28px;
  }

  .control-group :global(button:hover),
  .control-group :global(a:hover) {
    background: var(--color-bg, #f3f4f6);
  }

  .control-group :global(button.active) {
    background: var(--primary, #3b82f6);
    color: white;
  }
</style>
