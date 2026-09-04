# Shumoku ドキュメント再構築プラン

> Status: Draft
>
> この文書は、Shumoku のドキュメント再構築に向けた議論のたたき台である。
> 今後追加される要件・考慮事項を整理し、確定した意思決定と未決事項を記録するために使用する。

## 確定した方針

- Astro を静的な表示層として使い、既成のドキュメントテーマは前提にしない。
- コードから決定できるリファレンスはコードベースから生成し、対応するガイドを必須にしない。
- 公開 API の説明は英語の TSDoc を canonical とする。
- schema、CLI、Plugin descriptor などコード内の公開説明も英語を canonical とする。
- 内部実装コメントは日本語を許容し、公開ドキュメントの抽出対象にしない。
- メンテナー向けの設計・調査・運用文書は日本語を canonical とし、原則として翻訳しない。
- 利用者向け操作ガイドは日本語を canonical にでき、公開対象には英語版を用意する。
- 主要な README は英語を canonical とし、必要なものだけ `README.ja.md` を持つ。
- コード内に英語と日本語を併記しない。
- API リファレンスの日本語翻訳は初期スコープに含めず、英語へ fallback する。
- Playground と Editor はドキュメントへ内包せず、別アプリへのリンクとして扱う。
- 本番ビルド時に LLM を実行せず、同じ commit から同じ成果物を生成する。
- 全文検索は Pagefind を第一候補とし、日英で index を分離する。
- 通常検索は current / latest を対象とし、過去バージョンは明示的な scope で検索する。
- 検索 provider は交換可能にし、検索品質が不足した場合は Algolia DocSearch を再評価する。
- 世界配信は Cloudflare Pages を第一候補とし、規模や routing 要件に応じて Workers Static Assets を使う。
- reference と guide は完全静的に生成し、検索以外の client-side JavaScript を原則として要求しない。
- 現行 `apps/docs` は `apps/website` へ移し、ホームページとして独立して維持する。
- 新しい Astro ドキュメントを `apps/docs` に作り、website と docs の build / deploy を分離する。

## 背景

Shumoku の開発では、実装作業の多くを AI に委ねるバイブコーディングが前提になりつつある。
この開発方法では、実装とは別の場所に多数のドキュメントファイルを持つと、変更時に関連文書が
発見されにくくなり、コードと説明の同期を継続的に保つことが難しい。

一方で、すべての説明をコードコメントから生成する方式にも限界がある。公開 API の契約はコードの
近くに置けるが、Server や Editor の画面操作、複数画面にまたがる作業手順、設計思想、利用者が
行いたいことを起点とするガイドなどは、個別の型・関数へ自然に所属させられない。

そのため、本計画では docs.rs のような「リリースされたコードを基準にリファレンスを生成する」
考え方を取り入れつつ、操作ガイドなどの人間向け説明をコードの近くで管理するハイブリッド構成を
検討する。

## 目的

- AI が実装と同じ source of truth を変更すれば、その内容が公開文書へ自動的に反映されるようにする。
- コードから決定できる事実を手書きせず、実装とドキュメントの重複を減らす。
- 公開 API、設定スキーマ、CLI などの説明がリリース成果物と一致するようにする。
- UI 操作やワークフローの説明を、対応する機能と近い場所で管理する。
- reference を決定的に再生成し、既存リンク、example、journey、翻訳状態の破損を CI で検出する。
- GitHub 上の通常のコードレビューとリリースフローにドキュメントを統合する。
- 表示層を特定のドキュメントテーマに縛らず、Shumoku に適した情報設計とデザインを可能にする。

## 非目的

- すべての説明をコードコメントだけで表現すること。
- AI を本番ビルド時に実行し、非決定的にドキュメントを生成すること。
- 現在のドキュメント構成や URL を無条件に維持すること。
- Playground や Editor 本体をドキュメントサイトへ統合すること。
- 初期段階からすべての製品バージョンの操作ガイドを永久保存すること。

## 基本原則

### 1. 事実はコードから生成する

シグネチャ、設定項目、デフォルト値、enum、CLI オプション、対応 capability、パッケージバージョン
など、コードから一意に決まる情報は別の Markdown に書き写さない。

### 2. 説明は対象の近くに置く

公開 API の説明は TSDoc、パッケージ概要は各パッケージの README、画面操作は対象機能の近くに
置くガイドとして管理する。中央のドキュメントディレクトリにすべてを集めることを前提としない。

### 3. 例は実行可能にする

コード例は可能な限り実ファイルとして管理し、typecheck またはテスト対象にする。操作手順は
可能な範囲で Playwright の journey と対応させ、画面や操作対象が存在することを検証する。

### 4. 公開サイトは集約・表示に専念する

ドキュメントサイトは情報の source of truth にならない。各ソースから情報を収集し、ナビゲーション、
検索、相互リンク、バージョン選択を提供する静的な表示層とする。

### 5. 生成可能な情報を手書きしない

「変更時にドキュメントも更新すること」という指示に依存せず、通常の実装 source から reference を
生成する。CI は壊れたリンク、存在しない journey、翻訳状態、実行できない例など、既存契約の整合性だけを
決定的に検証する。

## コンテンツの分類

| 種類 | Source of truth | 主な内容 | 検証方法 |
| --- | --- | --- | --- |
| プロジェクト概要 | ルート `README.md` | 目的、特徴、導入入口 | リンク検査 |
| パッケージ概要 | 各パッケージの `README.md` | 選び方、導入、最小例、実行環境 | リンク検査、コード例の typecheck |
| 公開 API | TypeScript の exports と TSDoc | 契約、引数、戻り値、副作用、例外 | TypeDoc validation、typecheck |
| コード例 | `examples/` などの実ファイル | 典型的な利用方法 | typecheck、unit test、snapshot |
| UI 操作ガイド | 対象機能に隣接する `*.guide.<locale>.md` | 画面操作、判断、ワークフロー | スキーマ検査、journey、リンク検査 |
| UI 操作シナリオ | `*.journey.ts` | 画面遷移、操作対象、キャプチャ地点 | Playwright |
| Plugin リファレンス | descriptor、`configSchema`、capability 実装 | 設定項目、対応機能 | スキーマから自動生成 |
| CLI リファレンス | CLI のコマンド定義 | command、option、引数 | CLI から自動生成、snapshot |
| YAML リファレンス | parser の型・スキーマ | キー、型、制約、既定値 | スキーマから自動生成 |
| リリース・移行情報 | changeset、API 差分、必要な補足文書 | 変更点、破壊的変更、移行手順 | リリース CI、リンク検査 |
| 横断的な概念 | 少数の Markdown | 設計思想、アーキテクチャ、Plugin authoring | レビュー、リンク検査 |

