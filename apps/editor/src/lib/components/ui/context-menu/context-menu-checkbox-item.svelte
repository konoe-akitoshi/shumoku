<script lang="ts">
  import { ContextMenu as ContextMenuPrimitive } from 'bits-ui'
  import CheckIcon from 'phosphor-svelte/lib/Check'
  import type { Snippet } from 'svelte'
  import { cn, type WithoutChildrenOrChild } from '$lib/utils.js'

  let {
    ref = $bindable(null),
    checked = $bindable(false),
    indeterminate = $bindable(false),
    class: className,
    inset,
    children: childrenProp,
    ...restProps
  }: WithoutChildrenOrChild<ContextMenuPrimitive.CheckboxItemProps> & {
    inset?: boolean
    children?: Snippet
  } = $props()
</script>

<ContextMenuPrimitive.CheckboxItem
  bind:ref
  bind:checked
  bind:indeterminate
  data-slot="context-menu-checkbox-item"
  data-inset={inset}
  class={cn(
		"focus:bg-accent focus:text-accent-foreground gap-2 rounded-none py-2 pr-8 pl-2 text-xs data-inset:pl-7 [&_svg:not([class*='size-'])]:size-4 relative flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
		className
	)}
  {...restProps}
>
  {#snippet children({ checked })}
    <span class="absolute right-2 pointer-events-none">
      {#if checked}
        <CheckIcon />
      {/if}
    </span>
    {@render childrenProp?.()}
  {/snippet}
</ContextMenuPrimitive.CheckboxItem>
