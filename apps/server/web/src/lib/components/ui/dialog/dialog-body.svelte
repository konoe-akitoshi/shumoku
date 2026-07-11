<script lang="ts">
  // Wrap any variable-height content between Dialog.Header/Dialog.Footer in this
  // so header/footer stay pinned and only the body scrolls. Content placed
  // directly in Dialog.Content (skipping this) still works, but the whole
  // dialog scrolls together as a fallback — see dialog-content.svelte.
  import type { WithElementRef } from 'bits-ui'
  import type { HTMLAttributes } from 'svelte/elements'
  import { cn } from '$lib/utils.js'

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props()
</script>

<div
  bind:this={ref}
  data-slot="dialog-body"
  class={cn('-mx-1 min-h-0 flex-1 overflow-y-auto px-1', className)}
  {...restProps}
>
  {@render children?.()}
</div>
