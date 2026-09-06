<script lang="ts">
  import { cn } from './styles'

  const cardBase =
    'rounded-2xl border border-neutral-200/70 dark:border-neutral-700/50 bg-white/90 dark:bg-neutral-800/60 overflow-hidden hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors'
  const imgBorder = 'rounded-lg border border-neutral-100 dark:border-neutral-700/30'
  let {
    title,
    description,
    image,
    imageAlt,
    class: className,
  }: {
    title: string
    description: string
    image: string
    imageAlt: string
    class?: string
  } = $props()
</script>
<div class={cn(cardBase, 'flex flex-col h-full', className)}>
  <div class="p-4 pb-2 shrink-0">
    <h3 class="text-sm font-semibold">{title}</h3>
    <p class="text-xs text-neutral-500 dark:text-neutral-500">{description}</p>
  </div>
  <div class="px-2.5 pb-2.5 flex-1 min-h-0">
    <img src={image} alt={imageAlt} class={cn('w-full h-full object-cover object-top', imgBorder)}>
  </div>
</div>
