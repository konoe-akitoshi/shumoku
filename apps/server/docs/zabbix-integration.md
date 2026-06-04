# Zabbix Integration

Shumoku ServerのZabbix連携に関する開発ドキュメント。

## 概要

ZabbixからメトリクスをポーリングしてWeathermapに反映する。

```
Zabbix Server ──(JSON-RPC API)──> Shumoku Server ──(WebSocket)──> Browser
```

## 接続設定

### 環境変数 / config.yaml

```yaml
zabbix:
  url: "http://your-zabbix-server"
  token: "your-api-token"
  pollInterval: 30000  # ms
```

### APIトークン作成手順

1. Zabbix Web UI → Administration → API tokens
2. Create API token
3. 必要な権限: `host.get`, `item.get`, `hostinterface.get`

---

## Zabbix API リファレンス

### 認証

```http
POST /api_jsonrpc.php
Content-Type: application/json-rpc
Authorization: Bearer <token>
```

### 主要メソッド

| メソッド | 用途 | 現状 |
|---------|------|------|
| `apiinfo.version` | API バージョン確認 (無認証) | ✅ 実装済 |
| `host.get` | ホスト一覧取得 (interfaces/inventory/hostgroups/templates) | ✅ 実装済 |
| `item.get` | アイテム(メトリクス)取得 | ✅ 実装済 |
| `event.get` | 障害イベント取得 (アラート) | ✅ 実装済 |
| `map.get` | ネットワークマップ(sysmap)取得 | ✅ 実装済 (トポロジー) |
| `hostgroup.get` | ホストグループ | （host.get の selectHostGroups で代替） |
| `trigger.get` | トリガー(障害定義) | ❌ 未実装 |
| `history.get` | 過去データ | ❌ 未実装 |

---

## 取得可能なデータ

### ホスト情報 (`host.get`)

```json
{
  "hostid": "10084",
  "host": "router-01",
  "name": "Router 01 (Display Name)",
  "status": "0"  // 0=有効, 1=無効
}
```

**用途**: ノードのマッピング、表示名

### アイテム (`item.get`)

```json
{
  "itemid": "28336",
  "hostid": "10084",
  "name": "Interface eth0: Bits received",
  "key_": "net.if.in[eth0]",
  "lastvalue": "123456789",
  "lastclock": "1704067200",
  "units": "bps"
}
```

**用途**: メトリクス値の取得

### よく使うアイテムキー

| キー | 説明 | 用途 |
|------|------|------|
| `agent.ping` | Agent疎通確認 | ノード死活 |
| `icmpping` | ICMP疎通確認 | ノード死活 |
| `net.if.in[if]` | 受信トラフィック (bps) | リンク使用率 |
| `net.if.out[if]` | 送信トラフィック (bps) | リンク使用率 |
| `net.if.speed[if]` | インターフェース速度 | 使用率計算 |
| `ifOperStatus[if]` | インターフェース状態 | リンク状態 |
| `system.cpu.util` | CPU使用率 | ノード負荷 |
| `vm.memory.util` | メモリ使用率 | ノード負荷 |

### ホストインターフェース (`hostinterface.get`)

```json
{
  "interfaceid": "1",
  "hostid": "10084",
  "ip": "192.168.1.1",
  "dns": "router-01.local",
  "port": "10050",
  "type": "1"  // 1=Agent, 2=SNMP, 3=IPMI, 4=JMX
}
```

**用途**: ノードのIPアドレス表示

### トリガー (`trigger.get`)

```json
{
  "triggerid": "13491",
  "description": "Interface eth0 is down",
  "priority": "4",  // 0=未分類, 1=情報, 2=警告, 3=軽度, 4=重度, 5=致命的
  "value": "1"      // 0=OK, 1=障害
}
```

**用途**: 障害表示、アラート

### 障害 (`problem.get`)

```json
{
  "eventid": "123",
  "objectid": "13491",  // trigger ID
  "name": "Interface eth0 is down",
  "severity": "4",
  "acknowledged": "0"
}
```

**用途**: 現在発生中の障害表示

---

## トポロジー生成 (LLDP)

Zabbix から **ノード＋リンク**を生成する (`topology` capability / `fetchTopology`)。
**ノードはホスト (`host.get`)、リンクは各ホストの LLDP 隣接アイテム**から。Zabbix の
マップ (sysmap) や自作マップ生成モジュールには依存せず、**shumoku からの直接 SNMP も不要**
(Zabbix が収集済み)。詳細は `docs/design/zabbix-lldp-topology.md`。

