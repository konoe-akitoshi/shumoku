# Shumoku HP コンテキストメモ（日本語）

この文書は、Shumoku のホームページを作るときに参照するためのコンテキスト整理です。  
公開ページの完成原稿ではなく、Shumoku とは何か、各プロダクトが何を担うのか、どの説明がリポジトリ内ドキュメントと整合するのかをまとめたものです。

## 参照したドキュメント

### ルート直下

- `README.md`: Shumoku 全体の説明、価値、機能、構成。
- `ROADMAP.md`: ロードマップは best-effort であり、確約や納期ではない。
- `SUPPORT.md`: コミュニティサポートと商用サポートの境界。
- `COMMERCIAL_SUPPORT.md`: 商用サポートの範囲、プラグインポリシー、パートナー。
- `GOVERNANCE.md`: プロジェクトの意思決定、ロードマップ、パートナーの位置づけ。
- `SECURITY.md`: セキュリティ脆弱性の非公開報告導線。
- `CONTRIBUTING.md`: 貢献方法、Issue / Discussion / PR / DCO。
- `CODE_OF_CONDUCT.md`: コミュニティ行動規範。
- `TRADEMARK.md`: Shumoku 名称・ロゴ・パートナー表現の注意点。

### プロダクト / パッケージ

- `apps/server/README.md`
- `apps/server/docs/*.ja.mdx`
- `apps/editor/README.md`
- `apps/cli/README.md`
- `libs/@shumoku/core/README.md`
- `libs/shumoku/README.md`
- `libs/@shumoku/plugin-sdk/README.md`
- `libs/plugins/*/README.md`

---

# Shumoku 全体

## Shumoku とは

Shumoku は、ネットワーク構成を「現実からずれない、再生成できる地図」として扱うためのオープンソースプロジェクト。

ネットワーク図を、手で描いて古くなる静的な資料ではなく、YAML、NetBox、LLDP、SNMP、監視システムなどの実データから生成・更新できる運用ビューにすることを目指している。

## 中心になるメッセージ

- Network diagrams that don't drift away from reality.
- 構成図を、描いて古くなる資料から、実態に追従し続ける運用の地図へ。
- 現実のインフラから生成・更新できるネットワーク地図。
- ネットワークにも、地図が必要だ。
- 信頼できる構成図を。

## Shumoku が扱う課題

- 手書きの構成図は現実と乖離する。
- CMDB やインベントリの情報は気づかないうちに陳腐化する。
- 障害時に、正しい接続関係や影響範囲を把握しにくい。
- 監視画面と構成図が分離していると、状況判断に時間がかかる。
- 構成図が最新でないと、設計・構築・運用・障害対応の判断を誤らせる。

## Shumoku が提供する価値

- YAML、NetBox、ネットワークスキャン、独自 API などからトポロジーを生成できる。
- Zabbix、Prometheus、Grafana などのメトリクスやアラートをトポロジー上に重ねられる。
- 構成図を静的な資料ではなく、source of truth に近い運用ビューとして扱える。
- 設計、構築、運用、監視の文脈を同じトポロジー上でつなげられる。
- Markdown、ドキュメント、CI、Web アプリケーションへネットワーク図を組み込める。

## Shumoku の構成要素

| 領域 | 役割 | 主な利用者 |
| --- | --- | --- |
| Core | トポロジーのモデル、パーサ、レイアウト、plugin types を提供する中核ライブラリ | 開発者、組み込み利用者 |
| CLI / npm packages | YAML / JSON を SVG / HTML / PNG に変換し、ドキュメントや CI に組み込む | ドキュメント管理者、開発者 |
| Server | トポロジーにライブメトリクスやアラートを重ね、運用ダッシュボードとして使う | NOC、運用チーム、インフラチーム |
| Editor | 物理トポロジー、機器、モジュール、ケーブル、BOM を設計する | 設計者、構築担当、設備管理者 |

## 混同しないための前提

- Shumoku Server だけが Shumoku ではない。
- Shumoku Editor だけが Shumoku ではない。
- Core / CLI / renderers は、Shumoku をライブラリやドキュメント生成として使うための重要な入口。
- `Enterprise` は別製品名や有償版の名前ではない。
- 商用サポートは AGPL の利用権を変えるものではない。
- パートナー企業は Shumoku Project の開発方針やリリースを支配しない。

---

# 写真 / 画像素材

## 現状使用可能な写真

現状、リポジトリ内でホームページに使える実写写真は次の 2 点。

