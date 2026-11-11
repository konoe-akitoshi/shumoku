<script lang="ts">
  import type { AccessMethod } from '$lib/api'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'

  /**
   * The fields of one credential: name, method, and the method's own fields
   * (drawn from `methods[].fields`). Secret fields are write-only; the API only
   * reports which are already set, so an edit shows 設定済み and keeps the stored
   * value when left empty. The parent owns the values and the saving.
   */
  interface Props {
    methods: AccessMethod[]
    /** Keys of secret fields that already have a stored value (edit only). */
    secretsSet?: string[]
    /** Editing an existing credential: the method cannot change. */
    editing?: boolean
    /** Hide the name field (the first-run form leaves naming to the server). */
    hideName?: boolean
    name: string
    methodId: string
    values: Record<string, string>
    disabled?: boolean
    onSubmit?: () => void
  }

  let {
    methods,
    secretsSet = [],
    editing = false,
    hideName = false,
    name = $bindable(),
    methodId = $bindable(),
    values = $bindable(),
    disabled = false,
    onSubmit,
  }: Props = $props()

  const method = $derived(methods.find((m) => m.id === methodId))
  const methodLabel = (id: string) => methods.find((m) => m.id === id)?.label ?? id
  const secretIsSet = (f: { key: string; secret: boolean }) =>
    editing && f.secret && secretsSet.includes(f.key)
</script>

<div class="space-y-3">
  {#if !hideName}
    <div class="space-y-1">
      <Label for="credential-name">名前</Label>
      <Input
        id="credential-name"
        bind:value={name}
        {disabled}
        placeholder={editing ? '' : '自動で付けます'}
      />
    </div>
  {/if}

  {#if methods.length > 1}
    <div class="space-y-1">
      <Label for="credential-method">方式</Label>
      {#if editing}
        <p id="credential-method" class="text-sm">{methodLabel(methodId)}</p>
      {:else}
        <select id="credential-method" class="input" bind:value={methodId} {disabled}>
          {#each methods as m (m.id)}
            <option value={m.id}>{m.label}</option>
          {/each}
        </select>
      {/if}
    </div>
  {/if}

  {#if method}
    {#each method.fields as f (f.key)}
      <div class="space-y-1">
        <Label for="credential-field-{f.key}">
          {f.label}
          {#if f.required && !secretIsSet(f)}
            <span class="text-destructive"> *</span>
          {/if}
        </Label>
        <Input
          id="credential-field-{f.key}"
          type={f.secret ? 'password' : 'text'}
          autocomplete="off"
          {disabled}
          placeholder={secretIsSet(f) ? '設定済み — 空欄なら変更しない' : (f.placeholder ?? '')}
          value={values[f.key] ?? ''}
          oninput={(e) => (values = { ...values, [f.key]: e.currentTarget.value })}
          onkeydown={(e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSubmit?.()
    }
  }}
        />
      </div>
    {/each}
  {/if}
</div>
