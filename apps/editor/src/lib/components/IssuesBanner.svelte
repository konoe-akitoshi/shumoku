<script lang="ts">
  import type { ValidationIssue } from '@shumoku/core'
  import { CaretDown, CaretUp, Info, Warning, WarningCircle } from 'phosphor-svelte'
  import * as Card from '$lib/components/ui/card'

  export type RowIssue = {
    rowId: string
    from: string
    to: string
    issue: ValidationIssue
  }

  let {
    issues,
    onjump,
  }: {
    issues: RowIssue[]
    /** Called when the user clicks an issue row in the expanded list. */
    onjump?: (rowId: string) => void
  } = $props()

  let expanded = $state(false)

  const counts = $derived({
    error: issues.filter((i) => i.issue.severity === 'error').length,
    warning: issues.filter((i) => i.issue.severity === 'warning').length,
    info: issues.filter((i) => i.issue.severity === 'info').length,
  })

  const affectedRows = $derived(new Set(issues.map((i) => i.rowId)).size)
</script>

{#if issues.length > 0}
  <Card.Root class={`mb-3 border-l-2 ${counts.error ? 'border-red-400' : 'border-amber-400'}`}>
    <button
      type="button"
      class="w-full p-3 flex items-center justify-between text-left cursor-pointer hover:bg-muted/30 rounded-t"
      onclick={() => {
        expanded = !expanded
      }}
    >
      <div class="flex items-center gap-3 text-xs">
        {#if counts.error > 0}
          <span class="flex items-center gap-1 text-red-600 dark:text-red-400">
            <WarningCircle weight="fill" class="w-3.5 h-3.5" />
            {counts.error}
            {counts.error === 1 ? 'error' : 'errors'}
          </span>
        {/if}
        {#if counts.warning > 0}
          <span class="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <Warning weight="fill" class="w-3.5 h-3.5" />
            {counts.warning}
            {counts.warning === 1 ? 'warning' : 'warnings'}
          </span>
        {/if}
        {#if counts.info > 0}
          <span class="flex items-center gap-1 text-blue-600 dark:text-blue-400">
            <Info weight="fill" class="w-3.5 h-3.5" />
            {counts.info}
            info
          </span>
        {/if}
        <span class="text-muted-foreground">
          across {affectedRows}
          {affectedRows === 1 ? 'connection' : 'connections'}
        </span>
      </div>
      {#if expanded}
        <CaretUp class="w-3.5 h-3.5 text-muted-foreground" />
      {:else}
        <CaretDown class="w-3.5 h-3.5 text-muted-foreground" />
      {/if}
    </button>
    {#if expanded}
      <ul class="border-t divide-y">
        {#each issues as { rowId, from, to, issue }}
          <li>
            <button
              type="button"
              class="w-full p-2 flex items-start gap-2 text-xs text-left cursor-pointer hover:bg-muted/30"
              onclick={() => onjump?.(rowId)}
            >
              {#if issue.severity === 'error'}
                <WarningCircle weight="fill" class="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
              {:else if issue.severity === 'warning'}
                <Warning weight="fill" class="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              {:else}
                <Info weight="fill" class="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
              {/if}
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 font-mono">
                  <span class="font-medium">{from} → {to}</span>
                  <span class="text-muted-foreground opacity-60">{issue.code}</span>
                </div>
                <div class="text-muted-foreground mt-0.5">{issue.message}</div>
              </div>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </Card.Root>
{/if}
