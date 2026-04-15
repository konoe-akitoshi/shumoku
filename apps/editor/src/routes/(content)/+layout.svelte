<script lang="ts">
  let { children } = $props()
</script>

<div class="h-screen overflow-auto pt-16 px-6 pb-6 bg-white dark:bg-neutral-950">
  {@render children()}
</div>
