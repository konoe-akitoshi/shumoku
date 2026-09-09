<script lang="ts">
  import { Plus } from '@lucide/svelte'
  import Button from '$lib/ui/Button.svelte'
  import Checkbox from '$lib/ui/Checkbox.svelte'
  import CompactWorkbenchExample from '$lib/ui/CompactWorkbenchExample.svelte'
  import type { ControlVariant } from '$lib/ui/control'
  import Disclosure from '$lib/ui/Disclosure.svelte'
  import EmptyState from '$lib/ui/EmptyState.svelte'
  import IconButton from '$lib/ui/IconButton.svelte'
  import LinkButton from '$lib/ui/LinkButton.svelte'
  import NavLink from '$lib/ui/NavLink.svelte'
  import Notice from '$lib/ui/Notice.svelte'
  import PalettePreview from '$lib/ui/PalettePreview.svelte'
  import Panel from '$lib/ui/Panel.svelte'
  import SelectField from '$lib/ui/SelectField.svelte'
  import Tabs from '$lib/ui/Tabs.svelte'
  import TextArea from '$lib/ui/TextArea.svelte'
  import TextField from '$lib/ui/TextField.svelte'
  import TextLink from '$lib/ui/TextLink.svelte'
  import Toolbar from '$lib/ui/Toolbar.svelte'

  const variants: { variant: ControlVariant; purpose: string; label: string }[] = [
    {
      variant: 'primary',
      purpose: 'The next step. One dominant action per group.',
      label: 'Render diagram',
    },
    {
      variant: 'secondary',
      purpose: 'An alternative action, identified by its surface tone.',
      label: 'Reset changes',
    },
    {
      variant: 'ghost',
      purpose: 'Supporting commands; a quiet surface on interaction.',
      label: 'Fit to view',
    },
  ]
  let count = $state(0)
  let showLabels = $state(false)
  let submitted = $state(false)
  let name = $state('')
  let description = $state('')
  let validation = $state('')
  let tab = $state('source')
  let markerTab = $state('preview')
  let zoom = $state(100)
  let exportFormat = $state('svg')
  let includeLabels = $state(true)
  function validate(event: SubmitEvent & { currentTarget: HTMLFormElement }) {
    event.preventDefault()
    validation = name.trim() ? '' : 'Enter a diagram name, for example Campus network.'
    submitted = !validation
    if (validation) event.currentTarget.querySelector<HTMLInputElement>('#diagram-name')?.focus()
  }
</script>

<svelte:head>
  <title>UI preview · Shumoku</title>
  <meta name="robots" content="noindex">
</svelte:head>

