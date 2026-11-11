<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { AccessMethod, TopologyCredential } from '$lib/api'
  import { Button } from '$lib/components/ui/button'
  import { usageSummary } from '$lib/device-actions'
  import { TONE_CLASS } from '$lib/devices'

  /**
   * The credentials this topology uses, at the top of the Devices card. A row
   * filters the device list to that credential; 編集 and 追加 are admin only.
   */
  interface Props {
    credentials: TopologyCredential[]
    methods: AccessMethod[]
    admin: boolean
    loading: boolean
    /** The credential the device list is filtered to. */
    filter: string | null
    onFilter: (id: string | null) => void
    onEdit: (id: string) => void
    onAdd: () => void
    /** What an admin sees when there is no credential yet (the create form). */
    firstRun: Snippet
  }

  let { credentials, methods, admin, loading, filter, onFilter, onEdit, onAdd, firstRun }: Props =
    $props()

  const methodLabel = (id: string) => methods.find((m) => m.id === id)?.label ?? id
</script>

<section class="space-y-2" aria-label="認証情報">
  <div class="flex items-center justify-between gap-2">
    <h3 class="text-sm font-medium">認証情報</h3>
    {#if admin && credentials.length > 0}
      <Button variant="outline" size="sm" onclick={onAdd}>＋ 追加</Button>
    {/if}
  </div>

  {#if credentials.length > 0}
    <ul class="divide-y divide-border rounded-lg border border-border">
      {#each credentials as c (c.id)}
        <li class="flex items-center {filter === c.id ? 'bg-muted/60' : ''}">
          <button
            type="button"
            class="min-h-11 min-w-0 flex-1 px-3 py-2 text-left hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
            aria-pressed={filter === c.id}
            aria-label="{c.name}の機器だけを表示"
            onclick={() => onFilter(filter === c.id ? null : c.id)}
          >
            <span class="block truncate text-sm font-medium">{c.name}</span>
            <span class="block truncate text-xs text-muted-foreground">
              {methodLabel(c.method)}
              ·
              <span class={usageSummary(c.usage).warn ? TONE_CLASS.warn : ''}
                >{usageSummary(c.usage).text}</span
              >
            </span>
          </button>
          {#if admin}
            <Button
              variant="ghost"
              size="sm"
              class="mr-1 shrink-0"
              aria-label="{c.name}を編集"
              onclick={() => onEdit(c.id)}
            >
              編集
            </Button>
          {/if}
        </li>
      {/each}
    </ul>
  {:else if !loading}
    {#if admin}
      <div class="space-y-2 rounded-lg border border-border p-3">
        <p class="text-xs text-muted-foreground">
          最初の認証情報を登録すると、「読み取る」で機器に順に試し、応答したものを自動で割り当てます。
        </p>
        {@render firstRun()}
      </div>
    {:else}
      <p class="text-sm text-muted-foreground">
        認証情報がありません。管理者に登録を依頼してください。
      </p>
    {/if}
  {/if}
</section>
