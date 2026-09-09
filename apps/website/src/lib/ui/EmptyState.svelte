<script lang="ts">
  import type { Snippet } from 'svelte'
  import './ui.css'
  interface Props {
    title: string
    description?: string
    actions?: Snippet
  }
  let { title, description, actions }: Props = $props()
</script>

<div class="ui-empty-state">
  <p class="ui-empty-title">{title}</p>
  {#if description}
    <p class="ui-empty-description">{description}</p>
  {/if}
  {#if actions}
    <div class="ui-empty-actions">{@render actions()}</div>
  {/if}
</div>

<style>
  .ui-empty-state {
    display: grid;
    justify-items: start;
    gap: var(--ui-space-2);
    padding: var(--ui-space-4) var(--ui-space-6);
    min-inline-size: 0;
    font-size: var(--ui-type-body);
    line-height: var(--ui-leading);
    overflow-wrap: anywhere;
  }
  p {
    margin: 0;
  }
  .ui-empty-title {
    color: var(--site-fg);
    font-weight: 500;
  }
  .ui-empty-description {
    color: var(--site-muted);
    max-inline-size: 50ch;
  }
  .ui-empty-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ui-space-2);
    margin-block-start: var(--ui-space-2);
  }
</style>
