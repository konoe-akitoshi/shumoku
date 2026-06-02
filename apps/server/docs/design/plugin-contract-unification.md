# Plugin contract unification & flexible extension model

> ステータス: 設計（合意済み方向, 2026-06-03）。実装未着手。
> `#270`（web の per-plugin ハードコード設定フォーム）を**内包する、より広い設計修正**。
> 既存 `plugin-types.ts` / `docs/plugin-authoring.md` の contract を**一般化・強制・拡張**する
> （後方互換な移行を含む — §6）。

## 0. なぜこのドキュメントが要るか

プラグイン設計を見直した結果、3つの構造的ねじれが見つかった：

1. **自己記述コントラクトを「外部だけ」が守っている。** manifest + configSchema +
   capabilities という自己記述の仕組みは存在するが、完全に使うのは**外部プラグインだけ**。
   バンドル5種は特権ショートカット（`register(type, name, caps, factory)` 4引数・config 不透明・
   configSchema 無し）を通り、ホスト（web/server）が**プラグイン固有知識をハードコード**する。
   `#270` はその一症状（datasources モーダルの `type === '…'` 梯子）。
2. **「プラグイン＝データソース」と決め打ち。** すべて `DataSourcePlugin`。renderer / export /
   layout / catalog provider のような**別種の拡張点**を足す余地が型に無い。
3. **capability 語彙が閉じている。** `DataSourceCapability` は閉じた union で web 型にも漏れ、
   新しい能力種別を足すたびに core+web を触る。プラグインの**前方互換・柔軟性**を阻害。

合意したモデル：**プラグインは「拡張点(extension point)を埋める自己記述ユニット」。データソースは
その1拡張点にすぎない。外部プラグインの契約を正典とし、ホストは `type` で分岐せず、宣言
(schema/capabilities)だけで全プラグインを一様・汎用に扱う。プラグインは宣言的に最大限柔軟で、
新しいプラグインの追加はホストを1行も変えない。**

## 0.1 合意した設計の柱（この設計を貫く前提）

1. **拡張点モデルに一般化**（Q1）。`data-source` は拡張点の1種。renderer / export / layout /
   catalog 等を**同じ枠組み**で将来足せる。プラグインは拡張点の**任意の部分集合**を埋める
   （多役割 OK）。今回実装するのは data-source 拡張点のみ。**だが型・registry は一般化する。**
2. **external-first を正典**。外部プラグインの契約（manifest ベース・自己記述・実行時隔離＝
   `@shumoku/core` の型と registry しか見えない）を**基準**にする。**バンドルは共通サーフェス
   （config / options / capabilities）では外部契約に準拠**（#270 のハードコードを消す）が、
   外部が表現できない**特権的拡張を持つのは許容**（external＝きれいな下限、bundled＝必要時 superset）。
3. **宣言的に最大限柔軟・ホストは完全汎用**。capability は **open**（文字列、既知のみ消費・未知は
   graceful ignore）。config / options / action / 表示ヒントは**全て schema 宣言**で、ホストは
   汎用描画。`type === '…'` 分岐ゼロ。新プラグインも（多くの場合）新フィールド型も**ホスト編集ゼロ**。
4. **信頼モデルは (a) オペレータ導入・信頼済み**。外部プラグインは server 内でフル権限のコードとして
   動く前提（現状の `loader.ts` の `import()`）。よって今は **sandbox 不要・宣言的柔軟性をフルに出す**。
   未知作者向けの **sandbox / permission / API バージョニングは将来トラック**で、manifest に
   `apiVersion` / `permissions` の**余地だけ残す**（実装は本設計のスコープ外）。
   - 補足: コードを本体に注入する **“Level 2”（プラグインが任意 UI/挙動を持ち込み本体が汎用描画）**
     は (b) 未知作者＋sandbox とセットの大仕事。今回は採らず、**宣言的柔軟性（Level 1＋拡張点一般化）**
     で最大化する。

## 0.5 この設計の目的と完成チェックリスト

