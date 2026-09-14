<script lang="ts">
  import type { Picture } from 'vite-imagetools'
  import Panel from '$lib/ui/Panel.svelte'
  import { cn } from './styles'

  const imgBorder = 'rounded-md border border-neutral-100 dark:border-neutral-700/30'
  let {
    title,
    description,
    image,
    imageAlt,
    sizes,
    class: className,
  }: {
    title: string
    description: string
    image: Picture
    imageAlt: string
    sizes: string
    class?: string
  } = $props()
</script>
<Panel padded={false} class={cn('flex flex-col h-full overflow-hidden rounded-2xl', className)}>
  <div class="p-4 pb-2 shrink-0">
    <h3 class="text-sm font-semibold">{title}</h3>
    <p class="text-xs text-neutral-500 dark:text-neutral-500">{description}</p>
  </div>
  <div class="px-2.5 pb-2.5 flex-1 min-h-0 [&_picture]:block [&_picture]:h-full">
    <enhanced:img
      src={image}
      alt={imageAlt}
      {sizes}
      loading="lazy"
      decoding="async"
      class={cn('w-full h-full object-cover object-top', imgBorder)}
    />
  </div>
</Panel>
