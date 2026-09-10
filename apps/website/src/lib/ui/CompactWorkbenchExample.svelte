<script lang="ts">
  import CodeEditor from '../playground/CodeEditor.svelte'
  import Button from './Button.svelte'
  import FileTabs from './FileTabs.svelte'
  import Toolbar from './Toolbar.svelte'

  const initial = ['main.yaml', '日本語のネットワーク.yaml', 'long-network-configuration.yaml']
  let names = $state([...initial])
  let selected = $state(initial[0])
  const sample = Array.from(
    { length: 24 },
    (_, index) =>
      `# Line ${index + 1}: ${'Network workspace — horizontal scrollbar inspection. '.repeat(3)}`,
  ).join('\n')
  let contents = $state<Record<string, string>>({})
  function reset() {
    names = [...initial]
    selected = initial[0]
    contents = {}
  }
  function close(name: string) {
    if (names.length === 1) return
    names = names.filter((item) => item !== name)
    if (name === selected) selected = names[0] ?? ''
  }
</script>

<div class="compact-example">
  <div class="heading">
    <h3 class="ui-pane-title">Source</h3>
    <Button size="compact" variant="ghost" onclick={reset}>Reset files</Button>
  </div>
  <FileTabs
    id="compact-example"
    label="Compact file example"
    items={names.map((name) => ({ value: name, label: name, closable: names.length > 1 }))}
    value={selected}
    onselect={(name) => { selected = name }}
    onclose={close}
  >
    {#snippet children(name)}
      <CodeEditor
        {name}
        value={contents[name] ?? sample}
        onchange={(value) => { contents[name] = value }}
      />
    {/snippet}
  </FileTabs>
  <div class="heading">
    <span class="ui-pane-title">Preview</span>
    <Toolbar
      compact
      label="Compact example actions"
      actions={[
      { id: 'reset', label: 'Reset example files', text: 'Reset', onclick: reset },
    ]}
    />
  </div>
</div>

<style>
  .compact-example {
    --file-tabs-inset: var(--ui-space-2);
    display: flex;
    flex-direction: column;
    block-size: 24rem;
    min-inline-size: 0;
    background: var(--ui-workspace-chrome);
    border-radius: var(--ui-panel-radius);
    overflow: clip;
  }
  .heading {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--ui-space-1);
    padding: var(--ui-space-2);
  }
</style>
