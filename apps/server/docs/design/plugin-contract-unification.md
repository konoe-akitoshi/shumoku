# Plugin contract unification — one self-describing contract for every plugin

> ステータス: 設計（提案, 2026-06-03）。実装未着手。
> #270（web の per-plugin ハードコード設定フォーム）を**内包する、より広い設計修正**。
> 既存の `plugin-types.ts` の contract を**拡張・強制**する（破壊的でない移行を含む — §6）。

## 0. なぜこのドキュメントが要るか

プラグイン設計を見直した結果、根本的なねじれが見つかった：

> **自己記述コントラクト（manifest + configSchema + capabilities）は既に存在するが、
> それを完全に守っているのは「外部プラグインだけ」。バンドルされた5プラグインは
> 特権ショートカット（`register(type, name, caps, factory)` の4引数・config 不透明・
> configSchema 無し）を通る。** その結果、ホスト（web / server）が**プラグイン固有の
> 知識をハードコード**せざるを得ない。

`#270`（datasources モーダルの `if (type === 'zabbix' | 'netbox' | …)` 梯子）は、この
ねじれの**一症状**にすぎない。同じ根から、Sources ページの per-source options
（NetBox の site/tag フィルタ）や capability の未検証も生まれている。

**合意したモデル：プラグインは一種類。バンドルも外部も、同じ自己記述コントラクトで
自分を説明する。ホストは `type` 文字列で分岐せず、descriptor + capabilities + schema
だけで全プラグインを一様に扱う。** core が表示契約を定義し、プラグインが従う（#266）
原則を、バンドルにも適用しきる。

## 0.5 この設計の目的と完成チェックリスト

> 実装は priority-merge と同様、合意後に**段階的に一気に**やる（§5 phasing）。発散を
> 防ぐため、目的と「全部緑なら完成」の受け入れ条件をここに固定する。

### 目的
1. **バンドル/外部の二重定義を解消** — 全プラグインが同じ descriptor で自己記述する。
2. **ホストから per-plugin の `type === '…'` 知識を全廃** — #270（datasources）＋ Sources
   の options ＋ あらゆる分岐。新プラグイン追加でホストを触らない。
3. **config を「飾りの schema」から「検証される契約」へ** — 描画・検証の単一の真実。

### 完成チェックリスト（受け入れ条件＝テスト）
- [ ] **C1 descriptor 統一**: `register` が descriptor（type/displayName/capabilities/
      configSchema/optionsSchema）を受け、`getAllPlugins` は**バンドルでも configSchema を運ぶ**。
      (loader/registry unit test)
- [ ] **C2 config 検証**: サーバが data source 作成/更新時に config を configSchema で
      検証し、不正は 400。plugin は検証済み config を受ける。(api test)
- [ ] **C3 schema 強化**: `PluginConfigProperty` が boolean(checkbox)/enum+ラベル/
      array(候補ソース)/条件表示/警告/help を表現でき、**バンドル5種のフォームが全て
      schema だけで描ける**（手書きフォーム不要）。(schema 型 test + 目視等価確認)
- [ ] **C4 datasources 汎用描画一本化**: `datasources/+page.svelte` と `[id]/+page.svelte`
      の `type === '…'` 分岐がゼロ。(grep + web build)  ← #270 解消
- [ ] **C5 optionsSchema**: per-topology-source の options も schema 駆動。Sources ページの
      `type === 'netbox'` 等がゼロ。(grep + web build)
- [ ] **C6 capability 検証**: 申告した capability に対応するメソッドの存在を registry が
      検証（誤申告は登録/初回 instantiate で検出）。(registry unit test)
- [ ] **C7 `type === '…'` host ブランチゼロ**: プラグイン自身の dir 以外に plugin-type
      リテラル分岐が無い。grep ガードを CI/テストに追加。(guard test)
- [ ] **回帰**: バンドル5種＋外部サンプルが**同じ経路**で接続/設定/能力ディスパッチでき、
      typecheck / lint / 既存 test 全て緑。

### スコープ外（この設計でやらない）
- プラグイン間通信・sandbox・permission モデル。
- 既存 `config_json` のマイグレーション（per-plugin の shape は不変。no-backcompat 可）。
- metrics mapping UI の再設計（別ドメイン。`DiscoveredMetric` passthrough は現状維持）。
- 外部プラグインの **manifest 形式自体**の変更（`PluginConfigProperty` 拡張は後方互換で行う）。

## 1. 現状（証拠つき）

- **能力モデル**: `DataSourcePlugin`（type/displayName/capabilities/`initialize(config: unknown)`/
  testConnection）＋ capability mixin（`TopologyCapable` / `HostsCapable` / `MetricsCapable` /
  `AlertsCapable` / `AutoscanCapable`）。ディスパッチは `hasXCapability(plugin)`。
