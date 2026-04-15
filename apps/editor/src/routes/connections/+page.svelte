<script lang="ts">
  import { diagramState } from '$lib/context.svelte'

  interface ConnectionRow {
    id: string
    fromNode: string
    fromPort: string
    toNode: string
    toPort: string
    bandwidth: string
    vlan: string
    fromIp: string
    toIp: string
    label: string
  }

  const rows = $derived.by<ConnectionRow[]>(() => {
    return diagramState.links.map((link, i) => {
      const from = typeof link.from === 'object' ? link.from : { node: link.from }
      const to = typeof link.to === 'object' ? link.to : { node: link.to }
      const rawFromIp = 'ip' in from ? from.ip : undefined
      const rawToIp = 'ip' in to ? to.ip : undefined
      return {
        id: link.id ?? `link-${i}`,
        fromNode: from.node,
        fromPort: 'port' in from ? (from.port ?? '') : '',
        toNode: to.node,
        toPort: 'port' in to ? (to.port ?? '') : '',
        bandwidth: link.bandwidth ?? '',
        vlan: link.vlan
          ? Array.isArray(link.vlan)
            ? link.vlan.join(', ')
            : String(link.vlan)
          : '',
        fromIp: rawFromIp ? (Array.isArray(rawFromIp) ? rawFromIp.join(', ') : rawFromIp) : '',
        toIp: rawToIp ? (Array.isArray(rawToIp) ? rawToIp.join(', ') : rawToIp) : '',
        label: Array.isArray(link.label) ? link.label.join(', ') : (link.label ?? ''),
      }
    })
  })
</script>

<div class="h-[calc(100vh-2.5rem)] overflow-auto px-6 py-4 bg-white dark:bg-neutral-950">
  <div class="flex items-center justify-between mb-4">
    <h1 class="text-lg font-semibold text-neutral-800 dark:text-neutral-100">Connections</h1>
    <span class="text-xs text-neutral-400">{rows.length} links</span>
  </div>

  {#if rows.length > 0}
    <div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead>
          <tr
            class="border-b border-neutral-200 dark:border-neutral-700 text-left text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500"
          >
            <th class="pb-2 pr-4 font-medium">From</th>
            <th class="pb-2 pr-4 font-medium">To</th>
            <th class="pb-2 pr-4 font-medium">Bandwidth</th>
            <th class="pb-2 pr-4 font-medium">VLAN</th>
            <th class="pb-2 pr-4 font-medium">From IP</th>
            <th class="pb-2 pr-4 font-medium">To IP</th>
            <th class="pb-2 font-medium">Label</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row}
            <tr
              class="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors"
            >
              <td class="py-2 pr-4 font-mono">
                <span class="text-neutral-700 dark:text-neutral-200">{row.fromNode}</span>
                {#if row.fromPort}
                  <span class="text-neutral-400">:{row.fromPort}</span>
                {/if}
              </td>
              <td class="py-2 pr-4 font-mono">
                <span class="text-neutral-700 dark:text-neutral-200">{row.toNode}</span>
                {#if row.toPort}
                  <span class="text-neutral-400">:{row.toPort}</span>
                {/if}
              </td>
              <td class="py-2 pr-4">
                {#if row.bandwidth}
                  <span
                    class="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-mono text-[9px]"
                    >{row.bandwidth}</span
                  >
                {:else}
                  <span class="text-neutral-300 dark:text-neutral-600">—</span>
                {/if}
              </td>
              <td class="py-2 pr-4 font-mono text-neutral-600 dark:text-neutral-300">
                {row.vlan || '—'}
              </td>
              <td class="py-2 pr-4 font-mono text-neutral-500 dark:text-neutral-400 text-[10px]">
                {row.fromIp || '—'}
              </td>
              <td class="py-2 pr-4 font-mono text-neutral-500 dark:text-neutral-400 text-[10px]">
                {row.toIp || '—'}
              </td>
              <td class="py-2 text-neutral-600 dark:text-neutral-300">{row.label || '—'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <p class="text-sm text-neutral-400 dark:text-neutral-500 italic">No connections in diagram.</p>
  {/if}
</div>