## 提案アーキテクチャ

```text
TypeScript exports + TSDoc ---------> TypeDoc JSON -----------+
package README ------------------------------------------------+
examples ------------------------------------------------------+
plugin descriptors + schemas ------> reference model ---------+--> docs model
CLI definitions -------------------> reference model ---------+        |
co-located guides -----------------------------------------------------+
Playwright journeys ----------------> validation + images -----+        |
changesets + package metadata ------> versions and changes ----+        v
                                                                 Astro site
                                                                     |
                                                          static HTML + Pagefind
```

Astro は複数の入力形式を正規化した `docs model` を読み取り、静的ページを生成する。生成した
Markdown や HTML は原則として Git にコミットしない。

### Docs Registry と自動関連付け

Astro が各入力を直接個別に扱うのではなく、生成処理の中間に Docs Registry を置く。Registry は
API symbol、package、feature、route、HTTP operation、schema、guide、example、journey、version を
安定 ID で保持する。

```text
Repository
  ├── TypeScript AST / TypeDoc
  ├── OpenAPI
  ├── package exports
  ├── Plugin descriptors / schemas
  ├── README / guides
  ├── examples / tests
  ├── Playwright journeys
  └── git / release metadata
              |
              v
         Docs Registry
  ├── public entities and stable IDs
  ├── direct import / type relations
  ├── declared route / endpoint relations
  ├── source and version context
  └── explicit relations for ambiguous cases
              |
              +--> validation
              +--> automatic and reverse links
              +--> navigation / related content
              +--> search index
              v
            Astro
```

初期 Registry は public export、TypeDoc symbol、OpenAPI operation、CLI command、Plugin descriptor、
schema、guide の明示参照、example の direct import に限定する。Server handler が直接 import する公開
Core API は関連候補にできるが、完全な call graph 解析や Playwright 通信の動的観測は初期範囲に含めない。
UI route、guide、journey はコロケーション規約と安定 ID で関連付ける。

実装上の依存関係が利用者にとって有益とは限らないため、検出した関係をガイド本文へ無条件に
挿入しない。自動生成した Related API、Used by、開発者向け情報として利用する。
Markdown 内のバッククォート付き識別子は、その文書の package / feature scope から一意に解決
できる場合だけ自動リンクし、曖昧な場合に限って安定 ID による明示的な cross-reference を使う。

## 技術スタック案

Astro を正式な表示層として採用する。主要な構成は次のとおり。

| 役割 | 第一候補 | 理由 |
| --- | --- | --- |
| 静的サイト生成 | Astro | 独自 UI を作りやすく、複数ソースを静的に統合できる |
| ドキュメント UI | Astro による独自実装 | Starlight などの既成テーマへ情報設計を合わせないため |
| API 抽出 | TypeDoc JSON | TypeScript の公開 API と TSDoc を構造化して取得できる |
| コンテンツ統合 | Astro Content Loader | リポジトリ内の分散した Markdown や生成データを収集する |
| 全文検索 | Pagefind | 静的な分割 index、日英対応、検索サーバー不要 |
| コード表示 | Shiki または Expressive Code | TypeScript、YAML、CLI 例を表示する |
| 操作検証 | Playwright | 操作 journey とスクリーンショットを同じシナリオから作れる |
| API 互換性 | API Extractor | 公開 API の意図しない変更を検出する候補 |
| 品質管理 | TypeDoc validation、Biome、リンク検査 | AI が修正可能な具体的エラーを返す |
| CI/CD | GitHub Actions | 通常の PR、changeset、リリースフローへ統合する |
| ホスティング | Cloudflare Pages | GitHub 連携、PR preview、世界分散の静的配信 |
| 大規模配信 | Workers Static Assets | file 数や routing 要件が Pages の範囲を超えた場合の候補 |

### Astro と Eleventy の比較結果

Eleventy も、軽量な静的生成、client-side JavaScript を要求しない構成、既存ディレクトリからの
段階的な収集という点で有力だった。一方、Shumoku では Markdown の表示よりも、TypeDoc JSON、
OpenAPI、CLI command model、Plugin descriptor、YAML schema、翻訳状態、version 情報など複数の
構造化入力を検証して統合する比重が高い。Astro Content Loader と schema、型付き component の方が、
入力経路とエラーを明示しやすく、AI が規約や data cascade を推測する負荷を抑えやすいと判断した。

Eleventy の軽量性は魅力だが、validation、collection、関連リンク、locale、version の処理を独自に
組み合わせると、表示層が暗黙的なドキュメント基盤へ肥大化する懸念がある。このため初期実装は Astro
とする。ただし次の原則により、将来の renderer 変更を妨げない。

- TypeDoc、OpenAPI、schema の解析は Astro integration に直接実装しない。
- `docs:generate` と `docs:check` が SSG 非依存の Docs Registry と正規化済み content を生成する。
- slug、locale、version、公開範囲、関連リンクは Docs Registry で決定する。
- Astro component は表示だけを担当し、repository 全体を独自に探索しない。
- Markdown に Astro 固有 component を無制限に埋め込まず、portable な directive または構造化データを使う。

### 検索設計

Pagefind は Astro が生成した HTML を後処理して index を作る。Docs Registry から検索専用の別 DB を
生成せず、利用者が実際に読める最終 HTML を検索対象にする。

```text
Docs Registry
    |
    v
Astro static HTML
    |
    v
Pagefind language indexes
    |
    +--> en: English guides + API descriptions + symbols
    +--> ja: Japanese guides + symbols + English fallback text
```

- `<html lang>` により英語と日本語の index を分離する。
- API symbol、package 名、HTTP path、CLI command は全 locale で検索可能にする。
- Docs Registry の alias を使い、`NetworkGraph`、`topology`、`構成図` などの対応を補う。
- navigation、footer、version 一覧など本文でない領域は index から除外する。
- title、summary、heading、symbol、alias、kind、package、version を ranking / filter metadata にする。
- 通常検索では current / latest を優先し、同じ symbol の過去版が結果を埋めないようにする。
- 検索 UI と index は検索欄の focus 後に遅延ロードし、入力中に必要な chunk を preload する。
- 検索 provider interface を Astro UI と分離し、Pagefind から Algolia などへ交換可能にする。

