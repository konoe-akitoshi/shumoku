<script lang="ts">
import { onMount } from 'svelte'
import { browser } from '$app/environment'
import '../app.css'
import { page } from '$app/stores'
import Header from '$lib/components/header.svelte'
import House from 'phosphor-svelte/lib/House'
import TreeStructure from 'phosphor-svelte/lib/TreeStructure'
import Database from 'phosphor-svelte/lib/Database'
import GearSix from 'phosphor-svelte/lib/GearSix'
import CaretDoubleLeft from 'phosphor-svelte/lib/CaretDoubleLeft'
import CaretDoubleRight from 'phosphor-svelte/lib/CaretDoubleRight'

interface NavItem {
  href: string
  label: string
  icon: 'home' | 'topology' | 'database' | 'settings'
}

const navItems: NavItem[] = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/topologies', label: 'Topologies', icon: 'topology' },
  { href: '/datasources', label: 'Data Sources', icon: 'database' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
]

function isActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname.startsWith(href)
}

// Sidebar collapsed state
let sidebarCollapsed = false

// Apply saved theme and sidebar state on mount
onMount(() => {
  if (browser) {
    const localSettings = localStorage.getItem('shumoku-settings')
    let theme = 'light'
    if (localSettings) {
      const parsed = JSON.parse(localSettings)
      theme = parsed.theme || 'light'
      sidebarCollapsed = parsed.sidebarCollapsed || false
    }

    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }
})

function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed

  // Save to localStorage
  if (browser) {
    const localSettings = localStorage.getItem('shumoku-settings')
    const parsed = localSettings ? JSON.parse(localSettings) : {}
    parsed.sidebarCollapsed = sidebarCollapsed
    localStorage.setItem('shumoku-settings', JSON.stringify(parsed))
  }
}
</script>

<div class="flex h-screen">
  <!-- Sidebar Navigation -->
  <nav
    class="border-r border-theme-border bg-theme-bg-canvas flex flex-col transition-all duration-200 ease-in-out {sidebarCollapsed
      ? 'w-16'
      : 'w-64'}"
  >
    <div class="h-14 flex items-center justify-between px-3 border-b border-theme-border overflow-hidden">
      <div class="flex items-center gap-2 min-w-0">
        {#if !sidebarCollapsed}
          <div class="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 1024 1024" class="w-4 h-4" fill="none">
              <g transform="translate(90,40) scale(1.25)">
                <path fill="#1F2328" d="M380 340H450V505H700V555H510V645H450V645H380Z" />
              </g>
            </svg>
          </div>
          <span class="text-lg font-semibold text-theme-text-emphasis whitespace-nowrap">Shumoku</span>
        {/if}
      </div>
      <button
        onclick={toggleSidebar}
        class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-theme-bg-elevated transition-colors text-theme-text-muted hover:text-theme-text flex-shrink-0"
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {#if sidebarCollapsed}
          <CaretDoubleRight size={20} />
        {:else}
          <CaretDoubleLeft size={20} />
        {/if}
      </button>
    </div>

    <div class="flex-1 p-3">
      <div class="space-y-1">
        {#each navItems as item}
          <a
            href={item.href}
            class="flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors {isActive(
              item.href,
              $page.url.pathname
            )
              ? 'bg-primary/10 text-primary'
              : 'text-theme-text-muted hover:bg-theme-bg-elevated hover:text-theme-text'}"
            title={sidebarCollapsed ? item.label : undefined}
          >
            <span class="flex-shrink-0">
              {#if item.icon === 'home'}
                <House size={20} />
              {:else if item.icon === 'topology'}
                <TreeStructure size={20} />
              {:else if item.icon === 'database'}
                <Database size={20} />
              {:else if item.icon === 'settings'}
                <GearSix size={20} />
              {/if}
            </span>
            {#if !sidebarCollapsed}
              <span class="whitespace-nowrap">{item.label}</span>
            {/if}
          </a>
        {/each}
      </div>
    </div>

    <div class="p-3 border-t border-theme-border">
      {#if sidebarCollapsed}
        <div class="text-xs text-theme-text-muted text-center">v0.1</div>
      {:else}
        <div class="text-xs text-theme-text-muted px-3">v0.1.0</div>
      {/if}
    </div>
  </nav>

  <!-- Main Content Area -->
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- Header -->
    <Header />

    <!-- Main Content -->
    <main class="flex-1 overflow-auto">
      <slot />
    </main>
  </div>
</div>
