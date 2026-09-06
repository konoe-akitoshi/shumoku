<script lang="ts">
  let { orientation }: { orientation: 'vertical' | 'horizontal' } = $props()
</script>
{#if orientation === 'vertical'}
  <div class="flex justify-center py-1">
    <div
      class="w-px h-10 border-l-2 border-dashed border-emerald-300 dark:border-emerald-700/40"
    ></div>
  </div>
{:else}
  <div class="flex items-center px-2">
    <div
      class="h-px w-12 border-t-2 border-dashed border-emerald-300 dark:border-emerald-700/40"
    ></div>
  </div>
{/if}
