<script lang="ts">
  import { onMount } from 'svelte'
  import { browser } from '$app/environment'
  import '../app.css'
  import { page } from '$app/stores'
  import Header from '$lib/components/header.svelte'

  interface NavItem {
    href: string
    label: string
    icon: string
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
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          {#if sidebarCollapsed}
            <path d="M13 17l5-5-5-5M6 17l5-5-5-5" />
          {:else}
            <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
          {/if}
        </svg>
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
            {#if item.icon === 'home'}
              <svg
                class="w-5 h-5 flex-shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            {:else if item.icon === 'topology'}
              <svg
                class="w-5 h-5 flex-shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="12" cy="5" r="3" />
                <circle cx="5" cy="19" r="3" />
                <circle cx="19" cy="19" r="3" />
                <line x1="12" y1="8" x2="5" y2="16" />
                <line x1="12" y1="8" x2="19" y2="16" />
              </svg>
            {:else if item.icon === 'database'}
              <svg
                class="w-5 h-5 flex-shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
            {:else if item.icon === 'settings'}
              <svg
                class="w-5 h-5 flex-shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="12" cy="12" r="3" />
                <path
                  d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
                />
              </svg>
            {/if}
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
