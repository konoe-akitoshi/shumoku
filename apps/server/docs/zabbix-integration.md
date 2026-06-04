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

## トポロジー取り込み (Network Maps / sysmaps)

Zabbix の **ネットワークマップ (sysmap)** を 1 枚選んで shumoku の `NetworkGraph`
に変換する (`topology` capability / `fetchTopology`)。**標準の `map.get` のみ**に依存し、
自作マップ生成モジュール (例: ShowNet の `/zabbix/netmap`) のラベル/アイコン規約には
依存しない。

### 設定 (アタッチ単位 / `optionsJson`)

マップ選択はデータソース config ではなく **トポロジーへのアタッチ時オプション**
(`optionsSchema`)。1 つの Zabbix ソースを複数トポロジーに別マップで使える。

| キー | 説明 |
|------|------|
| `sysmapId` | 取り込む sysmap の ID。候補は `getConfigOptions('map')` が `map.get` で動的供給 |
| `groupBy` | `hostgroup` (既定) / `none`。下記参照 |
| `groupExclude` | サブグラフに使わないホストグループ名 (管理/全体グループの除外) |

### 変換マッピング

| Zabbix | shumoku | 備考 |
|--------|---------|------|
| selement `elementtype:0` (host) | `Node` | `elements[0].hostid` を `host.get` でバッチ解決 |
| host `name` | `Node.label` | selement.label は `{HOST.NAME}` マクロ (API では未展開) なので使わない |
| 既定インターフェース IP | `identity.mgmtIp` / `Node` ip | `main==='1'` 優先 |
| host id / sysName | `identity.vendorIds['zabbix-hostid']` / `sysName` | リゾルバのクラスタリング用 |
| `inventory.hardware` | `spec.vendor` / `model` / `type` | best-effort パース。空なら Generic |
| link `selementid1/2` | `Link.from/to.node` | 端点ごとに **ポートを合成** (1 port = 1 endpoint 不変条件) |
| link `drawtype` / `color` | `Link.type` / `style.stroke` | 0=solid,2=thick,3/4=dashed |
| host group | `Subgraph` | `groupBy` 参照 |

### グルーピング (`groupBy`)

- **`hostgroup`** (既定): 各ノードを **最も具体的なホストグループ**(マップ上メンバー数が
  最小のグループ)に入れる。全ホストを含む管理/全体グループは自動的に負けるので、
  ベンダ固有の命名規則に依存せずセグメント単位に分かれる。`groupExclude` で
  特定グループを明示除外。
- **`none`**: マップ上の標準ホストグループ要素 (`elementtype:3`) のみをサブグラフ化。
  素の Zabbix マップはこの形式だが、自動生成マップは持たないことが多い (= フラット)。

### 現時点の非対応 (今後)

- selement の x/y 座標は `Node.position` に未反映 (レイアウト保持は別途検討)。
- submap (`type:1`) / trigger (`type:2`) / image (`type:4`) 要素はスキップ。
- リンクのポート名 / 帯域 / VLAN は標準マップに無いため未対応 (`item.get` で別途付与の余地)。

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
