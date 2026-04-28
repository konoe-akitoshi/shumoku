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

  const fromCageOk = $derived(spec ? cageMatches(fromCage, spec.cage) : true)
  const toCageOk = $derived(spec ? cageMatches(toCage, spec.cage) : true)
  const reachExceeded = $derived(
    spec && cable?.length_m !== undefined && cable.length_m > spec.maxReach_m,
  )

  const cableKindLabel = $derived.by(() => {
    if (!spec) return ''
    if (spec.cableKind === 'twisted-pair') {
      const cat = cable?.category
      return cat ? `twisted-pair (${cat.toUpperCase()})` : 'twisted-pair'
    }
    if (spec.cableKind === 'fiber') {
      return `fiber ${spec.fiberMode === 'singlemode' ? 'single-mode' : 'multimode'}`
    }
    if (spec.cableKind === 'dac') return 'DAC (passive twinax)'
    if (spec.cableKind === 'aoc') return 'AOC (active optical)'
    return spec.cableKind
  })

  const cableConnector = $derived(cable?.connector ?? spec?.cableConnector)
</script>

{#if spec}
  <div
    class="rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/30 px-2 py-1.5 text-[11px] space-y-0.5"
  >
    <div class="text-[9px] uppercase tracking-wider text-neutral-400">Implies</div>
    <div class="flex justify-between">
      <span class="text-neutral-500">Cage</span>
      <span class="font-mono">
        <span class="{fromCageOk ? 'text-neutral-700 dark:text-neutral-200' : 'text-amber-600'}"
          >{spec.cage}</span
        >
        {#if !fromCageOk || !toCageOk}
          <span class="text-amber-600 ml-1" title="Doesn't fit one of the port cages">⚠</span>
        {/if}
      </span>
    </div>
    <div class="flex justify-between">
      <span class="text-neutral-500">Plug</span>
      <span class="font-mono text-neutral-700 dark:text-neutral-200"> {spec.cage} {standard} </span>
    </div>
    <div class="flex justify-between">
      <span class="text-neutral-500">Cable</span>
      <span class="font-mono text-neutral-700 dark:text-neutral-200">
        {cableKindLabel}{cableConnector ? `, ${cableConnector.toUpperCase()}` : ''}
      </span>
    </div>
    <div class="flex justify-between">
      <span class="text-neutral-500">Max reach</span>
      <span
        class="font-mono {reachExceeded ? 'text-amber-600' : 'text-neutral-700 dark:text-neutral-200'}"
      >
        {formatReachMeters(spec.maxReach_m)}
        {#if reachExceeded}
          <span class="ml-1" title="Cable length exceeds standard reach">⚠</span>
        {/if}
      </span>
    </div>
  </div>
{/if}
