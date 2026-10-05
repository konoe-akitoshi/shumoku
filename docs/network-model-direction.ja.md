# Shumoku の構成データモデル再設計方針

**目的は、Shumoku の構成データを新しく設計し、意味を公開した共通ネットワークモデルにすることである。**

前提: 既存データ形式・公開 API との互換性を、新規設計の制約にしない。
状態: 新設計の提案。型・validator・アプリへの実装と受入検証は未着手。
更新日: 2026-10-05。[論理設計の図と変更例](network-model-design.ja.md)で所有・参照・更新を確認する。
概念の要求・代替案・制限は [概念選定レビュー](network-model-concept-review.ja.md)を参照。
具体的な作業順は [実装計画案](network-model-implementation-plan.ja.md)を参照。

## 目指すものと最初の到達点

装置・インターフェース・接続・所属を、入力元や表示方法に依存せず記述できる共通モデルを作る。
Editor、Server、Library、外部アダプターが同じ構造と意味を扱えることを目指す。
第三者が Shumoku の内部実装を読まずに生成・検証できる仕様にする。

最初の到達点は **単一ネットワークの基本構造を表し、編集と異なる情報源の取込に耐える
新モデルの契約と試作**である。まず設計確認と小さな試作で土台を判定し、
各製品への導入は次の段階に分ける。土台の到達判定は次の五項目にする。

1. ノード・ポート・二端点の接続・所属を、曖昧な文字列参照や表示情報に頼らず表現できる。
2. 最小編集・保存の試作で、改名・削除・Undo が構造と拡張の参照を保つ。
3. 設計、台帳、探索を区別し、時系列の更新例で出所・未知値・撤回の範囲を保つ。
4. 小さな consumer で二つの View と複数所属を描き、新しい profile を核を変更せず追加できる。
5. containerlab の静的な対応範囲を共通構造と binding へ表し、往復と不足設定の診断を試せる。

全ネットワークプロトコル、完全な機器台帳、全情報源の自動照合を最初に完成させる必要はない。
最初に絞る対象は **共通モデルが扱う意味**であり、Linux コンテナの接続だけを完成目標にはしない。
containerlab 入出力と Editor の整合性は、新モデルが実用に耐えるかを調べる具体的な用途である。

[設計思想](PHILOSOPHY.md)の source-agnostic、reproducible、reality-aware を、このデータ契約で支える。

## これまでの実装と実験から分かった問題

| 現行実装で確認できること | 新設計で解決すること |
| --- | --- |
| `Node` に構造、位置、部材、identity、presence、attachment、解決後の fieldSources が集まる | 構造、表示、物理設計、入力の主張、解決結果を分ける |
| Editor の port ID は安定参照用。一方 Server の codec は port ID を interface name として補完する | 参照 ID と装置内の名前を別に定義する |
| `Link.id` は optional。保存経路は ID なしリンクを索引から除外する | 永続的な要素の ID と寿命を共通契約にする |
| `NetworkGraph` が入力 contribution と resolved output の両方になる | 入力情報と、照合・競合解決で得た結果を別の型にする |
| YAML の authoring schema は runtime graph より保存範囲が狭い | 入出力形式ごとの保持範囲を明示し、暗黙の脱落を避ける |
| `Subgraph` が所属、探索条件、階層、表示の箱などを担う | 意味上の所属と表示上の囲み・階層を分ける |

根拠: [core の型](../libs/@shumoku/core/src/models/types.ts)、
[観測の型](../libs/@shumoku/core/src/observation/types.ts)、
[contribution codec](../apps/server/api/src/services/contribution-store.ts)、
[Editor の同期](../apps/editor/src/lib/persistence/sync.ts)、
[YAML の往復範囲](../libs/@shumoku/core/src/parser/serialize.ts)。
この整理は実装上の契約を比較したもので、個別のデータ消失を再現したという主張ではない。

既存の entity registry には、強い識別キー、矛盾による候補排除、alias、失効処理の知見がある。
新設計ではこれらの知見を使うが、現在の wire shape や DB schema を維持するために概念を曲げない。
[Entity registry](../apps/server/api/src/services/entity-registry.ts)

## OpenTelemetry などから何を学ぶか

以下は一次資料の内容と、それを踏まえた Shumoku への提案を分けたものである。

