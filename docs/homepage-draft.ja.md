# Shumoku HP コンテキストメモ（日本語）

Shumoku のホームページを作るときに参照する**コンテキスト（事実）の整理**。公開ページの完成原稿ではない。

情報を 3 種類に分けて扱う。混ぜない。

- **事実（本体・§1〜§6）**: 正本（リポジトリ内文書）に基づく知識。文言・範囲に相違が出たら常に正本を優先する。
- **コピー候補（付録A）**: HP に載せる文言のドラフト。事実ではなく、本体から導いた出力。確定前にレビューする。
- **参照素材（付録B）**: 画像・リンクなどの一覧。

---

# §0 正本マップ（どの情報がどの文書に基づくか）

本メモの各記述は、次のリポジトリ内文書を正本とする。相違時は正本が正。

| 情報領域 | 正本 |
| --- | --- |
| 全体像・価値・機能・構成 | `README.md` |
| 名前・ロゴ・思想の由来 | `docs/ORIGIN.md` |
| コミュニティ／商用サポートの境界 | `SUPPORT.md` |
| 商用範囲・プラグインポリシー・パートナー | `COMMERCIAL_SUPPORT.md` |
| 意思決定・ガバナンス・パートナーの位置づけ | `GOVERNANCE.md` |
| ロードマップ（best-effort、確約ではない） | `ROADMAP.md` |
| セキュリティ脆弱性の報告導線 | `SECURITY.md` |
| 貢献フロー（Issue / Discussion / PR / DCO） | `CONTRIBUTING.md` |
| コミュニティ行動規範 | `CODE_OF_CONDUCT.md` |
| 名称・ロゴ・パートナー表現の注意 | `TRADEMARK.md` |
| Server の機能・設定・デプロイ | `apps/server/README.md`、`apps/server/docs/*.ja.mdx` |
| Editor | `apps/editor/README.md` |
| CLI | `apps/cli/README.md` |
| Core / ライブラリ API | `libs/@shumoku/core/README.md`、`libs/shumoku/README.md` |
| プラグイン各種 / SDK | `libs/plugins/*/README.md`、`libs/@shumoku/plugin-sdk/README.md` |

---

# §1 アイデンティティ（Shumoku とは）

## 一言でいうと

Shumoku は、ネットワーク構成を「現実からずれない、再生成できる地図」として扱うためのオープンソースプロジェクト。

手で描いて古くなる静的な資料ではなく、YAML・NetBox・LLDP・SNMP・監視システムなどの実データから生成・更新できる運用ビューにすることを目指す。

## 解く課題

- 手書きの構成図は現実と乖離する。
- CMDB やインベントリの情報は気づかないうちに陳腐化する。
- 障害時に、正しい接続関係や影響範囲を把握しにくい。
- 監視画面と構成図が分離していると、状況判断に時間がかかる。
- 構成図が最新でないと、設計・構築・運用・障害対応の判断を誤らせる。

## 提供価値

- YAML・NetBox・ネットワークスキャン・独自 API などからトポロジーを生成できる。
- Zabbix・Prometheus・Grafana などのメトリクスやアラートをトポロジー上に重ねられる。
- 構成図を静的な資料ではなく、source of truth に近い運用ビューとして扱える。
- 設計・構築・運用・監視の文脈を同じトポロジー上でつなげられる。
- Markdown・ドキュメント・CI・Web アプリケーションへネットワーク図を組み込める。

## ポジショニング（混同しないための前提）

- Shumoku Server だけが Shumoku ではない。Editor だけでもない。
- Core / CLI / renderers は、Shumoku をライブラリやドキュメント生成として使うための重要な入口。
- `Enterprise` は別製品名でも有償版の名前でもない。
- 商用サポートは AGPL の利用権を変えるものではない。
- パートナー企業は Shumoku Project の開発方針やリリースを支配しない。

---

# §2 プロダクト構成（ドメインモデル）

