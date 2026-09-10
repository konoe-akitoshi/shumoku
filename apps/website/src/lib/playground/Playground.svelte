<script lang="ts">
  import { sampleNetwork } from '@shumoku/core'
  import Button from '$lib/ui/Button.svelte'
  import FileTabs from '$lib/ui/FileTabs.svelte'
  import Notice from '$lib/ui/Notice.svelte'
  import CodeEditor from './CodeEditor.svelte'
  import './workbench.css'
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
  let mobileView = $state('code')
  let split = $state(45)
  let panes: HTMLDivElement | undefined = $state()
  function resize(event: PointerEvent) {
    if (!panes || !(event.currentTarget instanceof HTMLElement)) return
    if (event.type === 'pointerdown') event.currentTarget.setPointerCapture(event.pointerId)
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    const bounds = panes.getBoundingClientRect()
    split = Math.min(70, Math.max(25, ((event.clientX - bounds.left) / bounds.width) * 100))
  }
  let previous = $state<EditorFile[] | null>(null)
  const status = $derived(
    rendering ? 'Rendering…' : error ? 'Error' : result ? 'Ready' : 'Not rendered',
  )
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
    previous = files.map((file) => ({ ...file }))
    const index = files.findIndex((file) => file.name === name)
    invalidate()
    files = files.filter((file) => file.name !== name)
    if (activeFile === name) activeFile = files[Math.min(index, files.length - 1)]?.name ?? ''
  }
  function reset() {
    previous = files.map((file) => ({ ...file }))
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
      if (current === revision) {
        result = next
        mobileView = 'preview'
      }
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

<main id="main" class="workbench">
  <header class="workbench-title">
    <h1>Playground <span> / Network workspace</span></h1>
    <div class="workbench-actions">
      <Button type="button" size="compact" onclick={reset} variant="ghost">Reset sample</Button>
      {#if previous}
        <Button
          size="compact"
          variant="ghost"
          onclick={() => {
          if (!previous) return
          invalidate()
          files = previous
          previous = null
          activeFile = files[0]?.name ?? 'main.yaml'
        }}
          >Undo</Button
        >
      {/if}
      <Button
        size="compact"
        type="button"
        onclick={render}
        disabled={rendering}
        aria-busy={rendering}
        variant="primary"
      >
        {rendering ? 'Rendering...' : 'Render'}
      </Button>
    </div>
  </header>
  {#if error}
    <Notice title="Diagram could not be generated" tone="danger" live>
      <p>{error}</p>
      <p>Check the YAML input, then choose Render to retry.</p>
    </Notice>
  {/if}
  {#snippet viewSwitch()}
    <nav class="workbench-mobile" aria-label="Workspace view">
      <Button
        size="compact"
        variant="ghost"
        aria-pressed={mobileView === 'code'}
        onclick={() => { mobileView = 'code' }}
        >Code</Button
      >
      <Button
        size="compact"
        variant="ghost"
        aria-pressed={mobileView === 'preview'}
        onclick={() => { mobileView = 'preview' }}
        >Preview</Button
      >
    </nav>
  {/snippet}
  <div class="workbench-panes" bind:this={panes} style={`--editor-width: ${split}%`}>
    <section
      class="workbench-pane editor-pane"
      class:mobile-hidden={mobileView !== 'code'}
      aria-label="YAML Editor"
    >
      <div class="workbench-pane-heading">
        <h2 class="ui-pane-title">Source</h2>
        {@render viewSwitch()}
        <div class="workbench-actions">
          <Button size="compact" onclick={add} variant="ghost">+ Add file</Button>
        </div>
      </div>
      <FileTabs
        id="editor-files"
        label="YAML files"
        items={files.map(file => ({ value: file.name, label: file.name, closable: files.length > 1 }))}
        value={activeFile}
        onselect={(name) => { activeFile = name }}
        onclose={remove}
        closeLabel={(name) => `Delete ${name}`}
      >
        {#snippet children(name)}
          <CodeEditor {name} value={content} onchange={update} />
        {/snippet}
      </FileTabs>
    </section>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (Focusable window splitter implements the ARIA separator keyboard pattern.) -->
    <div
      class="workbench-sash"
      role="separator"
      tabindex="0"
      aria-label="Editor pane width"
      aria-orientation="vertical"
      aria-valuemin="25"
      aria-valuemax="70"
      aria-valuenow={Math.round(split)}
      onpointerdown={resize}
      onpointermove={resize}
      onkeydown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        split = event.key === 'Home' ? 25 : event.key === 'End' ? 70 : Math.min(70, Math.max(25, split + (event.key === 'ArrowLeft' ? -5 : 5)))
      }}
    ></div>
    <section
      class="workbench-pane output-pane"
      class:mobile-hidden={mobileView !== 'preview'}
      aria-label="Diagram output"
    >
      <div class="workbench-pane-heading">
        <h2 class="ui-pane-title">Preview</h2>
        {@render viewSwitch()}
        <div class="workbench-actions">
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
      <Preview {result} />
    </section>
  </div>
  <footer class="workbench-status">
    <span role="status">{status}{exporting ? ' · Exporting…' : ''}</span>
    <span>{activeFile} · {content.split('\n').length} lines · YAML</span>
  </footer>
</main>
