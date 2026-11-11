<script lang="ts">
  import { DropdownMenu } from 'bits-ui'
  import { DotsThreeIcon } from 'phosphor-svelte'
  import type { TopologyCredential } from '$lib/api'

  /** Actions on a whole group at once; every label says how many devices it touches. */
  interface Props {
    label: string
    count: number
    credentials: TopologyCredential[]
    /** Disabled group: offers 対象外を解除 instead of 対象外にする. */
    isDisabledGroup: boolean
    canRead: boolean
    /** Put 対象外にする first (the silent group). */
    disableFirst: boolean
    busy: boolean
    onRead: () => void
    onAssign: (credentialId: string | null) => void
    onSetEnabled: (enabled: boolean) => void
  }

  let {
    label,
    count,
    credentials,
    isDisabledGroup,
    canRead,
    disableFirst,
    busy,
    onRead,
    onAssign,
    onSetEnabled,
  }: Props = $props()

  const itemClass =
    'flex min-h-10 cursor-pointer items-center gap-2 rounded-sm px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-accent'
  const contentClass = 'z-50 min-w-[14rem] rounded-md border border-border bg-popover p-1 shadow-lg'
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger
    disabled={busy}
    aria-label="{label}の操作"
    class="inline-flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-accent disabled:opacity-50"
  >
    <DotsThreeIcon class="size-5" weight="bold" />
  </DropdownMenu.Trigger>
  <DropdownMenu.Content sideOffset={4} align="end" class={contentClass}>
    {#if disableFirst && !isDisabledGroup}
      <DropdownMenu.Item class={itemClass} onSelect={() => onSetEnabled(false)}>
        {count}
        台を対象外にする
      </DropdownMenu.Item>
    {/if}
    {#if canRead}
      <DropdownMenu.Item class={itemClass} onSelect={onRead}>
        {count}
        台を読み取る
      </DropdownMenu.Item>
    {/if}
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger class={itemClass}>
        {count}
        台に認証情報を割り当て
      </DropdownMenu.SubTrigger>
      <DropdownMenu.SubContent class={contentClass}>
        {#each credentials as p (p.id)}
          <DropdownMenu.Item class={itemClass} onSelect={() => onAssign(p.id)}>
            {p.name}
          </DropdownMenu.Item>
        {/each}
        {#if credentials.length === 0}
          <p class="px-2.5 py-2 text-xs text-muted-foreground">認証情報がありません</p>
        {/if}
        <DropdownMenu.Separator class="my-1 h-px bg-border" />
        <DropdownMenu.Item class={itemClass} onSelect={() => onAssign(null)}>
          割り当てを外す
        </DropdownMenu.Item>
      </DropdownMenu.SubContent>
    </DropdownMenu.Sub>
    {#if isDisabledGroup}
      <DropdownMenu.Item class={itemClass} onSelect={() => onSetEnabled(true)}>
        {count}
        台の対象外を解除
      </DropdownMenu.Item>
    {:else if !disableFirst}
      <DropdownMenu.Item class={itemClass} onSelect={() => onSetEnabled(false)}>
        {count}
        台を対象外にする
      </DropdownMenu.Item>
    {/if}
  </DropdownMenu.Content>
</DropdownMenu.Root>