## 全体マップ

| 領域 | 役割 | 主な利用者 |
| --- | --- | --- |
| Core | トポロジーのモデル、パーサ、レイアウト、plugin types を提供する中核ライブラリ | 開発者、組み込み利用者 |
| CLI / npm packages | YAML / JSON を SVG / HTML / PNG に変換し、ドキュメントや CI に組み込む | ドキュメント管理者、開発者 |
| Server | トポロジーにライブメトリクスやアラートを重ね、運用ダッシュボードとして使う | NOC、運用チーム、インフラチーム |
| Editor | 物理トポロジー、機器、モジュール、ケーブル、BOM を設計する | 設計者、構築担当、設備管理者 |

## Core

Shumoku の表示・レンダリング・連携の土台となるライブラリ。YAML / JSON / NetBox / LLDP / SNMP などの構造化データをネットワークトポロジーとして解釈し、読みやすい配置へ変換する。

主な役割:

- `NetworkGraph` のモデル定義。
- `Node`・`Link`・`Subgraph`・`Port`・`NetworkSettings` などの型を提供。
- YAML / multi-file topology のパース。
- `computeNetworkLayout()` による階層レイアウトの計算。
- `lightTheme` / `darkTheme` などのテーマ。
- icon ID や寸法 helpers。
- plugin types と plugin kit の提供。
- Server / Editor / renderer packages から再利用される共通基盤。

Core は render-agnostic で browser-safe。SVG / HTML / PNG は専用 renderer または all-in-one package の `shumoku` から出力する。

## CLI

`@shumoku/cli` は、NetworkGraph YAML または JSON を SVG・interactive HTML・PNG に変換するコマンドラインツール。

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

## npm パッケージ

`shumoku` は all-in-one package。`@shumoku/core`、HTML renderer、SVG renderer namespace をまとめて利用できる。

専用パッケージ:

- `@shumoku/core`: models、parser、layout、themes、plugin kit。
- `@shumoku/renderer-svg`: SVG render pipeline。
- `@shumoku/renderer-html`: interactive HTML output。
- `@shumoku/renderer-png`: PNG output。Node.js only。
- `@shumoku/renderer`: Svelte interactive renderer。
- `@shumoku/catalog`: device / service catalog。
- `@shumoku/plugin-sdk`: plugin 向け HTTP client と pagination helper。

## Server

### 位置づけと技術構成

Shumoku を運用現場で使うためのセルフホスト型 Web アプリケーション。トポロジーを監視スタックのリアルタイムメトリクスやアラートと組み合わせ、ライブな運用ダッシュボードに変換する。

- API: Bun + Hono。HTTP + WebSocket、SQLite、data-source plugin loader。
- Web UI: SvelteKit single-page UI。
- データ保存: SQLite。
- デプロイ: Docker、Docker Compose、Kubernetes / Helm、systemd、manual。

### できること

- トポロジーの作成・編集・管理。
- YAML ファイルのアップロード / ビルトインエディタでの YAML 編集。
- データソース接続。
- リンク使用率やノード状態のリアルタイム更新。
- アクティブアラートのトポロジー上への表示。
- 複数トポロジーやメトリクスウィジェットを組み合わせたダッシュボード。
- トークン付き読み取り専用共有リンク。
- WebSocket によるリアルタイムメトリクス配信。

### 主要機能

- **Live Weathermap**: リンクのトラフィック使用率を負荷に応じて色分け表示。どこに通信が集中しているかを地図上で把握できる。
- **Alert Overlay**: Zabbix・Prometheus / Alertmanager・Grafana から取得したアクティブアラートをトポロジー上に表示。障害や警告を機器・リンクの位置関係と合わせて確認できる。
- **Dashboard**: 複数のトポロジーやメトリクスウィジェット（Topology、Device Status、Alerts など）を 1 ビューにまとめ、NOC / 運用チーム向けの監視画面を作れる。
- **Share Link**: トポロジーやダッシュボードをトークン付き読み取り専用リンクで共有。リンクを持つ人はログインなしで閲覧できる。
- **Interactive Viewer**: ブラウザ上でパン・ズーム・ドリルダウン。大きなネットワークも階層化して閲覧できる。

