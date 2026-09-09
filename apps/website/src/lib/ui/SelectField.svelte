<script lang="ts">
  import { clsx } from 'clsx'
  import type { HTMLSelectAttributes } from 'svelte/elements'
  import DropdownIndicator from './DropdownIndicator.svelte'
  import { fieldDescription } from './field'
  import './ui.css'
  import './select-field.css'
  interface Props extends Omit<HTMLSelectAttributes, 'multiple' | 'value' | 'children'> {
    id: string
    label: string
    options: { value: string; label: string; disabled?: boolean }[]
    value?: string
    hint?: string
    error?: string
  }
  let {
    id,
    label,
    options,
    hint,
    error,
    value = $bindable(''),
    class: className,
    'aria-describedby': describedBy,
    ...rest
  }: Props = $props()
  const description = $derived(fieldDescription(id, hint, error, describedBy))
</script>

<div class="ui-field">
  <label for={id}
    >{label}
    {#if rest.required}
      <span aria-hidden="true"> *</span>
    {/if}</label
  >
  {#if hint}
    <p id={`${id}-hint`} class="ui-field-hint">{hint}</p>
  {/if}
  <div class="ui-select-shell">
    <select
      {...rest}
      {id}
      bind:value
      class={clsx('ui-input ui-select', className)}
      aria-describedby={description}
      aria-invalid={error ? true : rest['aria-invalid']}
    >
      {#each options as option (option.value)}
        <option value={option.value} disabled={option.disabled}>{option.label}</option>
      {/each}
    </select>
    <DropdownIndicator />
  </div>
  {#if error}
    <p id={`${id}-error`} class="ui-field-error">{error}</p>
  {/if}
</div>