技術スパイクでは日本語の分かち書き、英語 symbol との混在、同名 API、旧 version の除外、検索時の
転送量と応答時間を実データで評価する。Pagefind の関連度や規模が不十分な場合だけ、OSS 向け
Algolia DocSearch を第二候補として比較する。

### 世界配信と runtime performance

Astro は build 時だけ使用し、runtime では静的 HTML、CSS、画像、Pagefind index を Cloudflare の
世界分散 network から配信する。reference page と通常の guide は SSR や Worker invocation に依存
させない。

- HTML は再検証可能な cache policy、content hash 付き asset は長期 immutable cache とする。
- font は self-host と subset を基本とし、画像は寸法を固定して適切な形式へ最適化する。
- reference page は原則 JavaScript なし、guide は必要な demo だけ island を許可する。
- 検索 JavaScript は初期表示 bundle に含めず遅延ロードする。
- PR ごとの preview deployment で、リンク、検索、表示、Lighthouse budget を確認できるようにする。

Cloudflare Pages / Workers Static Assets には一 deployment あたりの file 数制限がある。過去の全 package
version を毎回一つの Astro build へ含めず、release ごとの immutable artifact として追加・保持する。
技術スパイクでは HTML、検索 chunk、画像を含む実 file 数を計測し、無料枠を前提に設計を固定しない。

## リポジトリ構成案

```text
shumoku/
├── README.md
├── libs/
│   └── @shumoku/core/
│       ├── README.md
│       ├── src/**/*.ts
│       └── examples/*.ts
├── apps/
│   ├── website/                 # 現行 apps/docs を移動したホームページ
│   ├── docs/                    # 新しい Astro ドキュメント
│   │   ├── astro.config.mjs
│   │   └── src/
│   │       ├── components/
│   │       ├── layouts/
│   │       ├── pages/
│   │       └── styles/
│   └── server/web/src/routes/
│       └── dashboards/
│           ├── +page.svelte
│           ├── feature.ts
│           ├── dashboard.guide.ja.md
│           └── dashboard.journey.ts
├── tooling/
│   └── docs/
│       ├── typedoc-loader.ts
│       ├── feature-loader.ts
│       ├── schema-loader.ts
│       └── checks/
└── .github/workflows/
    ├── website.yml
    └── docs.yml
```

この配置は方向性を示す例であり、実際の SvelteKit route 構造、ビルド境界、公開パッケージへの
不要なファイル混入などを確認したうえで決定する。

### Website と Docs の分離

現行 `apps/docs` は Next.js / Fumadocs 上にホーム、docs、Playground、Editor、検索 API が同居している。
最初にアプリ全体を `apps/website` へ移し、既存挙動と未コミット変更を保持する。その後、docs route と
Fumadocs content を段階的に新 `apps/docs` へ移行する。Playground と Editor の分離はそれぞれの移行計画で
扱い、今回の初期 rename と同時に大きく書き換えない。

- `apps/website`: ホームページ。既存 Next.js runtime を当面維持する。
- `apps/docs`: Astro の完全静的ドキュメント。Pagefind index を build 後に生成する。
- package name、Turbo task、cache output、環境変数をアプリごとに分ける。
- GitHub Actions と Cloudflare project を分け、片方だけを preview / rollback / deploy できるようにする。
- production domain の切り替え前は新 docs を preview domain で並行検証する。
- 新 docs の移行完了後に限り、website から旧 docs route、Fumadocs、検索 API を削除する。

## 公開 API ドキュメント

### 方針

- 公開 export をリファレンス生成の起点にする。
- API の利用者に対する契約を TSDoc に記述する。
- 公開 entry point には summary を必須とし、型から自明な説明の言い換えは要求しない。
- 制約、副作用、例外、単位、利用判断など、signature だけでは分からない内容を優先する。
- 実装理由を説明する内部コメントと公開 TSDoc を区別する。
- 長い例は `examples/` の実ファイルへ移し、TSDoc や README から参照する。
- 公開 API に必要な TSDoc がない場合は CI を失敗させる。
- `@deprecated`、`@since`、関連 API、ソースリンクの表示方法を別途定義する。

### ページ構成例

```text
/packages/core/0.8.2/
/packages/core/0.8.2/functions/computeNetworkLayout/
/packages/renderer-svg/0.5.0/functions/renderSvg/
/packages/core/latest/interfaces/NetworkGraph/
```

TypeDoc の JSON 形式は TypeDoc のバージョンに依存するため、バージョンを固定し、docs model へ
変換する adapter と fixture test を持つ。

## 操作ガイド

### 方針

UI 操作は特定の関数ではなく、利用者の目的や複数画面の流れに所属する。そのため、対象機能の
近くに Markdown として置き、必要に応じて実行可能な journey と関連付ける。

```text
dashboard.guide.en.md
dashboard.guide.ja.md
dashboard.journey.ts
```

ガイドには最低限、安定した ID、タイトル、カテゴリ、locale、関連 journey を持たせる。中央の
サイドバー設定は手書きせず、メタデータから生成することを検討する。

```yaml
---
id: server.dashboard.create
title: Create a dashboard
category: dashboards
journey: dashboard-create
---
```

### Journey の役割

- 操作対象の role や accessible name が存在することを確認する。
- 複数画面にまたがる主要な利用フローを検証する。
- ガイド用スクリーンショットのキャプチャ地点を定義する。
- 操作順、UI label、生成可能な画像をガイドへ埋め込むための構造化データを提供する。

Journey は文章の正しさを完全には保証しない。利用判断、背景、注意事項など、機械的に検証できない
内容は引き続き Markdown で説明する。Journey と Markdown の両方に同じ操作手順を書かず、ガイドは
目的、判断、注意、troubleshooting を中心にする。

### ガイドなしを正常状態とする

Server、CLI、Plugin、公開 package は、コードから生成した reference だけで十分ならガイドを持たない。
ガイドは機能追加時の必須成果物ではなく、次のようなコード構造から表現できない情報がある場合に
だけ追加する。

- 複数の API、command、画面を組み合わせる作業手順。
- 利用者が複数の方法から選択するための判断基準。
- 外部サービス側で必要な準備。
- 本番運用、障害対応、移行、安全上の注意。
- 背景や設計思想を理解しないと誤用しやすい機能。

`guide` が存在しないことを CI error にしない。存在するガイドの整合性と、明示的に guide-required と
された重要な workflow だけを検証対象にする。

## ドキュメント生成と CI

ドキュメント生成は通常の決定的な build step として実行する。CI に AI や LLM を組み込まず、実装変更から
ガイドの必要性を推測させない。CI の役割は、同じ source から同じ成果物を生成できることと、既存の
機械可読な契約が壊れていないことの検証に限定する。