- `docs/slides/images/member-interop.jpg`
  - Interop での Shumoku 関連の展示・参加文脈に使える写真。
  - About、Community、Project background など、人の活動や現場感を出す用途に向いている。
- `docs/slides/images/member-interop-source.jpg`
  - `member-interop.jpg` の元画像として扱える写真。
  - 必要に応じてトリミング、明るさ調整、別比率の派生画像を作る元素材として使える。

## 現状使用可能な製品画像

ホームページの製品説明では、実写写真よりも製品画面のスクリーンショットを使うほうが内容と合いやすい箇所がある。

- `apps/docs/public/screenshots/topology.png`: トポロジービュー。
- `apps/docs/public/screenshots/dashboard.png`: ダッシュボード。
- `apps/docs/public/screenshots/alert.png`: アラート表示。
- `apps/docs/public/screenshots/wethermap.png`: Weathermap 表示。
- `apps/docs/public/screenshots/netbox.png`: NetBox 連携の説明。
- `apps/docs/public/screenshots/share.png`: 共有リンク。
- `apps/docs/public/screenshots/zoom.png`: インタラクティブ閲覧。
- `apps/docs/public/screenshots/demo.mp4`: 動きのある製品紹介に使える動画。

補足:

- `assets/screenshots/dashboard.png` と `assets/screenshots/topology.png` も存在する。
- ページ実装では、Next.js の public path で参照しやすい `apps/docs/public/screenshots/*` を優先すると扱いやすい。
- スクリーンショットは Server の説明と相性がよく、Shumoku 全体の思想や About には実写写真またはロゴを使うほうが自然。

## 現状使用可能なロゴ / ブランド画像

- `apps/docs/public/logo-horizontal.svg`: ヘッダーやフッター向けの横長ロゴ。
- `apps/docs/public/logo-symbol.svg`: アイコン、favicon 的な小さい表示、装飾的なブランド要素。
- `apps/docs/public/integrations/*.svg`: Grafana、NetBox、Prometheus、Zabbix の連携ロゴ。
- `apps/docs/public/adopters/*.png`: 採用・登壇・コミュニティ文脈で使えるロゴ。

## 必要に応じて追加できる素材

ページの方向性に応じて、次の素材を追加できる。

- Server の最新スクリーンショット: dashboard、topology、weathermap、alerts、data source 設定画面。
- Editor のスクリーンショット: 物理トポロジー設計、機器・モジュール・ケーブル、BOM、PoE analysis。
- 実写写真: 展示、イベント、導入現場、ネットワークラック、配線、NOC / 運用卓。
- パートナーロゴ: TelHi Corporation（輝日株式会社）など、掲載許可が取れたもの。
- 図解画像: Shumoku 全体、Server、Editor、Core / CLI / npm packages の関係を示す概念図。
- OGP / social preview 用画像: Shumoku のロゴ、製品画面、短いメッセージを組み合わせた共有向け画像。
# Core / CLI / npm packages

## Core

Core は、Shumoku の表示・レンダリング・連携の土台となるライブラリ。YAML / JSON / NetBox / LLDP / SNMP などの構造化データをネットワークトポロジーとして解釈し、読みやすい配置へ変換する。

主な役割:

- `NetworkGraph` のモデル定義。
- `Node`、`Link`、`Subgraph`、`Port`、`NetworkSettings` などの型を提供。
- YAML / multi-file topology のパース。
- `computeNetworkLayout()` による階層レイアウトの計算。
- `lightTheme` / `darkTheme` などのテーマ。
- icon ID や寸法 helpers。
- plugin types と plugin kit の提供。
- Server / Editor / renderer packages から再利用される共通基盤。

Core は render-agnostic で browser-safe。SVG / HTML / PNG は専用 renderer または all-in-one package の `shumoku` から出力する。

## CLI

`@shumoku/cli` は、NetworkGraph YAML または JSON を SVG、interactive HTML、PNG に変換するコマンドラインツール。

例:

```bash
npx @shumoku/cli render network.yaml -o diagram.svg
npx @shumoku/cli render network.yaml -f html -o diagram.html
npx @shumoku/cli render network.yaml -f png -o diagram.png --scale 3
```

主な用途:

- Markdown やドキュメントに構成図を入れる。
- CI で YAML から図を生成する。
- SVG / HTML / PNG の成果物を作る。
- JSON topology をレンダリングする。

## npm packages

`shumoku` は all-in-one package。`@shumoku/core`、HTML renderer、SVG renderer namespace をまとめて利用できる。

専用パッケージ:

