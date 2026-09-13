<script lang="ts">
  import Button from './Button.svelte'
  import Notice from './Notice.svelte'
  import {
    contrast,
    foundationPalettes,
    type PaletteRole,
    paletteColor,
    paletteDesign,
    themeColors,
  } from './palette-model'
  import { filterMatrix, type Vision, visionMatrices } from './palette-vision'
  import TextField from './TextField.svelte'

  let vision = $state<Vision | 'normal'>('normal')
  const themes = ['light', 'dark'] as const
  const simulations = Object.keys(visionMatrices) as Vision[]
  const roles: [string, PaletteRole][] = [
    ['Canvas', 'site-bg'],
    ['Surface', 'ui-surface'],
    ['Field', 'ui-field-surface'],
    ['Workspace shell', 'ui-workspace-shell'],
    ['Control boundary', 'site-control-line'],
    ['Hover', 'ui-control-hover'],
    ['Pressed', 'ui-control-active'],
    ['Primary', 'ui-primary'],
    ['Text', 'site-fg'],
    ['Secondary text', 'site-muted'],
    ['Focus', 'ui-focus'],
    ['Error', 'ui-danger'],
  ]
</script>

<p>
  緑を主役に、温かいオフホワイトと石色のグレーを組み合わせた案です。ブランドの緑11色・暖色ニュートラル13色・黄緑6色。黄緑はブランド表現用で、警告色とは分けます。
</p>
<div class="foundations">
  {#each Object.entries(foundationPalettes) as [family, stops]}
    <section aria-label={family}>
      <h3>{family === 'Brand neutral' ? 'Warm neutral / Stone' : family}</h3>
      <ul class="palette">
        {#each Object.entries(stops) as [step, design]}
          {@const color = paletteColor(design).hex}
          <li>
            <span class="swatch" style:background={color} aria-hidden="true"></span
            ><span>{step}{step === '500' && family !== 'Brand neutral' ? ' · Logo' : ''}</span
            ><small>{color}</small>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</div>
<p>
  以下は基礎色を用途に割り当てたテーマです。60–30–10は主従の目安であり、面積比の実測値ではありません。
</p>
<label class="vision-control" for="palette-vision"
  >色覚シミュレーション（下の見本のみ）
  <select id="palette-vision" class="ui-input" bind:value={vision}>
    <option value="normal">通常表示</option>
    <option value="protan">P型・Protan</option>
    <option value="deutan">D型・Deutan</option>
    <option value="tritan">T型・Tritan</option>
    <option value="grayscale">グレースケール</option>
  </select>
</label>
<p class="caveat">
  Machado et al. (2009)、severity
  1.0の近似。個人の見え方の再現や適合保証ではありません。表示するHEX・比率は変換前の値です。
</p>
<svg width="0" height="0" aria-hidden="true" class="filters">
  <defs>
    {#each simulations as mode}
      <filter id={`palette-${mode}`} color-interpolation-filters="linearRGB">
        <feColorMatrix type="matrix" values={filterMatrix(mode)} />
      </filter>
    {/each}
  </defs>
</svg>
<div class="themes">
  {#each themes as theme}
    {@const colors = themeColors(theme)}
    <section
      class="proof"
      aria-label={`${theme} palette`}
      style={`${Object.entries(colors).map(([key, value]) => `--${key}:${value}`).join(';')};color-scheme:${theme}`}
      style:filter={vision === 'normal' ? 'none' : `url(#palette-${vision})`}
    >
      <h3>{theme === 'light' ? 'Light' : 'Dark'} / OKLCH</h3>
      <p class="secondary">
        本文 {contrast(colors['site-fg'], colors['site-bg']).toFixed(2)}:1 · 補助文字
        {contrast(colors['site-muted'], colors['ui-surface']).toFixed(2)}:1
      </p>
      <div class="sample">
        <TextField
          id={`palette-field-${theme}`}
          label="ネットワーク名"
          placeholder="例: 本社ネットワーク"
          hint="補助文字も明度差を確保"
        />
        <div class="actions">
          <Button variant="primary">図を生成</Button><Button>設定を確認</Button>
        </div>
        <Notice title="検証成功" tone="success">アイコンと文言で結果を識別</Notice>
        <Notice title="入力エラー" tone="danger">接続先の名前を確認してください</Notice>
      </div>
      <ul class="palette">
        {#each roles as [label, token]}
          {@const design = paletteDesign[theme][token]}
          <li>
            <span class="swatch" style:background={colors[token]} aria-hidden="true"></span
            ><span>{label}</span><small>{colors[token]}</small
            ><small
              >L {design[0].toFixed(3)} / C {design[1].toFixed(3)} / h
              {design[2].toFixed(1)}°</small
            >
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</div>

<style>
  .foundations {
    display: grid;
    gap: var(--ui-space-8);
    margin-block: var(--ui-space-4);
  }
  .foundations h3 {
    margin-block-end: var(--ui-space-4);
  }
  .vision-control {
    display: grid;
    gap: var(--ui-space-2);
    max-inline-size: 28rem;
  }
  .caveat,
  .secondary {
    color: var(--site-muted);
  }
  .filters {
    position: absolute;
    pointer-events: none;
  }
  .themes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 25rem), 1fr));
    gap: var(--ui-space-4);
  }
  .proof {
    min-inline-size: 0;
    padding: var(--ui-space-4);
    color: var(--site-fg);
    background: var(--site-bg);
    border: 1px solid var(--site-line);
    border-radius: var(--ui-radius);
  }
  .proof h3 {
    margin: 0;
  }
  .sample {
    display: grid;
    gap: var(--ui-space-4);
    background: var(--ui-surface);
    padding: var(--ui-space-4);
    margin-block: var(--ui-space-4);
    border-radius: var(--ui-radius);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ui-space-2);
  }
  .palette {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
    gap: var(--ui-space-4);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: grid;
    gap: var(--ui-space-1);
    min-inline-size: 0;
  }
  .swatch {
    display: block;
    block-size: var(--ui-space-12);
    border-radius: var(--ui-radius);
  }
  small {
    color: var(--site-muted);
    overflow-wrap: anywhere;
  }
</style>
