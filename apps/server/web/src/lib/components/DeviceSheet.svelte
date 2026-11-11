<script lang="ts">
  import type { Device, TopologyCredential } from '$lib/api'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Input } from '$lib/components/ui/input'
  import { STATE_META, TONE_CLASS } from '$lib/devices'

  /**
   * One device, opened from the list: what happened to it, the exceptions a
   * person may act on (override the credential, leave it out, read it now), and —
   * in a separate section — edits of the node itself (rename / reset / hide).
   * A bottom sheet on a narrow screen, a centred dialog from `sm` up.
   */
  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    device: Device | null
    credentials: TopologyCredential[]
    busy: boolean
    error: string | null
    /** Result of reading this device, shown inline. */
    notice: string | null
    formatAgo: (ts: number) => string
    onAssign: (credentialId: string | null) => unknown
    onSetEnabled: (enabled: boolean) => unknown
    onRead: () => unknown
    onSetLabel: (label: string | null) => void | Promise<void>
    onReset: () => void | Promise<void>
    onHide: () => void | Promise<void>
  }

  let {
    open,
    onOpenChange,
    device,
    credentials,
    busy,
    error,
    notice,
    formatAgo,
    onAssign,
    onSetEnabled,
    onRead,
    onSetLabel,
    onReset,
    onHide,
  }: Props = $props()

  let editingName = $state(false)
  let nameDraft = $state('')
  let boundId = $state<string | null>(null)

  $effect(() => {
    if (device && device.id !== boundId) {
      boundId = device.id
      editingName = false
    }
  })

  const meta = $derived(device ? STATE_META[device.state] : null)
  const canHide = $derived(Boolean(device?.mgmtIp || device?.chassisId || device?.sysName))
  const canRead = $derived(Boolean(device?.mgmtIp) && device?.enabled === true)

  function startEditName() {
    nameDraft = device?.label ?? ''
    editingName = true
  }
  function saveName() {
    void onSetLabel(nameDraft.trim() || null)
    editingName = false
  }
</script>

<Dialog.Root bind:open={() => open, (v) => onOpenChange(v)}>
  <Dialog.Content
    class="top-auto bottom-0 left-0 max-w-full translate-x-0 translate-y-0 rounded-b-none sm:top-[50%] sm:bottom-auto sm:left-[50%] sm:max-w-lg sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-b-lg"
  >
    {#if device && meta}
      <Dialog.Header>
        <Dialog.Title class="truncate pr-6">{device.label}</Dialog.Title>
        <Dialog.Description class="text-xs">
          {device.model ?? device.vendor ?? 'デバイス'}
        </Dialog.Description>
      </Dialog.Header>

      <Dialog.Body>
        <div class="space-y-5 text-sm">
          <section class="space-y-2">
            <p class="font-medium {TONE_CLASS[meta.tone]}">{meta.label}</p>
            <p class="text-muted-foreground">{meta.explanation}</p>
            {#if device.lastError}
              <p
                class="whitespace-pre-wrap break-words rounded border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive"
              >
                {device.lastError}
              </p>
            {/if}
            <p class="text-xs text-muted-foreground">
              最終取得: {device.lastReadAt ? formatAgo(device.lastReadAt) : '—'}
            </p>
          </section>

          <section>
            <h3 class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              識別情報
            </h3>
            <dl class="space-y-1 rounded-lg border border-border bg-card p-3 shadow-sm">
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">アドレス</dt>
                <dd class="font-mono">{device.mgmtIp ?? '—'}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">sysName</dt>
                <dd class="min-w-0 truncate">{device.sysName ?? '—'}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">chassisId</dt>
                <dd class="min-w-0 truncate font-mono text-xs" title={device.chassisId}>
                  {device.chassisId ?? '—'}
                </dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">ベンダー / モデル</dt>
                <dd class="min-w-0 truncate">
                  {[device.vendor, device.model].filter(Boolean).join(' / ') || '—'}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h3 class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              読み取り
            </h3>
            <div class="space-y-3 rounded-lg border border-border bg-card p-3 shadow-sm">
              <div class="space-y-1">
                <label for="device-credential" class="text-muted-foreground">認証情報</label>
                <select
                  id="device-credential"
                  class="input w-full"
                  disabled={busy}
                  value={device.credentialId ?? ''}
                  onchange={(e) => void onAssign(e.currentTarget.value || null)}
                >
                  <option value="">未設定</option>
                  {#each credentials as p (p.id)}
                    <option value={p.id}>{p.name}</option>
                  {/each}
                </select>
                {#if device.assignedBy === 'probe'}
                  <p class="text-xs text-muted-foreground">自動判定で選ばれました</p>
                {/if}
              </div>
              <div class="flex flex-wrap gap-2">
                <Button size="sm" disabled={busy || !canRead} onclick={() => void onRead()}>
                  {busy ? '読み取り中…' : 'この機器を読み取る'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onclick={() => void onSetEnabled(!device.enabled)}
                >
                  {device.enabled ? '対象外にする' : '対象外を解除'}
                </Button>
              </div>
              {#if notice}
                <p class="text-xs text-muted-foreground" role="status">{notice}</p>
              {/if}
            </div>
          </section>

          <section>
            <h3 class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              ノード
            </h3>
            <div class="space-y-3 rounded-lg border border-border bg-card p-3 shadow-sm">
              {#if editingName}
                <Input
                  placeholder={device.sysName ?? device.mgmtIp ?? '名前'}
                  aria-label="ノード名"
                  bind:value={nameDraft}
                  disabled={busy}
                  onkeydown={(e) => {
    if (e.key === 'Enter') saveName()
    else if (e.key === 'Escape') editingName = false
  }}
                />
                <div class="flex flex-wrap items-center gap-2">
                  <Button size="sm" disabled={busy} onclick={saveName}>保存</Button>
                  <Button variant="ghost" size="sm" onclick={() => (editingName = false)}>
                    キャンセル
                  </Button>
                  <span class="text-[11px] text-muted-foreground">空欄で元の名前に戻す</span>
                </div>
              {:else}
                <div class="flex items-center justify-between gap-2">
                  <div class="min-w-0">
                    <div class="text-[11px] text-muted-foreground">名前</div>
                    <p class="truncate font-medium">{device.label}</p>
                  </div>
                  <Button variant="outline" size="sm" disabled={busy} onclick={startEditName}>
                    編集
                  </Button>
                </div>
              {/if}
              <div class="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  title="このノードへの上書きを破棄して元の状態に戻す"
                  onclick={() => void onReset()}
                >
                  リセット
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  class="text-muted-foreground hover:text-destructive"
                  disabled={busy || !canHide}
                  title="図から隠す"
                  onclick={() => void onHide()}
                >
                  図から隠す
                </Button>
              </div>
            </div>
          </section>

          {#if error}
            <p class="text-sm text-destructive" role="alert">{error}</p>
          {/if}
        </div>
      </Dialog.Body>
    {/if}
  </Dialog.Content>
</Dialog.Root>