> 実装は priority-merge 同様、合意後に**段階的に一気に**やる（§4 phasing）。発散を防ぐため、
> 目的と「全部緑なら完成」の受け入れ条件をここに固定する。

### 目的
1. **新しい *プラグイン*（既存拡張点・既存 capability）は、core/api/web を 1 行も変えず追加できる。**
2. **ホストから per-plugin の `type === '…'` 知識を全廃**（#270 ＋ Sources options ＋ 全分岐）。
3. **config / options / capabilities を「飾りの宣言」から「検証される自己記述契約」へ**（描画・検証・
   実行の単一の真実）。
4. **拡張点モデルで data-source 以外を将来塞がない**（型・registry の一般化のみ、実装は data-source）。

### 完成チェックリスト（受け入れ条件＝テスト）
- [ ] **C1 拡張点 registry**: core が extension point を定義し、プラグインは部分集合を埋める。
      `data-source` は1実装。register / registry / `getAllPlugins` は拡張点を一般に扱う。(unit test)
- [ ] **C2 open capability**: capability は文字列（既知の well-known セット＋任意）。ホストは
      **既知のみ消費・未知は無視**（クラッシュしない）。閉じた union を撤去し、web 型の漏れも掃除。(unit test)
- [ ] **C3 自己記述 descriptor 統一**: バンドルも `configSchema` / `optionsSchema` / capabilities を
      宣言。`getAllPlugins` は **bundled でも configSchema を運ぶ**。descriptor ≡ 外部 manifest の
      ランタイム形。(loader/registry test)
- [ ] **C4 schema 駆動描画一本化**: `datasources/+page.svelte` ・ `[id]/+page.svelte` ・ Sources の
      options が **`type === '…'` 分岐ゼロ**。新フィールド型もホスト編集ゼロで描ける。(grep + web build) ← #270 解消
- [ ] **C5 config/options 検証**: core の純粋関数（schema + value → errors）で検証。api(作成/更新)・
      web(クライアント)が共有。不正は 400。(api test)
- [ ] **C6 capability 検証**: 申告 capability に対応するメソッド存在を registry が検証（嘘申告を
      初回 instantiate で検出）。(registry test)
- [ ] **C7 host に `type === '…'` ブランチゼロ**: プラグイン dir 外に plugin-type リテラル分岐が無い。
      grep ガードを CI/テストに追加（CLAUDE.md 不変条件の機械強制）。(guard test)
- [ ] **C8 新プラグイン＝ホスト編集ゼロ（核）**: 受け入れの実証として、**最小のサンプル外部プラグイン**
      （新 type・既存 capability・configSchema/optionsSchema 付き）を追加し、core/api/web を触らず
      接続・設定・options 描画・能力ディスパッチが通る。(e2e/integration)
- [ ] **回帰**: バンドル5種＋外部サンプルが**同一経路**で動作、typecheck / lint / 既存 test 緑。

### スコープ外（この設計でやらない）
- **sandbox / permission の実装**（信頼モデル(a)。manifest に `apiVersion`/`permissions` の宣言余地のみ）。
- **Level 2（プラグインが任意の UI/コードを本体に注入）**。
- **data-source 以外の拡張点の実装**（型・registry の一般化のみ。renderer 等は将来）。
- 既存 `config_json` のマイグレーション（per-plugin の保存 shape は不変。no-backcompat 可）。
- metrics mapping UI の再設計（別ドメイン。`DiscoveredMetric` passthrough は現状維持）。

## 1. 現状（証拠つき）

- **能力モデル**: `DataSourcePlugin`（type/displayName/capabilities/`initialize(config: unknown)`/
  testConnection）＋ capability mixin（`TopologyCapable`/`HostsCapable`/`MetricsCapable`/
  `AlertsCapable`/`AutoscanCapable`）。ディスパッチは `hasXCapability(plugin)`。