- `@shumoku/core`: models、parser、layout、themes、plugin kit。
- `@shumoku/renderer-svg`: SVG render pipeline。
- `@shumoku/renderer-html`: interactive HTML output。
- `@shumoku/renderer-png`: PNG output。Node.js only。
- `@shumoku/renderer`: Svelte interactive renderer。
- `@shumoku/catalog`: device / service catalog。
- `@shumoku/plugin-sdk`: plugin 向け HTTP client と pagination helper。

---

# Shumoku Server

## Server の位置づけ

Shumoku Server は、Shumoku を運用現場で使うためのセルフホスト型 Web アプリケーション。トポロジーを監視スタックのリアルタイムメトリクスやアラートと組み合わせ、ライブな運用ダッシュボードに変換する。

構成:

- API: Bun + Hono。HTTP + WebSocket、SQLite、data-source plugin loader。
- Web UI: SvelteKit single-page UI。
- データ保存: SQLite。
- デプロイ: Docker、Docker Compose、Kubernetes / Helm、systemd、manual。

## Server でできること

- トポロジーの作成・編集・管理。
- YAML ファイルのアップロード。
- ビルトインエディタでの YAML 編集。
- データソース接続。
- リンク使用率やノード状態のリアルタイム更新。
- アクティブアラートのトポロジー上への表示。
- 複数トポロジーやメトリクスウィジェットを組み合わせたダッシュボード。
- トークン付き読み取り専用共有リンク。
- WebSocket によるリアルタイムメトリクス配信。

## Server の主要機能

### Live Weathermap

リンクのトラフィック使用率を負荷に応じて色分け表示する。リアルタイムメトリクスを使って、どこに通信が集中しているかを地図上で把握できる。

関連画像:

- `/screenshots/wethermap.png`
- `/screenshots/topology.png`

### Alert Overlay

Zabbix、Prometheus / Alertmanager、Grafana から取得したアクティブアラートをトポロジー上に表示する。障害や警告を、機器やリンクの位置関係と合わせて確認できる。

関連画像:

- `/screenshots/alert.png`

### Dashboard

複数のトポロジーやメトリクスウィジェットを 1 つのビューにまとめられる。Topology、Device Status、Alerts などのウィジェットを配置し、NOC や運用チーム向けの監視画面を作れる。

関連画像:

- `/screenshots/dashboard.png`

### Share Link

トポロジーやダッシュボードを、トークン付きの読み取り専用リンクとして共有できる。リンクを持つ人はログインなしで閲覧できる。

関連画像:

- `/screenshots/share.png`

### Interactive Viewer

ブラウザ上でパン、ズーム、ドリルダウンが可能。大きなネットワークも階層化して閲覧できる。

関連画像:

- `/screenshots/zoom.png`

## Server のデータソース

Shumoku Server はプラグインアーキテクチャを採用している。各データソースはプラグインとして追加・管理される。設定フォームは各プラグインの `configSchema` から汎用的に生成される。

### YAML

トポロジーをコードで定義する built-in 入力。単一 YAML のほか、サブグラフの `file:` 参照を使う multi-file topology も扱える。

### NetBox

DCIM / IPAM からデバイス、VM、インターフェース、ケーブルを取得してトポロジーを生成する。site、tag、role、location などによる filtering に対応する。

Capabilities:

- topology
- hosts

### Zabbix

Zabbix JSON-RPC API から、device inventory、interface traffic、LLDP-derived topology、trigger events を取得する。

Capabilities:

- topology: hosts + LLDP neighbor items から NetworkGraph を構築。
- hosts: Zabbix hosts、management IP、interfaces、discoverable metrics。
- metrics: node health、link traffic。
- alerts: trigger events を neutral `AlertSeverity` scale に mapping。

### Prometheus

Prometheus から link / node metrics を取得し、label values から hosts を発見し、Alertmanager から alerts を読む。

Capabilities:

- metrics: node up/down、link traffic。
- hosts: label から hosts を discovery。
- alerts: Alertmanager API から active / resolved alerts。

Presets:

- `snmp`
- `node_exporter`
- `custom`

### Grafana

Grafana alerts を topology 上に表示する。bundled Alertmanager を polling するか、Grafana contact point から webhook を受ける。

Capabilities:

- alerts

### Aruba Instant On

Aruba Instant On cloud portal から access points、switches、per-device metrics、site alerts を取得する。非公式の `portal.arubainstanton.com` API を使用する。

Capabilities:

- hosts
- metrics
- alerts

補足:

- Portal account は MFA が無効である必要がある。
- 非公式 API のため upstream changes による失敗を検知しやすくしている。

### Network Scan

Active network discovery plugin。SNMP と LLDP によって seed crawl し、System-MIB、IF-MIB、LLDP-MIB から devices、ports、neighbors を収集する。上流の inventory がなくても topology を発見できる。

Capability:

- autoscan

補足:

- inventory plugins の `topology` ではなく、`autoscan` を実装する。
- `scan(input) -> Snapshot` を返す一回限りの crawl。

## Server のデプロイ

公開 Docker image を使うのが最短。clone 不要で起動できる。

```bash
docker run -d -p 8080:8080 -v shumoku-data:/data ghcr.io/konoe-akitoshi/shumoku:latest
```

起動後、`http://localhost:8080` を開き、管理者パスワードを設定する。

サンプルネットワークを投入して試す場合:

```bash
docker run -d -p 8080:8080 -e DEMO_MODE=true ghcr.io/konoe-akitoshi/shumoku:latest
```

本番では `latest` ではなく、正確な `X.Y.Z` タグを pin する。

その他のデプロイ:

- Docker Compose
- Kubernetes / Helm
- systemd
- 手動デプロイ
- nginx などのリバースプロキシ
- SQLite ファイルのバックアップ / リストア

---

# Shumoku Editor

## Editor の位置づけ

Shumoku Editor は、物理ネットワークトポロジーを設計するためのビジュアルエディタ。Server が運用・監視のためのアプリであるのに対し、Editor は設計・構築・部材管理に寄ったアプリ。

Status:

- early and under active development

## Editor でできること

- プロジェクト管理。
- ダイアグラムキャンバスでの配置・配線。
- 機器、モジュール、ケーブル、数量、仕様の管理。
- BOM（部材表）の派生。
- PoE power budget の分析。
- `.neted` プロジェクトファイルの import / export。
- `.yaml` / `.json` network definition の import。

## Editor の技術構成

- SvelteKit + Svelte 5。
- `@xyflow/svelte` による graph canvas。
- Tailwind CSS。
- Vite。
- Rendering と layout は shared Shumoku engine を再利用。
- Project data は browser IndexedDB に保存。
- Preview deployments と Production deployments は Vercel で管理。

## Editor の説明で使える要素

- 物理ネットワークトポロジーの設計。
- devices、modules、cables を first-class product として扱う。
- BOM を topology から派生する。
- PoE analysis につなげる。
- `.neted` portable project file を export / import できる。

---

# About / Origin / Philosophy

## About の位置づけ

About は製品機能の説明ではなく、Shumoku の名前、ロゴ、思想を伝えるための背景情報。

## 名前の由来

shumoku という名前は、実家のお茶室で見た喚鐘に由来しています。あるとき、ぼんやりとお茶室に座って、天井から吊り下げられた喚鐘を眺めていました。その喚鐘を支えている吊り具は三猿の形をしていて、複数の点が結ばれ、全体としてひとつの構造を成しているように見えました。それは、どこかネットワークトポロジーに似ていました。ネットワークは機器がただ並んでいるだけではなく、機器と機器のあいだには接続があり、経路があり、依存関係があり、見えない秩序があります。その関係性を見える形にしたものが、ネットワークトポロジーです。

喚鐘は、茶会の始まりを告げるために鳴らされます。音が響くことで場が始まる。人が集まり、意識が切り替わり、茶会という時間が立ち上がる。ネットワークトポロジーも、それに近いものだと考えています。トポロジーがあることで、構築が始まり、監視が始まり、運用が始まります。

喚鐘を鳴らす道具は撞木、そしてその撞木を掛けておく金具が撞木釘です。shumoku という名前は、そこから生まれました。shumoku は、ネットワークそのものを直接動かす道具ではありません。けれど、ネットワークの構成情報、監視情報、インベントリ、メトリクス、そして接続の関係性を、必要なときに扱える形で支えるためのものです。撞木釘が撞木を静かに支えるように、shumoku はネットワーク運用の始まりを支える小さな基点でありたいと考えています。

## ロゴの由来

shumoku のロゴは、ガブリエルの羽をモチーフにしています。

ネットワークトポロジーは、人が恣意的に作り出すものではありません。機器と機器の接続、経路、依存関係として、それはすでにそこに存在している構造です。ただ、その姿は多くの場合、目に見えないまま、複雑な構成の奥に隠れています。ネットワーク図は、その見えざる構造を読み取り、運用者の前に示すためのものです。構造を作ることではなく、すでに存在している関係性に輪郭を与えること。混沌のように見える構成の中から、そこにあった秩序を見出すこと。見えなかったものを、見える形へと降ろすことです。

