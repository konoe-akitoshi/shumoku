# 構成図ディスカバリ設計（ドラフト）

> ステータス: **議論中 / 未確定**。実装着手前のメモ。
> 根本設計に関わるため、合意が取れるまでコードに落とさない。

## 背景

現状の `apps/server` は「構成図を Input（YAML / editor）で受け取り、そこに Zabbix
等のメトリクスを overlay する」モデル。構成図そのものは静的な入力物。

一方で運用視点では、各ノードに対して SNMP / LLDP 等で最新情報を取りに行き、
**構成図自体を実態に追従させたい**という要求がある。

ただし「ディスカバリを主役にする」「描いた図を主役にする」のどちらかにモードを
固定すると拡張性を失う。たとえば「0 からクロールしたい」「NetBox を基準に
クロールしたい」「この区間は勝手にクロールしてほしくない」が**すべて同居**
できる必要がある。

## 現状モデル（出発点）

サーバには既に topology / metrics の 2 用途の概念がある。

- `DataSourcePurpose = 'topology' | 'metrics'`（`apps/server/api/src/types.ts`）
- `TopologyCapable` プラグイン（NetBox）は topology を pull できる
- `topology_data_sources` は `priority` を持つ（レイヤー化の素地はある）

足りないのは **発見トランスポート（SNMP/LLDP 等）**と、それに伴う後述の新概念。

## 中心アイデア: モードではなく「レイヤー + ポリシー」

構成図を単一の真実として持つのをやめ、**複数ソースレイヤーの重ね合わせ**で持つ。

- `authored` レイヤー（人が描いた図 / YAML / editor）
- `netbox:<dsId>` レイヤー
- `network-scan:<dsId>` レイヤー
- `proxmox:<dsId>` / `docker:<dsId>` / `k8s:<dsId>` レイヤー …
- （発見ソースが増えたらレイヤー型が増えるだけ）

サーバが表示する構成図は、これらを **resolver（マージ器）** が畳み込んだ
*projection（投影）*。resolver はソース非依存の純粋関数にする。

各ノード/リンクは「どのレイヤーが主張したか」= **provenance** を保持する。

### A/B/C はモードではなくレイヤー構成

