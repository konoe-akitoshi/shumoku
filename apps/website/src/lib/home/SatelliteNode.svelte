<script lang="ts">
  import Icon, { type IconDescriptor } from './Icon.svelte'

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
<div class="flex flex-col items-center gap-2 w-40">
  <div
    class="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200/50 dark:border-emerald-700/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400"
  >
    <Icon value={icon} />
  </div>
  <div class="text-center">
    <div class="text-sm font-semibold">{title}</div>
    <div class="text-xs text-neutral-500 dark:text-neutral-500 mt-0.5">{description}</div>
  </div>
</div>