```bash
bun run docs:check
```

候補となる検査項目は次のとおり。

- 公開対象の関数、型、class、enum に必要な TSDoc がある。
- TSDoc 内の symbol link とファイルリンクが解決できる。
- 公開 API が非公開型を不正に参照していない。
- README とガイド内のリンクが有効である。
- examples が typecheck またはテストを通過する。
- ガイドの frontmatter がスキーマに適合する。
- ガイドが参照する feature と journey が存在する。
- 日英コンテンツの対応関係が明示されている。
- 必須 journey が Playwright で成功する。
- 静的サイトと検索インデックスを生成できる。

エラーは通常の開発者向け検査として、壊れた契約とその source を具体的に示す。

```text
Documentation contract failed

Source: apps/server/docs/dashboards.mdx

- referenced journey "dashboard-create" does not exist
- internal link "/reference/server/dashboards" could not be resolved
```

コード変更と手書きガイドの対応は CI で強制しない。新しい guide を追加すべきかという意味上の判断は
自動検査の責務にせず、既存 guide が明示的に参照している symbol、journey、example の整合性だけを検査する。

## AI を前提にしたリポジトリ設計

- `AGENTS.md` には抽象的な「docs を更新する」だけでなく、コンテンツ種別ごとの更新規則を書く。
- 公開 API、操作ガイド、example の検査を `docs:check` に集約する。
- 生成物ではなく source of truth を AI の編集対象にする。
- 実装ファイルから更新対象のガイドへ機械的に到達できるようにする。
- 一つの説明を README、TSDoc、ガイドへ重複して記述しない。
- 自動生成できない説明だけを Markdown として残す。
- CI の失敗メッセージには、壊れた契約の source と理由を含める。
- 本番ビルド時に LLM を実行せず、同じ commit から同じサイトが生成されるようにする。

## 多言語

リポジトリ全体を一つの言語へ統一せず、読者とコンテンツ種別ごとに canonical language を決める。

| コンテンツ | Canonical | 翻訳方針 |
| --- | --- | --- |
| 公開 API の TSDoc | 英語 | 初期は英語へ fallback |
| schema、CLI、Plugin の公開説明 | 英語 | 初期は英語へ fallback |
| 型、signature、設定 key、command、コード例 | 言語非依存 | 全 locale で共有 |
| 利用者向け操作ガイド | 日本語を許可 | 公開対象は英語版を用意 |
| 主要 package README | 英語 | 必要なものだけ `README.ja.md` |
| 設計・調査・開発メモ | 日本語 | 原則翻訳しない |
| リリース・運用手順 | 日本語 | 必要な場合だけ翻訳 |
| 内部実装コメント | 日本語を許可 | 抽出しない |

公開 TSDoc の直下に日本語を併記しない。サイトのナビゲーション、ボタン、状態表示などは通常の
i18n dictionary で日英対応する。自然言語中心のガイドは canonical locale の本文を一つだけ持ち、
機能開発と同じ作業で日英両方のファイルを編集することを要求しない。

```text
create-topology.feature.ts
create-topology.journey.ts
docs/
  └── create-topology.ja.md
```

公開翻訳は機能実装から分離した翻訳工程で扱う。canonical の段落に安定 ID を付け、source hash と用語集を
用いて変更段落だけを翻訳対象として抽出する。翻訳済み content は sidecar catalog または locale artifact
として管理し、production build はそれを決定的に読み込む。build や CI で LLM を実行しない。古い翻訳を
最新として黙って表示せず、canonical への fallback または更新状態の表示を行う。

日本語版がない API reference は、構造とサイト UI を日本語で表示し、本文は最新の英語を表示する。
翻訳不足を理由にページを 404 にしない。日本語検索では日本語コンテンツに加え、API symbol と英語の
原文も検索対象にする。

将来 API 説明の日本語化が必要になった場合だけ、TypeDoc JSON から翻訳単位を抽出し、gettext PO
などの sidecar catalog を stable symbol ID に重ねる。翻訳をコードへ埋め込まず、原文変更時は
missing / fuzzy として検出し、古い翻訳より英語 fallback を優先する。この仕組みは初期実装には
含めない。

リポジトリ内の文書は公開範囲を区別する。メンテナー向け日本語文書は GitHub 上の source of truth
として維持し、公開サイトの通常ナビゲーションと検索へ自動的に混在させない。現行の `public: true`
と同等の明示的な公開指定、またはディレクトリ規約を新しい loader でも維持する。

## バージョニング

### 公開パッケージ

公開 API リファレンスはリリース成果物に対応させ、パッケージごとに独立して保持する。

```text
/packages/core/0.8.2/
/packages/core/latest/
/packages/renderer-svg/0.5.0/
```

Shumoku にはモノレポ全体の単一バージョンが存在しないため、サイト全体に一つのバージョン選択を
適用しない。`latest` は各パッケージの最新版へ解決する。

どのソースからリリース時点の文書を生成するかは未決定である。

- release commit / tag
- npm tarball
- CI が保存する静的 artifact

再現性と、公開されていない workspace 内コードを誤って表示しないことを重視して選定する。

### Server と Editor

Server は同じ source をバージョンごとに手で複製せず、`server-vX.Y.Z` と
`server-vX.Y.Z-beta.N` の release tag から immutable な docs artifact を生成する。artifact には
OpenAPI、Server guide、UI guide、同梱 Plugin descriptor、version、source commit を含める。

`latest` と `beta` は独立した文書編集チャンネルではなく、release workflow が更新する可動 alias とする。
通常の入口と検索は最新 stable を既定にし、beta は明示的に選択した利用者だけへ prerelease の警告付きで
表示する。Server UI からの Docs リンクには実行中の正確な version を含め、利用者を対応する immutable
snapshot へ送る。

```text
/en/server/                         -> latest stable の入口
/en/server/0.1.6/                   -> immutable stable snapshot
/en/server/0.2.0-beta.1/            -> immutable prerelease snapshot
/en/server/beta/                    -> 最新 beta への可動 alias（補助導線）
```

URL alias の解決と version selector は release metadata から静的 build 時に生成する。request 時の SSR、
database、管理画面は導入しない。`main` から生成する Server docs は preview / next として扱い、公開
`latest` や `beta` を上書きしない。

過去の全 release を通常 build に含め続ける必要はない。最新 stable、必要な旧 stable、最新 beta を
active build に含め、それより古い snapshot は immutable artifact または archive deployment として残す。
Editor は当面 production / preview の現行ガイドだけとし、利用者がローカルに特定版を保持する Server と
同じ履歴要件が生じた場合に version snapshot を導入する。