リンクの出どころは**標準 LLDP-MIB** (`lldpRemSysName` 等、OID `1.0.8802.1.1.2…`) を
SNMP_walk → LLD → dependent item で取り込んだもの。アイテムキー命名 (`lldp.rem.*`) は
LLDP テンプレ依存なので、**`lldp.rem.sysname` が無いホストはノードのみ**になる (graceful)。

### 設定 (アタッチ単位 / `optionsJson`)

| キー | 説明 |
|------|------|
| `hostGroups` | 取り込み対象のホストグループ id (`getConfigOptions('hostgroup')` が動的供給)。**大規模インスタンスでは必須級** (数千ホスト)。空=全件 |
| `groupBy` | `hostgroup` (既定, 最も具体的なグループに入れる) / `none` |
| `groupExclude` | サブグラフに使わないホストグループ名 |
| `includeExternalNeighbors` | Zabbix ホストでない LLDP 隣接にノードを合成 (既定 true) |

### 変換マッピング

| Zabbix | shumoku | 備考 |
|--------|---------|------|
| `host.get` host | `Node` | `id=<src>:host:<hostid>` |
| host `name` | `Node.label` / `identity.sysName` | **sysName は host.name** (host.host は IP のことがあり不可) |
| 既定 IF の IP | `identity.mgmtIp` | `main==='1'` 優先 |
| host id | `identity.vendorIds['zabbix-hostid']` | |
| `inventory.hardware` | `spec.vendor/model/type` | best-effort パース |
| LLDP 隣接 (`lldp.rem.sysname` 等) | `Link` | local IF + 隣接機器/ポートで端点。**実ポート名**つき |
| `lldp.loc.if.ifSpeed` | port `speed` / link `metadata.speedBps` | |
| ホストグループ | `Subgraph` | `groupBy` 参照 |

### 要点
- アイテムは host id バッチで `item.get`、IF ごとに**アイテム名の `[ifName]` サフィックス**で join (キーはファミリ間で形が揃っていないため)。
- LLDP は双方向に出るので**リンクを de-dup** (端点ペアの正規化キー)。
- 解決できない隣接は**外部ノードを合成** (identity.sysName 付き)。後で当該機器を別グループ/別ソースで取り込むと resolver が identity で**自動統合**。

### 現時点の非対応 (今後)
- ノード座標、VLAN、リンクアグリゲーションのまとめ。
- 非 L2DM な LLDP テンプレ向けのキー接頭辞設定 (現状は共通命名を自動検出)。
- リモートポート id が MAC のとき de-dup が緩むケース。

---

## マッピング

### ノードマッピング

トポロジーのノードIDとZabbixホストの紐付け:

```yaml
# mappingJson (DB保存)
nodes:
  router-01:
    hostId: "10084"        # Zabbix host ID
  switch-01:
    hostName: "sw-01"      # またはホスト名で指定
```

**自動マッピング**: `node.id` または `node.label` でホスト名を検索

### リンクマッピング

トポロジーのリンクとZabbixアイテムの紐付け:

```yaml
links:
  link-0:
    in: "28336"           # item ID (受信)
    out: "28337"          # item ID (送信)
    interface: "eth0"     # または interface名で検索
    bandwidth: 1000000000 # 回線容量 (bps) — topology の link.bandwidth を上書き
```

**自動マッピング**: `link.from.port` でインターフェース名を推測

---

## 実装状況

### 完了

- [x] ZabbixClient - 基本的なAPI通信
- [x] ZabbixPoller - 定期ポーリング
- [x] ZabbixMapper - ノード/リンクマッピング
- [x] DataSource管理 - DBでZabbix接続情報管理

### TODO

- [ ] 接続テストAPI (`/api/datasources/:id/test`)
- [ ] ホスト一覧取得API (マッピングUI用)
- [ ] アイテム検索API (マッピングUI用)
- [ ] インターフェース一覧取得
- [ ] 障害情報の取得・表示
- [ ] トリガー状態の反映
- [ ] ヒストリ取得 (グラフ表示用)

---

## UI設計 (予定)

### Settings > Data Source

1. 接続情報入力 (URL, Token)
2. 接続テスト
3. ホスト一覧プレビュー

### Topology > Settings > Mapping

1. ノード一覧 - Zabbixホスト選択
2. リンク一覧 - インターフェース/アイテム選択
3. 自動マッピングボタン

---

## 参考リンク

- [Zabbix API Documentation](https://www.zabbix.com/documentation/current/en/manual/api)
- [API Token Authentication](https://www.zabbix.com/documentation/current/en/manual/web_interface/frontend_sections/administration/api_tokens)
