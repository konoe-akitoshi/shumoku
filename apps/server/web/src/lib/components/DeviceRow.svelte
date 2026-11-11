<script lang="ts">
  import type { Device, TopologyCredential } from '$lib/api'
  import { STATE_META, TONE_CLASS } from '$lib/devices'

  /**
   * One device: a checkbox, the tappable body (opens the sheet) and a compact
   * credential select. The layout follows the list's own width (container query),
   * not the window's: a narrow panel stacks the select under the address even on
   * a wide screen; from `@lg` it sits on the right.
   */
  interface Props {
    device: Device
    credentials: TopologyCredential[]
    selected: boolean
    busy: boolean
    formatAgo: (ts: number) => string
    onOpen: (device: Device) => void
    onSelect: (device: Device, on: boolean) => void
    onAssign: (device: Device, credentialId: string | null) => Promise<boolean>
  }

  let {
    device: d,
    credentials,
    selected,
    busy,
    formatAgo,
    onOpen,
    onSelect,
    onAssign,
  }: Props = $props()

  const meta = $derived(STATE_META[d.state])
  const secondLine = $derived(
    [d.sysName && d.sysName !== d.label ? d.sysName : null, d.model].filter(Boolean).join(' · '),
  )

  async function change(e: Event & { currentTarget: HTMLSelectElement }) {
    const el = e.currentTarget
    const ok = await onAssign(d, el.value || null)
    if (!ok) el.value = d.credentialId ?? ''
  }
</script>

<li class="flex items-start {selected ? 'bg-muted/60' : ''}">
  <label class="flex size-11 shrink-0 cursor-pointer items-center justify-center">
    <input
      type="checkbox"
      class="size-4"
      aria-label="{d.label} を選択"
      checked={selected}
      onchange={(e) => onSelect(d, e.currentTarget.checked)}
    >
  </label>
  <div class="min-w-0 flex-1 pr-3 @lg:flex @lg:items-center @lg:gap-3">
    <button
      type="button"
      class="block min-h-11 w-full min-w-0 py-2 text-left hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none @lg:flex-1 {d.enabled ? '' : 'text-muted-foreground'}"
      onclick={() => onOpen(d)}
    >
      <span class="block truncate text-sm font-medium">{d.label}</span>
      <span class="block truncate text-xs">
        <span class="font-mono">{d.mgmtIp ?? '—'}</span>
        {#if secondLine}
          <span class="text-muted-foreground"> · {secondLine}</span>
        {/if}
      </span>
      {#if d.lastReadAt}
        <span class="block truncate text-xs text-muted-foreground">{formatAgo(d.lastReadAt)}</span>
      {/if}
      {#if meta.showsError && d.lastError}
        <span class="line-clamp-2 block break-words text-xs {TONE_CLASS[meta.tone]}"
          >{d.lastError}</span
        >
      {/if}
    </button>
    <div class="flex items-center gap-2 pb-2 @lg:w-64 @lg:shrink-0 @lg:pb-0">
      <select
        class="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        aria-label="{d.label} の認証情報"
        disabled={busy}
        value={d.credentialId ?? ''}
        onchange={change}
      >
        <option value="">未設定</option>
        {#each credentials as p (p.id)}
          <option value={p.id}>{p.name}</option>
        {/each}
      </select>
      {#if d.assignedBy === 'probe'}
        <span class="shrink-0 rounded border border-border px-1 text-[10px]">自動</span>
      {/if}
    </div>
  </div>
</li>
