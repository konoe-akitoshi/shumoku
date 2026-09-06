<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    id,
    title,
    description = '',
    children,
  }: { id: string; title: string; description?: string; children: Snippet } = $props()
</script>
<section {id} aria-labelledby={`${id}-title`}>
  <div class="section-heading">
    <h2 id={`${id}-title`}>{title}</h2>
    {#if description}
      <p>{description}</p>
    {/if}
  </div>
  {@render children()}
</section>
