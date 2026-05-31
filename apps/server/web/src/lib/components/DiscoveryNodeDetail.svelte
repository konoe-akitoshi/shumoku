<script lang="ts">
  import { type Attachment, type DiscoveryMode, type EffectivePolicy } from '$lib/api'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'

  /**
   * Discovery-tab per-node detail. Two regions:
   *   - Observed (read-only): identity + what the sources saw.
   *   - Authored overlay: the typed Attachments the operator attaches
   *     (access / policy), edited as a list + Add. Emits the full desired
   *     list via `onSetAttachments`; the parent PATCHes wholesale.
   */

  interface CredentialOrigin {
    mode: 'node' | 'subgraph' | 'topology' | 'default'
    intervalMs: 'node' | 'subgraph' | 'topology' | 'default'
    community: 'node' | 'subgraph' | 'topology' | 'default'
  }

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
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
      syncState?: 'synced' | 'notice'
      /** Protocol it was actually read with (snapshot data), e.g. 'snmp'. */
      readVia?: string
      sourceId?: string
      sourceName?: string
      sourceType?: string
      observedAt?: number
    } | null
    /** The node's current authored overlay (access / policy). */
    attachments?: Attachment[]
    probing: boolean
    onProbe: () => void
    formatAgo: (ts: number) => string
    /** Effective (merged) policy for inherited-value hints. */
    effectivePolicy?: EffectivePolicy | null
    patchingPolicy?: boolean
    policyErrorMessage?: string | null
    /** Emit the full desired attachment list (empty = clear the overlay). */
    onSetAttachments?: (attachments: Attachment[]) => void | Promise<void>
  }

  let {
    open,
    onOpenChange,
    node,
    attachments = [],
    probing,
    onProbe,
    formatAgo,
    effectivePolicy = null,
    patchingPolicy = false,
    policyErrorMessage = null,
    onSetAttachments,
  }: Props = $props()

  function originLabel(o: CredentialOrigin['mode']): string {
    if (o === 'node') return 'this node'
    if (o === 'subgraph') return 'subgraph'
    if (o === 'topology') return 'topology default'
    return 'runtime default'
  }

  const MODE_OPTIONS: DiscoveryMode[] = ['auto', 'observe', 'disabled']

  // Keyed on the actual read protocol (from snapshot `readVia`), not the
  // source type — so the label is real data, not a guess.
  const PROTOCOL_LABELS: Record<string, string> = {
    snmp: 'SNMP',
    ssh: 'SSH',
    netconf: 'NETCONF',
    http: 'HTTP',
  }
  function protocolLabel(p: string | undefined): string {
    if (!p) return '—'
    return PROTOCOL_LABELS[p] ?? p.toUpperCase()
  }

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

  // ── Local editable copy of the overlay. Reset when the node changes;
  //    after a save the parent re-passes the same node + new attachments,
  //    which already match our local edit, so no reset is needed. ──
  let working = $state<Attachment[]>([])
  let boundId = $state<string | null>(null)
  $effect(() => {
    if (node && node.id !== boundId) {
      boundId = node.id
      working = attachments.map((a) => ({ ...a }))
    }
  })

  const hasPolicy = $derived(working.some((a) => a.kind === 'policy'))
  const hasSnmp = $derived(working.some((a) => a.kind === 'access' && a.protocol === 'snmp'))
  const snmpCommunity = $derived.by(() => {
    const a = working.find((x) => x.kind === 'access' && x.protocol === 'snmp')
    return a && a.kind === 'access' && a.protocol === 'snmp' ? (a.community ?? '') : ''
  })
  const policyMode = $derived.by(() => {
    const a = working.find((x) => x.kind === 'policy')
    return a && a.kind === 'policy' ? a.mode : undefined
  })

  function commit(next: Attachment[]): void {
    working = next
    void onSetAttachments?.(next)
  }

  function setMode(mode: DiscoveryMode): void {
    const rest = working.filter((a) => a.kind !== 'policy')
    const prev = working.find((a) => a.kind === 'policy')
    const interval = prev && prev.kind === 'policy' ? prev.intervalMs : undefined
    commit([...rest, { kind: 'policy', mode, ...(interval ? { intervalMs: interval } : {}) }])
  }

  function setCommunity(value: string): void {
    const v = value.trim()
    const rest = working.filter((a) => !(a.kind === 'access' && a.protocol === 'snmp'))
    commit(v ? [...rest, { kind: 'access', protocol: 'snmp', community: v }] : rest)
  }

  function addSnmp(): void {
    if (!hasSnmp) commit([...working, { kind: 'access', protocol: 'snmp' }])
  }
  function removeKind(kind: 'policy' | 'access'): void {
    commit(working.filter((a) => a.kind !== kind))
  }
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
          {#if node.syncState === 'notice'}
            <span
              class="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 whitespace-nowrap"
            >
              notice
            </span>
          {/if}
        </Dialog.Title>
        <Dialog.Description class="text-xs">
          {node.quality}
          · {node.model ?? node.vendor ?? node.sysDescr?.split(',')[0] ?? '—'}
        </Dialog.Description>
      </Dialog.Header>

      <div class="space-y-4 text-sm">
        <!-- Observed (read-only): identity + what the sources reported. -->
        <section>
          <h3 class="text-xs font-medium text-theme-text-muted uppercase tracking-wide mb-2">
            Observed
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
            <div class="flex justify-between gap-3">
              <dt class="text-theme-text-muted">Read via</dt>
              <dd>
                {#if node.readVia}
                  {protocolLabel(node.readVia)}
                {:else if node.syncState === 'notice'}
                  <span class="italic text-theme-text-muted">not registered yet</span>
                {:else}
                  —
                {/if}
              </dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-theme-text-muted">Tracked by</dt>
              <dd>{node.sourceName ?? node.sourceId ?? '—'}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-theme-text-muted">Last seen</dt>
              <dd>{node.observedAt ? formatAgo(node.observedAt) : '—'}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-theme-text-muted">catalogId</dt>
              <dd class="font-mono text-xs">{node.catalogId ?? '— (no match)'}</dd>
            </div>
          </dl>
        </section>

        <!-- Authored overlay: the attachments the operator binds to this
             node. Edited as a list + Add; emits the full list on change. -->
        <section>
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-xs font-medium text-theme-text-muted uppercase tracking-wide">
              Authored overlay
            </h3>
            {#if patchingPolicy}
              <span class="text-[10px] text-theme-text-muted">saving…</span>
            {/if}
          </div>

          <div class="space-y-2">
            <!-- Discovery policy — always shown: every node has an
                 effective mode (auto/observe/disabled). The buttons set a
                 per-node override; Inherit clears it. It is NOT an addable
                 attachment, so it never appears in the "+ Add" menu. -->
            <div class="rounded border border-theme-border p-2.5">
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-xs font-medium">Discovery policy</span>
                {#if effectivePolicy}
                  <span class="text-[10px] text-theme-text-muted">
                    effective <span class="font-mono">{effectivePolicy.mode}</span> ·
                    {formatInterval(effectivePolicy.intervalMs)}
                    {#if effectivePolicy.source.mode !== 'node'}
                      (from {originLabel(effectivePolicy.source.mode)})
                    {/if}
                  </span>
                {/if}
              </div>
              <div class="flex gap-1.5 flex-wrap">
                {#each MODE_OPTIONS as m (m)}
                  {@const active = hasPolicy && policyMode === m}
                  <button
                    type="button"
                    class="text-xs px-2 py-1 rounded border transition-colors {active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-theme-border hover:border-primary'}"
                    disabled={patchingPolicy}
                    onclick={() => setMode(m)}
                  >
                    {m}
                  </button>
                {/each}
                <button
                  type="button"
                  class="text-xs px-2 py-1 rounded border border-theme-border hover:border-primary transition-colors text-theme-text-muted"
                  disabled={patchingPolicy || !hasPolicy}
                  title={hasPolicy
                    ? 'Clear the per-node override and inherit'
                    : 'No per-node override — already inheriting'}
                  onclick={() => removeKind('policy')}
                >
                  Inherit
                </button>
              </div>
            </div>

            <!-- Access · SNMP — always shown. The community can come from
                 a per-node override, an inherited attachment, or the
                 source's config-wide default; show which, and let the
                 operator override it for this node. Coherent with the
                 "Read via" line above. -->
            <div class="rounded border border-theme-border p-2.5">
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-xs font-medium">Access · SNMP</span>
                {#if hasSnmp}
                  <button
                    type="button"
                    class="text-xs text-theme-text-muted hover:text-danger"
                    disabled={patchingPolicy}
                    onclick={() => removeKind('access')}
                  >
                    remove override
                  </button>
                {/if}
              </div>
              {#if hasSnmp}
                <input
                  type="text"
                  class="input text-sm w-full font-mono"
                  placeholder="community"
                  value={snmpCommunity}
                  disabled={patchingPolicy}
                  onchange={(e) => setCommunity(e.currentTarget.value)}
                >
                <p class="text-[10px] text-theme-text-muted mt-1">
                  community override for this node
                </p>
              {:else if effectivePolicy?.community}
                <p class="text-xs text-theme-text-muted">
                  Community inherited from {originLabel(effectivePolicy.source.community)}.
                  <button
                    type="button"
                    class="text-primary hover:underline"
                    disabled={patchingPolicy}
                    onclick={addSnmp}
                  >
                    Override
                  </button>
                </p>
              {:else if node.readVia}
                <p class="text-xs text-theme-text-muted">
                  Reading with the <span class="font-medium">{node.sourceName ?? 'source'}</span>
                  default community.
                  <button
                    type="button"
                    class="text-primary hover:underline"
                    disabled={patchingPolicy}
                    onclick={addSnmp}
                  >
                    Override
                  </button>
                </p>
              {:else if node.syncState === 'notice'}
                <p class="text-xs text-amber-700 dark:text-amber-300">
                  Reachable but not readable — no working community.
                  <button
                    type="button"
                    class="text-primary hover:underline"
                    disabled={patchingPolicy}
                    onclick={addSnmp}
                  >
                    Set community
                  </button>
                </p>
              {:else}
                <button
                  type="button"
                  class="text-xs px-2 py-1 rounded border border-dashed border-theme-border hover:border-primary text-theme-text-muted"
                  disabled={patchingPolicy}
                  onclick={addSnmp}
                >
                  + SNMP community
                </button>
              {/if}
            </div>
          </div>

          {#if policyErrorMessage}
            <div
              class="mt-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-300"
            >
              {policyErrorMessage}
            </div>
          {/if}
        </section>
      </div>

      <Dialog.Footer class="flex items-center justify-between gap-2">
        <p class="text-xs text-theme-text-muted">Probe re-runs discovery against this node's IP.</p>
        <Button onclick={onProbe} disabled={probing || !node.sourceId || !node.mgmtIp} size="sm">
          {probing ? 'Probing…' : '⟳ Probe now'}
        </Button>
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>
