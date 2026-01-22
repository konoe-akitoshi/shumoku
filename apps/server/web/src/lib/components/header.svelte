<script lang="ts">
  import { page } from '$app/stores'
  import { browser } from '$app/environment'

  // Theme state
  let theme = 'light'

  // Initialize theme from localStorage
  $: if (browser) {
    const localSettings = localStorage.getItem('shumoku-settings')
    if (localSettings) {
      const parsed = JSON.parse(localSettings)
      theme = parsed.theme || 'light'
    }
  }

  function toggleTheme() {
    theme = theme === 'light' ? 'dark' : 'light'

    // Save to localStorage
    const localSettings = localStorage.getItem('shumoku-settings')
    const parsed = localSettings ? JSON.parse(localSettings) : {}
    parsed.theme = theme
    localStorage.setItem('shumoku-settings', JSON.stringify(parsed))

    // Apply theme
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  // Generate breadcrumbs from current path
  interface Breadcrumb {
    label: string
    href: string
  }

  const routeLabels: Record<string, string> = {
    '': 'Home',
    topologies: 'Topologies',
    datasources: 'Data Sources',
    settings: 'Settings',
    edit: 'Edit',
  }

  $: breadcrumbs = generateBreadcrumbs($page.url.pathname)

  function generateBreadcrumbs(pathname: string): Breadcrumb[] {
    const parts = pathname.split('/').filter(Boolean)

    if (parts.length === 0) {
      return [{ label: 'Home', href: '/' }]
    }

    const crumbs: Breadcrumb[] = [{ label: 'Home', href: '/' }]

    let currentPath = ''
    for (const part of parts) {
      currentPath += `/${part}`
      const label = routeLabels[part] || decodeURIComponent(part)
      crumbs.push({ label, href: currentPath })
    }

    return crumbs
  }
</script>

<header class="h-14 border-b border-theme-border bg-theme-bg-elevated flex items-center px-4 gap-4">
  <!-- Breadcrumbs -->
  <nav class="flex items-center gap-2 text-sm flex-1">
    {#each breadcrumbs as crumb, i}
      {#if i > 0}
        <svg class="w-4 h-4 text-theme-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      {/if}
      {#if i === breadcrumbs.length - 1}
        <span class="text-theme-text-emphasis font-medium">{crumb.label}</span>
      {:else}
        <a href={crumb.href} class="text-theme-text-muted hover:text-theme-text transition-colors">
          {crumb.label}
        </a>
      {/if}
    {/each}
  </nav>

  <!-- Theme Toggle -->
  <button
    onclick={toggleTheme}
    class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-theme-bg transition-colors text-theme-text-muted hover:text-theme-text"
    aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
  >
    {#if theme === 'light'}
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    {:else}
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    {/if}
  </button>
</header>