（各機能に対応するスクリーンショットは付録B「素材カタログ」を参照。）

### データソース（プラグイン）

プラグインアーキテクチャを採用。各データソースはプラグインとして追加・管理され、設定フォームは各プラグインの `configSchema` から汎用生成される。

| プラグイン | capabilities | 概要 |
| --- | --- | --- |
| YAML | topology | トポロジーをコードで定義する built-in 入力。単一 YAML のほか、サブグラフの `file:` 参照による multi-file topology も扱える。 |
| NetBox | topology / hosts | DCIM / IPAM からデバイス・VM・インターフェース・ケーブルを取得。site / tag / role / location などで filtering。 |
| Zabbix | topology / hosts / metrics / alerts | JSON-RPC API から取得。topology は hosts + LLDP neighbor items から NetworkGraph を構築。alerts は trigger events を neutral `AlertSeverity` にマッピング。 |
| Prometheus | metrics / hosts / alerts | link / node metrics を取得、label values から hosts を発見、Alertmanager から active / resolved alerts。presets: `snmp` / `node_exporter` / `custom`。 |
| Grafana | alerts | Grafana alerts を topology 上に表示。bundled Alertmanager を polling するか contact point から webhook を受ける。 |
| Aruba Instant On | hosts / metrics / alerts | 非公式の `portal.arubainstanton.com` API から access points・switches・per-device metrics・site alerts を取得。Portal account は MFA 無効が必要。 |
| Network Scan | autoscan | SNMP + LLDP で seed crawl し、System-MIB / IF-MIB / LLDP-MIB から devices・ports・neighbors を収集。上流 inventory がなくても topology を発見できる。`scan(input) -> Snapshot` の一回限りの crawl。 |

補足:

- Aruba は非公式 API のため、upstream changes による失敗を検知しやすくしている。
- Network Scan は inventory plugins の `topology` ではなく `autoscan` を実装する。

### デプロイ

公開 Docker image を使うのが最短（clone 不要）。

```bash
docker run -d -p 8080:8080 -v shumoku-data:/data ghcr.io/konoe-akitoshi/shumoku:latest
```

起動後 `http://localhost:8080` を開き、管理者パスワードを設定する。サンプル投入は `-e DEMO_MODE=true`。本番では `latest` ではなく正確な `X.Y.Z` タグを pin する。

その他: Docker Compose / Kubernetes・Helm / systemd / 手動 / nginx 等のリバースプロキシ / SQLite ファイルのバックアップ・リストア。

## Editor

### 位置づけ

物理ネットワークトポロジーを設計するためのビジュアルエディタ。Server が運用・監視のためのアプリであるのに対し、Editor は設計・構築・部材管理に寄る。ステータス: early and under active development。

### できること

- プロジェクト管理。
- ダイアグラムキャンバスでの配置・配線。
- 機器・モジュール・ケーブル・数量・仕様の管理。
- BOM（部材表）の派生。
- PoE power budget の分析。
- `.neted` プロジェクトファイルの import / export。
- `.yaml` / `.json` network definition の import。

### 技術構成

- SvelteKit + Svelte 5。
- `@xyflow/svelte` による graph canvas。
- Tailwind CSS / Vite。
- Rendering と layout は shared Shumoku engine を再利用。
- Project data は browser IndexedDB に保存。
- Preview / Production deployments は Vercel。

---

# §3 ライセンスと商用モデル

> 正本は `SUPPORT.md` / `COMMERCIAL_SUPPORT.md`。以下は要約。連絡先 `contact@shumoku.dev` は将来 `support@shumoku.dev` へ移行予定（両文書に TODO あり）。