この感覚は、どこか「告知」に似ています。天使は、まだ人々の目には見えていない始まりを告げます。すでに起こっていること、しかしまだ知られていないことを、人の前に示す。それは単なる情報ではなく、世界の見方を変える知らせです。ネットワーク図もまた、ネットワークの中にすでに存在している真実を告げるものです。どの機器がつながっているのか、どの経路が使われているのか、どこに依存関係があるのか。それらは図が生み出すものではなく、図によって初めて人の前に示されるものです。

shumoku の羽は、その告知の象徴です。派手に主張するための羽ではなく、見えざる構造が静かに示される瞬間を表す羽。図は構造を作るのではなく、すでにある構造に輪郭を与えるしるしでありたい、という思想を込めています。

## 思想

> 構成図を、描いて古くなる資料から、実態に追従し続ける運用の地図へ。
>
> Network diagrams that don't drift away from reality.

WiFi は天から降ってくるわけではありません。私たちが日々あたりまえのように使う通信の裏には、ケーブルとスイッチとルータと配線でできた、地に足のついた構造があります。誰かが設計し、敷設し、維持している現実のインフラです。インフラは「ある」。地にある。だからこそ、見えたほうがいい。見えない構造は、理解されず、信頼されず、いざというとき頼れません。

ネットワーク構成図は、単なる資料ではありません。機器の接続関係・通信経路・依存関係・障害の影響範囲を理解するための地図であり、設計・構築・運用・障害対応において人が頼りにするものです。しかし現実の構成図は手作業で作られ、構成変更のたびに更新が必要になり、やがて更新が追いつかず実態とずれた図が残ります。ずれた図は、かえって判断を誤らせます。必要なのは、ただ線が引かれた図ではなく、把握でき、信頼でき、更新できる地図です。

Shumoku が目指す地図の条件:

- 把握できる: 全体像と接続関係が一目で読み取れる。
- 信頼できる: 実ネットワークに基づく source of truth である。
- 更新できる: 構成変更に追従し、継続的に再生成できる。

設計原則:

- Readable: 人間が読める・美しい・構造がわかる（最優先）。
- Reproducible: YAML / JSON / Git / CI で再生成できる（Diagram as Code）。
- Reality-aware: NetBox・LLDP・SNMP・API など実態に近い情報を使う。
- Source-agnostic: 特定の情報源に閉じない。
- Operational: NOC・監視・障害対応・共有で使える。
- Extensible: plugins・vendor catalog・templates で広げられる。

---

# 商用サポート

## 基本方針

Shumoku は AGPL-3.0 のオープンソースソフトウェア。利用にあたって商用契約は不要。商用サポートは、ソフトウェア利用権とは別に提供される、組織向けの有償サービス。

## コミュニティサポートと商用サポート

| 内容 | 窓口 |
| --- | --- |
| 再現可能なバグ報告、一般的な質問、機能要望、ドキュメント改善など、公開の場で議論でき、プロジェクト全体の利益になるもの | コミュニティ — GitHub Issues / Discussions / Discord |
| 特定環境の調査、非公開サポート、応答保証、期限、優先実装、要件対応の開発 | 商用 — contact@shumoku.dev |

GitHub での機能要望は歓迎。ただし、実装するかどうか・いつ・どの順序でかは、プロジェクトの方向性、ロードマップ、メンテナンス性に基づき Shumoku Project が判断する。特定の期限で特定の成果が必要な場合は商用の対象。

## 商用サポートの範囲

- 導入・運用支援: お客様の環境での Shumoku Server（および Editor）のインストールと運用。
- データソース連携: NetBox・Zabbix・Prometheus・Grafana 等との接続の調査・設定。監視側の設定確認を含む場合がある。
- 環境固有マッピング: トポロジー・メトリクス・アラートのマッピングを、お客様のネットワークと運用に合わせて調整。
- カスタムプラグイン開発: OSS プロジェクトが対応していないデータソース向けの連携を開発。
- 優先対応・期限付き対応: 合意した期間内で特定のバグ・機能を優先して対応。
- PoC 支援: 要件に対する Shumoku の評価を支援。
- 運用設計・継続サポート: 運用への組み込みに関するコンサルティングと、導入後の継続的なサポート。

## プラグインポリシー

