<script lang="ts">
  import type { NodePort } from '@shumoku/core'
  import { CaretDown } from 'phosphor-svelte'
  import { diagramState } from '$lib/context.svelte'

  let {
    nodeId,
    value,
    placeholder = 'Select port…',
    disabled = false,
    onchange,
  }: {
    nodeId: string
    value: string
    placeholder?: string
    disabled?: boolean
    onchange: (portId: string) => void
  } = $props()

  let open = $state(false)
  let query = $state('')
  let highlight = $state(0)
  let containerEl: HTMLDivElement | null = $state(null)
  let inputEl: HTMLInputElement | null = $state(null)

  const ports = $derived(diagramState.getNodePorts(nodeId))
  const currentPort = $derived(ports.find((p) => p.id === value))

  function portDisplay(p: NodePort): string {
    return p.label || p.cage || 'unnamed'
  }

  function portDetails(p: NodePort): string {
    return [
      p.faceplateLabel && p.faceplateLabel !== p.label ? `panel ${p.faceplateLabel}` : '',
      p.speed,
      p.cage,
      p.poe ? 'PoE' : '',
    ]
      .filter(Boolean)
      .join(' · ')
  }

  // Only existing ports — port-cage and speed are not authored here, they
  // belong on the port itself (detail panel) or on the link's medium
  // field. Free-form typing creates a label-only port via the inline
  // "+ Create" row rendered below the list.
  const filteredPorts = $derived.by(() => {
    const q = query.trim().toLowerCase()
    if (!q) return ports
    return ports.filter((p) =>
      [p.label, p.faceplateLabel, p.interfaceName, p.cage, p.speed]
        .filter(Boolean)
        // biome-ignore lint/style/noNonNullAssertion: filter(Boolean) guarantees non-null
        .some((s) => s!.toLowerCase().includes(q)),
    )
  })

  $effect(() => {
    if (highlight >= filteredPorts.length) highlight = 0
  })

  function openDropdown() {
    if (disabled) return
    open = true
    query = ''
    setTimeout(() => inputEl?.select(), 0)
  }

  function closeDropdown() {
    open = false
    query = ''
  }

  function pickPort(p: NodePort) {
    onchange(p.id)
    closeDropdown()
  }

  function commitFreeText(text: string) {
    const trimmed = text.trim()
    // Match an existing port by label first, else create a label-only port.
    const exact = trimmed ? ports.find((p) => p.label === trimmed) : undefined
    if (exact) {
      pickPort(exact)
      return
    }
    const id = diagramState.addNodePort(nodeId, { label: trimmed, source: 'custom' })
    if (id) onchange(id)
    closeDropdown()
  }

  function onKey(e: KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault()
        openDropdown()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (filteredPorts.length > 0) highlight = (highlight + 1) % filteredPorts.length
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (filteredPorts.length > 0)
        highlight = (highlight - 1 + filteredPorts.length) % filteredPorts.length
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const picked = filteredPorts[highlight]
      // Highlighted suggestion wins only if the user hasn't typed something
      // distinct — otherwise commit the typed text as a new port.
      if (picked && !query.trim()) pickPort(picked)
      else commitFreeText(query)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeDropdown()
    }
  }

  // Click-outside to dismiss.
  $effect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!containerEl?.contains(e.target as Node)) closeDropdown()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  })

  const inputClass =
    'w-full pl-2 pr-6 py-1 text-[11px] bg-transparent border border-neutral-200 dark:border-neutral-700 rounded outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 text-neutral-800 dark:text-neutral-100 font-mono disabled:opacity-50'
</script>

<div class="relative" bind:this={containerEl}>
  <input
    bind:this={inputEl}
    type="text"
    {disabled}
    value={open ? query : currentPort ? portDisplay(currentPort) : ''}
    {placeholder}
    class={inputClass}
    onfocus={openDropdown}
    oninput={(e) => {
      query = (e.target as HTMLInputElement).value
    }}
    onkeydown={onKey}
    onblur={() => {
      // Delay so item-click `mousedown` can fire first.
      setTimeout(() => {
        if (!open) return
        if (query.trim()) commitFreeText(query)
        else closeDropdown()
      }, 120)
    }}
  >
  <CaretDown
    class="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-400"
  />

  {#if open}
    {@const trimmed = query.trim()}
    {@const exactMatch = trimmed
      ? filteredPorts.some((p) => p.label === trimmed)
      : false}
    <ul
      class="absolute left-0 right-0 top-full mt-1 z-50 max-h-56 overflow-auto rounded-md border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg text-[11px]"
    >
      {#each filteredPorts as port, i (port.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <li
          class="px-2 py-1 cursor-pointer {i === highlight
            ? 'bg-blue-50 dark:bg-blue-900/30'
            : 'hover:bg-neutral-50 dark:hover:bg-neutral-700/50'}"
          onmouseenter={() => {
            highlight = i
          }}
          onmousedown={(e) => {
            e.preventDefault()
            pickPort(port)
          }}
        >
          <div class="font-mono text-slate-700 dark:text-neutral-200">{portDisplay(port)}</div>
          {#if portDetails(port)}
            <div class="text-[10px] font-mono text-neutral-400">{portDetails(port)}</div>
          {/if}
        </li>
      {/each}
      {#if !exactMatch}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <li
          class="px-2 py-1 cursor-pointer {filteredPorts.length > 0
            ? 'border-t border-slate-200 dark:border-neutral-700'
            : ''} hover:bg-neutral-50 dark:hover:bg-neutral-700/50"
          onmousedown={(e) => {
            e.preventDefault()
            commitFreeText(trimmed)
          }}
        >
          <span class="font-mono text-blue-600 dark:text-blue-400">
            {trimmed ? `+ "${trimmed}"` : '+ New port'}
          </span>
          <span class="text-[10px] text-neutral-400 ml-1">create on this node</span>
        </li>
      {/if}
    </ul>
  {/if}
</div>
