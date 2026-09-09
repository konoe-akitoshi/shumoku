<script lang="ts">
  import Panel from '$lib/ui/Panel.svelte'
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
<Panel variant="ruled" class="flex items-start gap-4">
  <div class="feature-icon" aria-hidden="true"><Icon value={icon} /></div>
  <div class="min-w-0">
    <h3 class="text-sm font-semibold">{title}</h3>
    <p class="description">{description}</p>
  </div>
</Panel>

<style>
  .feature-icon {
    flex-shrink: 0;
    color: var(--site-muted);
    padding-block: var(--ui-space-1);
  }
  .description {
    font-size: var(--ui-type-body);
    line-height: var(--ui-leading);
    color: var(--site-muted);
  }
</style>
