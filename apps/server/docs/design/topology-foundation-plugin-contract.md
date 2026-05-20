# Topology Foundation: Plugin Contract v2

> ステータス: ドラフト。`topology-foundation.md` の付属。
> 観測モデルに乗せるための plugin v2 仕様。後方互換は考慮しない（v1 は破棄）。

## 0. v1 からの変更点（要約）

| 観点 | v1 | v2 |
|---|---|---|
| topology 返却 | `fetchTopology(options) → NetworkGraph` | `fetchTopology(options) → Snapshot`（NetworkGraph + status + 全要素に provenance/identity） |
| ソース識別 | プラグイン側で `type` だけ | プラグインがインスタンス ID も snapshot に刻む |
| identity キー供給 | なし（host name 等を緩く返す） | **必須**。各要素に `identity` を埋める |
| エラー処理 | throw | snapshot に `status: 'failed' \| 'partial' \| 'empty' \| 'ok'` を埋めて返す |
| autoscan 系 | 該当なし | 新規 `AutoscanCapable` capability（seed / scope / capability 申告） |
| metrics 同期 | `pollMetrics(mapping)` | 変更なし（既存 v1 を維持） |

`MetricsCapable` / `HostsCapable` / `AlertsCapable` は概ね据え置き。topology 周辺だけが
大きく変わる。

## 1. 基本契約

`@shumoku/core/src/plugin-types.ts` の `DataSourcePlugin` は維持。
`DataSourceCapability` に **`'autoscan'`** を追加：

```ts
export type DataSourceCapability =
  | 'topology'   // 構造ある観測を返す
  | 'metrics'    // メトリクス
  | 'hosts'      // ホスト列挙（UI mapping 用）
  | 'alerts'     // アラート
  | 'autoscan'   // ネットワーク発見（SNMP/LLDP/ARP 等の seed-crawl 型）
```

`autoscan` は `topology` の特殊形ではなく、**追加 capability**（典型: 同じプラグインが
`topology` と `autoscan` 両方を持つ）。autoscan は seed / scope / 識別フローを持つ点で
HTTP API ベースの topology source と挙動が異なるため明示する。

## 2. `TopologyCapable` v2

```ts
/** v2: snapshot を返す。NetworkGraph を直接返さない。 */
export interface TopologyCapable {
  fetchTopology(options?: Record<string, unknown>): Promise<Snapshot>

  /** v1 にあった watchTopology は廃止。realtime は別レイヤー
   *  （WebSocket / webhook で差分を再 fetch トリガにする）。 */
}

export interface Snapshot {
  /** snapshot 取得の集約ステータス。retraction ゲートに使われる。 */
  status: 'ok' | 'partial' | 'failed' | 'empty'

  /** 人間可読の失敗理由（status !== 'ok' のとき）。 */
  statusMessage?: string

  /** スキャン開始時刻（Unix ms）。snapshot 内要素の observedAt と一致。 */
  capturedAt: number

  /** 観測結果。NetworkGraph と同型。
   *  - status === 'failed' のときは null
   *  - status === 'ok' / 'partial' / 'empty' のときは存在
   *  全要素に provenance.source とidentity（取れる範囲で）が埋まっている。 */
  graph: NetworkGraph | null

  /** 取得中の警告（DNS 解決失敗、一部 OID timeout 等、要素レベルの諦め）。
   *  status を 'partial' にする原因の説明。 */
  warnings?: string[]
}
```

### 2.1 プラグインの責務

snapshot 内の各 Node / Link / Subgraph / NodePort に対し：

- **`provenance.source`** を必ず埋める。値はそのプラグインインスタンスの `<sourceId>`（DB の
  `data_sources.id`）。
- **`provenance.observedAt`** を埋める（基本は `snapshot.capturedAt` と同じでよい）。
- **`identity`**（取れる範囲で）を埋める。

`provenance.state` はプラグインでは**埋めない**。resolver の責務。

### 2.2 identity 充実度の指針

| ソース型 | Node の identity | Port の identity |
|---|---|---|
| **authored (editor 経由)** | mgmtIp（人が入れたなら）。なくてもよい | ifName（手書き）、なくてもよい |
| **NetBox API** | mgmtIp + vendorIds (netbox device-id) | ifName + vendorIds (netbox interface-id) |
| **SNMP-LLDP autoscan** | mgmtIp + chassisId + sysName | ifIndex + ifName + mac |
| **Zabbix host list** | mgmtIp（host inventory にあれば）+ vendorIds (zabbix hostId) | ifName（discovery rule で取れる範囲） |
| **Proxmox API** | vendorIds (proxmox node-id / vm-id) | （仮想 NIC の場合）mac |
| **k8s API** | vendorIds (k8s uid) | （pod IP は揮発、識別キーにしない） |

identity の質は後段の `identity-and-correlation.md` の identity quality 計算に直結する。

### 2.3 snapshot 内の `id`

snapshot 内要素の `id`（NetworkGraph 上の id）は**プラグインが自由に決めてよい**。
resolver は identity キーで突合するので、source 横断の id 一致は前提にしない。

ただし**プラグイン内では deterministic** に決めること（同じ機器は次回スキャンでも
同じ id になる）。理由: identity が取れなかった場合の fallback としてプラグイン内 id 等価で
マッチを試みる resolver の挙動（後述）が利く。

推奨パターン:
- NetBox plugin: `id = "netbox-${device_id}"` / `id = "netbox-if-${interface_id}"`
- SNMP plugin: `id = "snmp-${chassisId}"` / `id = "snmp-${chassisId}-${ifName}"`
- 識別不能時: `id = "<source>-${capturedAt}-${counter}"` （識別が取れるまでの臨時 id）

