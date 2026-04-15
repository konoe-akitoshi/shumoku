<script lang="ts">
  import { Cube, ListBullets, PlugsConnected, Table } from 'phosphor-svelte'
  import { page } from '$app/stores'

  const navItems = [
    { href: '/', label: 'Diagram', icon: Cube },
    { href: '/specs', label: 'Specs', icon: ListBullets },
    { href: '/bom', label: 'BOM', icon: Table },
    { href: '/connections', label: 'Connections', icon: PlugsConnected },
  ]
</script>

<nav
  class="fixed top-0 left-0 right-0 z-50 h-10 flex items-center gap-1 px-3 bg-white/80 dark:bg-neutral-900/80 backdrop-blur border-b border-neutral-200 dark:border-neutral-800"
>
  <span class="text-xs font-bold text-neutral-700 dark:text-neutral-200 mr-3">shumoku</span>
  {#each navItems as item}
    <a
      href={item.href}
      class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors
        {$page.url.pathname === item.href
          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
          : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'}"
    >
      <svelte:component this={item.icon} class="w-3.5 h-3.5" />
      {item.label}
    </a>
  {/each}
</nav>