- バンドル OSS プラグイン: リポジトリで保守（zabbix、prometheus、netbox、grafana、aruba-instant-on、network-scan）。コミュニティサポートの対象。
- コミュニティプラグイン: 公開プラグイン契約を使って誰でも独立して開発・公開できる。作者が保守する。
- 商用開発プラグイン: 特定組織のための商用開発。非公開のまま提供される場合もあり、OSS 化するかはケースバイケースで判断。

## 導入を支えるパートナー

Shumoku の導入、運用設計、データソース連携を支援するパートナー。

ロゴ掲載予定:

- TelHi Corporation（輝日株式会社）

対応領域に応じて、今後もパートナーを追加していく予定。Shumoku 本体の開発・リリースは Shumoku Project が行う。

## 支払いについて

商用サポートへの支払いはサービスの対価。AGPL-3.0 のライセンス条件を変更するものではなく、プロジェクトの方針への影響力を購入するものでもない。

---

# コミュニティ / プロジェクト情報

## コミュニティ参加

Shumoku は AGPL-3.0 のオープンソースプロジェクト。利用者、運用者、開発者からのフィードバック、Issue、Pull Request、ドキュメント改善を歓迎している。

導線:

- バグ報告: GitHub Issues
- 機能要望: GitHub Issues / Discussions
- 質問・相談: GitHub Discussions / Discord
- コード・ドキュメント改善: Pull Request

## セキュリティ

セキュリティ脆弱性は公開 Issue ではなく、GitHub Security Advisory または `contact@shumoku.dev` へ非公開で報告する。

## プロジェクト情報リンク

- Contributing: `CONTRIBUTING.md`
- Code of Conduct: `CODE_OF_CONDUCT.md`
- Security: `SECURITY.md`
- Governance: `GOVERNANCE.md`
- Roadmap: `ROADMAP.md`
- Support: `SUPPORT.md`
- Commercial Support: `COMMERCIAL_SUPPORT.md`
- Brand Guidelines: `TRADEMARK.md`

---

# FAQ 素材

## 無料ですか？

Shumoku は AGPL-3.0 のオープンソースです。無料で利用でき、商用契約は不要です。本番導入向けに有償サポート・コンサルティング・カスタム開発を提供しています。

## AGPL-3.0 は商用利用できますか？

AGPL-3.0 の条件に従って利用できます。商用サポートを受けることは、AGPL-3.0 の条件を変更するものではありません。AGPL-3.0 が合わない具体的な事情がある場合は個別に相談してください。

## PHP Weathermap との違いは？

トポロジーファースト UI、多階層ナビ、900+ ベンダーアイコン、ネイティブ連携。Grafana に依存せず、トポロジー、メトリクス、アラート、共有ビューを Shumoku Server の中で扱える。

## 監視ツールなしでも使える？

はい。YAML や NetBox、ネットワークスキャンなどからトポロジーを生成し、スタンドアロンのトポロジービューアとして利用できます。監視連携はオプションです。

## エンタープライズサポートは？

公開できるバグ報告・質問・機能要望は GitHub でのコミュニティサポートです。特定環境の調査、非公開サポート、応答保証、期限付き対応、カスタム開発は商用サポートの対象です。導入支援は Shumoku Project とパートナー企業が連携して対応します。

## Shumoku Server と Editor の違いは？

Server は運用・監視のためのセルフホスト型 Web アプリケーション。Editor は物理トポロジー、機器、モジュール、ケーブル、BOM を扱う設計ツール。

## NetBox がなくても使えますか？

使えます。YAML でトポロジーを定義できるほか、Network Scan による SNMP + LLDP discovery、Zabbix の LLDP topology、custom plugin などの選択肢があります。

## Zabbix / Prometheus がなくても使えますか？

使えます。監視連携なしでも topology viewer として利用できます。リアルタイムメトリクスやアラート表示には監視データソースが必要です。

---

# CTA / リンク素材

## Primary CTA 素材

- サーバーを導入
- Docker で試す
- デモを見る
- トポロジーを作る
- Playground で試す

## Secondary CTA 素材

- GitHub
- Docs
- Editor を開く
- 商用サポートに相談
- 設計思想を読む

## URL / 連絡先

- Docs: `/ja/docs/server`
- Server installation: `/ja/docs/server/installation`
- Editor: `https://editor.shumoku.dev/`
- GitHub: `https://github.com/konoe-akitoshi/shumoku`
- Discord: `https://discord.gg/dyYbEsDZYr`
- X: `https://x.com/shumoku_dev`
- Email: `mailto:contact@shumoku.dev`