<script lang="ts">
  let { direction }: { direction: 'right' | 'left' } = $props()
</script>
<div class="hidden lg:flex items-center px-1">
  <div class="w-10 border-t-2 border-dashed border-neutral-300 dark:border-neutral-600 relative">
    {#if direction === 'right'}
      <div
        class="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-[5px] border-l-neutral-300 dark:border-l-neutral-600 border-y-[4px] border-y-transparent"
      ></div>
    {/if}
    {#if direction === 'left'}
      <div
        class="absolute left-0 top-1/2 -translate-y-1/2 w-0 h-0 border-r-[5px] border-r-neutral-300 dark:border-r-neutral-600 border-y-[4px] border-y-transparent"
      ></div>
    {/if}
  </div>
</div>