- **capability は本当に機能直結**（飾りでない）。各プラグインが宣言し、ホストが汎用ディスパッチ:
  `discovery-scheduler.ts:85-97`（autoscan→`scan()` / else topology→`fetchTopology()`）、
  `server.ts:405`（metrics→`pollMetrics()`）、`datasource.ts:295-372`（hosts/topology/alerts）。
  → **これが設計の良い部分**で、config フォームもこの「宣言→汎用」方式に寄せるべき。
- **登録経路が2つ（非対称）**:
  - 外部: `plugin.json` manifest（id/name/version/capabilities/**configSchema**）→ `loader.ts` が読む。
  - バンドル: `register(type, name, caps, factory)` 4引数・**schema 無し**
    （例 `libs/plugins/netbox/src/index.ts:80`）。
  - 決定的証拠: `loader.ts:getAllPlugins` は外部に `configSchema` を載せる（`:248`）が
    **バンドルには載せない**（`:768-779`）。web は汎用レンダラを持つが**バンドルを除外**
    （`datasources/+page.svelte:770` `… && !['zabbix','netbox',…].includes(type)`）。
- **設計意図は既にホスト非依存**: 「UI/runtime はどのプラグインが存在するか知らない。capability 契約
  だけを知る」(`docs/plugin-authoring.md`)。**バンドルの特権ショートカットがこの意図を破っている。**

## 2. 根本問題（症状の連鎖）

| # | 問題 | 証拠 |
|---|---|---|
| P1 | 「プラグインである」定義がバンドル/外部で**二重**。自己記述 manifest をバンドルが使わない | register 4引数、bundled に schema 無し `loader.ts:768` |
| P2 | config が `unknown`、schema は **UI ヒント止まり**。検証が web(手書き)＋plugin(その場)で二重 | `initialize(config: unknown)` |
| P3 | capability が**未検証の口約束**（`includes()` でキャストするだけ、メソッド存在を見ない） | type guards（`hasNativeApi` だけ `typeof` 検証） |
| P4 | configSchema が**貧弱**（boolean/enum ラベル/array 複数選択/条件表示/警告/help/候補ソースが無い） | `PluginConfigProperty` |
| P5 | per-plugin の設定面が**2系統**ともハードコード: ①接続 config(#270) ②topology-source options | sources `+page.svelte` の `type==='netbox'` |
| P6 | ホストが **`type` 文字列で分岐**（CLAUDE.md「plugin.type=== を外で書くな」に反する） | datasources 梯子 20+ |
| **P7** | **capability 語彙が閉じた union** で web 型にも漏れる → 能力追加に core+web 編集が要る（柔軟性阻害） | `DataSourceCapability` (core)、api/web 型 |
| **P8** | **「プラグイン＝データソース」決め打ち**。別種拡張点を足す余地が型に無い | 全プラグインが `DataSourcePlugin` のみ |

**良い所（保つ）**: capability の宣言→汎用ディスパッチ。外部の manifest+configSchema 経路。core の
表示契約型（`Alert`/`AlertSeverity` 中立/`MetricsData`/`DiscoveredMetric` passthrough）。

## 3. 目標設計

### 3.1 拡張点(extension point)モデルに一般化（P8）
- core に「拡張点」の概念を導入。`data-source` は1拡張点。各拡張点は**その契約（実装すべき
  インタフェース群＝capability）**を定義する。
- プラグインは「どの拡張点の、どの capability を実装するか」を宣言。registry は拡張点ごとに
  プラグインを引ける。ホストは拡張点の契約だけを知り、**プラグインの具体は知らない**。
- 今回実装する拡張点は `data-source` のみ。だが `register` / registry / 一覧 API は**拡張点を
  一般に扱う形**にして、将来 `renderer` 等を core 側で1点足すだけで開けるようにする。

### 3.2 PluginDescriptor ≡ manifest（external-first・bundled superset 可）（P1）
```
interface PluginDescriptor {
  type: string                      // 一意 id（= manifest.id）
  displayName: string
  extensionPoints: ExtensionPointId[]   // 例: ['data-source']（将来 'renderer' 等）
  capabilities: string[]                // open。well-known: topology/metrics/hosts/alerts/autoscan
  configSchema?: PluginConfigSchema      // 接続設定（datasources）
  optionsSchema?: PluginConfigSchema     // per-use options（例: topology-source の groupBy/site/tag）
  apiVersion?: string                    // 将来の互換判定の余地（今は記録のみ）
  permissions?: string[]                 // 将来 sandbox の余地（今は記録のみ）
}
```
- **外部 manifest（plugin.json）が正典**。`PluginDescriptor` はその**ランタイム形**で、bundled も
  同じ descriptor を `register(descriptor, factory)` で渡す（bundled は server 同梱なのでディスク
  load 不要）。
- **後方互換**: 既存 `register(type, name, caps, factory)`（4引数）は薄いアダプタとして残す
  （外部プラグイン互換）。バンドルは descriptor 版へ移行。
- `getAllPlugins`/registry は**常に descriptor（含 configSchema/optionsSchema）を運ぶ** →
  web は bundled/external を区別しない。
- **bundled superset**: bundled が外部契約で表現できない特権機能を持つのは可。ただし**共通面
  （config/options/capabilities の宣言と描画）は必ず descriptor 経由**＝ホストは型分岐しない。

### 3.3 open capability（P7）
- `capabilities: string[]`（閉じた union を撤去）。well-known セット
  （`topology`/`metrics`/`hosts`/`alerts`/`autoscan`）は core が定数で持つが、**未知の文字列も許容**。
- ホストは**既知の capability だけ消費**し、未知は無視（クラッシュしない＝前方互換）。
- web 型の `DataSourceCapability` 漏れを撤去し、core の1ソースに集約。
- 「未知 capability をホストがどう活かすか」は将来（拡張点を core が足す＝§0.1 の「新拡張点＝core 機能」）。

### 3.4 schema 駆動の宣言的 UI（P2/P4/P5）
- config / options を、**ホストが汎用描画できるだけの表現力**を持つ schema で宣言。`PluginConfigProperty`
  を後方互換に強化:
  - `boolean` → チェックボックス、`enum` に表示ラベル（`oneOf:{const,title}[]`）。
  - `array`（string[]）＋**候補ソース**（§3.4.1）→ NetBox site/tag の複数選択を汎用化。
  - **条件表示** `visibleWhen:{field,equals}`（Grafana webhook 等）。
  - **per-field 警告/ help/ docUrl**（Aruba「MFA off」等）、`format:'password'` でマスク。
  - 任意で **action**（「接続テスト」等、capability に紐づく定義済みの操作）も宣言可能に。
- **#3.4.1 候補ソース（動的選択肢）**: site/tag のように upstream から選択肢を取るフィールドは、
  schema に `optionsSource: '<key>'` を宣言し、プラグインに `getConfigOptions(key): Promise<{value,label}[]>`
  を持たせる（capability `hosts` の `getHosts` と同列の汎用経路）。ホストは key を渡して候補を引くだけ。
- `optionsSchema` は拡張点/capability に紐づく per-use 設定（topology の groupBy/filter 等）。Sources
  ページがこれを汎用描画 → P5 の `type===` 消滅。

### 3.5 config/options 検証＝「契約」（P2）
- core に純粋関数 `validateAgainstSchema(schema, value): {ok} | {errors}` を置く（**実行時隔離のため
  core**。外部プラグインも同じ検証を受けられる）。
- api: data source / topology-source の作成・更新で検証。不正は 400。
- web: 同じ schema からフォーム描画＋クライアント検証。
- plugin の `initialize` は検証済み config を受ける（防御的 parse は残してよいが、二重の form 側手書き
  検証は撤去）。→ 描画・検証・実行が**一つの schema 由来**。

### 3.6 capability 検証（P3）
- registry が factory で instantiate した実体に対し、申告 capability ごとの必須メソッド
  （topology→`fetchTopology`、hosts→`getHosts`、metrics→`pollMetrics`、alerts→`getAlerts`、
  autoscan→`scan`）の存在を assert。欠落は**初回 instantiate 時**に検出（dev: throw、本番: ログ＋
  当該 capability 無効化）。登録時の dummy instantiate は副作用懸念のため避ける。

### 3.7 ホストから `type` 分岐撤去 ＋ ガード（P6）
- 3.2–3.6 が揃えば、web/datasources・web/sources の `type === '…'` 梯子を全削除。
- 再発防止に **grep ガード**（プラグイン dir 外で `'<bundled-type>'` リテラル分岐を検出したらテスト失敗）。

### 3.8 信頼モデル(a) と将来 sandbox の余地
- 現状: 外部プラグインは server 内でフル権限。**(a) 信頼済み**前提で sandbox 無し。
- 将来 (b) 未知作者に備え、descriptor に `apiVersion` / `permissions` を**宣言できる場所だけ用意**
  （今は記録/表示のみ、強制しない）。sandbox / permission 強制・API 安定化は別設計。

## 4. 段階実装（phasing）
1. **Phase 1 — 一般化した型・registry**: ExtensionPoint 概念、`PluginDescriptor`（capabilities open、
   extensionPoints、apiVersion/permissions 余地）、descriptor 版 `register`（4引数アダプタ併存）。
   `getAllPlugins`/registry が descriptor を運ぶ。capability 検証（C6）。（C1/C2/C3/C6 土台）
2. **Phase 2 — schema 強化＋検証**: `PluginConfigProperty` 拡張、`optionsSource`/`getConfigOptions`、
   core の `validateAgainstSchema`。（C5/C4 土台）
3. **Phase 3 — バンドル5種の自己記述**: 各 plugin に configSchema（+ NetBox 等 optionsSchema）執筆。
4. **Phase 4 — web 汎用描画一本化**: datasources の `type===` 撤去＋汎用描画＋サーバ config 検証配線
   （**#270 解消**）。（C4/C5）
5. **Phase 5 — options 汎用化＋ガード＋実証**: Sources options 汎用化（C4/C5）、grep ガード（C7）、
   サンプル外部プラグインで「ホスト編集ゼロ」を実証（C8）。
6. 回帰: 全プラグイン同一経路で緑。

各 Phase をコミット単位に、priority-merge 同様こまめに。

## 5. 確定した決定
- **決定1**: 拡張点モデルに一般化（data-source は1点、実装は data-source のみ、型/registry は一般化）。
- **決定2**: external-first を正典。bundled は共通面のみ準拠・特権 superset 許容。
- **決定3**: capability は open（未知は graceful ignore）。閉じた union 撤去。
- **決定4**: 宣言的柔軟（Level 1＋拡張点一般化）。コード/UI 注入の Level 2 は採らない。
- **決定5**: 信頼モデル(a)（信頼済み・sandbox 無し）。`apiVersion`/`permissions` は宣言余地のみ。
- **決定6**: config/options 検証は core の純粋関数（api/web 共有）。
- **決定7**: capability 検証は初回 instantiate 時（登録時 dummy instantiate は避ける）。
- **決定8**: bundled の自己記述は `register(descriptor, factory)`（plugin.json 経由にしない＝同梱）。

## 6. #270 / 後方互換 / 既存ドキュメント
- `#270` は本設計の **Phase 1+3+4（datasources）**に相当する部分集合。本 doc が上位で、Sources
  options（P5）/ capability 検証（P3）/ type ガード（P6）/ open capability（P7）/ 拡張点一般化（P8）
  まで一掃。実装着手時 #270 に本 doc を参照リンク。
- `register(type,name,caps,factory)`（4引数）は**残す**（外部互換）。descriptor 版を足し bundled 移行。
- `config_json` の保存 shape は不変。schema は描画＋検証に使うだけ。
- `plugin-authoring.md`: 「core が契約を定義、プラグインが従う」「UI は capability 契約だけ知る」を
  **機械的に強制**（C7 ガード）＋ **拡張点・open capability・descriptor 統一**を反映して更新する。
- `plugin-types.ts` / `topology-foundation-plugin-contract.md`: capabilities open 化・descriptor 化・
  ExtensionPoint 追加を反映（supersede）。