| やりたいこと | レイヤー構成 |
|---|---|
| 0 からクロール (A) | `authored` なし、`network-scan` のみ |
| NetBox 基準でクロール (A') | `netbox` をベースライン、`network-scan` がその枠内を補完 |
| 描いた図 + 実態差分 (B) | `authored` が主、`network-scan` は observe のみ |
| メトリクスだけ SNMP (C) | `network-scan` の topology レイヤーを持たず metrics 用途のみ |

新しい発見ソースが増えても「レイヤー型が増える」だけ。コードパス（モード）は
増やさない。これが拡張性の担保。

## ポリシースコープ（「この区間はクロールするな」）

レイヤーとは別軸の **ポリシー**。スコープに紐づき、ノブは 2 つ。

1. **crawl boundary** — LLDP ウォークの伝播範囲。
   LLDP 発見は seed から雪だるま式に隣接を辿って広がるため、フェンスが要る。
2. **adoption** — 発見した事実を effective graph にどう取り込むか。
   - `none` … 触らない
   - `observe` … 発見はするが自動マージしない（差分提案として表示のみ）
   - `adopt` … 自動マージする

「勝手にクロールしてほしくない区間」= そのスコープに `crawl: none` / `observe`
を当てるだけ。特殊ケースではなくモデル上で素直に表現できる。

### 先行事例: Netdisco の crawl 制御がほぼそのまま参考になる

Netdisco（L2 トポロジ発見専門ツール、中央ポーラー型）は、この crawl 制御を
**デーモン配置ではなくソフト側の設定（ACL 風）**で解決している。shumoku の
ポリシースコープはこれを踏襲するのが定石。

- `discover_only` — クロール対象サブネットを限定
- `discover_no` — 特定サブネットを除外
- `discover_no_type` — CDP/LLDP の device type 正規表現で除外（IP電話・軽量AP 等）
- `discover_no_neighbors` — 「この機器の隣接は発見キューに積まない」=
  **クロール伝播のフェンス**

→ ポリシースコープは「デーモンを置く/置かない」とは**独立した問題**。
スコープの主軸は **CIDR + 境界ノード（= `discover_no_neighbors` 相当）**とする。

## 要素の state（reconciliation を第一級プロパティに）

resolver が畳み込んだ各ノード/リンクは provenance に加えて **state** を持つ。

- `confirmed` … 複数レイヤーが一致（描いた図に実態の裏付けあり）
- `authored-only` … 描いたが実機で観測できない（点線表示など）
- `discovered-only` … 観測されたが図にない（ゴースト / 提案表示）
- `conflicting` … レイヤー間で矛盾

reconciliation を「別建ての差分リスト」ではなく要素のプロパティにする。
直近マージの auto-layout / pinned positions と噛み合わせる想定
（discovered は自動配置、authored は pin 維持）。

## 最大の難所: identity correlation

レイヤーを重ねる以上、複数レイヤーが指す同じ実体を**同一と判定する鍵**が必要。

- 物理機器: management IP、フォールバックで LLDP chassisId / sysName
- ワークロード: 後述の「スティッチ問題」を参照。VM は
  「ハイパーバイザ側 ID」と「ゲスト OS のホスト名/IP」の両方を晒す必要がある

→ `@shumoku/core` の `Node` に `managementIp` / `chassisId` 相当のフィールドを
足す必要がある可能性が高い。ワークロード層を入れるとさらに「ハイパーバイザ ID /
ゲスト ID」のような複合キーが要る。**コアに触る判断**なので早めに固めたい。

## 発見プロトコルのカタログ

「何のレイヤーを埋めるか」で分類する。`◯` = Scanopy が現状使用、`R` = Scanopy
ロードマップ、`—` = Scanopy 未対応。

### L2 物理レイヤー（隣接・配線）

| 手段 | 内容 | Scanopy |
|---|---|---|
| LLDP (802.1AB) | 標準の隣接。SNMP LLDP-MIB | ◯ |
| CDP | Cisco 独自隣接。CDP-MIB | ◯ |
| FDP / EDP / SONMP | Foundry/Extreme/Nortel 版。ニッチ | — |
| MAC 転送テーブル | BRIDGE-MIB / Q-BRIDGE-MIB。アンマネージド機器越しの接続推定に使える | △（採取するが L2 リンク導出には不使用と明言） |
| STP/RSTP | BRIDGE-MIB `dot1dStp`。スイッチ網のツリー構造 | — |

Scanopy は「LLDP/CDP のみ、MAC テーブルは L2 リンクに使わない」と割り切り、
アンマネージド機器が見えないことを許容している。shumoku は **MAC/STP も使えば
アンマネージド機器が見える**という差別化余地がある。

### L3 論理レイヤー（IP・経路）

| 手段 | 内容 |
|---|---|
| ARP / NDP テーブル | IP-MIB `ipNetToMedia`。IP↔MAC、ホスト発見 |
| ルーティング隣接 | OSPF-MIB / BGP4-MIB / ISIS-MIB。L3 隣接グラフ |
| BMP (BGP Monitoring Protocol) | ルートコレクタとして経路を受動収集 |

### デバイスを叩くトランスポート（Cisco 系で効く）

| 手段 | 内容 | 対応機器 |
|---|---|---|
| SNMP (v2c/v3) | 最も広く効く。MIB ベース | ほぼ全機種 |
| NETCONF/YANG (RFC6241) | SSH 上の構造化 config/state | Cisco IOS-XE/NX-OS/IOS-XR、Juniper、Arista |
| RESTCONF | NETCONF の HTTP/JSON 版 | 同上 |
| gNMI/gRPC (OpenConfig) | ストリーミングテレメトリ（push 購読） | 新しめの Cisco / Arista / Nokia |
| SSH CLI スクレイピング | `show cdp/lldp neighbors` 等。泥臭いが機種非依存で確実 | 事実上全部 |
| ベンダー管理 API | Catalyst Center / Meraki / ACI APIC / SD-WAN vManage | Cisco 製品群 |

Scanopy ロードマップは NETCONF/gNMI/NetFlow を**含まない**。「プロトコル深掘り」
より「ベンダー API 統合」に寄せている。深掘りはコスト高・機種依存で ROI が
読みにくいという判断は shumoku も踏襲してよい。

### サービス／トラフィック由来

| 手段 | 内容 | Scanopy |
|---|---|---|
| ポートスキャン + フィンガープリント | 開放ポートからサービス判定（230+ 定義） | ◯ |
| NetFlow / IPFIX / sFlow | フローで「誰が誰と通信」→ アプリ依存・L3 ヒント | — |
| mDNS/DNS-SD・SSDP/UPnP・WS-Discovery | LAN のサービス/機器を受動発見 | — |
| DHCP リース / DNS (PTR, AXFR) | ホスト在庫と命名 | — |

### ハードウェア / OOB

| 手段 | 内容 |
|---|---|
| Redfish (DMTF) | サーバ BMC（iLO/iDRAC）。CPU/メモリ/ストレージ在庫 |
| IPMI | 旧式 BMC |
| WMI / WinRM | Windows ホスト情報 |
| ENTITY-MIB | SNMP 経由のハード型番・シリアル |

## ワークロード層（VM / Docker / k8s）

L2/L3 とは**性質が根本的に違う**。LLDP/SNMP は「網を叩いて隣を辿る」が、
VM/Docker/k8s は **オーケストレータが自分の在庫を全部知っており、その権威 API を
1 回読むだけ**。

帰結：
- クロール伝播がない → デーモン配置・到達性・ポリシースコープの議論が
  **ほぼ無関係**になる。必要なのは API クレデンシャル 1 個
- イベント API があるのでポーリング不要。Docker events / k8s watch /
  Proxmox task log で push 同期できる

### 各ソース

- **Docker** — Docker API（unix ソケット or socket-proxy）。コンテナ → docker
  network（bridge/host/overlay/macvlan）→ ホスト。Scanopy は実装済み。
- **VM (Proxmox/libvirt/VMware)** — Proxmox VE REST API `/api2/json/`、トークン
  認証。物理ホスト → VM → 仮想 NIC → bridge(`vmbr0`)/OVS/SDN → 物理 NIC →
  物理スイッチ。Scanopy はロードマップ。
- **Kubernetes** — K8s API。Node / Pod / Service / Deployment / Ingress /
  NetworkPolicy。**グラフが 2 枚ある**: スケジューリンググラフ（Pod がどの Node
  で動くか）と サービス/依存グラフ（Service が Pod を束ねる、Deployment 所有）。

### core データモデルに効く 4 つの帰結

1. **包含は `Subgraph` ネストに乗る** — 物理ホスト ⊃ VM ⊃ コンテナ、Node ⊃ Pod、
   compose project ⊃ containers。すべて入れ子。core の `Subgraph`（ネスト構造）と
   element-unification 方針（node/subgraph は同じ「ブロック」）がここで効く。
   包含は Link ではなくネストで表現するのが素直。
2. **`Link` 1 種類では足りない** — 包含 / メンバーシップ（Pod ∈ Service）/
   所有（Deployment → Pod）/ ネットワーク接続（コンテナ → bridge）など複数の
   エッジ種別がある。包含=ネスト、ネットワーク接続=Link、メンバーシップ/所有=
   別種エッジ、と分ける判断が要る。
3. **スティッチ問題がレイヤーモデルの価値そのもの** — ワークロード層単独では
   「VM が浮いてるだけ」。価値は仮想と物理を繋ぐ 1 本の鎖を見せること:
   `コンテナ → docker net → ホスト eth0 → 物理スイッチ Gi0/3`。
   繋ぐ鍵は共有 identity（Proxmox VM 名/IP == k8s Node 名/IP、Proxmox ホストの
   mgmt IP == SNMP 発見した物理ホスト）。→ identity correlation の論点が
   ワークロード層でさらに重要になる。
4. **チャーンが激しい → `discovered-only` 固定 + 折りたたみ前提** — Pod は秒単位で
   生滅する。authored で描かず pin もしない。レイアウトが踊らないよう、常に
   discovered-only・自動配置・デフォルトで集約表示（Pod 個体でなく Deployment
   単位で畳む）にする。

→ ワークロード層は「スキャンの議論」から切り離せて API 統合（既存プラグイン機構と
同型）として軽く作れる一方、**core のデータモデルに一番踏み込む**層。

## トランスポートとデプロイ構成

「SNMP/LLDP を実際にどこから叩くか」。デーモン構成に振り切らないのが方針。
業界の成熟ツールは「中央ポーリングがデフォルト、分散はオプションで後付け」。

| パターン | 状態 | 必須か | 例 |
|---|---|---|---|
| 中央ポーリング | — | これが基本 | Zabbix(server直), LibreNMS, Netdisco, Observium |
| ステートレス中継 | なし | オプション | Prometheus snmp_exporter |
| ステートフル proxy | 自前 DB / store-forward | オプション | Zabbix proxy, LibreNMS 分散 |
| 登録型デーモン必須 | DB / api-key / heartbeat / capability 報告 | 必須 | Scanopy |

- **Zabbix** — サーバ自身が agentless ポーリング（SNMP/IPMI/SSH）。proxy は
  あくまでオプション（リモート拠点・分断越え・スケール時のみ）。proxy は自前 DB を
  持ち store-and-forward する。
- **LibreNMS** — 単一ポーラーで 1000 台以上。CDP/LLDP/ARP クロールも中央。
  Distributed Polling は性能限界に当たってから入れるオプション。
- **Netdisco** — 中央サーバ + ワーカ。seed から LLDP/CDP 隣接をクロール。
  デーモンを撒かない。crawl 制御は前述の `discover_no` 系設定。
- **Prometheus snmp_exporter** — SNMP→HTTP の薄い変換ゲートウェイ。DB なし・
  登録なし・heartbeat なし・状態なし。使い捨て可能。
- **Scanopy** — 登録型デーモン必須・移動不可・heartbeat 常時。一番重い段に最初から
  振り切った例外（「描かない・全部発見」に全振りした製品ゆえに許容できる割り切り）。

### shumoku の方針

1. **デフォルトは shumoku server が直接 SNMP/LLDP ポーリング**。多くの網では
   サーバの到達性で足りる。「Docker 1 コンテナで完結」という売りも守れる。
2. **「クロールするな」はトランスポートと無関係**。Netdisco `discover_no` 系を
   設定で持つ（前述のポリシースコープ節）。
3. **到達できないセグメント用にオプションで中継を置けるようにする。ただし
   Scanopy 型のステートフルデーモンではなく Prometheus exporter 型のステートレス
   中継**にする。薄い `shumoku-probe`（SNMP→HTTP/gRPC ゲートウェイ、DB も登録も
   なし、サーバから見れば「別の SNMP エンドポイント」が増えるだけ）。
4. レイヤーモデルとも噛み合う — SNMP ソースレイヤーが「サーバ直」由来か
   「中継経由」由来かは resolver にとって透過。**トランスポートはレイヤーの下の
   実装詳細**。

## メトリクス側（C）

SNMP は素直に強い。`ifHCInOctets` / `ifHCOutOctets` のカウンタ差分は
Zabbix を経由するより直接的にリンク使用率が出せる。既存の
`purpose: 'metrics'` にそのまま乗る。topology 側より独立して進められる。

## 先行事例: Scanopy（github.com/scanopy/scanopy）

「Network documentation, without the drawing」— 人が図を描くのをやめ、実態の継続
更新モデルに置き換えるツール。Rust デーモン + Rust/PostgreSQL サーバ + Svelte UI。
AGPL-3.0 + 商用。

- **構成**: セグメントごとに分散デーモン。デーモンは API key 認証、heartbeat 30s、
  capability（Docker ソケット有無・所有サブネット）をサーバへ報告。
- **発見**: デーモン 1 本が「サブネット IP/port/ARP スキャン → SNMP → Docker 列挙
  → 自己報告」を統合実行。L2（ARP で MAC）は直結 IF を持つサブネットのみ、
  リモートは L3 のみ。
- **SNMP**: v2c のみ（v3 は Planned）。System/IF/IP/LLDP/CDP/ENTITY/BRIDGE-MIB。
- **L2 トポロジ**: LLDP/CDP 隣接テーブルのみから導出。アンマネージド機器は出ない。
- **モデル更新**: upsert。discovered フィールドは上書き、ユーザの name/tag は保護。
  authored レイヤーを**持たない**ので reconciliation 問題自体が発生しない。

**shumoku との対比**: Scanopy は本メモの A（0 からクロール）に全振りした製品で、
その代償に authored 概念・reconciliation・ポリシースコープを全部捨てている。
shumoku は editor を持ち authored topology が主役なのでそのまま真似はできないが、
発見プロトコルの選び方（SNMP + ベンダー API に寄せ、プロトコル深掘りを避ける）と
upsert の軽量さは参考になる。

## 未決の論点（次に詰める）

1. **ポリシースコープのデータモデル** — 主軸は CIDR + 境界ノードで方向は確定
   （Netdisco 流）。残: 既存 `Subgraph` 単位の指定も併用するか、設定の置き場所。
2. **新規発見ソースのデフォルト adoption** — 安全側で `observe`（差分提案のみ、
   人が承認）か、0 クロール用途を見据えて `adopt` か。
3. **コンフリクト解決** — レイヤー間で属性が食い違うとき priority で勝者を
   決めるか、存在の不一致は常に `conflicting` として surface するか。
4. **identity correlation のキー** — `Node` への `managementIp` / `chassisId`
   追加可否、ワークロード層向けの複合キー（ハイパーバイザ ID / ゲスト ID）。
   core への変更。
5. **`Link` の拡張 / エッジ種別** — ワークロード層の包含・メンバーシップ・所有を
   どう表現するか。包含=`Subgraph` ネスト、他=新エッジ種別、で良いか。
6. **中継（shumoku-probe）の要否と形** — v1 はサーバ直ポーリングのみで出すか、
   最初からステートレス中継を用意するか。

## 関連メモ

- 既存のプラグイン契約（`docs/plugin-authoring.md`）— コア型が表示契約。
  プラグインは境界で自分の語彙をコア語彙へ翻訳する。発見プラグインも同様。
- auto-layout MVP / pinned positions（PR #282 周辺）— discovered ノードの配置に活用。
- 比較対象ツール: Scanopy / Zabbix(+proxy) / LibreNMS / Netdisco /
  Prometheus snmp_exporter。
</content>