この方式は一般的な versioned docs の折衷である。Docusaurus は current と latest を分けて release 時に
docs を freeze する一方、versioning が contributor 負荷と build cost を増やすため必要な場合だけ使うよう
案内している。docs.rs は package publish ごとに文書を build し、正確な version と `latest` / semver
shortcut を提供する。Kubernetes は通常サイトに現行版と直近の限られた旧版だけを掲載する。Shumoku は
release-triggered snapshot と alias は採用するが、versioned Markdown の repository 内コピーは行わない。

## サイト上の情報設計

サイトの入口は、実装上のパッケージ構成だけでなく、利用者の目的からも辿れるようにする。

```text
Overview
Get Started
Library
  Topology YAML
  TypeScript API
  Packages（package versioning導入時）
CLI
  Commands
Server
  Guides
  API
  Data Sources
  Versions
Developers（公開する開発者向け文書が揃った時点で追加）
```

Playground と Editor はドキュメント内へ統合せず、ヘッダーなどから別アプリへの外部リンクとして
提供する。

2026-09-04 時点で、公開URLとナビゲーションを`library / cli / server`のproduct-first構造へ統一した。
コード上の所有場所は`libs`、`apps/cli`、`apps/server`のままとし、公開サイトの形に合わせた文書treeを
別途管理しない。旧`reference/*`、`guides/getting-started`、`guides/server/*`は検索対象外の互換redirect
として残す。ServerのversionなしURLは選択中のstable（存在しないlocal buildでは`next`）へ解決し、
exact version URLをcanonicalとする。

## 現行ドキュメントの棚卸しと移行判断

2026-09-04 時点のリポジトリを確認した。依存 package 内の文書、changeset、生成済みコピーを除き、
主要な Markdown / MDX とコード上の生成元を対象に評価した。

### 現状の概要

- npm / library 向け公開文書は `apps/docs/content/docs/npm/` に日英 17 組ある。
- Server の公開文書は `apps/server/docs/` に日英 6 組あり、すべて `public: true` である。
- Server 公開文書は `collect-docs.mjs` により `apps/docs/content/docs/server/` へコピーされ、コピーは
  source と同一で gitignored になっている。ここにはすでに「所有するアプリの近くに文書を置く」
  原則が部分的に実現されている。
- `apps/server/docs/design/` にメンテナー向け設計文書が 25 件、`apps/editor/docs/design/` に 10 件、
  `apps/editor/docs/pages/` に日本語の画面・操作設計文書が 4 件ある。
- apps / libs 配下には package README が 25 件あり、公開 package の概要と最小例はすでにかなり
  コロケーションされている。
- ルート `docs/` にはアーキテクチャ、思想、リリース、Plugin authoring などの日本語中心の
  メンテナー文書がある。
- 公開 npm 文書には多数のコードブロックと、API、YAML / JSON field、CLI option を手書きした表が
  ある。生成元と同期されておらず、移行時にはそのままコピーせず分類し直す必要がある。
- 現行 MDX 固有要素は主に `Callout`、`Cards`、`Tabs`、`VendorIcons` であり、Astro component または
  Markdown directive へ置き換え可能である。

### 移行可能性の結論

**移行は可能であり、構造的な阻害要因は確認されなかった。** ただし一括変換ではなく、生成元が
すでにある領域、コード側の宣言化が必要な領域、人間向けガイドとして残す領域に分けて進める。

| 領域 | 移行判断 | 主な理由・前提作業 |
| --- | --- | --- |
| 公開 package API | 条件付きで生成へ移行可能 | TypeDoc 導入と公開 TSDoc coverage の実測・補完が必要 |
| Server HTTP API | 生成へ移行しやすい | OpenAPI 3.1 document、104 件の route 定義、operation ID 生成がすでにある |
| Server WebSocket | 一部手動が残る | OpenAPI 外の protocol 型・message 定義を抽出可能な形へ寄せる必要がある |
| CLI reference | 小規模 refactor 後に生成可能 | `HELP` と `parseArgs` option が二重管理なので単一 command model が必要 |
| Plugin reference | 生成へ移行しやすい | descriptor、capabilities、`configSchema`、`optionsSchema` がすでにある |
| YAML / JSON reference | 現状のままでは完全生成できない | parser の型・変換処理が中心で、単一の runtime schema が存在しない |
| Theme / renderer options | API 生成と guide へ分割可能 | 型・TSDocから事実を生成し、選び方と視覚例だけをガイドに残す |
| Vendor icons | catalog から生成可能 | 数、名前、URL を手書きせず catalog / asset metadata を入力にする |
| Server 操作 | guide として移行 | dashboards、datasources、topologies は短い操作ガイドとして価値がある |
| Server installation | guide として維持 | Docker、systemd、reverse proxy、backup は複数手順と運用判断を含む |
| Editor page docs | 現状は設計文書として維持 | stub や将来計画を含み、現行利用者向けガイドとして直接公開できない |
| 設計・調査文書 | 日本語のまま維持 | 公開 reference へ変換せず repository documentation として扱う |
| package README | canonical source として再利用 | docs site が直接収集し、同内容の MDX 複製を作らない |

### 現行公開ページの移行先

| 現行ページ | 移行先 |
| --- | --- |
| npm `about` / `index` | ルート・main package README と少数の Getting Started へ統合 |
| npm `api-reference` | TypeDoc から生成する package reference で置換 |
| npm `basic-diagram` | 利用者向けガイドとして維持。field 一覧は生成 reference へ分離 |
| npm `cli` | command model から生成する reference と、必要な workflow guide へ分割 |
| npm `custom-integration` | 複数 API を組み合わせる guide として維持 |
| npm `examples` | 検証可能な example / fixture の索引として再構築 |
| npm `interactive-features` | renderer option reference と利用者向け guide へ分割 |
| npm `json-reference` | NetworkGraph schema / TypeDoc 生成へ置換。用途説明と例だけを残す |
| npm `yaml-reference` | parser 用 runtime schema を整備後に生成へ置換 |
| npm `multi-file` | 横断 workflow guide として維持 |
| npm `organizing-groups` | guide として維持。field の定義は生成 reference へ移す |
| npm `styling-themes` | Theme API reference と視覚的 guide へ分割 |
| npm `vendor-icons` | catalog 生成一覧と短い利用 guide へ分割 |
| npm NetBox `api` | Plugin package の TypeDoc reference で置換 |
| npm NetBox `index` | 外部サービス設定と troubleshooting guide として維持 |
| npm NetBox `visualization` | schema / mapping reference と利用判断 guide へ分割 |
| Server `api` | OpenAPI reference で置換し、認証と WebSocket の概念説明だけを残す |
| Server `dashboards` | 操作 guide として維持し、将来 journey と関連付ける |
| Server `datasources` | 共通操作 guide を維持し、Plugin 一覧・設定表は descriptor から生成 |
| Server `installation` | 日英の運用 guide として維持 |
| Server `topologies` | 操作 guide として維持し、YAML reference は共有生成ページへリンク |
| Server `index` | Server README と公開 landing page の責務を整理して統合 |