| 参考対象 | 確認した考え方 | Shumoku で採る方針 |
| --- | --- | --- |
| OTel Entity Data Model | 識別属性と変更可能な説明属性を分け、必要十分で反復可能な identity を求める | ID、名前、外部参照、照合の根拠を混ぜない |
| OTel semantic conventions | 属性名・意味・値・単位を共通にし、名前空間で衝突を避ける | 型だけでなく中立な属性辞書を公開する |
| OTel Telemetry Schemas | producer/consumer と規約が独立に進化できるよう、意味の版を識別する | 新モデルの schema と意味の版を明示し、公開後の変更規則を決める |
| IETF RFC 8345 | network、node、termination point、link とそれらの参照を定義する | 所有関係と接続端点を明示する。方向や階層を表示から推測しない |
| containerlab | 接続端点を明確に記述し、実行設定と継承規則を持つ | 入出力で評価する。ラボ固有の設定を共通 core の形にしない |

資料: [OTel Entity](https://opentelemetry.io/docs/specs/otel/entities/data-model/)、
[OTel Naming](https://opentelemetry.io/docs/specs/semconv/general/attribute-naming/)、
[OTel Telemetry Schemas](https://opentelemetry.io/docs/specs/otel/schemas/)、
[RFC 8345](https://www.rfc-editor.org/rfc/rfc8345.html)、
[containerlab topology](https://containerlab.dev/manual/topo-def-file/)。

2026-10-03 の確認では、OTel Entity Data Model は Development である。
完成済みのネットワーク標準として採用するものではない。
また OTel の Telemetry Schemas は意味の進化を扱う仕組みであり、全データの JSON Schema と
同じものではない。Shumoku は構造の検査用 schema と、意味の仕様を両方用意する。

OTel の Resource はテレメトリーの観測対象を記述する。構成図の位置・部材・接続全体を
そのまま Resource に詰める理由にはならない。
[Resource Data Model](https://opentelemetry.io/docs/specs/otel/resource/data-model/)
OTLP、Collector、OTel SDK を初期実装の必須要件にはしない。

## 新モデルの分割

| 領域 | 保存する意味 | 持ち込まない意味 |
| --- | --- | --- |
| NetworkTopology | ノード、ポート、接続、所属、属性、外部参照 | 座標、色、観測の勝者、ラボの起動命令 |
| ViewDocument | 構造への参照、表示ラベル、配置、非表示、囲み、描画方針 | 実機 identity、構造の存在を決める主張 |
| Domain profile | 部材、コネクター、物理配線、校正、カタログなど、用途別に型を持つ情報 | 全用途を混ぜた無規則な metadata |
| SourceContribution / Resolution | 出所、用途、時刻、網羅範囲、照合結果、競合と採用理由 | 描画用の座標、入力を装った解決済み値 |
| IntegrationDocument | 外部形式の原定義、実行設定、対応表、変換能力 | 共通ノード種別としての plugin 名 |

分割は保存ファイル数を増やすことが目的ではなく、正本と責務を明確にするために行う。
Editor プロジェクトはこれらを束ねる。Library は基本構造と必要な表示設定だけでも使える。

### 基本構造は正規化して参照する

新しい `NetworkTopology` は、nodes、ports、connections、groups を別の collection にする。
ポートをノードに埋め込んだデータと、別のポート一覧を同時に正本にしない。

| 概念 | 初期契約 |
| --- | --- |
| Topology | スキーマ版と安定 ID を持つ。内部参照のスコープである |
| Node | 文書内のネットワーク要素。安定 ID と任意の説明名・属性を持つ。実機の同定とは別 |
| Port | 安定 ID、所有 node ID、任意の interfaceName を持つ物理・論理の接続端点 |
| Connection | 安定 ID と二つの端点参照を持つ、初期対応範囲の無向接続。媒体・層・実現方法の排他的な kind は置かない |
| Group | 任意の名前付き Node 集合。安定 ID と明示的な nodeIds を持ち、親子・包含・通信制御は意味しない |

すべての要素 ID は topology 内で一意とする。端点のポートが分かる場合は `portId` で参照し、
所有 node は Port から解決する。ポートが不明の場合は `nodeId` だけで参照し、ポート未特定の
接続として保持する。端点はどちらか一方だけを持ち、同じ参照の node ID を重複保存しない。
ID は文字列の内容に意味を求めず、改名・整列・再読込で変えない。
同名の要素や、別 topology の同じ ID を、同じ実機とは判定しない。

初期の Connection は無向の二端点の接続関係とする。正常に双方向通信できるという主張ではない。
表示矢印を方向の事実にしない。RFC 8345 の有向 link、フロー、共有セグメント、LAG は
別の意味として後から追加し、今回の connection に黙って押し込まない。
共有媒体などの新しい独立要素には、profile の契約だけでなく core の追加が必要になる可能性がある。
初期コアがネットワーク全般の関係を表せるとはしない。

Node は複数の group に所属できる。サイトとセキュリティ区画が違う分類軸だからである。
表示上どの group を箱として囲むかは View が選ぶ。
動的な所属条件は別の規則で計算し、基本構造に保存する所属集合と二重に編集しない。
Group は省略できる。集合の意味や包含の関係は用途別に定義し、初期 core に parentGroupId は置かない。
Group が表示以外の共通参照にも必要かは、P1 で確認する。

形の例は [router-switch.network.json](examples/network-model/router-switch.network.json)、
対応する表示は [router-switch.view.json](examples/network-model/router-switch.view.json)を参照する。
これらは新設計の例であり、現在の parser で読める形式とは主張しない。

### ID と同定の根拠を分ける

内部 ID は編集と参照を保つための ID である。
外部参照は authority、objectType、key の組とし、authority は接続先インスタンスまで区別する。
NetBox A の device 42 と NetBox B の device 42 は別の外部参照になる。

serial、chassis ID、MAC、IP、interfaceName などは、意味とスコープを定義した証拠として扱う。
値が一つ一致しただけで全情報源を自動 merge する規則を core に入れない。
特に IP、表示名、ifIndex を永続的な実機 ID の代用にしない。

照合は外部参照・証拠・明示的な対応を入力にする別処理にし、元の ID と採用した canonical ID の
対応を結果として返す。自動同定できない要素も表現できる。
OTel の entity merge 規則と、ネットワークの観測から同じ実機を推定する処理は同一ではない。

### 属性の意味を辞書にする

構造の参照・所有関係・要素 ID は型のあるフィールドに置く。
説明属性は名前空間付きの属性辞書に従う。初期は有限数・文字列・boolean と、
同じ型の配列を扱い、未知の JSON object を核心の構造の代用にしない。

初期に吟味する規約の例は次の通り。下記は Shumoku の提案で、OTel の属性名への準拠宣言ではない。

| 属性 | 対象・意味 | 不明な場合 |
| --- | --- | --- |
| `device.role` | Node の中立な役割。router/switch/firewall/access-point など | 属性を省略 |
| `device.vendor` / `device.model` | Node の確認できる製品情報 | plugin kind から推定しない |
| `interface.capacity_bps` | Port の容量。単位は bit/s。実測 throughput とは別 | 0 や表示文字列で補わない |
| `connection.technology` | Connection の確認できる技術。Ethernet など | ケーブル材質まで推定しない |
| `inventory.serial_number` | 製品に記載された識別証拠。スコープと出所を別途持つ | 内部 ID に転用しない |

各項目に対象、型、単位、値域、情報の根拠、安定度を定義する。
core の既存名と意味が衝突する独自属性を作らず、製品固有の属性は別の名前空間に置く。
同じ接続を指すために consumer が `plugin.type` を見る必要がない契約にする。

### 不明と不在と失敗を分ける

任意の属性の省略は「情報がない」。0、false、空文字列とは等価にしない。
空の ports は「文書に記載されたポートがない」であり、実機にポートがない証拠ではない。
Node だけ分かる接続は、ポートを捏造せず node 端点として表せる。
Port 自体は分かるが名前や仕様が不明な場合も、任意属性を省略して保持できる。
推定した speed、kind、材質を事実として埋めない。

SourceContribution は構造とは別に sourceId、用途、capturedAt、scope、完全性、成功状態を持つ。
用途は少なくとも設計上の主張と観測上の主張を区別する。手動/自動やプロジェクト所有/外部は
用途と同じ分類ではない。設計と実測が違っても、一方を優先値で消して同じ事実にしない。

収集失敗と partial snapshot は、掲載されていない要素の削除を意味しない。
完全で成功した snapshot の不在も、その source の宣言した scope 内の撤回に限る。
他 source の存在主張を削除する命令ではない。明示的な削除操作と snapshot を区別する。

Resolution は採用した構造、ID 対応、属性の出所、競合、採用理由を持つ派生結果とする。
NetworkTopology は構造を表す値の型であり、型が同じでも書込みの権限は同じではない。
Editor は設計の文書を編集し、source は自分の主張を更新し、Resolution は読み取り用に再計算する。
観測値を設計へ採る操作は明示的な取込にし、source 更新で設計を上書きしない。
`fieldSources` や解決済み状態を、次の source 入力へ戻して正本にしない。
高度な自動照合・競合解決アルゴリズム全体は初期完成条件に含めないが、その入出力の意味は決める。
これらは複数入力を扱う機能の契約であり、静的な topology の単独利用に resolver や
IdentityMap の稼働を要求しない。sequence や record 置換は収集試作の方式として比較する。

## Editor と物理設計への適用

新しい Editor プロジェクトの構造の正本は `NetworkTopology` にする。
旧 `NetworkGraph` を永続化の正本に置き続ける設計や、二つの構造の同期を恒久化しない。
レイアウトの中間表現は派生データとして生成する。

作成・接続・ポート削除・ノード削除を、参照検証と参照調整を含む atomic な編集操作にする。
改名は内部 ID を変更しない。削除では関連接続・所属・View・profile・integration を調整し、
Undo はこれらを一緒に復元する。カタログの再同期も同じ変更契約に従う。

View の箱・色・ラベル・配置を変更しても構造は変わらない。
ただし校正済み座標、配線経路、長さは物理設計の事実でもある。
これらは物理設計 profile に用途と単位を持たせ、単なる見た目として削らない。

部材の型と実際に設置する instance、ポートの receptacle とケーブルの plug、
配線経由点と通信端点はそれぞれ区別する。
既存 [接続モデル](../apps/editor/docs/design/connection-model.md)と
[Editor の型](../apps/editor/src/lib/types.ts)の経験を使い、新しい参照関係で設計し直す。
全受動配線の内部接続を初期 core に加える必要はない。

profile は schema と版を持ち、参照の影響を検査できる契約を要求する。
P1 の候補方式では、拡張の全 target 参照を envelope に型付きで宣言する。
payload は参照の local key を使い、内部 ID を隠して埋めない。
未知の profile は保持し、payload の意味は未検証とする。
参照先の削除・付替えを扱えない場合は、影響する編集全体を止めて診断する。
この振る舞いを既知・未知の profile を使う初期試験に含める。
envelope と宣言的な参照パスを比較し、公開前に方式を選ぶ。
未知 profile がある場合の編集停止は初期 Editor の方針で、読み取り consumer に同じ編集機能は要求しない。
大きな `metadata` を置いただけで拡張性を達成したことにしない。

## containerlab は新モデルの検証に使う

containerlab の静的定義を新モデルへ取り込み、必要な実行設定を IntegrationDocument に持つ。
nodeName、kind、image、startup-config、env、binds と継承構造を、共通属性から再生成できると
仮定しない。[Node configuration](https://containerlab.dev/manual/nodes/)

単純な veth は virtual な二端点接続に対応する。Linux の interface と NOS alias の違いは
アダプターが扱い、内部 port ID と別に保持する。
node 端点のままの接続は表現できるが、実行用の出力には具体的な interface の割当が必要になる。
物理設計から仮想 lab を生成した場合、その lab は設計の実現例であり、同じ実機を観測した証拠にはしない。
デプロイ後の inventory は別の観測入力であり、静的な定義の逆変換とは見なさない。
[Inventory](https://containerlab.dev/manual/inventory/)

最初の対応表は二端点の静的接続を対象に決める。Linux fixture は変換処理の小さな試験に使い、
ルーター/スイッチの NOS を持つ静的 fixture でも新モデルの意味が通ることを確認する。
対象 containerlab の版はアダプターの契約で固定し、core の設計をその版の制限に合わせない。

未編集の往復は解析後の設定値を保持する。編集後は対応表に従う変更だけを出力する。
新規出力には kind/image/interface の対応を明示し、機器の role から起動設定を推測しない。
不明な設定参照に影響する変更や未対応リンクは、黙って変換せず診断する。
ラボの deploy 成功はアダプターの実行試験であり、新モデルの正しさ全体の代用にはしない。

## 互換性と公開後の進化

今は新モデルを選べる段階なので、旧 YAML、旧 ZIP、旧 API、旧 DB の同形性を必須にしない。
互換 codec や移行 wizard を新設計の前提作業にしない。
実装を段階的に置き換えることはできるが、各段階の正本は新モデルの責務に従う。
実データの移行方法は、必要になった時点で別作業として扱う。

一方、新モデルを公開した後は、構造・意味・profile の版と成熟度を明示する。
構造 schema、属性辞書、参照検証、互換性の説明、例と適合試験を合わせて公開する。
OTel の仕組みを参考にする理由は、producer と consumer が独立に扱える共通契約を作るためである。

## 最初に実装しない範囲

1. 全 YANG/OpenConfig、NETCONF/gNMI、OTLP/Collector の実装と規格準拠の宣言。
2. 全プロトコル・VRF/route・共有セグメント・LAG・全受動配線の完全な模型。
3. 全 source を横断した完全自動同定、分散した同時編集、全競合の自動解決。
4. 全 containerlab kind/link、起動設定の全面編集、実行環境管理。
5. 旧形式の完全な互換性、旧データの自動移行、既存全機能の同時再実装。

保留するのは高度な機能の実装であり、出所・未知値・参照・拡張の境界の定義は初期に行う。
新しい source や consumer を足すたびに core の意味が変わるなら、基本設計へ戻って吟味する。
