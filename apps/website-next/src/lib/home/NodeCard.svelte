<script lang="ts">
  import Icon, { type IconDescriptor } from './Icon.svelte'

  const builtinIcons: Record<string, IconDescriptor> = {
    YAML: { name: 'FileCode2', class: 'w-7 h-7 shrink-0 text-neutral-500 dark:text-neutral-400' },
    'Custom API': {
      name: 'Plug',
      class: 'w-7 h-7 shrink-0 text-neutral-500 dark:text-neutral-400',
    },
    'Network scan': {
      name: 'Radar',
      class: 'w-7 h-7 shrink-0 text-neutral-500 dark:text-neutral-400',
    },
    ネットワークスキャン: {
      name: 'Radar',
      class: 'w-7 h-7 shrink-0 text-neutral-500 dark:text-neutral-400',
    },
    'Aruba Instant On': {
      name: 'Wifi',
      class: 'w-7 h-7 shrink-0 text-neutral-500 dark:text-neutral-400',
    },
  }
  let {
    title,
    description,
    tag,
    logo,
  }: {
    title: string
    description: string
    tag?: string
    logo?: string
  } = $props()
</script>
<div
  class="flex items-center gap-3 px-4 py-3 rounded-xl border border-neutral-200/70 dark:border-neutral-700/50 bg-white/90 dark:bg-neutral-800/60 w-full"
>
  {#if logo}
    <img src={logo} alt={title} class="w-7 h-7 shrink-0 object-contain">
  {:else}
    <Icon value={builtinIcons[title]} />
  {/if}
  <div class="min-w-0 flex-1">
    <div class="flex items-center gap-2">
      <span class="text-sm font-semibold">{title}</span>
      {#if tag}
        <span
          class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400"
        >
          {tag}
        </span>
      {/if}
    </div>
    <p class="text-xs text-neutral-500 dark:text-neutral-500 mt-0.5">{description}</p>
  </div>
</div>
