<script lang="ts">
  import { diagramState } from '$lib/context.svelte'
  import { deriveSpecsFromNodes, getSpecPower } from '$lib/spec-utils'

  const specs = $derived(deriveSpecsFromNodes(diagramState.nodes, diagramState.catalog))
  const totalCount = $derived(specs.reduce((s, e) => s + e.count, 0))
  const totalPower = $derived(
    specs.reduce((s, e) => s + (getSpecPower(e.catalogEntry).maxDraw ?? 0) * e.count, 0),
  )
  const totalPoeBudget = $derived(
    specs.reduce((s, e) => s + (getSpecPower(e.catalogEntry).poeBudget ?? 0) * e.count, 0),
  )
</script>

<div class="h-[calc(100vh-2.5rem)] overflow-auto px-6 py-4 bg-white dark:bg-neutral-950">
  <div class="flex items-center justify-between mb-4">
    <h1 class="text-lg font-semibold text-neutral-800 dark:text-neutral-100">Bill of Materials</h1>
  </div>

  <!-- Summary cards -->
  <div class="grid grid-cols-3 gap-3 mb-6">
    <div
      class="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
    >
      <div class="text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
        Devices
      </div>
      <div class="text-xl font-mono font-bold text-neutral-800 dark:text-neutral-100">
        {totalCount}
      </div>
      <div class="text-[10px] text-neutral-400">{specs.length} unique specs</div>
    </div>
    <div
      class="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
    >
      <div class="text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
        Total Power
      </div>
      <div class="text-xl font-mono font-bold text-neutral-800 dark:text-neutral-100">
        {totalPower}W
      </div>
      <div class="text-[10px] text-neutral-400">max consumption</div>
    </div>
    <div
      class="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
    >
      <div class="text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
        PoE Budget
      </div>
      <div class="text-xl font-mono font-bold text-neutral-800 dark:text-neutral-100">
        {totalPoeBudget}W
      </div>
      <div class="text-[10px] text-neutral-400">total available</div>
    </div>
  </div>

  {#if specs.length > 0}
    <div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead>
          <tr
            class="border-b border-neutral-200 dark:border-neutral-700 text-left text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500"
          >
            <th class="pb-2 pr-4 font-medium">#</th>
            <th class="pb-2 pr-4 font-medium">Product</th>
            <th class="pb-2 pr-4 font-medium">Vendor / Model</th>
            <th class="pb-2 pr-4 font-medium text-right">Qty</th>
            <th class="pb-2 pr-4 font-medium text-right">Unit Power</th>
            <th class="pb-2 pr-4 font-medium text-right">Total Power</th>
            <th class="pb-2 font-medium text-right">PoE Budget</th>
          </tr>
        </thead>
        <tbody>
          {#each specs as entry, i}
            {@const power = getSpecPower(entry.catalogEntry)}
            <tr class="border-b border-neutral-100 dark:border-neutral-800">
              <td class="py-2 pr-4 text-neutral-400">{i + 1}</td>
              <td class="py-2 pr-4 font-medium text-neutral-800 dark:text-neutral-100">
                {entry.label}
              </td>
              <td class="py-2 pr-4 font-mono text-neutral-500 dark:text-neutral-400">
                {entry.spec.vendor ?? '—'}
                /
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
                {power.maxDraw ? `${power.maxDraw * entry.count}W` : '—'}
              </td>
              <td class="py-2 text-right font-mono text-neutral-600 dark:text-neutral-300">
                {power.poeBudget ? `${power.poeBudget * entry.count}W` : '—'}
              </td>
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr class="text-xs font-semibold text-neutral-700 dark:text-neutral-200">
            <td class="pt-3" colspan="3">Total</td>
            <td class="pt-3 pr-4 text-right font-mono">{totalCount}</td>
            <td class="pt-3 pr-4"></td>
            <td class="pt-3 pr-4 text-right font-mono">{totalPower}W</td>
            <td class="pt-3 text-right font-mono">{totalPoeBudget}W</td>
          </tr>
        </tfoot>
      </table>
    </div>
  {:else}
    <p class="text-sm text-neutral-400 dark:text-neutral-500 italic">No nodes in diagram.</p>
  {/if}
</div>