- **登録経路が2つ**:
  - 外部: `plugin.json` manifest（id/name/version/capabilities/**configSchema**）→
    `loader.ts` が読み、`registry.register(...)` を呼ぶ index.js を import。
  - バンドル: `registry.register(type, name, caps, factory)` の**4引数・schema 無し**
    （例 `libs/plugins/netbox/src/index.ts:80`
    `register('netbox','NetBox',['topology','hosts'], cfg => { plugin.initialize(cfg) })`）。
- **非対称の決定的証拠**: `loader.ts` の `getAllPlugins()` は、外部には
  `configSchema: manifest.configSchema` を載せる（`:248`）が、**バンドルには載せない**
  （`:768-779`、`version:'bundled'` で schema フィールド無し）。
- **web は汎用 configSchema レンダラを持つ**が、バンドルを**明示的に除外**
  （`datasources/+page.svelte:770` `… && !['zabbix','netbox','prometheus','grafana','aruba-instant-on'].includes(type)`）。
  バンドルは `type === '…'` のハードコード梯子（form-state 宣言・テンプレート `{#if}`・
  `getConfigFromForm()`・`handleCreate()` 検証・編集側 `[id]/+page.svelte`）に流れる。

## 2. 根本問題（症状の連鎖）

| # | 問題 | 証拠 |
|---|---|---|
| P1 | **「プラグインである」定義がバンドル/外部で二重**。自己記述 manifest をバンドルが使わない | `register` 4引数 `plugin-types.ts` `PluginRegistryInterface`、bundled に schema 無し `loader.ts:768` |
| P2 | **config が `unknown`、schema は UI ヒント止まり**。検証が web(手書き)＋plugin(その場)で二重、単一の真実が無い | `initialize(config: unknown)`、`PluginManifest.configSchema` は描画専用 |
| P3 | **capability が未検証の口約束**。`capabilities.includes('topology')` で `& TopologyCapable` に**キャスト**するだけ（メソッド存在を見ない） | type guards（`hasNativeApi` だけ `typeof` 検証） |
| P4 | **configSchema が貧弱**でフォームを表現しきれない（boolean/enum ラベル/array 複数選択/条件表示/警告/help が無い） | `PluginConfigProperty` |
| P5 | **per-plugin の設定面が2系統**ともハードコード: ① data source 接続設定(#270) ② topology-source options(Sources の NetBox site/tag) | sources `+page.svelte` の `type==='netbox'` |
| P6 | **ホストが `type` 文字列で分岐**（CLAUDE.md「plugin.type=== を外で書くな」に反する）。P1 のため守れない | datasources 梯子 20+ 箇所、`:571` の条件 |

**良い所（保つ）**: capability mixin パターンは妥当。**外部の manifest+configSchema 経路こそ
正しいモデル**。core の表示契約型（`Alert` / `AlertSeverity`(中立 CVSS) / `MetricsData` /
`DiscoveredMetric` passthrough）は良設計。→ 「作り直す」のではなく**バンドルを外部と同じ
良いモデルに寄せ＋契約を強くする**。

## 3. 目標設計

### 3.1 PluginDescriptor に統一
プラグインは（バンドルも外部も）一つの descriptor で自己記述する：

```
interface PluginDescriptor {
  type: string
  displayName: string
  capabilities: readonly DataSourceCapability[]
  configSchema?: PluginConfigSchema      // 接続設定（datasources）
  optionsSchema?: PluginConfigSchema     // per-topology-source options（Sources）
}
```

- registry に descriptor ベースの登録を追加：`register(descriptor, factory)`。
- **後方互換**: 既存の `register(type, name, caps, factory)`（4引数）は薄いアダプタとして
  残す（外部プラグインを壊さない）。バンドル5種は descriptor 版へ移行し configSchema を持つ。
- `getAllPlugins()` / registry は**常に** descriptor（含 configSchema/optionsSchema）を運ぶ。
  → web は bundled/external を区別せず schema で描画。

### 3.2 configSchema = 検証される契約
- サーバの data source 作成/更新 API が、受け取った config を descriptor.configSchema で
  **検証**（必須/型/enum/format）。不正は 400。単一の validator（core or api 共有）。
- plugin の `initialize` は検証済み config を受け取れる（defensive parse は残してよいが
  二重の form 側検証は撤去）。
- web は同じ schema からフォームを描画＋クライアント検証 → **描画・検証・実行が一つの schema
  に由来**。

### 3.3 PluginConfigProperty 強化（P4 解消）
現フォームを schema だけで描けるよう、最小拡張（後方互換・任意フィールド）：
- `boolean` → チェックボックス描画（型は既にあるが renderer/挙動を定義）。
- `enum` に表示ラベル（`enumLabels?: string[]` or `oneOf: {const,title}[]`）。
- `array`（string[]）に item 型と**候補ソース**（`optionsSource?: 'netbox.sites' 等`）→
  NetBox の site/tag 複数選択を汎用化。
- **条件表示**（`visibleWhen?: { field, equals }`）→ Grafana の webhook 切替など。
- **per-field 警告 / help**（`warning?`, `help?`, `docUrl?`）→ Aruba の「MFA off」等。
- `secret`/mask は既存 `format:'password'` を踏襲。

### 3.4 optionsSchema（per-topology-source）（P5 解消）
- topology に source を attach する際の per-plugin options（NetBox: groupBy/site/tag/role…）も
  descriptor.optionsSchema として宣言 → Sources ページが汎用描画。
- これで「接続 config」と「per-attach options」が**同じ schema 機構**に乗り、`type===` が消える。

### 3.5 capability の検証（P3 解消）
- registry が factory で instantiate した実体に対し、申告 capability ごとの必須メソッド
  （topology→`fetchTopology`、hosts→`getHosts`、metrics→`pollMetrics`、alerts→`getAlerts`、
  autoscan→`scan`）の存在を assert。欠落は登録時 or 初回 instantiate でエラー（dev で throw、
  本番でログ＋当該 capability 無効化）。`hasXCapability` のキャストが嘘でなくなる。

### 3.6 ホストから `type` 分岐を撤去（P6 解消）
- 1–5 が揃えば、web/datasources・web/sources の `type === '…'` 梯子を全削除。
- 再発防止に grep ガード（`plugin.type === '<bundled>'` をプラグイン dir 外で検出したら
  テスト失敗）を追加。CLAUDE.md の不変条件を機械で強制。

## 3.7 確定したい決定（実装前に詰める）
- **決定A**: バンドルの自己記述は「descriptor を register に渡す」方式（推奨）か、
  「バンドルも plugin.json 相当を持ち loader 経由」か。→ **推奨: descriptor を register**
  （バンドルは esbuild で server に同梱され、ディスクからの動的 load は不要）。
- **決定B**: `PluginConfigProperty` 拡張の最終セット（§3.3 の項目で過不足ないか）。array の
  候補ソース（NetBox site/tag）をどう汎用化するか（capability `hosts` のような「options 候補」
  取得経路を足すか、plugin に `getConfigOptions(field)` を持たせるか）。
- **決定C**: config 検証を core の純粋関数（schema+config→errors）に置き、api/web 双方が使う。
- **決定D**: capability 検証のタイミング（登録時に dummy instantiate は副作用懸念 → 初回
  instantiate 時に検証＋キャッシュ、が無難か）。

## 4. 段階実装（phasing）
1. **Phase 1**: `PluginDescriptor` + descriptor 版 register（4引数アダプタ併存）。
   `getAllPlugins`/registry が configSchema/optionsSchema を運ぶ。（C1, C6 の土台）
2. **Phase 2**: `PluginConfigProperty` 強化 + core の config 検証関数。（C3, C2 の土台）
3. **Phase 3**: バンドル5種に configSchema（+ NetBox 等に optionsSchema）を執筆。
4. **Phase 4**: datasources の汎用描画一本化＋`type===` 撤去（**#270 解消**）。サーバ config 検証配線。（C2, C4）
5. **Phase 5**: Sources options 汎用化（C5）＋ capability 検証配線（C6）＋ grep ガード（C7）。
6. 回帰: 全プラグイン同一経路で動作確認、typecheck/lint/test 緑。

各 Phase をコミット単位にし、priority-merge 同様こまめに。

## 5. #270 との関係
`#270` は本設計の **Phase 1+3+4 の datasources 部分**に相当する部分集合。本 doc が上位の
設計として #270 を内包し、Sources options（P5）/ capability 検証（P3）/ type 分岐ガード（P6）
まで一掃する。実装着手時、#270 にこの doc へのリンクを貼り「広い設計の一部として解消」と注記。

## 6. 後方互換と既存ドキュメント
- `register(type, name, caps, factory)`（4引数）は**残す**（外部プラグイン互換）。descriptor 版を
  足し、バンドルは移行。
- `config_json` の保存形は不変。schema は描画＋検証に使うだけで、保存 shape は変えない。
- CLAUDE.md の「plugins conform to a generic contract / no `plugin.type ===` outside the
  plugin dir」は、本設計で**機械的に強制**される（C7 ガード）。#270 の参照先を本 doc にする。
