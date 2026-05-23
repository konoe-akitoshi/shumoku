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
  }

  let { open, onOpenChange, node, probing, onProbe, formatAgo }: Props = $props()

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
