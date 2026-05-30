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
    snmpCredentialId?: string
    source: {
      mode: 'node' | 'subgraph' | 'topology' | 'default'
      intervalMs: 'node' | 'subgraph' | 'topology' | 'default'
      snmpCredentialId: 'node' | 'subgraph' | 'topology' | 'default'
    }
  }

  interface CredentialOption {
    id: string
    name: string
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
      /** 'notice' = reachable but not yet readable over SNMP (needs a
       *  credential); 'synced' = fully walked. */
      syncState?: 'synced' | 'notice'
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
    /** Last PATCH error for this node, or null. Surfaced as an inline
     *  banner under the mode buttons so the operator sees why their
     *  click didn 't stick (e.g. 409 "pin to Manual first"). */
    policyErrorMessage?: string | null
    /** Available SNMP credentials for the picker. Caller fetches them
     *  once and passes the same list to every modal open. Empty array
     *  is fine — the picker shows an inline link to /settings/snmp-
     *  credentials. */
    snmpCredentialOptions?: CredentialOption[]
    /** Change the per-node SNMP credential override. Pass `''` (empty
     *  string) to clear the per-node override and inherit. */
    onSetCredential?: (credentialId: string) => void | Promise<void>
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
    policyErrorMessage = null,
    snmpCredentialOptions = [],
    onSetCredential,
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

  /** Friendly label for the read protocol. The read layer is NOT
   *  SNMP-only — SNMP-LLDP is just one protocol a source can read with —
   *  so this is a lookup, not a hardcoded string. Unknown types fall
   *  back to the raw type rather than pretending they're SNMP. */
  const PROTOCOL_LABELS: Record<string, string> = {
    'snmp-lldp': 'SNMP-LLDP',
  }
  function protocolLabel(type: string | undefined): string {
    if (!type) return '—'
    return PROTOCOL_LABELS[type] ?? type
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

        <!-- How this node is read. The protocol + endpoint + credential
             the scanner uses to walk it. Filled in automatically when the
             source already knows them; otherwise the operator sets the
             credential here. For a discovered node this just works — no
             separate adopt step. -->
        <section>
          <h3 class="text-xs font-medium text-theme-text-muted uppercase tracking-wide mb-2">
            How this node is read
          </h3>
          <dl class="space-y-1">
            <div class="flex justify-between gap-3">
              <dt class="text-theme-text-muted">Protocol</dt>
              {#if node.syncState === 'notice'}
                <dd class="text-theme-text-muted italic">not registered yet</dd>
              {:else}
                <dd>{protocolLabel(node.sourceType)}</dd>
              {/if}
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-theme-text-muted">IP</dt>
              <dd class="font-mono">{node.mgmtIp ?? '—'}</dd>
            </div>
          </dl>

          {#if node.syncState === 'notice'}
            <div
              class="mt-3 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-300"
            >
              Reachable but not readable over SNMP. Assign a working credential below to sync this
              device.
            </div>
          {/if}

          <!-- SNMP credential. Inherits through the same chain as
               mode/intervalMs. Empty string clears the per-node override.
               Empty credentials list shows a link to create one. -->
          {#if onSetCredential}
            <div class="mt-3">
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs text-theme-text-muted">SNMP credential</span>
                {#if effectivePolicy?.snmpCredentialId}
                  <span class="text-[10px] text-theme-text-muted">
                    from {originLabel(effectivePolicy.source.snmpCredentialId)}
                  </span>
                {/if}
              </div>
              {#if snmpCredentialOptions.length === 0}
                <p class="text-xs text-theme-text-muted">
                  No credentials defined.
                  <a href="/settings/snmp-credentials" class="text-primary hover:underline">
                    Create one →
                  </a>
                </p>
              {:else if effectivePolicy}
                <select
                  class="input text-sm w-full"
                  value={effectivePolicy.source.snmpCredentialId === 'node'
                    ? (effectivePolicy.snmpCredentialId ?? '')
                    : ''}
                  disabled={patchingPolicy}
                  onchange={(e) => onSetCredential?.(e.currentTarget.value)}
                >
                  <option value="">
                    — inherit ({effectivePolicy.snmpCredentialId
                    ? snmpCredentialOptions.find((c) => c.id === effectivePolicy?.snmpCredentialId)
                        ?.name ?? 'unknown'
                    : 'plugin default'}) —
                  </option>
                  {#each snmpCredentialOptions as opt (opt.id)}
                    <option value={opt.id}>{opt.name}</option>
                  {/each}
                </select>
              {:else}
                <p class="text-xs text-theme-text-muted">Loading…</p>
              {/if}
            </div>
          {/if}
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

        <!-- Discovery policy = the *schedule* (mode + interval the
             scheduler uses), kept separate from "how this node is read"
             above. Per-field origin shows whether a value is this node's
             own override or inherited from subgraph / topology. The three
             buttons pin the override (auto / observe / disabled); Inherit
             clears it. Setting any of these on a discovered-only node now
             just works — the server materializes the authored entry. -->
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
            {#if policyErrorMessage}
              <div
                class="mt-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-300"
              >
                {policyErrorMessage}
              </div>
            {/if}
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
