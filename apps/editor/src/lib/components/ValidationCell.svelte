<script lang="ts">
  import type { IssueSeverity, ValidationIssue } from '@shumoku/core'
  import { Info, Warning, WarningCircle } from 'phosphor-svelte'
  import type { Snippet } from 'svelte'
  import * as Tooltip from '$lib/components/ui/tooltip'

  let {
    issues,
    children,
    class: className = '',
  }: {
    issues: readonly ValidationIssue[]
    children: Snippet
    class?: string
  } = $props()

  const top = $derived<IssueSeverity | undefined>(
    issues.find((i) => i.severity === 'error')?.severity ??
      issues.find((i) => i.severity === 'warning')?.severity ??
      issues.find((i) => i.severity === 'info')?.severity,
  )

  const tintClass = $derived(
    top === 'error'
      ? 'bg-red-50 dark:bg-red-950/30'
      : top === 'warning'
        ? 'bg-amber-50 dark:bg-amber-950/30'
        : top === 'info'
          ? 'bg-blue-50 dark:bg-blue-950/30'
          : '',
  )

  const iconColor = $derived(
    top === 'error' ? 'text-red-500' : top === 'warning' ? 'text-amber-500' : 'text-blue-500',
  )
</script>

{#if issues.length === 0}
  <div class={className}>{@render children()}</div>
{:else}
  <Tooltip.Provider delayDuration={150}>
    <Tooltip.Root>
      <Tooltip.Trigger class={`relative block w-full rounded ${tintClass} ${className}`}>
        {@render children()}
        <span class={`absolute right-0.5 top-0.5 pointer-events-none ${iconColor}`}>
          {#if top === 'error'}
            <WarningCircle weight="fill" class="w-3 h-3" />
          {:else if top === 'warning'}
            <Warning weight="fill" class="w-3 h-3" />
          {:else}
            <Info weight="fill" class="w-3 h-3" />
          {/if}
        </span>
      </Tooltip.Trigger>
      <Tooltip.Content class="max-w-sm">
        <ul class="space-y-1">
          {#each issues as issue}
            <li class="flex items-start gap-1.5 text-xs">
              <span class="font-mono opacity-60 shrink-0">{issue.code}</span>
              <span>{issue.message}</span>
            </li>
          {/each}
        </ul>
      </Tooltip.Content>
    </Tooltip.Root>
  </Tooltip.Provider>
{/if}
