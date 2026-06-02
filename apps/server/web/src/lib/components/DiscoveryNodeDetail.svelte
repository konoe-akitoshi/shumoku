<script lang="ts">
  import { DropdownMenu } from 'bits-ui'
  import { CaretRightIcon, PlusIcon, TrashIcon } from 'phosphor-svelte'
  import { type Attachment, type DiscoveryMode, type EffectivePolicy } from '$lib/api'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import {
    accessKey,
    isAuthoredAttachment,
    stripProvenance,
    unifyAccessRows,
  } from '$lib/discovery-attachments'

  /**
   * Discovery-tab per-node detail. Two regions:
   *   - Observed: the device's identity facts (mgmtIp / sysName / chassisId).
   *   - Settings: name, discovery policy, and Access — each shown as ONE
   *     effective value (no observed/authored layers). For Access the field
   *     is always editable; editing sets a top-priority override, clearing
   *     drops it back to the source value. `provenance` only annotates where
   *     the current value comes from. We PATCH just the operator's overrides
   *     (`working`) via `onSetAttachments`; observed values are never sent.
   */

  /** Where an effective value was inherited from (for origin hints). */
  type OriginLevel = 'node' | 'subgraph' | 'topology' | 'default'

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
      /** Attachment keys the human removed (negative assertion), from the
       *  resolved node — so the panel can round-trip suppression. */
      suppressedAttachments?: string[]
    } | null
    /** The node's resolved attachments (sources + human, merged with
     *  provenance). The panel splits them by provenance for display/edit. */
    attachments?: Attachment[]
    probing: boolean
    onProbe: () => void
    formatAgo: (ts: number) => string
    /** Effective (merged) policy for inherited-value hints. */
    effectivePolicy?: EffectivePolicy | null
    patchingPolicy?: boolean
    policyErrorMessage?: string | null
    /** Emit the full desired human state for this node: the operator's
     *  attachments (overrides/additions) and the suppressed keys (removals).
     *  The parent PATCHes both. */
    onSetAttachments?: (next: {
      attachments: Attachment[]
      suppressed: string[]
    }) => void | Promise<void>
    /** Set the authored name override (`null`/'' reverts to the observed name). */
    onSetLabel?: (label: string | null) => void | Promise<void>
    /** Reset: drop the whole authored overlay (attachments + name) for this node. */
    onReset?: () => void | Promise<void>
    /** Hide: exclude this node from the diagram (identity-keyed). */
    onHide?: () => void | Promise<void>
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
    onReset,
    onHide,
  }: Props = $props()

  function originLabel(o: OriginLevel): string {
    if (o === 'node') return 'this node'
    if (o === 'subgraph') return 'subgraph'
    if (o === 'topology') return 'topology default'
    return 'runtime default'
  }

  const MODE_OPTIONS: DiscoveryMode[] = ['auto', 'observe', 'disabled']
  // Selected-mode highlight, toned per mode (same hues as the grid cards) so
  // the color carries the mode — not the app's green `primary`, which reads as
  // "healthy" on a not-readable node and would even paint "disabled" green.
  const MODE_SELECTED_CLASS: Record<DiscoveryMode, string> = {
    auto: 'bg-sky-500 text-white shadow-sm',
    observe: 'bg-violet-500 text-white shadow-sm',
    disabled: 'bg-neutral-500 text-white shadow-sm',
  }

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

  // ── Local editable copy of the overlay. Re-synced from the incoming
  //    `attachments` prop whenever the PROP itself changes (node switched, or
  //    the parent pushed a new overlay for the same node — e.g. Reset clearing
  //    it server-side). We track the last `attachments` PROP value in
  //    `lastPropsKey`, updated ONLY here in the effect. A local edit changes
  //    `working` (and PATCHes), but does NOT touch `lastPropsKey`; the parent's
  //    post-PATCH round-trip re-passes the same value, so `incomingKey ===
  //    lastPropsKey` and the effect is a no-op — the edit is never stomped.
  //    (Earlier this compared against a key that `commit` also mutated, which
  //    re-fired the effect with the still-old prop and reset `working` back —
  //    that stomped edits. Keep `lastPropsKey` effect-only.) ──
  let working = $state<Attachment[]>([])
  // Attachment keys the operator removed (negative assertion). PATCHed
  // alongside `working`; seeded from the resolved node's suppressedAttachments.
  let workingSuppressed = $state<string[]>([])
  let boundId = $state<string | null>(null)
  let lastPropsKey = $state<string>('')
  // Name editing is gated behind an explicit Edit action — the name is not a
  // permanently-open free-text box.
  let editingName = $state(false)
  let nameDraft = $state('')
  // Which access row is expanded for editing (accordion — at most one).
  let openAccess = $state<AccessProtocol | null>(null)
  $effect(() => {
    if (!node) return
    // Key on both the merged attachments AND the suppression set, so a change
    // to either re-syncs the local editable copies (and never on a local edit,
    // which doesn't touch the props — that would stomp the edit).
    const incomingKey = JSON.stringify({ a: attachments, s: node.suppressedAttachments ?? [] })
    const nodeChanged = node.id !== boundId
    if (nodeChanged || incomingKey !== lastPropsKey) {
      boundId = node.id
      lastPropsKey = incomingKey
      // `working` holds ONLY the operator's overrides/additions; `workingSuppressed`
      // holds their removals. Observed values aren't copied in — they're merged
      // for display by unifyAccessRows and shown in the same editable field
      // (editing one creates an override). So we never PATCH an observed value
      // as if it were the operator's.
      working = attachments.filter(isAuthoredAttachment).map(stripProvenance)
      workingSuppressed = [...(node.suppressedAttachments ?? [])]
      if (nodeChanged) {
        editingName = false
        openAccess = null
      }
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
  // ONE row per protocol — no observed/authored layers. `working` holds the
  // operator's overrides; the resolved props carry whatever a source observed.
  // unifyAccessRows collapses them: each row's effective value is the override
  // if present, else the observed value, and the field is always editable.
  const observedAccessAll = $derived(
    attachments.filter(
      (a): a is AccessAttachment => a.kind === 'access' && !isAuthoredAttachment(a),
    ),
  )
  // One row per protocol (override ?? observed), minus anything the operator
  // suppressed (deleted). Suppressed rows vanish immediately, before the
  // round-trip drops them from the props.
  const unifiedAccess = $derived(
    unifyAccessRows(working, observedAccessAll).filter(
      (r) => !workingSuppressed.includes(accessKey(r.protocol)),
    ),
  )
  // Shown protocols. The + menu offers the rest (a suppressed protocol becomes
  // addable again — re-adding it un-suppresses).
  const presentProtocols = $derived(new Set<AccessProtocol>(unifiedAccess.map((r) => r.protocol)))
  const addableProtocols = $derived(
    ACCESS_PROTOCOLS.filter((p) => !presentProtocols.has(p.protocol)),
  )
  const policyMode = $derived.by(() => {
    const a = working.find((x) => x.kind === 'policy')
    return a && a.kind === 'policy' ? a.mode : undefined
  })

  function commit(next: Attachment[], nextSuppressed: string[] = workingSuppressed): void {
    // Local edit: update working + suppression and PATCH. Do NOT touch
    // `lastPropsKey` — it tracks the incoming PROPS only. Touching it here would
    // re-fire the sync effect with the still-old props and reset the edit back,
    // stomping it. The parent's post-PATCH refresh re-passes new props and the
    // effect re-syncs from those legitimately.
    working = next
    workingSuppressed = nextSuppressed
    void onSetAttachments?.({ attachments: next, suppressed: nextSuppressed })
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

  /** Upsert the operator's override for a protocol into `working` (add if the
   *  protocol isn't overridden yet, else replace it in place). Editing a value
   *  also un-suppresses the key — you can't both delete and override it. */
  function upsertAccess(next: AccessAttachment): void {
    const exists = working.some((a) => a.kind === 'access' && a.protocol === next.protocol)
    const nextWorking = exists
      ? working.map((a) => (a.kind === 'access' && a.protocol === next.protocol ? next : a))
      : [...working, next]
    commit(
      nextWorking,
      workingSuppressed.filter((k) => k !== accessKey(next.protocol)),
    )
  }
  // Editing to a value sets a top-priority override; clearing the field drops
  // the override (revert to the observed value / source default) — so we never
  // store an empty override that would blank an observed value.
  function setSnmpCommunity(value: string): void {
    const v = value.trim()
    if (!v) {
      removeAccess('snmp')
      return
    }
    upsertAccess({ kind: 'access', protocol: 'snmp', community: v })
  }
  function setSshUsername(value: string): void {
    const v = value.trim()
    if (!v) {
      removeAccess('ssh')
      return
    }
    upsertAccess({ kind: 'access', protocol: 'ssh', username: v })
  }

  function addAccess(protocol: AccessProtocol): void {
    if (presentProtocols.has(protocol)) return
    // Adding un-suppresses too (re-adding a previously-deleted protocol).
    commit(
      [...working, { kind: 'access', protocol }],
      workingSuppressed.filter((k) => k !== accessKey(protocol)),
    )
    openAccess = protocol // expand the freshly-added row for immediate editing
  }
  /** Clearing the field drops the operator's override → the row reverts to the
   *  source value (it stays shown). NOT a delete: suppression is untouched. */
  function removeAccess(protocol: AccessProtocol): void {
    commit(working.filter((a) => !(a.kind === 'access' && a.protocol === protocol)))
  }
  /** ✕ deletes the access entirely. If a source supplies it, record a
   *  suppression so it stays gone across re-scans; always drop any override.
   *  Reset (whole node) brings it back. */
  function deleteAccess(protocol: AccessProtocol, hasObserved: boolean): void {
    const nextWorking = working.filter((a) => !(a.kind === 'access' && a.protocol === protocol))
    const key = accessKey(protocol)
    const nextSuppressed = hasObserved
      ? Array.from(new Set([...workingSuppressed, key]))
      : workingSuppressed.filter((k) => k !== key)
    commit(nextWorking, nextSuppressed)
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

        <!-- Settings: name / discovery policy / access for this one node.
             Each is a single effective value the operator can edit, override,
             or delete — not a separate "authored layer". -->
        <section>
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Settings
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
                      ? MODE_SELECTED_CLASS[m]
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
              {#if unifiedAccess.length > 0}
                <!-- ONE row per protocol. No observed/authored layers: the
                     field is always editable (typing sets a top-priority
                     override); the caption just says where the current value
                     comes from. Clearing the field / Revert drops the override
                     back to the source value. -->
                <div class="border-t border-border divide-y divide-border">
                  {#each unifiedAccess as row (row.protocol)}
                    {@const effective = row.authored ?? row.observed}
                    {@const overridden = !!row.authored}
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
                        {#if !expanded && effective}
                          <span
                            class="text-xs text-muted-foreground truncate max-w-[150px] font-mono"
                          >
                            {accessSummary(effective)}
                          </span>
                        {/if}
                      </button>

                      {#if expanded && effective}
                        <div class="px-3 pb-3 pl-9 space-y-2">
                          <p class="text-[11px] text-muted-foreground">
                            {#if overridden}
                              Your value
                              {#if row.observed}
                                · source read
                                <span class="font-mono">{accessSummary(row.observed)}</span>
                                · clear to revert
                              {/if}
                            {:else}
                              From {node.sourceName ?? 'the source'} — edit to set your own
                            {/if}
                          </p>
                          {#if row.protocol === 'snmp'}
                            <div class="space-y-1">
                              <Label class="text-[11px] text-muted-foreground">Community</Label>
                              <Input
                                class="h-8 text-xs font-mono"
                                placeholder="community (e.g. public)"
                                value={snmpCommunityOf(effective)}
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
                                value={sshUsernameOf(effective)}
                                disabled={patchingPolicy}
                                onchange={(e) => setSshUsername(e.currentTarget.value)}
                              />
                            </div>
                          {:else}
                            <p class="text-[11px] text-muted-foreground">
                              No editable fields for this protocol yet.
                            </p>
                          {/if}
                          <!-- ✕ deletes the access (any row, incl. source-supplied).
                               A source-supplied one is suppressed so it stays gone
                               across re-scans; Reset (whole node) restores it. -->
                          <div class="flex items-center justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              class="h-7 gap-1 px-2 text-muted-foreground hover:text-destructive"
                              disabled={patchingPolicy}
                              title="Delete this access. Reset restores it from the source."
                              onclick={() => deleteAccess(row.protocol, !!row.observed)}
                            >
                              <TrashIcon size={14} />
                              Delete
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
        <div class="flex items-center gap-1.5">
          {#if onReset}
            <Button
              variant="ghost"
              size="sm"
              disabled={patchingPolicy}
              title="Discard your overrides on this node and return to the discovered state"
              onclick={() => onReset?.()}
            >
              Reset
            </Button>
          {/if}
          {#if onHide}
            <Button
              variant="ghost"
              size="sm"
              class="text-muted-foreground hover:text-destructive"
              title="Hide this node from the diagram (it stays discoverable but won't be shown)"
              onclick={() => onHide?.()}
            >
              Hide
            </Button>
          {/if}
        </div>
        <Button onclick={onProbe} disabled={probing || !node.sourceId || !node.mgmtIp} size="sm">
          {probing ? 'Rescanning…' : '⟳ Rescan'}
        </Button>
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>
