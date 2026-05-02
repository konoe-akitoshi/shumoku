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

  // C スタイルの tint — 行側のごく薄い tint と区別がつく強さで、
  // それでも input/select の視認性を邪魔しない範囲に抑える。
  const tintClass = $derived(
    top === 'error'
      ? 'bg-destructive/[0.06] dark:bg-destructive/[0.18]'
      : top === 'warning'
        ? 'bg-amber-500/[0.06] dark:bg-amber-500/[0.18]'
        : top === 'info'
          ? 'bg-blue-500/[0.06] dark:bg-blue-500/[0.18]'
          : '',
  )

  const iconColor = $derived(
    top === 'error'
      ? 'text-destructive'
      : top === 'warning'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-blue-600 dark:text-blue-400',
  )
</script>

{#if issues.length === 0}
  <div class={className}>{@render children()}</div>
{:else}
  <Tooltip.Provider delayDuration={150}>
    <Tooltip.Root>
      <Tooltip.Trigger
        class={`relative block w-full cursor-help rounded outline-none focus-visible:ring-1 focus-visible:ring-ring ${tintClass} ${className}`}
      >
        {@render children()}
        <span class={`pointer-events-none absolute right-1 top-1 ${iconColor}`}>
          {#if top === 'error'}
            <WarningCircle weight="fill" class="h-3 w-3" />
          {:else if top === 'warning'}
            <Warning weight="fill" class="h-3 w-3" />
          {:else}
            <Info weight="fill" class="h-3 w-3" />
          {/if}
        </span>
      </Tooltip.Trigger>
      <Tooltip.Content
        class="max-w-md border-border bg-popover p-0 text-popover-foreground shadow-md"
      >
        <ul class="divide-y divide-border">
          {#each issues as issue}
            <li class="flex items-start gap-2 px-3 py-2">
              <span
                class="mt-0.5 shrink-0 {issue.severity === 'error'
                  ? 'text-destructive'
                  : issue.severity === 'warning'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-blue-600 dark:text-blue-400'}"
              >
                {#if issue.severity === 'error'}
                  <WarningCircle weight="fill" class="h-3.5 w-3.5" />
                {:else if issue.severity === 'warning'}
                  <Warning weight="fill" class="h-3.5 w-3.5" />
                {:else}
                  <Info weight="fill" class="h-3.5 w-3.5" />
                {/if}
              </span>
              <div class="min-w-0 flex-1 leading-snug">
                <div class="text-xs">{issue.message}</div>
                <div class="mt-0.5 font-mono text-[10px] text-muted-foreground/80">
                  {issue.code}
                </div>
              </div>
            </li>
          {/each}
        </ul>
      </Tooltip.Content>
    </Tooltip.Root>
  </Tooltip.Provider>
{/if}
