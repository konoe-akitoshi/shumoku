<script lang="ts">
  // Generic, schema-driven config form. Renders any plugin `configSchema` /
  // `optionsSchema` (PluginConfigSchema) — there is no per-plugin branch here,
  // which is the whole point (#270). Widgets cover every Phase-0 §7.3 case:
  // text / uri / password / email / number / select(oneOf|enum) / checkbox /
  // string[] (free entry) / nested object, plus visibleWhen, warning, help.
  //
  // Recursion (nested objects) is a self-import — types live in $props (biome
  // can't parse typed {#snippet} params). Nested-object bags are created in an
  // $effect, not during render, to avoid Svelte's state_unsafe_mutation.
  // Dynamic `optionsSource` candidates degrade to free entry (the documented F2
  // fallback); wiring getConfigOptions is a later step.
  import { isSecretProp, type PluginConfigProperty, type PluginConfigSchema } from '@shumoku/core'
  import { EyeIcon, EyeSlashIcon } from 'phosphor-svelte'
  import SchemaForm from './SchemaForm.svelte'

  let {
    schema,
    value = $bindable(),
    disabled = false,
    getOptions,
    onChange,
  }: {
    schema: PluginConfigSchema
    value: Record<string, unknown>
    disabled?: boolean
    /** Fetch dynamic candidates for an `optionsSource` key (connection-backed). */
    getOptions?: (key: string) => Promise<{ value: string; label: string }[]>
    /** Called after any field mutation — for save-on-change consumers. */
    onChange?: () => void
  } = $props()

  // Per-field reveal toggle for secret inputs. Default masked (type=password);
  // the eye reveals the value, including a stored secret the server returns to
  // the admin-only config UI.
  let revealed = $state<Record<string, boolean>>({})

  const entries = $derived(Object.entries(schema.properties))

  // Dynamic candidates for optionsSource array fields, fetched lazily.
  let candidates = $state<Record<string, { value: string; label: string }[]>>({})
  let loadingOptions = $state<Record<string, boolean>>({})

  async function ensureOptions(key: string) {
    if (!getOptions || candidates[key] || loadingOptions[key]) return
    loadingOptions[key] = true
    try {
      candidates[key] = await getOptions(key)
    } catch {
      candidates[key] = []
    } finally {
      loadingOptions[key] = false
    }
  }

  // Ensure nested object props have a bag to write into — after render, so we
  // never mutate $state during rendering.
  $effect(() => {
    for (const [key, prop] of Object.entries(schema.properties)) {
      if (prop.type === 'object' && prop.properties) {
        const child = value[key]
        if (typeof child !== 'object' || child === null || Array.isArray(child)) {
          value[key] = {}
        }
      }
    }
  })

  // Load candidates for visible optionsSource fields — both array (multi-select)
  // and single-value string (single-select) fields.
  $effect(() => {
    if (!getOptions) return
    for (const prop of Object.values(schema.properties)) {
      if (prop.optionsSource && prop.type !== 'object' && isVisible(prop)) {
        void ensureOptions(prop.optionsSource)
      }
    }
  })

  function addFromSelect(key: string, e: Event) {
    const select = e.currentTarget as HTMLSelectElement
    const picked = select.value
    if (picked && !asArray(key).includes(picked)) value[key] = [...asArray(key), picked]
    select.value = ''
    onChange?.()
  }

  function isVisible(prop: PluginConfigProperty): boolean {
    if (!prop.visibleWhen) return true
    return value[prop.visibleWhen.field] === prop.visibleWhen.equals
  }

  function choices(prop: PluginConfigProperty): { const: string | number; title: string }[] | null {
    if (prop.oneOf) return prop.oneOf
    if (prop.enum) return prop.enum.map((v) => ({ const: v, title: String(v) }))
    return null
  }

  function asArray(key: string): string[] {
    const v = value[key]
    return Array.isArray(v) ? (v as string[]) : []
  }

  function subSchema(prop: PluginConfigProperty): PluginConfigSchema {
    return { type: 'object', required: prop.required, properties: prop.properties ?? {} }
  }

  function subValue(key: string): Record<string, unknown> {
    const v = value[key]
    return typeof v === 'object' && v !== null && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : {}
  }

  function inputType(prop: PluginConfigProperty): string {
    if (prop.format === 'password') return 'password'
    if (prop.format === 'email') return 'email'
    if (prop.format === 'uri') return 'url'
    return 'text'
  }

  function onText(key: string, e: Event) {
    value[key] = (e.currentTarget as HTMLInputElement).value
    onChange?.()
  }
  function onNumber(key: string, e: Event) {
    const raw = (e.currentTarget as HTMLInputElement).value
    value[key] = raw === '' ? undefined : Number(raw)
    onChange?.()
  }
  function onSelect(key: string, prop: PluginConfigProperty, e: Event) {
    const raw = (e.currentTarget as HTMLSelectElement).value
    value[key] = prop.type === 'number' ? Number(raw) : raw
    onChange?.()
  }
  function onCheckbox(key: string, e: Event) {
    value[key] = (e.currentTarget as HTMLInputElement).checked
    onChange?.()
  }
  function addTag(key: string, e: KeyboardEvent) {
    if (e.key !== 'Enter' && e.key !== ',') return
    e.preventDefault()
    const input = e.currentTarget as HTMLInputElement
    const tag = input.value.trim()
    if (!tag) return
    const next = asArray(key)
    if (!next.includes(tag)) value[key] = [...next, tag]
    input.value = ''
    onChange?.()
  }
  function removeTag(key: string, tag: string) {
    value[key] = asArray(key).filter((t) => t !== tag)
    onChange?.()
  }
