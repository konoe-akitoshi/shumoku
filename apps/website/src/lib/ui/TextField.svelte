<script lang="ts">
  import { clsx } from 'clsx'
  import type { HTMLInputAttributes } from 'svelte/elements'
  import { fieldDescription } from './field'
  import './ui.css'

  interface Props extends Omit<HTMLInputAttributes, 'type'> {
    id: string
    label: string
    hint?: string
    error?: string
    type?: 'text' | 'email' | 'url' | 'tel' | 'search'
  }
  let {
    id,
    label,
    hint,
    error,
    type = 'text',
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
  <input
    {...rest}
    {id}
    {type}
    bind:value
    aria-describedby={description}
    aria-invalid={error ? true : rest['aria-invalid']}
    class={clsx('ui-input', className)}
  >
  {#if error}
    <p id={`${id}-error`} class="ui-field-error">{error}</p>
  {/if}
</div>