## 3. `AutoscanCapable`（新規）

SNMP/LLDP/ARP のような seed-crawl 型の発見を扱う。HTTP API ベースの NetBox 等とは
別 capability にする。同じプラグインクラスが `TopologyCapable & AutoscanCapable` を
同時実装してよい（autoscan の結果も snapshot として `fetchTopology()` で返せばよい）。

```ts
export interface AutoscanCapable {
  /** seed と scope を設定して実行。fetchTopology() と異なり、scope/seed が必須。 */
  scan(input: AutoscanInput): Promise<Snapshot>

  /** autoscan の進捗を購読（optional）。長いスキャン中の UI 表示用。 */
  subscribeProgress?(
    input: AutoscanInput,
    onProgress: (p: AutoscanProgress) => void,
  ): () => void
}

export interface AutoscanInput {
  /** クロール開始機器（IP 等）。 */
  seeds: string[]

  /** クロール対象/除外を Netdisco 流で。 */
  scope: ScopePolicy

  /** 識別フェーズ後に対応 MIB / プロトコルでだけ実行する。
   *  カタログから引いた "discovery capabilities" を渡す入口。 */
  capabilityHints?: DiscoveryCapabilityHints
}

export interface ScopePolicy {
  includeCidrs?: string[]      // 対象 CIDR
  excludeCidrs?: string[]      // 除外 CIDR
  boundaryNodes?: string[]     // ノード ID / IP。これを超えて隣接を辿らない
  noTypesPatterns?: string[]   // CDP/LLDP device type 正規表現で除外
}

export interface DiscoveryCapabilityHints {
  snmp?: { versions?: string[]; mibs?: string[] }
  netconf?: { yang?: string[] }
  cli?: { family?: string }
  // 詳細は topology-foundation.md § 2.4
}

export interface AutoscanProgress {
  phase: 'reachability' | 'identify' | 'walk' | 'finalize'
  totalCandidates: number
  processed: number
  failed: number
  messages: string[]
}
```

### 3.1 autoscan plugin の典型実装

1. seed に対し ping/ARP で到達性確認
2. SNMP System-MIB を引いて sysObjectID / sysDescr / sysName を取得（identification）
3. カタログから model を引く（または外部 sysObjectID 辞書）
4. 対応 MIB だけを walk
5. LLDP-MIB の隣接情報から次の機器を queue に積む（scope policy でフェンス）
6. 全機器走査後に snapshot 生成、`status='ok'` または `'partial'` で返す

## 4. プラグイン登録の変更

`registry.register(type, displayName, capabilities, factory)` の `capabilities` は
**v1 と同じシグネチャ**。`'autoscan'` を追加できるだけ。

`PluginRegistry.getPluginsWithCapability('autoscan')` で autoscan capable な
プラグインを列挙できる（既存 API）。

## 5. 既存 5 プラグインの v2 マッピング

| Plugin | v1 capabilities | v2 capabilities | 主な変更 |
|---|---|---|---|
| **netbox** | topology, hosts | topology, hosts | `fetchTopology()` が `Snapshot` を返す。Device/Interface に identity を入れる |
| **zabbix** | metrics, hosts, alerts | metrics, hosts, alerts | 変更ほぼなし（topology 提供しない）。host 列挙の identity 充実 |
| **prometheus** | metrics, hosts, alerts | metrics, hosts, alerts | 同上 |
| **grafana** | alerts | alerts | 変更なし |
| **aruba-instant-on** | hosts, metrics, alerts | hosts, metrics, alerts | identity 充実のみ |

→ **5 プラグインのうち実質的な書き換えは netbox の 1 個だけ**。他は identity を埋める
小改修で済む。 これは「NetworkGraph が核に残った」結果。

## 6. 新規プラグイン候補（v1 で実装する想定）

| 名前 | capabilities | 役割 |
|---|---|---|
| **snmp-lldp** | topology, autoscan, hosts, metrics | autoscan の本命。SNMP LLDP/CDP/ENTITY/IF MIB をベースに network discovery |
| **libvirt** | topology, hosts | KVM/Xen 仮想化発見（将来） |
| **proxmox** | topology, hosts, metrics | Proxmox VE（将来、scanopy ロードマップ参考） |
| **kubernetes** | topology, hosts | k8s API による Workload 層（将来） |

MVP の v1 では **snmp-lldp 1 個**を作る前提。詳細は `topology-foundation-mvp.md`。

## 7. プラグイン側の testConnection() 改訂

v2 では `testConnection()` の戻り値に **identity 取得可否**を追加する（autoscan 系）：

```ts
export interface ConnectionResult {
  ok: boolean
  message?: string
  diagnostics?: {
    canFetchTopology?: boolean
    canSupplyIdentity?: boolean   // mgmtIp / chassisId / sysName を取れるか
    sampleIdentity?: Identity     // テスト中に取れたサンプル
  }
}
```

UI のソース追加ウィザードはこの diagnostics を見せて「このソースで identity が取れるか」を
ユーザに事前に示せる。

## 8. configSchema の継承

v1 から変更なし。各プラグインが `configSchema` を返し、Web UI がそれを基にフォーム生成する
（CLAUDE.md の方針: configSchema 駆動。プラグイン名分岐は不可）。

autoscan 系プラグインの configSchema には `defaultScope` 等の autoscan 固有設定が含まれる
ことになる。

## 9. 廃止予定

- v1 の `watchTopology(onChange)`: realtime topology はサーバ側で snapshot を比較して
  差分を WS に流す形に集約する（プラグイン側に push を求めない）
- v1 で「成功でも `throw new Error()` で部分失敗を伝える」習慣: v2 では必ず
  `Snapshot.status` で表現する
</content>