</script>

{#each entries as [ key, prop ] (key)}
  {#if !prop.serverSupplied && isVisible(prop)}
    <div class="schema-field">
      {#if prop.type === 'boolean'}
        <label class="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value[key] === true}
            {disabled}
            onchange={(e) => onCheckbox(key, e)}
          >
          <span class="text-sm">{prop.title ?? key}</span>
        </label>
      {:else}
        <label class="label" for={`sf-${key}`}>{prop.title ?? key}</label>

        {#if choices(prop)}
          <select
            id={`sf-${key}`}
            class="input"
            {disabled}
            value={value[key] ?? prop.default ?? ''}
            onchange={(e) => onSelect(key, prop, e)}
          >
            {#each choices(prop) ?? [] as opt (opt.const)}
              <option value={opt.const}>{opt.title}</option>
            {/each}
          </select>
        {:else if prop.type === 'number'}
          <input
            id={`sf-${key}`}
            class="input"
            type="number"
            min={prop.minimum}
            max={prop.maximum}
            step={prop.step}
            placeholder={prop.placeholder}
            {disabled}
            value={(value[key] ?? prop.default ?? '') as number | string}
            oninput={(e) => onNumber(key, e)}
          >
        {:else if prop.type === 'array'}
          <div class="tag-input" class:opacity-50={disabled}>
            {#each asArray(key) as tag (tag)}
              <span class="tag">
                {tag}
                <button type="button" class="tag-x" {disabled} onclick={() => removeTag(key, tag)}>
                  ×
                </button>
              </span>
            {/each}
            <input
              id={`sf-${key}`}
              class="tag-entry"
              type="text"
              placeholder={prop.placeholder ?? 'Type and press Enter'}
              {disabled}
              onkeydown={(e) => addTag(key, e)}
            >
          </div>
          {#if prop.optionsSource && (candidates[prop.optionsSource]?.length ?? 0) > 0}
            <select class="input mt-1" {disabled} onchange={(e) => addFromSelect(key, e)}>
              <option value="">Add…</option>
              {#each (candidates[prop.optionsSource] ?? []).filter((o) => !asArray(key).includes(o.value)) as o (o.value)}
                <option value={o.value}>{o.label}</option>
              {/each}
            </select>
          {/if}
        {:else if prop.type === 'object' && prop.properties}
          <fieldset class="schema-object">
            <SchemaForm
              schema={subSchema(prop)}
              value={subValue(key)}
              {disabled}
              {getOptions}
              {onChange}
            />
          </fieldset>
        {:else if prop.optionsSource && (candidates[prop.optionsSource]?.length ?? 0) > 0}
          <!-- Single-select from dynamic candidates (e.g. a Zabbix map). When no
               candidates are available (connection not ready), this falls through
               to the free-text input below — the documented freeSolo fallback. -->
          <select
            id={`sf-${key}`}
            class="input"
            {disabled}
            value={(value[key] ?? prop.default ?? '') as string}
            onchange={(e) => onSelect(key, prop, e)}
          >
            <option value="">{prop.placeholder ?? 'Select…'}</option>
            {#each candidates[prop.optionsSource] ?? [] as o (o.value)}
              <option value={o.value}>{o.label}</option>
            {/each}
          </select>
        {:else if isSecretProp(prop)}
          <div class="relative" class:opacity-50={disabled}>
            <input
              id={`sf-${key}`}
              class="input"
              style="padding-right: 2.5rem"
              type={revealed[key] ? 'text' : 'password'}
              autocomplete="new-password"
              autocapitalize="off"
              autocorrect="off"
              spellcheck="false"
              data-1p-ignore
              data-lpignore="true"
              data-bwignore="true"
              placeholder={prop.placeholder}
              {disabled}
              value={(value[key] ?? prop.default ?? '') as string}
              oninput={(e) => onText(key, e)}
            >
            <!-- Eye sits inside the field's right edge. Stable accessible name +
                 aria-pressed conveys state; the icon swaps for sighted users. -->
            <button
              type="button"
              class="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-theme-text-muted transition-colors hover:text-theme-text disabled:opacity-60"
              aria-label="Toggle secret visibility"
              aria-pressed={revealed[key] ? 'true' : 'false'}
              title={revealed[key] ? 'Hide' : 'Show'}
              {disabled}
              onclick={() => {
                revealed[key] = !revealed[key]
              }}
            >
              {#if revealed[key]}
                <EyeSlashIcon size={16} />
              {:else}
                <EyeIcon size={16} />
              {/if}
            </button>
          </div>
        {:else}
          <input
            id={`sf-${key}`}
            class="input"
            type={inputType(prop)}
            placeholder={loadingOptions[prop.optionsSource ?? ''] ? 'Loading…' : prop.placeholder}
            {disabled}
            value={(value[key] ?? prop.default ?? '') as string}
            oninput={(e) => onText(key, e)}
          >
        {/if}
      {/if}

      {#if prop.warning}
        <p class="schema-warning">{prop.warning}</p>
      {/if}
      {#if prop.help}
        <p class="schema-help">
          {prop.help}
          {#if prop.docUrl}
            <a href={prop.docUrl} target="_blank" rel="noreferrer">docs</a>
          {/if}
        </p>
      {/if}
    </div>
  {/if}
{/each}

<style>
  .schema-field {
    margin-bottom: 0.75rem;
  }
  .schema-object {
    border: 1px solid var(--border, #e5e7eb);
    border-radius: 0.375rem;
    padding: 0.75rem;
    margin-top: 0.25rem;
  }
  .schema-warning {
    color: var(--destructive, #dc2626);
    font-size: 0.75rem;
    margin-top: 0.25rem;
  }
  .schema-help {
    color: var(--muted-foreground, #6b7280);
    font-size: 0.75rem;
    margin-top: 0.25rem;
  }
  .tag-input {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    align-items: center;
    border: 1px solid var(--border, #e5e7eb);
    border-radius: 0.375rem;
    padding: 0.25rem 0.5rem;
    min-height: 2.25rem;
  }
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: var(--muted, #f3f4f6);
    border-radius: 0.25rem;
    padding: 0.1rem 0.4rem;
    font-size: 0.8125rem;
  }
  .tag-x {
    cursor: pointer;
    border: none;
    background: none;
    line-height: 1;
  }
  .tag-entry {
    flex: 1;
    min-width: 6rem;
    border: none;
    outline: none;
    background: transparent;
    font: inherit;
  }
</style>
