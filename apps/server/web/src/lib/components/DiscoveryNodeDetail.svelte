<script lang="ts">
  import { DropdownMenu } from 'bits-ui'
  import { CaretRightIcon, PlusIcon, TrashIcon } from 'phosphor-svelte'
  import { type Attachment, type DiscoveryMode, type EffectivePolicy } from '$lib/api'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'

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
    /** Set the authored name override (`null`/'' reverts to the observed name). */
    onSetLabel?: (label: string | null) => void | Promise<void>
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
    onSetLabel,
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
  // Name editing is gated behind an explicit Edit action — the name is not a
  // permanently-open free-text box.
  let editingName = $state(false)
  let nameDraft = $state('')
  // Which access row is expanded for editing (accordion — at most one).
  let openAccess = $state<AccessProtocol | null>(null)
  $effect(() => {
    if (node && node.id !== boundId) {
      boundId = node.id
      working = attachments.map((a) => ({ ...a }))
      editingName = false
      openAccess = null
    }
  })

  type AccessAttachment = Extract<Attachment, { kind: 'access' }>
  type AccessProtocol = AccessAttachment['protocol']

  // Every access protocol the model supports, with the one-liner shown in the
  // add-picker. `reads` marks whether the discovery engine actually reads via
  // it yet — SNMP does today; ssh / netconf / http are attachable (so creds can
  // be authored ahead of support) but flagged "not used to read yet".
  const ACCESS_PROTOCOLS: ReadonlyArray<{
    protocol: AccessProtocol
    label: string
    hint: string
    reads: boolean
  }> = [
    { protocol: 'snmp', label: 'SNMP', hint: 'Community-based polling (v2c / v3)', reads: true },
    { protocol: 'ssh', label: 'SSH', hint: 'CLI login (username / port)', reads: false },
    { protocol: 'netconf', label: 'NETCONF', hint: 'XML config protocol', reads: false },
    { protocol: 'http', label: 'HTTP', hint: 'REST / web API', reads: false },
  ]
  function protocolReads(p: AccessProtocol): boolean {
    return ACCESS_PROTOCOLS.find((x) => x.protocol === p)?.reads ?? false
  }

  const hasPolicy = $derived(working.some((a) => a.kind === 'policy'))
  const accessRows = $derived(working.filter((a): a is AccessAttachment => a.kind === 'access'))
  const presentProtocols = $derived(new Set(accessRows.map((a) => a.protocol)))
  const addableProtocols = $derived(
    ACCESS_PROTOCOLS.filter((p) => !presentProtocols.has(p.protocol)),
  )
  const policyMode = $derived.by(() => {
    const a = working.find((x) => x.kind === 'policy')
    return a && a.kind === 'policy' ? a.mode : undefined
  })

  function commit(next: Attachment[]): void {
    working = next
    void onSetAttachments?.(next)
  }

  function startEditName(): void {
    nameDraft = node?.label ?? ''
    editingName = true
  }
  function saveName(): void {
    void onSetLabel?.(nameDraft.trim() || null)
    editingName = false
  }
  function cancelEditName(): void {
    editingName = false
  }

  function setMode(mode: DiscoveryMode): void {
    const rest = working.filter((a) => a.kind !== 'policy')
    const prev = working.find((a) => a.kind === 'policy')
    const interval = prev && prev.kind === 'policy' ? prev.intervalMs : undefined
    commit([...rest, { kind: 'policy', mode, ...(interval ? { intervalMs: interval } : {}) }])
  }

  // Per-row field readers (typed access into the discriminated union).
  function snmpCommunityOf(a: AccessAttachment): string {
    return a.protocol === 'snmp' ? (a.community ?? '') : ''
  }
  function sshUsernameOf(a: AccessAttachment): string {
    return a.protocol === 'ssh' ? (a.username ?? '') : ''
  }

  /** Collapsed-row summary of the current value (or a "set …" placeholder). */
  function accessSummary(a: AccessAttachment): string {
    if (a.protocol === 'snmp') return a.community ? a.community : 'set community'
    if (a.protocol === 'ssh') return a.username ? a.username : 'set username'
    return 'no fields'
  }

  function toggleAccess(protocol: AccessProtocol): void {
    openAccess = openAccess === protocol ? null : protocol
  }

  /** Replace one access row's fields in place (preserves order). */
  function updateAccess(protocol: AccessProtocol, next: AccessAttachment): void {
    commit(working.map((a) => (a.kind === 'access' && a.protocol === protocol ? next : a)))
  }
  function setSnmpCommunity(value: string): void {
    const v = value.trim()
    updateAccess('snmp', { kind: 'access', protocol: 'snmp', ...(v ? { community: v } : {}) })
  }
  function setSshUsername(value: string): void {
    const v = value.trim()
    updateAccess('ssh', { kind: 'access', protocol: 'ssh', ...(v ? { username: v } : {}) })
  }

  function addAccess(protocol: AccessProtocol): void {
    if (presentProtocols.has(protocol)) return
    commit([...working, { kind: 'access', protocol }])
    openAccess = protocol // expand the freshly-added row for immediate editing
  }
  function removeAccess(protocol: AccessProtocol): void {
    commit(working.filter((a) => !(a.kind === 'access' && a.protocol === protocol)))
    if (openAccess === protocol) openAccess = null
  }
  function clearPolicyOverride(): void {
    commit(working.filter((a) => a.kind !== 'policy'))
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
          <h3 class="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Observed
          </h3>
          <dl class="space-y-1 rounded-lg border border-border bg-card shadow-sm p-3">
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">mgmtIp</dt>
              <dd class="font-mono">{node.mgmtIp ?? '—'}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">sysName</dt>
              <dd>{node.sysName ?? '—'}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">chassisId</dt>
              <dd class="font-mono text-xs truncate ml-2 max-w-[260px]" title={node.chassisId}>
                {node.chassisId ?? '—'}
              </dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">Read via</dt>
              <dd>
                {#if node.readVia}
                  {protocolLabel(node.readVia)}
                {:else if node.syncState === 'notice'}
                  <span class="italic text-muted-foreground">not registered yet</span>
                {:else}
                  —
                {/if}
              </dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">Tracked by</dt>
              <dd>{node.sourceName ?? node.sourceId ?? '—'}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">Last seen</dt>
              <dd>{node.observedAt ? formatAgo(node.observedAt) : '—'}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">catalogId</dt>
              <dd class="font-mono text-xs">{node.catalogId ?? '— (no match)'}</dd>
            </div>
          </dl>
        </section>

        <!-- Authored overlay: the attachments the operator binds to this
             node. Edited as a list + Add; emits the full list on change. -->
        <section>
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Authored overlay
            </h3>
            {#if patchingPolicy}
              <span class="text-[10px] text-muted-foreground">saving…</span>
            {/if}
          </div>

          <div class="space-y-2">
            <!-- Name — an authored override of the display name. Gated behind
                 an explicit Edit action (not a permanently-open text box). The
                 observed identity (sysName / mgmtIp) stays in the section
                 above; this just renames the node. Reset reverts to the
                 discovered name — crucial for nodes whose name is just an IP. -->
            <div class="rounded-lg border border-border bg-card shadow-sm p-3">
              {#if editingName}
                <div class="mb-2 text-sm font-semibold text-foreground">Name</div>
                <Input
                  placeholder={node.sysName ?? node.mgmtIp ?? 'name'}
                  bind:value={nameDraft}
                  disabled={patchingPolicy}
                  onkeydown={(e) => {
                    if (e.key === 'Enter') saveName()
                    else if (e.key === 'Escape') cancelEditName()
                  }}
                />
                <div class="flex items-center gap-2 mt-2">
                  <Button size="sm" onclick={saveName} disabled={patchingPolicy}>Save</Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={patchingPolicy}
                    onclick={cancelEditName}
                  >
                    Cancel
                  </Button>
                  {#if node.sysName}
                    <span class="text-[10px] text-muted-foreground ml-auto">
                      empty → discovered (<span class="font-mono">{node.sysName}</span>)
                    </span>
                  {/if}
                </div>
              {:else}
                <div class="flex items-center justify-between gap-2">
                  <div class="min-w-0">
                    <div class="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Name
                    </div>
                    <p class="text-sm font-medium truncate">{node.label}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    class="h-8 shrink-0"
                    disabled={patchingPolicy || !onSetLabel}
                    onclick={startEditName}
                  >
                    Edit
                  </Button>
                </div>
              {/if}
            </div>

            <!-- Discovery policy — always shown: every node has an effective
                 mode (auto/observe/disabled). A segmented control sets a
                 per-node override; the selection reflects the *effective* mode
                 so it's never empty. When inheriting, the control reads as
                 "following …"; overriding shows a Reset-to-inherit action. -->
            <div class="rounded-lg border border-border bg-card shadow-sm p-3">
              <div class="text-sm font-semibold text-foreground mb-1">Discovery policy</div>
              <p class="text-[11px] text-muted-foreground mb-2.5">
                {#if hasPolicy}
                  Overridden on this node.
                {:else if effectivePolicy}
                  Following {originLabel(effectivePolicy.source.mode)} ·
                  <span class="font-mono">{effectivePolicy.mode}</span>
                  · every {formatInterval(effectivePolicy.intervalMs)}
                {:else}
                  Not set.
                {/if}
              </p>

              <!-- Segmented control: one selection out of the three modes. -->
              <div class="inline-flex w-full rounded-md border border-border p-0.5 bg-background">
                {#each MODE_OPTIONS as m (m)}
                  {@const selected = (hasPolicy ? policyMode : effectivePolicy?.mode) === m}
                  <button
                    type="button"
                    class="flex-1 rounded-[5px] px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50
                      {selected
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'}
                      {selected && !hasPolicy ? 'opacity-80' : ''}"
                    disabled={patchingPolicy}
                    aria-pressed={selected}
                    onclick={() => setMode(m)}
                  >
                    {m}
                  </button>
                {/each}
              </div>

              {#if hasPolicy}
                <div class="mt-2 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-7 px-2 text-muted-foreground"
                    disabled={patchingPolicy}
                    title="Clear the per-node override and inherit"
                    onclick={clearPolicyOverride}
                  >
                    Reset to inherited
                  </Button>
                </div>
              {/if}
            </div>

            <!-- Access — how the node is read. Header carries a + button that
                 opens a dropdown of the protocols not yet attached (SNMP / SSH
                 / NETCONF / HTTP); choosing one appends a row with its fields.
                 The ones the engine can't read with yet are flagged. -->
            <div class="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
              <div class="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
                <div class="min-w-0">
                  <div class="text-sm font-semibold text-foreground">Access</div>
                  <div class="text-[11px] text-muted-foreground">how this node is read</div>
                </div>
                {#if addableProtocols.length > 0}
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger
                      disabled={patchingPolicy}
                      class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50 transition-colors shrink-0"
                      title="Add access method"
                      aria-label="Add access method"
                    >
                      <PlusIcon size={16} weight="bold" />
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content
                      sideOffset={6}
                      align="end"
                      class="z-50 min-w-[15rem] rounded-md border border-border bg-popover p-1 shadow-lg"
                    >
                      {#each addableProtocols as p (p.protocol)}
                        <DropdownMenu.Item
                          disabled={patchingPolicy}
                          onSelect={() => addAccess(p.protocol)}
                          class="flex items-center justify-between gap-3 rounded-sm px-2.5 py-2 text-left cursor-pointer outline-none data-[highlighted]:bg-accent data-[disabled]:opacity-50"
                        >
                          <span class="flex flex-col">
                            <span class="text-sm font-medium">{p.label}</span>
                            <span class="text-[11px] text-muted-foreground">{p.hint}</span>
                          </span>
                          {#if !p.reads}
                            <span class="text-[10px] text-muted-foreground whitespace-nowrap">
                              not read yet
                            </span>
                          {/if}
                        </DropdownMenu.Item>
                      {/each}
                    </DropdownMenu.Content>
                  </DropdownMenu.Root>
                {/if}
              </div>

              <!-- Attached protocols: one row each. Tap a row to expand its
                   fields (accordion — at most one open). Collapsed rows show a
                   value summary + chevron, iOS-Settings-style. -->
              {#if accessRows.length > 0}
                <div class="border-t border-border divide-y divide-border">
                  {#each accessRows as row (row.protocol)}
                    {@const expanded = openAccess === row.protocol}
                    <div>
                      <button
                        type="button"
                        class="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-accent/50 transition-colors"
                        aria-expanded={expanded}
                        onclick={() => toggleAccess(row.protocol)}
                      >
                        <span class="flex items-center gap-2 min-w-0">
                          <CaretRightIcon
                            size={14}
                            class="text-muted-foreground shrink-0 transition-transform {expanded
                              ? 'rotate-90'
                              : ''}"
                          />
                          <span class="text-sm font-medium">{protocolLabel(row.protocol)}</span>
                          {#if !protocolReads(row.protocol)}
                            <span
                              class="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground whitespace-nowrap"
                              title="Stored, but the discovery engine doesn't read via this protocol yet"
                            >
                              not read yet
                            </span>
                          {/if}
                        </span>
                        {#if !expanded}
                          <span
                            class="text-xs text-muted-foreground truncate max-w-[150px] font-mono"
                          >
                            {accessSummary(row)}
                          </span>
                        {/if}
                      </button>

                      {#if expanded}
                        <div class="px-3 pb-3 pl-9 space-y-2">
                          {#if row.protocol === 'snmp'}
                            <div class="space-y-1">
                              <Label class="text-[11px] text-muted-foreground">Community</Label>
                              <Input
                                class="h-8 text-xs font-mono"
                                placeholder="community (e.g. public)"
                                value={snmpCommunityOf(row)}
                                disabled={patchingPolicy}
                                onchange={(e) => setSnmpCommunity(e.currentTarget.value)}
                              />
                            </div>
                          {:else if row.protocol === 'ssh'}
                            <div class="space-y-1">
                              <Label class="text-[11px] text-muted-foreground">Username</Label>
                              <Input
                                class="h-8 text-xs"
                                placeholder="username"
                                value={sshUsernameOf(row)}
                                disabled={patchingPolicy}
                                onchange={(e) => setSshUsername(e.currentTarget.value)}
                              />
                            </div>
                          {:else}
                            <p class="text-[11px] text-muted-foreground">
                              No editable fields for this protocol yet.
                            </p>
                          {/if}
                          <div class="flex justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              class="h-7 gap-1 px-2 text-muted-foreground hover:text-destructive"
                              disabled={patchingPolicy}
                              onclick={() => removeAccess(row.protocol)}
                            >
                              <TrashIcon size={14} />
                              Remove
                            </Button>
                          </div>
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              {:else}
                <!-- Empty / inheritance state when nothing is attached here. -->
                <div class="border-t border-border px-3 py-2.5 text-[11px] text-muted-foreground">
                  {#if effectivePolicy?.community}
                    No override — SNMP community inherited from
                    {originLabel(effectivePolicy.source.community)}
                    (<span class="font-mono">{effectivePolicy.community}</span>). Use + to override.
                  {:else if node.readVia}
                    No override — reading with the {node.sourceName ?? 'source'} default community.
                    Use + to override.
                  {:else if node.syncState === 'notice'}
                    <span class="text-amber-700 dark:text-amber-300">
                      Reachable but not readable — use + to add SNMP and set a community.
                    </span>
                  {:else}
                    No access method attached. Use + to add one.
                  {/if}
                </div>
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
        <p class="text-xs text-muted-foreground">Probe re-runs discovery against this node's IP.</p>
        <Button onclick={onProbe} disabled={probing || !node.sourceId || !node.mgmtIp} size="sm">
          {probing ? 'Probing…' : '⟳ Probe now'}
        </Button>
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>
