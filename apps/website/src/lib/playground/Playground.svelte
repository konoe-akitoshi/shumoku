<script lang="ts">
  import { sampleNetwork } from '@shumoku/core'
  import { exportDiagram, type Format } from './export'
  import FormatMenu from './FormatMenu.svelte'
  import Preview from './Preview.svelte'
  import { type EditorFile, type RenderResult, renderFiles } from './render'

  let files = $state<EditorFile[]>(sampleNetwork.map((file) => ({ ...file })))
  let activeFile = $state('main.yaml')
  let result = $state.raw<RenderResult | null>(null)
  let error = $state<string | null>(null)
  let rendering = $state(false)
  let exporting = $state(false)
  let revision = 0
  const content = $derived(files.find((file) => file.name === activeFile)?.content ?? '')

  function invalidate() {
    revision++
    result = null
    error = null
    rendering = false
  }
  function update(content: string) {
    invalidate()
    files = files.map((file) => (file.name === activeFile ? { ...file, content } : file))
  }
  function add() {
    let name = 'new-file.yaml'
    let suffix = 1
    while (files.some((file) => file.name === name)) name = `new-file-${suffix++}.yaml`
    invalidate()
    files = [
      ...files,
      { name, content: `name: "${name.replace('.yaml', '')}"\n\nnodes: []\nlinks: []` },
    ]
    activeFile = name
  }
  function remove(name: string) {
    if (files.length <= 1) return
    invalidate()
    files = files.filter((file) => file.name !== name)
    if (activeFile === name) activeFile = files[0]?.name ?? 'main.yaml'
  }
  function reset() {
    invalidate()
    files = sampleNetwork.map((file) => ({ ...file }))
    activeFile = 'main.yaml'
  }
  async function render() {
    const current = ++revision
    rendering = true
    result = null
    error = null
    try {
      const next = await renderFiles(files.map((file) => ({ ...file })))
      if (current === revision) result = next
    } catch (cause) {
      if (current === revision) error = cause instanceof Error ? cause.message : String(cause)
    } finally {
      if (current === revision) rendering = false
    }
  }
  async function output(format: Format, action: 'open' | 'download') {
    if (!result || exporting) return
    exporting = true
    error = null
    try {
      await exportDiagram(result, format, action)
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause)
    } finally {
      exporting = false
    }
  }
</script>

<main class="flex min-h-[calc(100dvh-56px)] flex-col md:h-[calc(100dvh-56px)]">
  <div
    class="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-white px-6 py-4 dark:border-neutral-700 dark:bg-neutral-900"
  >
    <h1 class="text-xl font-semibold">Playground</h1>
    <div class="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onclick={reset}
        class="rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800"
      >
        Reset
      </button>
      <button
        type="button"
        onclick={render}
        disabled={rendering}
        class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {rendering ? 'Rendering...' : 'Render'}
      </button>
      <FormatMenu
        label="Open"
        disabled={!result || exporting}
        onselect={(format) => { void output(format, 'open') }}
      />
      <FormatMenu
        label="Download"
        disabled={!result || exporting}
        onselect={(format) => { void output(format, 'download') }}
      />
    </div>
  </div>
  {#if error}
    <p
      role="alert"
      class="border-b border-red-300 bg-red-100 px-6 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400"
    >
      {error}
    </p>
  {/if}
  <div class="flex min-h-0 flex-1 flex-col md:flex-row">
    <section
      class="flex min-h-80 min-w-0 flex-1 flex-col border-r border-neutral-200 dark:border-neutral-700"
      aria-label="YAML Editor"
    >
      <div
        class="flex items-center gap-1 overflow-x-auto border-b border-neutral-200 bg-neutral-50 px-2 dark:border-neutral-700 dark:bg-neutral-800"
      >
        {#each files as file (file.name)}
          <div
            class="group flex shrink-0 items-center border-b-2"
            class:border-blue-500={activeFile === file.name}
            class:border-transparent={activeFile !== file.name}
          >
            <button
              type="button"
              aria-pressed={activeFile === file.name}
              onclick={() => { activeFile = file.name }}
              class="px-3 py-2 font-mono text-sm"
              class:text-blue-600={activeFile === file.name}
            >
              {file.name}
            </button>
            {#if files.length > 1}
              <button
                type="button"
                class="px-1 text-neutral-500"
                aria-label={`Delete ${file.name}`}
                onclick={() => remove(file.name)}
              >
                ×
              </button>
            {/if}
          </div>
        {/each}
        <button type="button" onclick={add} class="shrink-0 px-3 py-2 text-sm text-neutral-500">
          + Add
        </button>
      </div>
      <textarea
        aria-label={activeFile}
        value={content}
        oninput={(event) => update(event.currentTarget.value)}
        class="min-h-64 flex-1 resize-none bg-white p-4 font-mono text-sm focus:outline-none dark:bg-neutral-900"
        spellcheck={false}
      ></textarea>
    </section>
    <Preview {result} />
  </div>
</main>
