<script lang="ts">
  import { diagramState } from '$lib/context.svelte'
  import { deriveSpecsFromNodes, getSpecPower } from '$lib/spec-utils'

  const specs = $derived(deriveSpecsFromNodes(diagramState.nodes, diagramState.catalog))
</script>

<div class="h-[calc(100vh-2.5rem)] overflow-auto px-6 py-4 bg-white dark:bg-neutral-950">
  <div class="flex items-center justify-between mb-4">
    <h1 class="text-lg font-semibold text-neutral-800 dark:text-neutral-100">Spec Palette</h1>
    <span class="text-xs text-neutral-400"
      >{specs.length}
      specs, {specs.reduce((s, e) => s + e.count, 0)} nodes</span
    >
  </div>

  {#if specs.length > 0}
    <div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead>
          <tr
            class="border-b border-neutral-200 dark:border-neutral-700 text-left text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500"
          >
            <th class="pb-2 pr-4 font-medium">Name</th>
            <th class="pb-2 pr-4 font-medium">Kind</th>
            <th class="pb-2 pr-4 font-medium">Vendor</th>
            <th class="pb-2 pr-4 font-medium">Model</th>
            <th class="pb-2 pr-4 font-medium text-right">Qty</th>
            <th class="pb-2 pr-4 font-medium text-right">Power</th>
            <th class="pb-2 pr-4 font-medium text-right">PoE</th>
            <th class="pb-2 font-medium">Nodes</th>
          </tr>
        </thead>
        <tbody>
          {#each specs as entry}
            {@const power = getSpecPower(entry.catalogEntry)}
            <tr
              class="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors"
            >
              <td class="py-2 pr-4">
                <div class="font-medium text-neutral-800 dark:text-neutral-100">{entry.label}</div>
                {#if entry.catalogEntry}
                  <div class="text-[9px] text-blue-500 dark:text-blue-400 mt-0.5">catalog</div>
                {:else}
                  <div class="text-[9px] text-neutral-400 mt-0.5">custom</div>
                {/if}
              </td>
              <td class="py-2 pr-4">
                <span
                  class="px-1.5 py-0.5 rounded text-[9px] font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400"
                  >{entry.spec.kind}</span
                >
              </td>
              <td class="py-2 pr-4 font-mono text-neutral-600 dark:text-neutral-300">
                {entry.spec.vendor ?? '—'}
              </td>
              <td class="py-2 pr-4 font-mono text-neutral-600 dark:text-neutral-300">
                {'model' in entry.spec ? entry.spec.model ?? '—' : 'service' in entry.spec ? entry.spec.service : '—'}
              </td>
              <td
                class="py-2 pr-4 text-right font-mono font-semibold text-neutral-700 dark:text-neutral-200"
              >
                {entry.count}
              </td>
              <td class="py-2 pr-4 text-right font-mono text-neutral-600 dark:text-neutral-300">
                {power.maxDraw ? `${power.maxDraw}W` : '—'}
              </td>
              <td class="py-2 pr-4 text-right font-mono text-neutral-600 dark:text-neutral-300">
                {power.poeBudget ? `${power.poeBudget}W` : '—'}
              </td>
              <td class="py-2">
                <div class="flex flex-wrap gap-1">
                  {#each entry.nodeIds as nodeId}
                    <span
                      class="px-1 py-0.5 rounded text-[9px] font-mono bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400"
                      >{nodeId}</span
                    >
                  {/each}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr class="text-[10px] font-medium text-neutral-500 dark:text-neutral-400">
            <td class="pt-3 pr-4" colspan="4">Total</td>
            <td class="pt-3 pr-4 text-right font-mono">{specs.reduce((s, e) => s + e.count, 0)}</td>
            <td class="pt-3 pr-4 text-right font-mono">
              {specs.reduce((s, e) => s + (getSpecPower(e.catalogEntry).maxDraw ?? 0) * e.count, 0)}W
            </td>
            <td class="pt-3 pr-4 text-right font-mono">
              {specs.reduce((s, e) => s + (getSpecPower(e.catalogEntry).poeBudget ?? 0) * e.count, 0)}W
            </td>
            <td class="pt-3"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  {:else}
    <p class="text-sm text-neutral-400 dark:text-neutral-500 italic">
      No nodes with specs in diagram.
    </p>
  {/if}
</div>