### 移行前に必要なコード側の準備

#### TypeDoc の成立性確認

現状は export と doc comment が多数存在するが、単純件数だけでは公開 API の網羅率を判断できない。
TypeDoc を一時導入して package ごとの JSON を生成し、次を計測する。

- 実際に公開 entry point から到達する symbol 数。
- summary、parameter、return、deprecated 情報の欠落率。
- workspace package 間の re-export と source link の解決。
- overload、union、generic、subpath export の表示品質。
- 既存 README の API 記述を TSDoc へ移す必要がある箇所。

#### CLI command model の一本化

現在の CLI は help text と `node:util` の `parseArgs` option 定義が別々に存在する。option、default、例、
validation、help を一つの typed command model から導出する形へ refactor した後、その model を docs
generator も読む。

#### NetworkGraph / YAML schema の一本化

`NetworkGraph` は TypeScript interface、YAML は parser の入力型と変換ロジックが中心であり、公開
リファレンスを完全生成できる単一 schema がない。型だけから runtime の alias、normalization、warning、
入力許容形式を復元しない。parser が実際に受け付ける契約を表す schema / metadata を整備し、parser、
validation、reference の三者が同じ定義を利用する必要がある。

#### 操作文書の現行性確認

Server の公開操作ガイドは短く移行しやすいが、UI label と現行画面が一致することを保証していない。
Editor の page 文書には明示的な stub と将来計画が含まれる。公開移行前に主要フローだけを選び、
Playwright journey または既存 E2E test と照合する。

### 移行時に維持する source of truth

- `apps/server/docs/*.mdx` は新形式へ変換するまで引き続き Server 所有とする。
- `apps/docs/content/docs/server/` は生成コピーなので移行 source として編集しない。
- package README は新サイトから直接収集し、同内容の MDX を新設しない。
- `docs/`、`apps/server/docs/design/`、`apps/editor/docs/design/` の日本語設計文書は一括翻訳しない。
- 現行公開 MDX は移行完了まで削除せず、新旧ページの内容と redirect を比較できるようにする。
- 現行のコード例はコピーして固定せず、可能なものから test / fixture / example file へ移して埋め込む。

### 移行難易度

総合判断は **中程度**。Astro への表示移行自体より、手書きリファレンスを正しいコード契約へ
戻す作業が中心になる。

- 低難易度: README 収集、設計文書の分類、Server OpenAPI、Plugin descriptor、静的検索。
- 中難易度: TypeDoc adapter、日英 guide、MDX component 置換、redirect、example の実ファイル化。
- 高難易度: YAML 入力契約の schema 化、独立 package version の保存、UI journey の安定運用。

最初の技術スパイクでは、Core API、Server OpenAPI、CLI、YAML、Server 操作ガイドを一つずつ選び、
異なる生成経路を end-to-end で確認する。これに成功すれば、残りは段階的に移行可能と判断できる。

## バイブコーディング適合性の再評価

ここでいう適合性は、AI がドキュメント本文を大量に生成できることではない。通常の実装変更だけで
reference とサイト内の関連情報が可能な限り更新され、別ファイルの探索、日英の二重編集、リンク追記、
同じ option や field の再説明にコンテキストを使わずに済むことを指す。同時に、生成結果をそのまま
並べるのではなく、利用者が目的から情報へ到達できる読みやすい公開サイトを維持できることを条件とする。

### 結論

現行構成は **コードを AI で開発する基盤としては良いが、ドキュメントを継続的に維持する仕組みとしては
まだ部分的にしかフレンドリーではない**。monorepo、詳細な `AGENTS.md`、OpenAPI、Plugin descriptor、
package README、Server 文書のコロケーションは強い土台である。一方、公開文書の主要部分は手書き MDX、
日英ペア、README、型、CLI help の間に同じ事実が分散しており、AI は機能変更のたびに「どの文書が影響を
受けるか」を検索して判断する必要がある。更新し忘れても現在の CI は多くの場合成功する。

したがって、Astro への置換だけでは適合性はほとんど上がらない。効果を生むのは、コード上の契約を
source of truth にすることと、そこから reference と関係を自動生成することである。CI はその処理の
再現性と既存参照の整合性を確認する安全網であり、ドキュメント作業を指揮する仕組みではない。

### 現行構成の評価

| 評価軸 | 評価 | 現状 |
| --- | --- | --- |
| 実装と情報源の近さ | 良い部分がある | package README と Server 文書は所有コードの近くにあるが、npm 公開文書は `apps/docs` に集中している |
| 事実の単一管理 | 弱い | CLI option、API 説明、YAML field、日英ページなどに手動の重複がある |
| 変更影響の自動発見 | 弱い | OpenAPI compatibility 以外は、機能と文書の関係を機械的に追跡していない |
| 生成可能な契約 | 領域差が大きい | Server OpenAPI と Plugin metadata は強いが、CLI と YAML 入力契約は宣言化が不足している |
| 例の信頼性 | 弱い | 公開 MDX 内の例の多くは typecheck、parse、render の対象になっていない |
| 多言語の更新負荷 | 弱い | 日英ファイルが対で存在するが、原文と翻訳の freshness を検査していない |
| CI のフィードバック | 不足 | docs build は通常 CI に入るが、リンク、公開 symbol、翻訳、guide の陳腐化を個別に検出しない |
| 利用者向けの読みやすさ | 維持可能 | 現行 guide の文章構成は再利用でき、生成 reference と手書き guide を分離すればむしろ改善できる |
| AI が読む文脈の信頼性 | 弱い | design、調査、stub、将来計画、現行仕様の status が統一されず、古い文書を正と誤認し得る |

特に問題なのは文書量そのものではなく、**正しい更新先を決めるための探索と判断**である。1 つの option を
追加したとき、実装、help、README、reference、英語、日本語を別々に確認する設計は、AI のコンテキストを
消費し、もっともらしい不整合を生みやすい。逆に、typed command model を 1 か所変更すれば help と
reference が更新される設計なら、実装タスクのコンテキスト内で完結する。

