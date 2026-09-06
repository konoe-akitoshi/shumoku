<script lang="ts" module>
  export interface IconDescriptor {
    name: string
    class?: string
  }
</script>
<script lang="ts">
  import {
    ArrowRight,
    BriefcaseBusiness,
    Code2,
    Feather,
    FileCode2,
    Landmark,
    Layers,
    LayoutGrid,
    LifeBuoy,
    Mail,
    Map as MapIcon,
    Package,
    PencilRuler,
    Plug,
    Quote,
    Radar,
    RefreshCw,
    Server,
    ShieldCheck,
    Terminal,
    Wifi,
    Wrench,
  } from '@lucide/svelte'

  const icons = {
    ArrowRightIcon: ArrowRight,
    EmailIcon: Mail,
    Code2,
    MapIcon,
    Package,
    Plug,
    Layers,
    PencilRuler,
    Server,
    Terminal,
    FileCode2,
    Radar,
    Wifi,
    LayoutGrid,
    RefreshCw,
    ShieldCheck,
    Feather,
    Landmark,
    Quote,
    BriefcaseBusiness,
    LifeBuoy,
    Wrench,
  }
  let { value }: { value?: IconDescriptor | null } = $props()
  const Component = $derived(
    value && value.name in icons ? icons[value.name as keyof typeof icons] : undefined,
  )
</script>
{#if value?.name === 'XIcon'}
  <svg class={value.class} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
    />
  </svg>
{:else if value?.name === 'GitHubIcon'}
  <svg class={value.class} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"
    />
  </svg>
{:else if Component}
  <Component class={value?.class} />
{/if}
