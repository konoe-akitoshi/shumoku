<script lang="ts">
  import { Cube, GearSix, PlugsConnected, Table, Toolbox } from 'phosphor-svelte'
  import { page } from '$app/stores'

  // Extract project ID from URL
  const projectId = $derived($page.params.id ?? '')

  const navItems = $derived([
    { href: `/project/${projectId}/diagram`, label: 'Diagram', icon: Cube },
    { href: `/project/${projectId}/connections`, label: 'Connections', icon: PlugsConnected },
    { href: `/project/${projectId}/materials`, label: 'Materials', icon: Toolbox },
    { href: `/project/${projectId}/bom`, label: 'BOM', icon: Table },
    { href: `/project/${projectId}/settings`, label: 'Settings', icon: GearSix },
  ])
</script>

<nav
  class="fixed top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-2 py-1 rounded-xl bg-white/80 dark:bg-neutral-800/80 backdrop-blur-lg border border-neutral-200 dark:border-neutral-700 shadow-lg"
>
  <a
    href="/"
    class="text-[10px] font-bold text-neutral-600 dark:text-neutral-300 px-2 hover:text-primary transition-colors"
    >shumoku</a
  >
  <div class="w-px h-4 bg-neutral-200 dark:bg-neutral-600"></div>
  {#each navItems as item}
    <a
      href={item.href}
      class="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors
        {$page.url.pathname === item.href
          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
          : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700/50'}"
    >
      <svelte:component this={item.icon} class="w-3 h-3" />
      {item.label}
    </a>
  {/each}
</nav>
