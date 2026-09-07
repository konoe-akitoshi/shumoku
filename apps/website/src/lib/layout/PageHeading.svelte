<script lang="ts">
  let { title, description }: { title: string; description?: string } = $props()
</script>
<div class="site-container page-heading">
  <h1>{title}</h1>
  {#if description}
    <p>{description}</p>
  {/if}
</div>
<style>
  .page-heading {
    padding-top: 4rem;
    padding-bottom: 2rem;
  }
  h1 {
    font-size: clamp(2rem, 4vw, 3rem);
    font-weight: 600;
    letter-spacing: -0.035em;
    line-height: 1.2;
  }
  p {
    max-width: 42rem;
    margin-top: 1.25rem;
    color: var(--site-muted);
    line-height: 1.8;
  }
</style>