### 目標とする更新体験

通常の機能追加では、AI に「関連ドキュメントも探して更新する」と要求しない。次の流れを標準とする。

1. AI は実装と同じ場所にある TSDoc、schema、command model、descriptor を更新する。
2. `docs:generate` が reference、navigation、関連リンク、検索用 metadata を生成する。
3. `docs:check` が生成差分、未説明の公開 symbol、壊れた example、リンク、翻訳 freshness を検査する。
4. guide は人間向けに編集された少数の文章として残し、field や option の一覧を再記述しない。
5. 新しい guide の要否は CI に推測させず、利用者向けの新しい workflow を意図的に提供するときだけ判断する。

これにより、大半の変更はコード周辺だけで完結する。利用者には生成 reference の羅列ではなく、手書きの
入口、task-oriented guide、生成された正確な詳細、相互リンクを一つの UI で提供する。

### 先に直すべき点

サイトの再実装より先に、次を整える。これらがない状態で Astro へ移行すると、現在の重複と更新責任を
別の renderer に移すだけになる。

1. 文書に `status`、`audience`、`owner`、`canonical locale` を付け、現行仕様と draft / research / future
   plan を機械的に区別する。
2. `docs:check` の入口を作り、最初は source inventory、生成差分、内部リンク、重複 source の検出を行う。
3. CLI の option と help を typed command model に統合する。
4. YAML / JSON 入力を parser、validation、reference で共有できる runtime schema に寄せる。
5. 公開 entry point の TypeDoc coverage を測定し、欠落を package 単位で報告する。
6. MDX 内の実行可能な例を example / fixture に移し、typecheck、parse、render の対象にする。
7. Docs Registry から package、symbol、route、command、plugin、guide の関連を導出する。
8. 原文 hash と source revision により翻訳の freshness を検出し、古い翻訳を黙って最新扱いしない。

新しい手書き guide を必須にする判定は最後まで狭く保つ。公開 symbol の追加だけなら TSDoc で完了し、
操作画面でも既存 journey の範囲内なら自動更新または既存 guide への関連付けで完了する。新しい目的、
複数段階の判断、重大な運用上の注意が増えた場合だけ guide の追加を求める。

## 段階的な再構築案

### Phase 0: 要件確定

- 利用者、主要ユースケース、対象コンテンツを整理する。
- バージョニングと URL 互換性の要件を決める。
- Cloudflare Pages の project、domain、preview、保持方針を確定する。
- 確定した言語ポリシーをコンテンツ分類と build check に落とし込む。
- API、操作、概念説明の代表ページを選ぶ。

### Phase 1: source of truth と検査の技術スパイク

- 現行 `apps/docs` を `apps/website` へ移し、package / Turbo / deployment の境界を分離する。
- 新しい `apps/docs` に Astro の最小構成を作り、website と独立して build できるようにする。
- TypeDoc、OpenAPI、CLI command model、YAML schema を代表 1 件ずつ生成可能にする。
- `docs:check` の最小版で source inventory、生成差分、内部リンクを検査する。
- 実ファイル化した example を typecheck、parse、render の対象にする。
- 代表的な操作ガイドを Playwright journey と結び付ける。

2026-09-04 時点で、website / docs の分離、Astro の独立 build、TypeDoc と OpenAPI の代表ページ、
および source inventory・生成の決定性・build 後の内部リンクを検査する最小 `docs:check` まで完了した。
CLI command model、YAML runtime schema、実行可能 example も完了した。Server の Topology 作成を
代表操作として、route に隣接する日英 guide、typed journey、安定した UI anchor、翻訳 freshness
検査を接続した。journey は現在 source/anchor 契約までを決定的に検査しており、実ブラウザでの
Playwright 実行は preview 環境の認証方法を決めた後の未完了項目とする。

### Phase 2: ドキュメント契約と関係グラフ

- `docs:check` を公開 symbol、翻訳 freshness、既存 guide の参照整合性まで拡張する。
- 公開 API に必要な TSDoc の基準を定める。
- 最小 Docs Registry と guide schema から direct relation だけを生成する。
- examples と journey の実行方法を CI に統合する。
- canonical guide の変更段落だけを抽出できる翻訳用 artifact を定義する。

### Phase 3: Astro 表示層の技術スパイク

- TypeDoc JSON と OpenAPI から代表的な reference を Astro で描画する。
- 分散した README と guide を Astro Content Loader で収集する。
- Pagefind の日本語・英語検索品質、index size、ビルド時間を確認する。
- Cloudflare Pages の preview、cache header、世界各地からの応答を確認する。
- guide と reference を同じ情報設計で読める最小デザインを作成する。

2026-09-04 時点で、Core 公開関数 155 件、Server OpenAPI operation 109 件、Plugin descriptor 9 件、
日英ガイド 12 件を静的生成・収集し、一覧・詳細・Pagefind 検索を含む 575 ページの build を確認した。Vercel preview 用設定、Cloudflare
互換 header、canonical / hreflang、CI の `docs:check` も追加済み。世界各地からの実測と preview
上のブラウザ確認は実デプロイ後に行う。

### Phase 4: コンテンツ移行

- 既存文書を README、TSDoc、guide、横断文書へ分類する。
- コードから生成できる重複記述を削除する。
- 代表的なユーザーフローから操作ガイドを移行する。
- 旧 URL から新 URL への redirect map を作成する。

旧 Fumadocs の英語ページ 23 URL は `tooling/docs/migration.routes.json` に全件登録し、追加・削除の
取りこぼしと `ready` な転送先の存在を `docs:check` で検査する。現時点では 8 件を ready、
3 件を partial、12 件を pending としており、preview 承認前に website 側の redirect は有効化しない。

Server の旧公開ページ 6 URL はすべて移行先が ready になった。Server overview、installation、認証・
WebSocket 概念は `apps/server/docs` に日英ガイドとして置き、Topologies、Data Sources、Dashboards は
所有する UI route にガイドと typed journey をコロケーションした。UI journey は安定した
`data-doc-step` anchor との対応を生成時に検査する。9 種類の data source の capability、config、option
一覧は bundled plugin descriptor と Manual source descriptor から生成し、ガイドには設定表を重複して
書かない。実ブラウザでの journey 実行と redirect の有効化は preview 確認後に行う。

### Phase 5a: 公開前に必要なリリース整合性

