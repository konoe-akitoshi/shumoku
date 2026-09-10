<script lang="ts">
  import { clsx } from 'clsx'
  import type { HTMLInputAttributes } from 'svelte/elements'
  import { fieldDescription } from './field'
  import './ui.css'
  import './checkbox.css'

  interface Props extends Omit<HTMLInputAttributes, 'type' | 'children'> {
    id: string
    label: string
    hint?: string
    error?: string
  }
  let {
    id,
    label,
    hint,
    error,
    checked = $bindable(false),
    class: className,
    'aria-describedby': describedBy,
    ...rest
  }: Props = $props()
  const description = $derived(fieldDescription(id, hint, error, describedBy))
</script>

<div class="ui-field">
  <label class="ui-checkbox" for={id}>
    <input
      {...rest}
      {id}
      type="checkbox"
      bind:checked
      class={clsx(className)}
      aria-describedby={description}
      aria-invalid={error ? true : rest['aria-invalid']}
    >
    <span
      >{label}
      {#if rest.required}
        <span aria-hidden="true"> *</span>
      {/if}</span
    >
  </label>
  {#if hint}
    <p id={`${id}-hint`} class="ui-field-hint">{hint}</p>
  {/if}
  {#if error}
    <p id={`${id}-error`} class="ui-field-error">{error}</p>
  {/if}
</div>
