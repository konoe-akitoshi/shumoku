<script lang="ts">
  import { DropdownMenu } from 'bits-ui'
  import { CaretDownIcon } from 'phosphor-svelte'
  import type { TopologyCredential } from '$lib/api'
  import { Button, buttonVariants } from '$lib/components/ui/button'

  /** Shown while devices are selected: act on exactly those. */
  interface Props {
    count: number
    credentials: TopologyCredential[]
    busy: boolean
    onAssign: (credentialId: string | null) => void
    /** Admin only: omitted for others. */
    onCreateCredential?: () => void
    onSetEnabled: (enabled: boolean) => void
    onRead: () => void
    onClear: () => void
  }

  let {
    count,
    credentials,
    busy,
    onAssign,
    onCreateCredential,
    onSetEnabled,
    onRead,
    onClear,
  }: Props = $props()

  const itemClass =
    'flex min-h-10 cursor-pointer items-center gap-2 rounded-sm px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-accent'
</script>

<div
  class="sticky bottom-2 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 shadow-sm"
  role="region"
  aria-label="選択中の機器の操作"
>
  <span class="text-sm font-medium">{count} 件選択中</span>
  <DropdownMenu.Root>
    <DropdownMenu.Trigger
      disabled={busy}
      class={buttonVariants({ variant: 'outline', size: 'sm' })}
    >
      認証情報を割り当て
      <CaretDownIcon />
    </DropdownMenu.Trigger>
    <DropdownMenu.Content
      sideOffset={4}
      align="start"
      class="z-50 min-w-[14rem] rounded-md border border-border bg-popover p-1 shadow-lg"
    >
      {#each credentials as p (p.id)}
        <DropdownMenu.Item class={itemClass} onSelect={() => onAssign(p.id)}>
          {p.name}
        </DropdownMenu.Item>
      {/each}
      {#if credentials.length > 0}
        <DropdownMenu.Separator class="my-1 h-px bg-border" />
      {/if}
      <DropdownMenu.Item class={itemClass} onSelect={() => onAssign(null)}>
        割り当てを外す
      </DropdownMenu.Item>
      {#if onCreateCredential}
        <DropdownMenu.Item class={itemClass} onSelect={onCreateCredential}>
          新しい認証情報を作成…
        </DropdownMenu.Item>
      {/if}
    </DropdownMenu.Content>
  </DropdownMenu.Root>
  <Button variant="outline" size="sm" disabled={busy} onclick={() => onSetEnabled(false)}>
    対象外にする
  </Button>
  <Button variant="outline" size="sm" disabled={busy} onclick={() => onSetEnabled(true)}>
    対象外を解除
  </Button>
  <Button variant="outline" size="sm" disabled={busy || credentials.length === 0} onclick={onRead}>
    読み取る
  </Button>
  <Button variant="ghost" size="sm" onclick={onClear}>選択を解除</Button>
</div>
