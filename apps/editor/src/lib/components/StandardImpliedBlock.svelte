<script lang="ts">
  import {
    formatReachMeters,
    getStandardSpec,
    type LinkCable,
    type PortConnector,
  } from '@shumoku/core'

  let {
    standard,
    cable,
    fromCage,
    toCage,
  }: {
    standard: string | undefined
    cable?: LinkCable
    fromCage?: PortConnector
    toCage?: PortConnector
  } = $props()

  const spec = $derived(getStandardSpec(standard))

  function cageMatches(cage: PortConnector | undefined, required: string): boolean {
    if (!cage) return true
    return cage === required || cage === 'combo'
  }

  const cageOk = $derived(
    spec ? cageMatches(fromCage, spec.cage) && cageMatches(toCage, spec.cage) : true,
  )
  const reachExceeded = $derived(
    spec && cable?.length_m !== undefined && cable.length_m > spec.maxReach_m,
  )

  const cableKindLabel = $derived.by(() => {
    if (!spec) return ''
    if (spec.cableKind === 'twisted-pair') {
      const cat = cable?.category
      return cat ? `twisted-pair · ${cat.toUpperCase()}` : 'twisted-pair'
    }
    if (spec.cableKind === 'fiber') {
      const grade = cable?.category
      const mode = spec.fiberMode === 'singlemode' ? 'single-mode' : 'multimode'
      return grade ? `${mode} · ${grade.toUpperCase()}` : mode
    }
    if (spec.cableKind === 'dac') return 'DAC'
    if (spec.cableKind === 'aoc') return 'AOC'
    return spec.cableKind
  })

  const cableConnector = $derived(cable?.connector ?? spec?.cableConnector)
</script>

{#if spec}
  <div
    class="rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/30 px-2 py-1.5 text-[11px] font-mono"
  >
    <div class="flex justify-between">
      <span class="text-neutral-500">{spec.cage} cage</span>
      {#if !cageOk}
        <span class="text-amber-600" title="Doesn't fit one of the port cages"
          >⚠ cage mismatch</span
        >
      {/if}
    </div>
    <div class="text-neutral-700 dark:text-neutral-200">
      {cableKindLabel}{cableConnector ? ` · ${cableConnector.toUpperCase()}` : ''}
      ·
      <span class={reachExceeded ? 'text-amber-600' : ''}
        >≤ {formatReachMeters(spec.maxReach_m)}</span
      >
      {#if reachExceeded}
        <span class="text-amber-600 ml-1" title="Cable length exceeds standard reach">⚠</span>
      {/if}
    </div>
  </div>
{/if}
