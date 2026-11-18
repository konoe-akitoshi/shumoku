<script lang="ts">
  import { CaretRightIcon } from 'phosphor-svelte'
  import { page } from '$app/state'
  import { dashboards } from '$lib/stores/dashboards'
  import { topologiesList } from '$lib/stores/topologies'
  import ThemeToggle from './ThemeToggle.svelte'

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
    // Topology subroute tabs (post routes refactor — each is a real
    // page, so the breadcrumb needs labels for them). Otherwise the
    // ID_PATTERN heuristic below treats "discovery"/"resolved" as an
    // ID and shows "…".
    sources: 'Sources',
    discovery: 'Discovery',
    mapping: 'Mapping',
    resolved: 'Resolved',
  }

  // ID-shaped segments (e.g. "msy3HM05AczI") get resolved via the
  // matching store. Shows "…" while the entity hasn't been loaded yet.
  const ID_PATTERN = /^[A-Za-z0-9_-]{8,}$/

  const idLabels = $derived.by(() => {
    const parts = page.url.pathname.split('/').filter(Boolean)
    const labels: Record<string, string> = {}
    // Map id segments based on the parent route segment
    for (const [i, seg] of parts.entries()) {
      if (!ID_PATTERN.test(seg)) continue
      const parent = parts[i - 1]
      if (parent === 'topologies') {
        const t = $topologiesList.find((x) => x.id === seg)
        if (t) labels[seg] = t.name
      } else if (parent === 'dashboards') {
        const d = $dashboards.find((x) => x.id === seg)
        if (d) labels[seg] = d.name
      }
    }
    return labels
  })

  const breadcrumbs = $derived(generateBreadcrumbs(page.url.pathname, idLabels))

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

  <ThemeToggle />
</header>
