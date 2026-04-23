<script lang="ts">
  import { CaretLeft, Code, Play } from 'phosphor-svelte'
  import { diagramState } from '$lib/context.svelte'

  let {
    isOpen = $bindable(false),
  }: {
    isOpen?: boolean
  } = $props()

  // Live JSON snapshot of the current diagram. Re-computed from state
  // every tick so drags / add / delete flow into the textarea. When
  // the user has the textarea focused we keep their in-progress edit
  // instead of clobbering it, which matters for multi-line JSON.
  const liveJson = $derived(JSON.stringify(diagramState.exportGraph(), null, 2))

  let draft = $state('')
  let dirty = $state(false)
  let error = $state('')

  // If the state changes and the user hasn't touched the draft, pull
  // the fresh JSON into the textarea. Once they start typing (`dirty`
  // flips true) the draft is theirs until they Apply or Revert.
  $effect(() => {
    if (!dirty) draft = liveJson
  })

  function onInput(value: string) {
    draft = value
    dirty = true
    error = ''
  }

  async function apply() {
    try {
      await diagramState.importDiagram(draft)
      error = ''
      dirty = false
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
  }

  function revert() {
    draft = liveJson
    dirty = false
    error = ''
  }
</script>

<div class="flex h-full items-stretch gap-1">
  {#if isOpen}
    <div
      class="w-[400px] bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl flex flex-col overflow-hidden"
    >
      <div
        class="flex items-center justify-between px-3 py-2 border-b border-neutral-200 dark:border-neutral-700 shrink-0"
      >
        <span class="text-xs font-semibold text-neutral-700 dark:text-neutral-200">
          Diagram JSON
        </span>
        <span class="text-[10px] font-mono text-neutral-400 dark:text-neutral-500">
          NetworkGraph
        </span>
      </div>

      <textarea
        class="flex-1 w-full p-3 text-[11px] font-mono leading-relaxed bg-transparent text-neutral-700 dark:text-neutral-200 resize-none outline-none placeholder:text-neutral-400 themed-scrollbar"
        spellcheck="false"
        placeholder={'{\n  "version": "1",\n  "nodes": [],\n  "links": []\n}'}
        value={draft}
        oninput={(e) => onInput((e.target as HTMLTextAreaElement).value)}
      ></textarea>

      {#if error}
        <div
          class="px-3 py-1.5 text-[11px] font-mono text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border-t border-red-200 dark:border-red-900/50 shrink-0 break-all"
        >
          {error}
        </div>
      {/if}

      <div
        class="flex items-center justify-between px-3 py-2 border-t border-neutral-200 dark:border-neutral-700 shrink-0"
      >
        <span class="text-[10px] text-neutral-400 dark:text-neutral-500">
          {dirty ? 'Unsaved edits' : 'Live'}
        </span>
        <div class="flex items-center gap-1.5">
          {#if dirty}
            <button
              type="button"
              class="px-2.5 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
              onclick={revert}
            >
              Revert
            </button>
          {/if}
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!dirty}
            onclick={apply}
          >
            <Play class="w-3 h-3" weight="fill" />
            Apply
          </button>
        </div>
      </div>
    </div>
  {/if}

  <button
    type="button"
    class="self-center flex items-center justify-center shrink-0 bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors {isOpen
      ? 'w-6 h-10'
      : 'w-10 h-10'}"
    title={isOpen ? 'Close code panel' : 'Open code panel'}
    onclick={() => {
      isOpen = !isOpen
    }}
  >
    {#if isOpen}
      <CaretLeft class="w-4 h-4" />
    {:else}
      <Code class="w-5 h-5" />
    {/if}
  </button>
</div>

<style>
  .themed-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: #d4d4d4 transparent;
  }
  :global(.dark) .themed-scrollbar {
    scrollbar-color: #525252 transparent;
  }
</style>