## 基本方針

Shumoku は AGPL-3.0 のオープンソースソフトウェア。利用にあたって商用契約は不要。商用サポートは、ソフトウェア利用権とは別に提供される、組織向けの有償サービス。支払いはサービスの対価であり、AGPL-3.0 の条件を変えるものでも、プロジェクトの方針への影響力を買うものでもない。

## コミュニティ／商用の境界

| 内容 | 窓口 |
| --- | --- |
| 再現可能なバグ報告、一般的な質問、機能要望、ドキュメント改善など、公開の場で議論でき、プロジェクト全体の利益になるもの | コミュニティ — GitHub Issues / Discussions / Discord |
| 特定環境の調査、非公開サポート、応答保証、期限、優先実装、要件対応の開発 | 商用 — contact@shumoku.dev |

GitHub での機能要望は歓迎。ただし実装するか・いつ・どの順序かは、方向性・ロードマップ・メンテナンス性に基づき Shumoku Project が判断する。特定の期限で特定の成果が必要な場合は商用の対象。

## 商用サポートの範囲

- 導入・運用支援: お客様の環境での Server（および Editor）のインストールと運用。
- データソース連携: NetBox・Zabbix・Prometheus・Grafana 等との接続の調査・設定（監視側の設定確認を含む場合がある）。
- 環境固有マッピング: トポロジー・メトリクス・アラートのマッピングを、お客様のネットワークと運用に合わせて調整。
- カスタムプラグイン開発: OSS が対応していないデータソース向けの連携。
- 優先対応・期限付き対応: 合意期間内で特定のバグ・機能を優先対応。
- PoC 支援 / 運用設計・継続サポート。

## プラグインポリシー

- バンドル OSS プラグイン: リポジトリで保守（zabbix、prometheus、netbox、grafana、aruba-instant-on、network-scan）。コミュニティサポートの対象。
- コミュニティプラグイン: 公開プラグイン契約を使って誰でも独立して開発・公開できる。作者が保守。
- 商用開発プラグイン: 特定組織のための商用開発。非公開のまま提供される場合もあり、OSS 化はケースバイケース。

## パートナー

Shumoku の導入・運用設計・データソース連携を支援するパートナー。ロゴ掲載予定: TelHi Corporation（輝日株式会社）。今後も対応領域に応じて追加予定。本体の開発・リリースは Shumoku Project が行う。

---

# §4 プロジェクト / ガバナンス / コミュニティ

## コミュニティ参加

AGPL-3.0 のオープンソースプロジェクト。利用者・運用者・開発者からのフィードバック、Issue、Pull Request、ドキュメント改善を歓迎。

- バグ報告: GitHub Issues
- 機能要望: GitHub Issues / Discussions
- 質問・相談: GitHub Discussions / Discord
- コード・ドキュメント改善: Pull Request

## セキュリティ

セキュリティ脆弱性は公開 Issue ではなく、GitHub Security Advisory または `contact@shumoku.dev` へ非公開で報告する。

## ガバナンス要点

- ロードマップは best-effort であり、確約や納期ではない（`ROADMAP.md`）。
- 開発方針・リリースの決定権は Shumoku Project にあり、パートナー企業は支配しない（`GOVERNANCE.md`）。

## リンク集

プロジェクト文書:

- Contributing: `CONTRIBUTING.md`
- Code of Conduct: `CODE_OF_CONDUCT.md`
- Security: `SECURITY.md`
- Governance: `GOVERNANCE.md`
- Roadmap: `ROADMAP.md`
- Support: `SUPPORT.md`
- Commercial Support: `COMMERCIAL_SUPPORT.md`
- Brand Guidelines: `TRADEMARK.md`

外部 URL / 連絡先:

- Docs: `/ja/docs/server`
- Server installation: `/ja/docs/server/installation`
- Editor: `https://editor.shumoku.dev/`
- GitHub: `https://github.com/konoe-akitoshi/shumoku`
- Discord: `https://discord.gg/dyYbEsDZYr`
- X: `https://x.com/shumoku_dev`
- Email: `mailto:contact@shumoku.dev`

---

# §5 ブランド / 由来 / 思想

About は製品機能の説明ではなく、Shumoku の名前・ロゴ・思想を伝えるための背景情報。

> **由来の正本は `docs/ORIGIN.md`。** HP の About / Origin はこの文書を基に構成し、本文はここに複製しない（複製すると正本と drift する）。以下は制作時に押さえる要点のみ。

## 名前の由来（要点）

- `shumoku`（撞木釘）は、茶室で喚鐘を吊る金具の名。喚鐘を鳴らす撞木を静かに支える基点。
- shumoku はネットワークそのものを直接動かす道具ではなく、構成情報・監視情報・インベントリ・メトリクス・接続関係を「必要なときに扱える形」で支える存在になぞらえている。
- 喚鐘が茶会の始まりを告げるように、トポロジーが示されて初めて構築・監視・運用が始まる。

## ロゴの由来（要点）

- ロゴはガブリエルの羽（＝「告知」の象徴）がモチーフ。
- ネットワークトポロジーは人が恣意的に作るものではなく、接続・経路・依存としてすでにそこに在る構造。図はそれを生み出すのではなく、見えざる構造に輪郭を与え「しるし」として人の前に示す。
- 羽は、派手に主張するためではなく、構造が静かに示される瞬間を表す。

## 思想と設計原則

思想（`docs/ORIGIN.md` および README のナラティブ）: ネットワークインフラは目に見えないが確かに「ある」。見えない構造は理解されず、信頼されず、いざというとき頼れない。だから見えたほうがいい。構成図は資料ではなく、設計・構築・運用・障害対応で人が頼る地図であるべきで、手作業で古びてずれた図はかえって判断を誤らせる。

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

# 付録A: コピー候補（HP 文言のドラフト）

> ここは**事実ではなく出力**。上の §1〜§5 から導いた文言のたたき台。ページに載せる前にレビュー・取捨選択する。

## メッセージ / タグライン

- Network diagrams that don't drift away from reality.
- 構成図を、描いて古くなる資料から、実態に追従し続ける運用の地図へ。
- 現実のインフラから生成・更新できるネットワーク地図。
- ネットワークにも、地図が必要だ。
- 信頼できる構成図を。

## FAQ

- **無料ですか？** — AGPL-3.0 のオープンソース。無料で利用でき、商用契約は不要。本番導入向けに有償サポート・コンサルティング・カスタム開発を提供。
- **AGPL-3.0 は商用利用できますか？** — 条件に従って利用できる。商用サポートを受けても AGPL-3.0 の条件は変わらない。合わない具体的な事情があれば個別相談。
- **PHP Weathermap との違いは？** — トポロジーファースト UI、多階層ナビ、900+ ベンダーアイコン、ネイティブ連携。Grafana に依存せず、トポロジー・メトリクス・アラート・共有ビューを Server の中で扱える。
- **監視ツールなしでも使える？** — はい。YAML・NetBox・ネットワークスキャンなどからトポロジーを生成し、スタンドアロンのトポロジービューアとして利用できる。監視連携はオプション。
- **エンタープライズサポートは？** — 公開できるバグ報告・質問・機能要望は GitHub のコミュニティサポート。特定環境の調査・非公開サポート・応答保証・期限付き対応・カスタム開発は商用の対象。導入支援は Shumoku Project とパートナーが連携。
- **Server と Editor の違いは？** — Server は運用・監視のためのセルフホスト型 Web アプリ。Editor は物理トポロジー・機器・モジュール・ケーブル・BOM を扱う設計ツール。
- **NetBox がなくても使えますか？** — 使える。YAML 定義のほか、Network Scan（SNMP + LLDP discovery）、Zabbix の LLDP topology、custom plugin という選択肢がある。
- **Zabbix / Prometheus がなくても使えますか？** — 使える。監視連携なしでも topology viewer として利用できる。リアルタイムメトリクス／アラート表示には監視データソースが必要。

