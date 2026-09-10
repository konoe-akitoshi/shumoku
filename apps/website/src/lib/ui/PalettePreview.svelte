<script lang="ts">
  const roles = [
    ['Canvas', '--site-bg'],
    ['Surface', '--ui-surface'],
    ['Field / shell', '--ui-field-surface'],
    ['Hover', '--ui-control-hover'],
    ['Selected', '--ui-control-active'],
    ['Primary', '--ui-primary'],
    ['Text', '--site-fg'],
    ['Secondary text', '--site-muted'],
    ['Focus / link', '--site-accent'],
    ['Error', '--ui-danger'],
  ]
</script>

<ul class="palette">
  {#each roles as [label, token]}
    <li>
      <span class="swatch" style:background={`var(${token})`} aria-hidden="true"></span>
      <span>{label}</span>
      <small>{token}</small>
    </li>
  {/each}
</ul>

<style>
  .palette {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: var(--ui-space-4);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: grid;
    gap: var(--ui-space-1);
    min-inline-size: 0;
  }
  .swatch {
    display: block;
    block-size: var(--ui-space-12);
    border-radius: var(--ui-radius);
  }
  small {
    color: var(--site-muted);
    overflow-wrap: anywhere;
  }
</style>
