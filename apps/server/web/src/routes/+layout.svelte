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
    <!-- Header: Logo & Toggle -->
    <div class="h-14 flex items-center justify-between px-3 border-b border-theme-border">
      {#if !sidebarCollapsed}
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 1024 1024" class="w-4 h-4" fill="none">
              <g transform="translate(90,40) scale(1.25)">
                <path fill="#1F2328" d="M380 340H450V505H700V555H510V645H450V645H380Z" />
              </g>
            </svg>
          </div>
          <span class="text-lg font-semibold text-theme-text-emphasis whitespace-nowrap">Shumoku</span>
        </div>
      {/if}
      <button
        onclick={toggleSidebar}
        class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-theme-bg-elevated transition-colors text-theme-text-muted hover:text-theme-text {sidebarCollapsed
          ? 'mx-auto'
          : 'flex-shrink-0'}"
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {#if sidebarCollapsed}
          <CaretDoubleRight size={20} />
        {:else}
          <CaretDoubleLeft size={20} />
        {/if}
      </button>
    </div>

    <!-- Navigation Items -->
    <div class="flex-1 py-3 px-2">
      <div class="space-y-1">
        {#each navItems as item}
          <a
            href={item.href}
            class="flex items-center h-10 text-sm rounded-lg transition-colors {sidebarCollapsed
              ? 'justify-center w-10 mx-auto'
              : 'gap-3 px-3'} {isActive(item.href, $page.url.pathname)
              ? 'bg-primary/10 text-primary'
              : 'text-theme-text-muted hover:bg-theme-bg-elevated hover:text-theme-text'}"
            title={sidebarCollapsed ? item.label : undefined}
          >
            {#if item.icon === 'home'}
              <House size={20} />
            {:else if item.icon === 'topology'}
              <TreeStructure size={20} />
            {:else if item.icon === 'database'}
              <Database size={20} />
            {:else if item.icon === 'settings'}
              <GearSix size={20} />
            {/if}
            {#if !sidebarCollapsed}
              <span class="whitespace-nowrap">{item.label}</span>
            {/if}
          </a>
        {/each}
      </div>
    </div>

    <!-- Footer: Version -->
    <div class="py-3 px-2 border-t border-theme-border">
      <div class="text-xs text-theme-text-muted {sidebarCollapsed ? 'text-center' : 'px-3'}">
        {sidebarCollapsed ? 'v0.1' : 'v0.1.0'}
      </div>
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
