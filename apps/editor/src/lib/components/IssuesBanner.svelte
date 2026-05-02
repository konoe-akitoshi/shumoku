<script lang="ts">
  import type { ValidationIssue } from '@shumoku/core'
  import { CaretDown, CaretUp, Info, Warning, WarningCircle } from 'phosphor-svelte'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
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

  const tone = $derived(counts.error > 0 ? 'error' : counts.warning > 0 ? 'warning' : 'info')
</script>

{#if issues.length > 0}
  <Card.Root
    class="mb-3 overflow-hidden border-border bg-muted/20 shadow-none {tone === 'error'
      ? 'ring-1 ring-destructive/20'
      : tone === 'warning'
        ? 'ring-1 ring-amber-500/20'
        : 'ring-1 ring-blue-500/20'}"
  >
    <button
      type="button"
      class="w-full cursor-pointer px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
      onclick={() => {
        expanded = !expanded
      }}
    >
      <div class="flex items-center justify-between gap-3">
        <div class="flex min-w-0 items-center gap-2">
          <span
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-background {tone ===
            'error'
              ? 'border-destructive/30 text-destructive'
              : tone === 'warning'
                ? 'border-amber-500/30 text-amber-600 dark:text-amber-400'
                : 'border-blue-500/30 text-blue-600 dark:text-blue-400'}"
          >
            {#if tone === 'error'}
              <WarningCircle weight="fill" class="h-3.5 w-3.5" />
            {:else if tone === 'warning'}
              <Warning weight="fill" class="h-3.5 w-3.5" />
            {:else}
              <Info weight="fill" class="h-3.5 w-3.5" />
            {/if}
          </span>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-xs font-medium">Diagnostics</span>
              {#if counts.error > 0}
                <Badge variant="destructive" class="h-4 px-1.5 text-[10px] font-mono">
                  {counts.error}
                  error{counts.error === 1 ? '' : 's'}
                </Badge>
              {/if}
              {#if counts.warning > 0}
                <Badge
                  variant="outline"
                  class="h-4 border-amber-500/30 px-1.5 text-[10px] font-mono text-amber-700 dark:text-amber-300"
                >
                  {counts.warning}
                  warning{counts.warning === 1 ? '' : 's'}
                </Badge>
              {/if}
              {#if counts.info > 0}
                <Badge
                  variant="outline"
                  class="h-4 border-blue-500/30 px-1.5 text-[10px] font-mono text-blue-700 dark:text-blue-300"
                >
                  {counts.info}
                  info
                </Badge>
              {/if}
            </div>
            <div class="mt-0.5 truncate text-[11px] text-muted-foreground">
              {affectedRows}
              {affectedRows === 1 ? 'connection needs' : 'connections need'}
              attention
            </div>
          </div>
        </div>
        <span class="text-muted-foreground">
          {#if expanded}
            <CaretUp class="h-3.5 w-3.5" />
          {:else}
            <CaretDown class="h-3.5 w-3.5" />
          {/if}
        </span>
      </div>
    </button>
    {#if expanded}
      <ul class="divide-y border-t bg-background/60">
        {#each issues as { rowId, from, to, issue }}
          <li class="px-2 py-1.5">
            <Button
              type="button"
              variant="ghost"
              class="h-auto w-full justify-start gap-2 rounded-md px-2 py-1.5 text-left"
              onclick={() => onjump?.(rowId)}
            >
              {#if issue.severity === 'error'}
                <WarningCircle weight="fill" class="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              {:else if issue.severity === 'warning'}
                <Warning
                  weight="fill"
                  class="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400"
                />
              {:else}
                <Info
                  weight="fill"
                  class="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400"
                />
              {/if}
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5 font-mono text-[11px]">
                  <span class="font-medium">{from} → {to}</span>
                  <span class="truncate text-muted-foreground/70">{issue.code}</span>
                </div>
                <div class="mt-0.5 whitespace-normal text-[11px] text-muted-foreground">
                  {issue.message}
                </div>
              </div>
            </Button>
          </li>
        {/each}
      </ul>
    {/if}
  </Card.Root>
{/if}
