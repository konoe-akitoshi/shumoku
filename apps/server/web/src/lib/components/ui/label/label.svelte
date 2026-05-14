<script lang="ts" module>
  import type { Snippet } from 'svelte'
  import type { HTMLLabelAttributes } from 'svelte/elements'

  export type LabelProps = HTMLLabelAttributes & {
    children?: Snippet
  }
</script>

<script lang="ts">
  import { cn } from '$lib/utils.js'

  let { class: className, children, ...restProps }: LabelProps = $props()
</script>

<label
  class={cn(
    'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
    className,
  )}
  {...restProps}
>
  {@render children?.()}
</label>
