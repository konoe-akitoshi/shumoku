<script lang="ts" module>
  import type { HTMLInputAttributes } from 'svelte/elements'

  export type InputProps = HTMLInputAttributes & {
    value?: string | number
  }
</script>

<script lang="ts">
  import { cn } from '$lib/utils.js'

  let { class: className, value = $bindable(), ...restProps }: InputProps = $props()
</script>

<input
  bind:value
  class={cn(
    'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
    className,
  )}
  {...restProps}
>
