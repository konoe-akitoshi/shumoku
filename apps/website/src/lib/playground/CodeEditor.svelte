<script lang="ts">
  import '../ui/scrollbar.css'
  import { gutterWheel } from './gutter-wheel'

  let {
    name,
    value,
    onchange,
  }: { name: string; value: string; onchange: (value: string) => void } = $props()
  let scrollTop = $state(0)
  let editor: HTMLTextAreaElement | undefined = $state()
  const forwardWheel = gutterWheel(() => editor)
  let viewportHeight = $state<number>()
  const lines = $derived(value.split('\n').length)
  const gutterDigits = $derived(Math.max(2, String(lines).length))
</script>

<div class="source-editor ui-scrollbar-surface" style:--gutter-digits={gutterDigits}>
  <div
    class="source-gutter"
    aria-hidden="true"
    {@attach forwardWheel}
    style:block-size={viewportHeight === undefined ? undefined : `${viewportHeight}px`}
  >
    <div style={`transform: translateY(-${scrollTop}px)`}>
      {#each Array.from({ length: lines }, (_, index) => index + 1) as line (line)}
        <div>{line}</div>
      {/each}
    </div>
  </div>
  <textarea
    class="ui-scrollbar ui-scrollbar--quiet"
    bind:this={editor}
    bind:clientHeight={viewportHeight}
    aria-label={`${name} source`}
    {value}
    spellcheck="false"
    autocapitalize="off"
    autocomplete="off"
    wrap="off"
    oninput={(event) => onchange(event.currentTarget.value)}
    onscroll={(event) => { scrollTop = event.currentTarget.scrollTop }}
  ></textarea>
</div>

<style>
  .source-editor {
    display: flex;
    min-inline-size: 0;
    inline-size: 100%;
    min-block-size: 0;
    padding-block: var(--ui-space-1);
    font:
      0.875rem / var(--ui-leading) ui-monospace,
      monospace;
  }
  .source-gutter {
    box-sizing: border-box;
    flex: 0 0 auto;
    inline-size: calc(var(--gutter-digits) * 1ch + 2 * var(--ui-space-4));
    overflow: clip;
    text-align: right;
    padding-inline: var(--ui-space-4);
    color: var(--site-muted);
    user-select: none;
    font-variant-numeric: tabular-nums;
  }
  textarea {
    flex: 1;
    min-inline-size: 0;
    min-block-size: 0;
    resize: none;
    padding: 0;
    padding-inline-end: var(--ui-space-4);
    border: 0;
    border-radius: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    tab-size: 2;
  }
  textarea:focus-visible {
    outline: 2px solid var(--site-accent);
    outline-offset: -2px;
  }
  @media (max-width: 767px) {
    .source-editor {
      font-size: 1rem;
    }
  }
</style>