## CTA ラベル

- Primary: サーバーを導入 / Docker で試す / デモを見る / トポロジーを作る / Playground で試す
- Secondary: GitHub / Docs / Editor を開く / 商用サポートに相談 / 設計思想を読む

---

# 付録B: 参照素材カタログ

> 画像などの参照素材の一覧。§0 のリンク集（プロジェクト文書・外部 URL）と対で使う。

## 実写写真

リポジトリ内で HP に使える実写写真は次の 2 点。

- `docs/slides/images/member-interop.jpg`: Interop での展示・参加文脈。About / Community / Project background など人の活動・現場感を出す用途向き。
- `docs/slides/images/member-interop-source.jpg`: 上の元画像。トリミング・明るさ調整・別比率の派生を作る素材。

## 製品スクリーンショット（画像 → 対象の対応）

製品説明では実写よりスクリーンショットが内容と合う箇所がある。ファイル名の右が写っている対象。

- `apps/docs/public/screenshots/topology.png`: トポロジービュー（Interactive Viewer / Live Weathermap）
- `apps/docs/public/screenshots/wethermap.png`: Weathermap 表示（Live Weathermap）
- `apps/docs/public/screenshots/alert.png`: アラート表示（Alert Overlay）
- `apps/docs/public/screenshots/dashboard.png`: ダッシュボード（Dashboard）
- `apps/docs/public/screenshots/share.png`: 共有リンク（Share Link）
- `apps/docs/public/screenshots/zoom.png`: インタラクティブ閲覧（Interactive Viewer）
- `apps/docs/public/screenshots/netbox.png`: NetBox 連携の説明
- `apps/docs/public/screenshots/demo.mp4`: 動きのある製品紹介動画

補足:

- **ファイル名注意**: `apps/docs/public/screenshots/` 側は `wethermap.png`（`weathermap` の綴り違い）。参照時はこの実ファイル名に合わせる。`docs/slides/images/` 側は `weathermap.png` と正しい。資産のリネームは別途検討。
- `assets/screenshots/dashboard.png`・`assets/screenshots/topology.png` も存在する。
- ページ実装では Next.js の public path で参照しやすい `apps/docs/public/screenshots/*` を優先。
- スクリーンショットは Server の説明と相性がよく、全体の思想や About には実写写真またはロゴが自然。

## ロゴ / ブランド画像

- `apps/docs/public/logo-horizontal.svg`: ヘッダー / フッター向けの横長ロゴ。
- `apps/docs/public/logo-symbol.svg`: アイコン・favicon 的な小表示・装飾的ブランド要素。
- `apps/docs/public/integrations/*.svg`: Grafana / NetBox / Prometheus / Zabbix の連携ロゴ。
- `apps/docs/public/adopters/*.png`: 採用・登壇・コミュニティ文脈のロゴ（現状 `itcuec_logo_300.png`、`janog57_logo.png`）。

## 必要に応じて追加できる素材

- Server の最新スクリーンショット: dashboard、topology、weathermap、alerts、data source 設定画面。
- Editor のスクリーンショット: 物理トポロジー設計、機器・モジュール・ケーブル、BOM、PoE analysis。
- 実写写真: 展示、イベント、導入現場、ネットワークラック、配線、NOC / 運用卓。
- パートナーロゴ: TelHi Corporation（輝日株式会社）など、掲載許可が取れたもの。
- 図解画像: Shumoku 全体、Server、Editor、Core / CLI / npm packages の関係を示す概念図。
- OGP / social preview 用画像: ロゴ・製品画面・短いメッセージを組み合わせた共有向け画像。