- versioned docs artifact の schema を定義し、生成元、version、commit、生成器versionを記録する。
- `server-release.yml` の既存 stable / beta 判定を利用して、release tag の checkout から Server artifact を
  生成・検証・保存する。通常の機能 PR や `main` push では公開 alias を動かさない。
- exact version、stable、beta の対応を表す機械可読 manifest を release workflow から生成する。
- Astro は artifact と manifest を入力に、exact version page、stable 入口、beta 補助導線、version
  selector、prerelease banner、canonical metadata を静的生成する。
- Server UI の Docs リンクを、`GET /api/system` と同じ build version に対応する exact URL へ向ける。
- `docs:versions:check` で artifact のdigest、tagとversionの一致、aliasの参照先、source link、内部リンク、
  stable検索へのbeta混入を検査する。
- 公開 npm package reference も少なくとも release済みversionを表示し、未releaseの`main`と混同しない。

2026-09-04 時点で、Server artifact schema、入力とcontentのSHA-256検証、`next`とexact versionの静的
route、version selector、beta / development banner、version-scoped Pagefind filter、Server UIから実行中
versionへのDocsリンクを実装した。`server-release.yml`はrelease時にartifactを生成しGitHub Releaseへ
添付する。本番buildはopt-inでGitHub Release assetsから直近stableとbetaを収集し、aliasを導出する。
ローカルの`docs:check`はnetworkを使わず`next` artifactで同じschema、route、検索scopeを検証する。

未完了なのは、artifactを持つ実releaseを使ったVercel preview、本番projectへの
`SHUMOKU_DOCS_SERVER_RELEASES=github`設定、stable / beta aliasの実データ確認である。これらはdeploy前の
外部環境検証として扱い、コード側の生成経路とは分離する。

### Phase 5b: 必要に応じた履歴保持

- npm package ごとの独立version snapshotと`latest`をrelease flowへ統合する。
- Serverのactive buildに含めるstable世代数とbeta保持期間を決定する。
- 古いartifactのarchive、rollback、削除ポリシーを決定する。
- 過去版を含む検索は既定indexへ混ぜず、version選択中だけscopeする。

### Phase 6: 切り替え

- 検索、リンク、モバイル表示、アクセシビリティを検証する。
- 旧サイトとの主要ページ比較を行う。
- カスタムドメインを切り替える。
- 移行後に不要となる旧 docs 実装を削除する。

## 評価指標案

- 公開 API のドキュメント網羅率。
- 検証可能な example の割合。
- 通常の機能変更で編集が必要になった Markdown ファイル数。
- 一つの仕様について存在する canonical source の数。
- コードから生成される reference 情報の割合。
- Journey とガイド本文に重複して記載された操作手順数。
- 同じ機能変更内で日英を二重編集した回数。
- リリースから API ドキュメント公開までの時間。
- 壊れたリンク、存在しない操作、古いスクリーンショットの件数。
- CI の実行時間と flaky journey の割合。
- 主要タスクについて入口または検索から正しい guide / reference へ到達できる割合。

網羅率を目的化しすぎず、誤った説明や重複した説明を減らすことを優先する。

## リスク

### TypeDoc JSON への結合

TypeDoc の JSON schema 変更に追従する必要がある。TypeDoc のバージョン固定、adapter、fixture test で
影響を限定する。

### 独自 UI の保守コスト

既成 docs framework を使わないため、ナビゲーション、モバイル表示、アクセシビリティ、検索 UI
などを保守する必要がある。独自実装する範囲を最小化し、Astro と標準的な HTML を中心に構成する。

### Journey の不安定化

E2E テストとスクリーンショット生成は環境依存で不安定になる可能性がある。すべてのガイドを
ブラウザテスト対象にせず、重要な利用フローから適用する。

### コロケーションによる配布物への混入

公開 npm パッケージやアプリのビルド成果物へ guide や画像が不要に含まれないよう、package files、
tsconfig、build inputs を確認する。

### 文章の発見性

文書がリポジトリ内に分散すると、人間がファイルを探しにくくなる可能性がある。安定 ID、生成された
索引、検索コマンド、feature manifest などで補う。

### 過剰な強制

変更ファイルだけを根拠に手書き docs の更新を必須化すると false positive が増え、形式的な更新を誘発する。
実装から生成できる reference は自動生成し、手書き guide の必要性は CI の判定対象にしない。

## 未決事項

- ドキュメントの主な読者と優先する利用シナリオ。
- Web UI 全体を対象にするか、主要操作だけをガイド化するか。
- feature manifest をコードとして持つか、guide frontmatter だけで表現するか。
- 公開対象の日英ガイドについて、翻訳の陳腐化をどのように検出するか。
- 将来 API 日本語 overlay が必要になる判断基準。
- API リファレンスのバージョン保持期間。
- npm tarball、tag、artifact のどれをリリース文書の入力にするか。
- 操作ガイドのスクリーンショットを Git 管理するか、CI artifact として生成するか。
- Storybook を内部 UI カタログとして併用するか。
- 既存 URL と検索エンジン評価をどこまで維持するか。
- `llms.txt`、機械可読な API index、Markdown 表現をどこまで提供するか。
- 独自 Astro UI に必要なアクセシビリティ基準とテスト範囲。

## 次の議論で追加する事項

今後出てくる考慮事項は、次のいずれかへ分類して本書へ追加する。

- 利用者とユースケース
- コンテンツの source of truth
- AI が変更を発見する仕組み
- 自動生成と検証
- 多言語
- バージョニングとリリース
- 情報設計と UI
- ホスティングと運用
- 移行互換性
- セキュリティ、ライセンス、公開範囲
- パフォーマンスと CI コスト

## 現時点の仮説

現時点では、次の構成が最も有力である。

> Astro を独自の静的表示層として使用し、公開 API は TSDoc と TypeDoc JSON、パッケージ概要は
> README、操作説明は機能に隣接した Markdown、主要操作の検証と画像生成は Playwright journey を
> source of truth とする。Repository 全体から Docs Registry と関係 graph を生成し、コードから取得
> できる事実、関連リンク、逆参照を自動化する。公開コード内の説明は英語、メンテナー文書は日本語、
> 利用者向けガイドは日本語 canonical を許容する。通常の決定的な生成処理で reference を更新し、
> CI は生成可能性と既存参照の整合性だけを検証する。検索は locale 別の Pagefind index、配信は Cloudflare Pages を
> 初期構成とし、Astro は source of truth ではなく交換可能な静的表示層として扱う。

この仮説は、追加要件と技術スパイクの結果を受けて更新する。
