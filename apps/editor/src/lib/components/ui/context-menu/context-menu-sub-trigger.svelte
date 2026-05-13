<script lang="ts">
  import { ContextMenu as ContextMenuPrimitive } from 'bits-ui'
  import CaretRightIcon from 'phosphor-svelte/lib/CaretRight'
  import { cn, type WithoutChild } from '$lib/utils.js'

  let {
    ref = $bindable(null),
    class: className,
    inset,
    children,
    ...restProps
  }: WithoutChild<ContextMenuPrimitive.SubTriggerProps> & {
    inset?: boolean
  } = $props()
</script>

<ContextMenuPrimitive.SubTrigger
  bind:ref
  data-slot="context-menu-sub-trigger"
  data-inset={inset}
  class={cn(
		"focus:bg-accent focus:text-accent-foreground data-open:bg-accent data-open:text-accent-foreground gap-2 rounded-none px-2 py-2 text-xs data-inset:pl-7 [&_svg:not([class*='size-'])]:size-4 flex cursor-default items-center outline-hidden select-none data-inset:ps-8 [&_svg]:pointer-events-none [&_svg]:shrink-0",
		className
	)}
  {...restProps}
>
  {@render children?.()}
  <CaretRightIcon class="ml-auto" />
</ContextMenuPrimitive.SubTrigger>
