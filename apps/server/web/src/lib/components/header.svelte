<script lang="ts">
import { page } from '$app/stores'
import { browser } from '$app/environment'
import CaretRight from 'phosphor-svelte/lib/CaretRight'
import Moon from 'phosphor-svelte/lib/Moon'
import Sun from 'phosphor-svelte/lib/Sun'

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
        <CaretRight size={16} class="text-theme-text-muted" />
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
      <Moon size={20} />
    {:else}
      <Sun size={20} />
    {/if}
  </button>
</header>
