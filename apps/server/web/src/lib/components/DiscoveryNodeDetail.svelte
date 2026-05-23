<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'

  /**
   * Discovery-tab per-node detail modal. Renders identity / discovery
   * / catalog facts and the Probe action against the source that
   * owns the node.
   *
   * The card grid passes the same shape it already built in
   * `refreshDiscovery()` plus an extra `sysObjectID` field; this
   * component does no fetching of its own.
   */

  type DiscoveryMode = 'auto' | 'observe' | 'disabled'

  interface EffectivePolicy {
    mode: DiscoveryMode
    intervalMs: number
    source: {
      mode: 'node' | 'subgraph' | 'topology' | 'default'
      intervalMs: 'node' | 'subgraph' | 'topology' | 'default'
    }
  }

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** All the per-card data plus a few details only the modal shows. */
    node: {
      id: string
      label: string
      sysDescr?: string
      model?: string
      vendor?: string
      mgmtIp?: string
      chassisId?: string
      sysName?: string
      sysObjectID?: string
      catalogId?: string
      quality: 'stable' | 'weak' | 'unbound'
      sourceId?: string
      sourceName?: string
      sourceType?: string
      observedAt?: number
    } | null
    probing: boolean
    onProbe: () => void
    formatAgo: (ts: number) => string
    /** Effective discovery policy for this node — null while loading
     *  or when the GET hasn 't run yet. */
    effectivePolicy?: EffectivePolicy | null
    /** Patch in-flight, drives the spinner on the mode buttons. */
    patchingPolicy?: boolean
    /** Change mode (or 'inherit' to clear the per-node override). */
    onSetMode?: (mode: DiscoveryMode | 'inherit') => void | Promise<void>
  }

  let {
    open,
    onOpenChange,
    node,
    probing,
    onProbe,
    formatAgo,
    effectivePolicy = null,
    patchingPolicy = false,
    onSetMode,
  }: Props = $props()

  function originLabel(o: EffectivePolicy['source']['mode']): string {
    if (o === 'node') return 'this node'
    if (o === 'subgraph') return 'subgraph'
    if (o === 'topology') return 'topology default'
    return 'runtime default'
  }

  const MODE_OPTIONS: DiscoveryMode[] = ['auto', 'observe', 'disabled']

  function formatInterval(ms: number): string {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60_000) return `${Math.round(ms / 1000)}s`
    if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`
    return `${Math.round(ms / 3_600_000)}h`
  }

  const qualityColor = $derived(
    node?.quality === 'stable'
      ? 'bg-green-500'
      : node?.quality === 'weak'
        ? 'bg-amber-500'
        : 'bg-neutral-500',
  )
</script>

<Dialog.Root bind:open={() => open, (v) => onOpenChange(v)}>
  <Dialog.Content class="sm:max-w-lg">
    {#if node}
      <Dialog.Header>
        <Dialog.Title class="flex items-center gap-2">
          <span
            class="inline-block w-2 h-2 rounded-full {qualityColor}"
            title={node.quality}
          ></span>
          <span class="truncate">{node.label}</span>
        </Dialog.Title>
        <Dialog.Description class="text-xs">
          {node.quality}
          · {node.model ?? node.vendor ?? node.sysDescr?.split(',')[0] ?? '—'}
        </Dialog.Description>
      </Dialog.Header>

      <div class="space-y-4 text-sm">
        <!-- Identity. The keys that the resolver clusters on, with a check
             next to each present field so the user can see *why* this
             node is stable / weak. -->
        <section>
          <h3 class="text-xs font-medium text-theme-text-muted uppercase tracking-wide mb-2">
            Identity
          </h3>
          <dl class="space-y-1">
            <div class="flex justify-between gap-3">
              <dt class="text-theme-text-muted">mgmtIp</dt>
              <dd class="font-mono">{node.mgmtIp ?? '—'}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-theme-text-muted">sysName</dt>
              <dd>{node.sysName ?? '—'}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-theme-text-muted">chassisId</dt>
              <dd class="font-mono text-xs truncate ml-2 max-w-[260px]" title={node.chassisId}>
                {node.chassisId ?? '—'}
              </dd>
            </div>
          </dl>
        </section>

        <!-- Discovery. Which source owns this node and when it last
             answered. Source type tells you which plugin code path
             actually walked the wire. -->
        <section>
          <h3 class="text-xs font-medium text-theme-text-muted uppercase tracking-wide mb-2">
            Discovery
          </h3>
          <dl class="space-y-1">
            <div class="flex justify-between gap-3">
              <dt class="text-theme-text-muted">Tracked by</dt>
              <dd>
                {node.sourceName ?? node.sourceId ?? '—'}
                {#if node.sourceType}
                  <span class="text-theme-text-muted ml-1">({node.sourceType})</span>
                {/if}
              </dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-theme-text-muted">Last seen</dt>
              <dd>{node.observedAt ? formatAgo(node.observedAt) : '—'}</dd>
            </div>
          </dl>
        </section>

        <!-- Discovery policy. The effective mode + interval the
             scheduler will use for this node, with the per-field
             origin so the operator can tell "this came from my
             override" apart from "this came from the subgraph". The
             three buttons either pin the override (auto / observe /
             disabled) or clear it (Inherit). 409 from a discovered-only
             node is surfaced via the parent 's console warn for now —
             Phase A2.1 will show it inline. -->
        <section>
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-xs font-medium text-theme-text-muted uppercase tracking-wide">
              Discovery policy
            </h3>
            {#if effectivePolicy}
              <span class="text-[10px] text-theme-text-muted">
                from {originLabel(effectivePolicy.source.mode)}
              </span>
            {/if}
          </div>
          {#if effectivePolicy}
            <dl class="space-y-1 mb-3">
              <div class="flex justify-between gap-3">
                <dt class="text-theme-text-muted">Mode</dt>
                <dd class="font-mono">{effectivePolicy.mode}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-theme-text-muted">Interval</dt>
                <dd class="font-mono">
                  {formatInterval(effectivePolicy.intervalMs)}
                  <span class="text-theme-text-muted ml-1 text-xs">
                    ({originLabel(effectivePolicy.source.intervalMs)})
                  </span>
                </dd>
              </div>
            </dl>
            <div class="flex gap-1.5 flex-wrap">
              {#each MODE_OPTIONS as m (m)}
                {@const active = effectivePolicy.mode === m && effectivePolicy.source.mode === 'node'}
                <button
                  type="button"
                  class="text-xs px-2 py-1 rounded border transition-colors {active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-theme-border hover:border-primary'}"
                  disabled={patchingPolicy}
                  onclick={() => onSetMode?.(m)}
                >
                  {m}
                </button>
              {/each}
              <button
                type="button"
                class="text-xs px-2 py-1 rounded border border-theme-border hover:border-primary transition-colors text-theme-text-muted"
                disabled={patchingPolicy || effectivePolicy.source.mode !== 'node'}
                title={effectivePolicy.source.mode !== 'node'
                  ? 'No per-node override — already inheriting'
                  : 'Clear per-node override and inherit'}
                onclick={() => onSetMode?.('inherit')}
              >
                Inherit
              </button>
              {#if patchingPolicy}
                <span class="text-xs text-theme-text-muted self-center ml-1">saving…</span>
              {/if}
            </div>
          {:else}
            <p class="text-xs text-theme-text-muted">Policy view loading…</p>
          {/if}
        </section>

        <!-- Catalog. Set when sysObjectID or chassis part number
             matched an entry. Otherwise show the raw OID so a
             follow-up catalog PR can pick it up. -->
        <section>
          <h3 class="text-xs font-medium text-theme-text-muted uppercase tracking-wide mb-2">
            Catalog
          </h3>
          <dl class="space-y-1">
            <div class="flex justify-between gap-3">
              <dt class="text-theme-text-muted">sysObjectID</dt>
              <dd class="font-mono text-xs">{node.sysObjectID ?? '—'}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-theme-text-muted">catalogId</dt>
              <dd class="font-mono text-xs">{node.catalogId ?? '— (no match)'}</dd>
            </div>
          </dl>
        </section>
      </div>

      <Dialog.Footer class="flex items-center justify-between gap-2">
        <p class="text-xs text-theme-text-muted">
          Probe re-runs discovery against this node 's IP only.
        </p>
        <Button onclick={onProbe} disabled={probing || !node.sourceId || !node.mgmtIp} size="sm">
          {probing ? 'Probing…' : '⟳ Probe now'}
        </Button>
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>