<main id="main" class="site-container preview">
  <header class="intro">
    <div>
      <p class="muted">Shumoku / Interface reference</p>
      <h1>Website UI kit</h1>
    </div>
    <p class="intro-note">
      A working reference for actions, surfaces and states. Development only.
    </p>
  </header>

  <section class="band" aria-labelledby="palette-title">
    <div class="section-label">
      <h2 id="palette-title">Shumoku palette</h2>
      <p>ロゴの緑を引き立てるニュートラル。テーマ切替でlight／darkを比較できます。</p>
    </div>
    <div class="section-content"><PalettePreview /></div>
  </section>

  <section class="band" aria-labelledby="navigation-title">
    <div class="section-label">
      <h2 id="navigation-title">Links & navigation</h2>
      <p>Move through information, not button variants.</p>
    </div>
    <div class="section-content">
      <p>
        Use <TextLink href="#form">the diagram form</TextLink> to edit a name. A link stays in the
        sentence, without a button-sized box.
      </p>
      <nav aria-label="Reference sections" class="examples">
        <NavLink href="#navigation-title" aria-current="page">Navigation</NavLink>
        <NavLink href="#workspace-title">Workspace</NavLink>
        <NavLink href="#form">Form</NavLink>
      </nav>
    </div>
  </section>

  <section class="band" aria-labelledby="selection-title">
    <div class="section-label">
      <h2 id="selection-title">文字マーカー</h2>
      <p>選択・ホバーは不透明な緑背景と白文字。文字の太さは変えない。</p>
    </div>
    <div class="section-content">
      <p>NavLinkとTabsの共通仕様。文字の左右に0.25remの余白を取り、操作領域とは分離しています。</p>
      <Tabs
        id="marker"
        label="文字マーカー"
        value={markerTab}
        onselect={(value) => { markerTab = value }}
        items={[{ value: 'source', label: 'Source' }, { value: 'preview', label: 'Preview' }, { value: 'settings', label: '表示設定' }, { value: 'history', label: '履歴', disabled: true }]}
      >
        {#snippet children(value)}
          <p>
            現在の表示：{value === 'settings' ? '表示設定' : value === 'source' ? 'Source' : 'Preview'}
          </p>
        {/snippet}
      </Tabs>
    </div>
  </section>

  <section class="band" aria-labelledby="choices-title">
    <div class="section-label">
      <h2 id="choices-title">選択入力と空状態</h2>
      <p>ネイティブ入力を使い、ラベルと説明は共通ルールで配置する。</p>
    </div>
    <div class="section-content">
      <SelectField
        id="export-format"
        label="出力形式"
        hint="この見本では設定だけを変更します。"
        bind:value={exportFormat}
        options={[{value:'svg',label:'SVG — ベクター画像'},{value:'png',label:'PNG — ラスター画像'},{value:'pdf',label:'PDF — 未対応',disabled:true}]}
      />
      <Checkbox
        id="include-labels"
        label="機器名と接続ラベルを含める"
        hint="ラベル全体をクリック、またはSpaceキーで切り替えられます。"
        bind:checked={includeLabels}
      />
      <Checkbox
        id="remote-export"
        label="外部ストレージへ保存"
        hint="接続先が設定されていないため利用できません。"
        disabled
      />
      <output aria-live="polite"
        >形式：{exportFormat.toUpperCase()}
        / ラベル：{includeLabels ? '含める' : '含めない'}</output
      >
      <EmptyState
        title="まだ出力がありません"
        description="元データを入力してから描画してください。空の状態はエラーとして扱いません。"
      />
    </div>
  </section>

  <section class="band" aria-labelledby="workspace-title">
    <div class="section-label">
      <h2 id="workspace-title">Workspace</h2>
      <p>Switch context; keep actions near their target.</p>
    </div>
    <div class="section-content">
      <CompactWorkbenchExample />
      <Tabs
        id="specimen"
        label="Diagram workspace"
        value={tab}
        onselect={(value) => { tab = value }}
        items={[{value:'source',label:'Source'},{value:'preview',label:'Preview'},{value:'history',label:'History',disabled:true}]}
      >
        {#snippet children(value)}
          {#if value === 'source'}
            <p>
              Source contains the diagram definition. Use the arrow keys to switch to Preview.
              History is unavailable in this local example.
            </p>
          {:else}
            <div class="examples">
              <output aria-live="polite">Zoom: {zoom}%</output>
              <Toolbar
                label="Preview scale"
                actions={[
                {id:'out',label:'Zoom out',text:'−',disabled:zoom <= 50,onclick:()=>{zoom -= 25}},
                {id:'in',label:'Zoom in',text:'+',disabled:zoom >= 200,onclick:()=>{zoom += 25}},
                {id:'fit',label:'Reset zoom',text:'Reset zoom',onclick:()=>{zoom=100}},
              ]}
              />
            </div>
          {/if}
        {/snippet}
      </Tabs>
      <Notice title="Local example"
        >These controls update this page only. No data is sent or saved.</Notice
      >
    </div>
  </section>

  <section class="band" aria-labelledby="actions-title">
    <div class="section-label">
      <h2 id="actions-title">Actions</h2>
      <p>Priority before decoration.</p>
    </div>
    <div class="section-content">
      {#each variants as { variant, purpose, label }}
        <div class="specimen">
          <div>
            <h3>{variant}</h3>
            <p>{purpose}</p>
          </div>
          <div class="examples">
            <Button {variant} onclick={() => count++}>{label}</Button>
            <Button {variant} disabled>Unavailable</Button>
          </div>
        </div>
      {/each}
      <output aria-live="polite">Actions: {count}</output>
      <div class="examples">
        <Button
          variant="ghost"
          aria-pressed={showLabels}
          onclick={() => { showLabels = !showLabels }}
        >
          Show labels
        </Button>
        <output aria-live="polite">Labels: {showLabels ? 'shown' : 'hidden'}</output>
      </div>
    </div>
  </section>

  <section class="band" aria-labelledby="size-title">
    <div class="section-label">
      <h2 id="size-title">Scale & labels</h2>
      <p>More space, not louder type.</p>
    </div>
    <div class="section-content">
      <div class="examples">
        <Button onclick={() => count++}>Default</Button>
        <Button size="large" onclick={() => count++}>Large action</Button>
        <IconButton label="Add item" onclick={() => count++}><Plus /></IconButton>
      </div>
      <p class="muted">Targets start at 2.75rem. Labels wrap without clipping.</p>
      <div class="examples">
        <Button onclick={() => count++}
          >長いラベルでも操作領域を維持する / Long translated label</Button
        >
        <LinkButton href="#form" variant="secondary">Go to form</LinkButton>
      </div>
    </div>
  </section>

  <section class="band" aria-labelledby="surface-title">
    <div class="section-label">
      <h2 id="surface-title">Surfaces</h2>
      <p>Enclose tools. Separate information.</p>
    </div>
    <div class="surface-examples section-content">
      <Panel>
        <h3>Grouped actions</h3>
        <p>Use an enclosed surface when controls belong together.</p>
        <div class="examples">
          <Disclosure label="Actions" align="start">
            <Button variant="ghost" onclick={() => count++}>Increment</Button>
            <LinkButton href="#form" variant="ghost">Go to form</LinkButton>
          </Disclosure>
          <Disclosure label="Unavailable" disabled><Button>Unavailable action</Button></Disclosure>
        </div>
      </Panel>
      <Panel variant="ruled">
        <h3>Related information</h3>
        <p>
          Whitespace and shared alignment are enough for supporting content. No nested card or
          decorative icon tile.
        </p>
      </Panel>
    </div>
  </section>

  <section class="band" aria-labelledby="form-title">
    <div class="section-label">
      <h2 id="form-title">Native behavior</h2>
      <p>Appearance follows semantics.</p>
    </div>
    <form id="form" class="section-content" onsubmit={validate} novalidate>
      <TextField
        id="diagram-name"
        label="Diagram name"
        bind:value={name}
        required
        hint="Required. This example validates locally and does not save."
        error={validation}
        oninput={() => { submitted = false; validation = '' }}
      />
      <TextArea
        id="diagram-description"
        label="Description (optional)"
        bind:value={description}
        hint="Add context for the reader. You can resize this field vertically."
      />
      <TextField id="diagram-owner" label="Owner" value="Read-only example" readonly />
      <TextField
        id="diagram-remote"
        label="Remote destination"
        value="Not connected"
        disabled
        hint="Connect a destination before publishing. Publishing is not available in this example."
      />
      <div class="examples">
        <Button type="submit" variant="primary">Validate diagram</Button>
        <Button onclick={() => count++}>Does not submit</Button>
      </div>
      {#if submitted}
        <Notice title="Diagram name validated" tone="success" live
          ><p>{name} is ready. This example has not saved it.</p></Notice
        >
      {/if}
    </form>
  </section>
</main>

<style>
  .preview {
    --specimen-columns: 4;
    display: grid;
    grid-template-columns: repeat(var(--specimen-columns), minmax(0, 1fr));
    column-gap: var(--ui-space-6);
    padding-block: var(--ui-space-12);
    font-size: var(--ui-type-body);
    line-height: var(--ui-leading);
  }
  .intro,
  .band {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: subgrid;
    column-gap: var(--ui-space-6);
    align-items: start;
  }
  .intro {
    padding-bottom: var(--ui-space-12);
  }
  .intro > div {
    grid-column: span 2;
  }
  .intro-note {
    grid-column: 3 / -1;
    color: var(--site-muted);
    max-inline-size: 40ch;
  }
  h1 {
    font-size: var(--ui-type-heading);
    line-height: var(--ui-space-12);
    font-weight: 600;
    letter-spacing: -0.025em;
  }
  h2,
  h3 {
    font-size: inherit;
    font-weight: 600;
  }
  h3 {
    margin-bottom: var(--ui-space-2);
  }
  .band {
    padding-block: var(--ui-space-8);
    border-top: 1px solid var(--site-line);
  }
  .band:first-of-type {
    border-top: 2px solid var(--site-fg);
  }
  .section-label p {
    margin-top: var(--ui-space-2);
    color: var(--site-muted);
    max-inline-size: 24ch;
  }
  .section-content {
    grid-column: 2 / -1;
    min-inline-size: 0;
    display: grid;
    gap: var(--ui-space-4);
  }
  .specimen {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: start;
    gap: var(--ui-space-6);
    padding-block: var(--ui-space-4);
  }
  .specimen:first-child {
    padding-top: 0;
  }
  .specimen + .specimen {
    border-top: 1px solid var(--site-line);
  }
  .specimen p,
  .muted,
  output {
    color: var(--site-muted);
  }
  .examples {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--ui-space-2);
  }
  .surface-examples {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--ui-space-6);
  }
  .surface-examples p {
    color: var(--site-muted);
    margin-bottom: var(--ui-space-4);
  }
  @supports not (grid-template-columns: subgrid) {
    .intro,
    .band {
      grid-template-columns: repeat(var(--specimen-columns), minmax(0, 1fr));
    }
  }
  @media (max-width: 56rem) {
    .specimen,
    .surface-examples {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 40rem) {
    .preview {
      --specimen-columns: 1;
      padding-block: var(--ui-space-8);
    }
    .intro > div,
    .intro-note,
    .section-content {
      grid-column: 1 / -1;
    }
    .intro,
    .band {
      row-gap: var(--ui-space-6);
    }
    .section-label p {
      max-inline-size: none;
    }
  }
</style>
