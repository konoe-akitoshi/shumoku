<script lang="ts">
  import { clsx } from 'clsx'
  import type { HTMLTextareaAttributes } from 'svelte/elements'
  import { fieldDescription } from './field'
  import './ui.css'

  interface Props extends HTMLTextareaAttributes {
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
    value = $bindable(''),
    class: className,
    'aria-describedby': describedBy,
    ...rest
  }: Props = $props()
  const description = $derived(fieldDescription(id, hint, error, describedBy))
</script>

<div class={clsx('ui-field', className)}>
  <label for={id}
    >{label}
    {#if rest.required}
      <span aria-hidden="true"> *</span>
    {/if}</label
  >
  {#if hint}
    <p id={`${id}-hint`} class="ui-field-hint">{hint}</p>
  {/if}
  <textarea
    {...rest}
    {id}
    bind:value
    aria-describedby={description}
    aria-invalid={error ? true : rest['aria-invalid']}
    class="ui-input"
  ></textarea>
  {#if error}
    <p id={`${id}-error`} class="ui-field-error">{error}</p>
  {/if}
</div>
