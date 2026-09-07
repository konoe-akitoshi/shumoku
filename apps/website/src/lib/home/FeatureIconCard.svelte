<script lang="ts">
  import Icon, { type IconDescriptor } from './Icon.svelte'
  import { cn } from './styles'

  const cardBase =
    'rounded-2xl border border-neutral-200/70 dark:border-neutral-700/50 bg-white/90 dark:bg-neutral-800/60 overflow-hidden hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors'

  let {
    title,
    description,
    icon,
  }: {
    title: string
    description: string
    icon: IconDescriptor
  } = $props()
</script>
<div class={cn(cardBase, 'flex items-center gap-4 p-5')}>
  <div
    class="shrink-0 w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200/50 dark:border-emerald-700/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400"
  >
    <Icon value={icon} />
  </div>
  <div class="min-w-0">
    <h3 class="text-sm font-semibold">{title}</h3>
    <p class="text-xs text-neutral-500 dark:text-neutral-500">{description}</p>
  </div>
</div>
