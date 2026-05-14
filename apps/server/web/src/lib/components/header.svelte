<script lang="ts">
  import { CaretRightIcon, MoonIcon, SunIcon } from 'phosphor-svelte'
  import { derived } from 'svelte/store'
  import { page } from '$app/stores'
  import { dashboards } from '$lib/stores/dashboards'
  import { resolvedTheme, themeSetting } from '$lib/stores/theme'
  import { topologiesList } from '$lib/stores/topologies'

  // Generate breadcrumbs from current path
  interface Breadcrumb {
    label: string
    href: string
  }

  const routeLabels: Record<string, string> = {
    '': 'Home',
    dashboards: 'Dashboards',
    topologies: 'Topologies',
    datasources: 'Data Sources',
    plugins: 'Plugins',
    settings: 'Settings',
    edit: 'Edit',
  }

  // ID-shaped segments (e.g. "msy3HM05AczI") get resolved via the
  // matching store. Shows "…" while the entity hasn't been loaded yet.
  const ID_PATTERN = /^[A-Za-z0-9_-]{8,}$/

  const idLabels = derived(
    [topologiesList, dashboards, page],
    ([$topologies, $dashboards, $page]) => {
      const parts = $page.url.pathname.split('/').filter(Boolean)
      const labels: Record<string, string> = {}
      // Map id segments based on the parent route segment
      for (let i = 0; i < parts.length; i++) {
        const seg = parts[i]
        if (!seg || !ID_PATTERN.test(seg)) continue
        const parent = parts[i - 1]
        if (parent === 'topologies') {
          const t = $topologies.find((x) => x.id === seg)
          if (t) labels[seg] = t.name
        } else if (parent === 'dashboards') {
          const d = $dashboards.find((x) => x.id === seg)
          if (d) labels[seg] = d.name
        }
      }
      return labels
    },
  )

  $: breadcrumbs = generateBreadcrumbs($page.url.pathname, $idLabels)

  function generateBreadcrumbs(pathname: string, labels: Record<string, string>): Breadcrumb[] {
    const parts = pathname.split('/').filter(Boolean)

    if (parts.length === 0) {
      return [{ label: 'Home', href: '/' }]
    }

    const crumbs: Breadcrumb[] = [{ label: 'Home', href: '/' }]

    let currentPath = ''
    for (const part of parts) {
      currentPath += `/${part}`
      let label = routeLabels[part] ?? labels[part]
      if (!label) {
        label = ID_PATTERN.test(part) ? '…' : decodeURIComponent(part)
      }
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
        <CaretRightIcon size={16} class="text-theme-text-muted" />
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
    onclick={() => themeSetting.toggle()}
    class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-theme-bg transition-colors text-theme-text-muted hover:text-theme-text cursor-pointer"
    aria-label={$resolvedTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
  >
    {#if $resolvedTheme === 'dark'}
      <MoonIcon size={20} />
    {:else}
      <SunIcon size={20} />
    {/if}
  </button>
</header>
