# NetBox API Reference for Shumoku

Shumoku がネットワーク図生成に利用する NetBox API エンドポイントのリファレンス。

## 概要

NetBox は REST API と GraphQL API を提供しています。Shumoku は主に REST API を使用してネットワークトポロジ情報を取得します。

---

## DCIM（データセンターインフラ管理）

### Sites（サイト）

**エンドポイント:** `/api/dcim/sites/`

| フィールド | 型 | 説明 |
|-----------|------|------|
| `id` | integer | 一意識別子 |
| `name` | string | サイト名 |
| `slug` | string | URL用スラッグ |
| `status` | string | 状態（active, planned, retired） |
| `region` | object | 所属リージョン |
| `description` | string | 説明 |

**Shumoku での利用:** `subgraph` として表現

### Devices（デバイス）

**エンドポイント:** `/api/dcim/devices/`

| フィールド | 型 | 説明 |
|-----------|------|------|
| `id` | integer | 一意識別子 |
| `name` | string | デバイス名 |
| `device_type` | object | デバイスタイプ（manufacturer, model） |
| `role` | object | デバイスロール（router, switch等） |
| `platform` | object | プラットフォーム（OS） |
| `site` | object | 所属サイト |
| `location` | object | ラック位置 |
| `rack` | object | ラック |
| `status` | string | 状態（active, planned, staged, failed, offline） |
| `primary_ip4` | object | プライマリ IPv4 |
| `primary_ip6` | object | プライマリ IPv6 |
| `oob_ip` | object | OOB（帯域外管理）IP |
| `latitude` | float | 緯度 |
| `longitude` | float | 経度 |

**Shumoku での利用:** `node` として表現。`role` から `type` を推測。

### Interfaces（インターフェース）

**エンドポイント:** `/api/dcim/interfaces/`

| フィールド | 型 | 説明 |
|-----------|------|------|
| `id` | integer | 一意識別子 |
| `device` | object | 所属デバイス |
| `name` | string | インターフェース名（eth0, ge-0/0/0等） |
| `type` | string | 物理タイプ（1000base-t, 10gbase-x-sfpp等） |
| `enabled` | boolean | 有効/無効 |
| `mode` | string | VLANモード（access, tagged, tagged-all） |
| `untagged_vlan` | object | アンタグドVLAN |
| `tagged_vlans` | array | タグドVLAN一覧 |
| `cable` | object | 接続ケーブル |
| `speed` | integer | 速度（kbps） |
| `duplex` | string | 全二重/半二重 |
| `mac_address` | string | MACアドレス |
| `vrf` | object | 所属VRF |
| `_occupied` | boolean | ケーブル接続済みか |

**Shumoku での利用:** `port` として表現。リンクの終端として使用。

### Cables（ケーブル）

**エンドポイント:** `/api/dcim/cables/`

| フィールド | 型 | 説明 |
|-----------|------|------|
| `id` | integer | 一意識別子 |
| `a_terminations` | array | A側終端（インターフェース等） |
| `b_terminations` | array | B側終端 |
| `type` | string | ケーブルタイプ（cat5e, cat6, fiber-om3等） |
| `status` | string | 状態（connected, planned, decommissioning） |
| `color` | string | ケーブル色 |
| `length` | float | 長さ |
| `length_unit` | string | 長さ単位（m, ft） |

**Shumoku での利用:** `link` として表現。

### Cable Trace（ケーブルトレース）

**エンドポイント:** `/api/dcim/interfaces/<ID>/trace/`

ケーブルパスを終端から終端までトレースします。パススルーパッチパネルも含む完全なパスを取得可能。

| パラメータ | 説明 |
|-----------|------|
| `render=svg` | SVG画像として取得 |

**レスポンス:**
- 各セグメントのケーブルと終端のリスト
- パスが完全か、アクティブか、分岐しているか

### Racks（ラック）

**エンドポイント:** `/api/dcim/racks/`

| フィールド | 型 | 説明 |
|-----------|------|------|
| `id` | integer | 一意識別子 |
| `name` | string | ラック名 |
| `site` | object | 所属サイト |
| `location` | object | 位置 |
| `u_height` | integer | ユニット数 |
| `starting_unit` | integer | 開始ユニット番号 |

### Locations（ロケーション）

**エンドポイント:** `/api/dcim/locations/`

サイト内の階層的な位置（建物、フロア、部屋等）。

### Manufacturers（メーカー）

**エンドポイント:** `/api/dcim/manufacturers/`

| フィールド | 型 | 説明 |
|-----------|------|------|
| `id` | integer | 一意識別子 |
| `name` | string | メーカー名（Yamaha, Juniper等） |
| `slug` | string | スラッグ |

**Shumoku での利用:** `vendor` として表現。アイコン選択に使用。

### Device Types（デバイスタイプ）

**エンドポイント:** `/api/dcim/device-types/`

| フィールド | 型 | 説明 |
|-----------|------|------|
| `id` | integer | 一意識別子 |
| `manufacturer` | object | メーカー |
| `model` | string | モデル名 |
| `slug` | string | スラッグ |
| `u_height` | integer | ラックユニット数 |

**Shumoku での利用:** `model` として表現。アイコン選択に使用。

### Device Roles（デバイスロール）

**エンドポイント:** `/api/dcim/device-roles/`

| フィールド | 型 | 説明 |
|-----------|------|------|
| `id` | integer | 一意識別子 |
| `name` | string | ロール名 |
| `slug` | string | スラッグ（router, switch, firewall等） |
| `color` | string | 表示色 |

**Shumoku での利用:** `type` の推測に使用。

---

## IPAM（IPアドレス管理）

### VLANs

**エンドポイント:** `/api/ipam/vlans/`

| フィールド | 型 | 説明 |
|-----------|------|------|
| `id` | integer | 一意識別子 |
| `vid` | integer | VLAN ID（1-4094） |
| `name` | string | VLAN名 |
| `status` | string | 状態 |
| `site` | object | 所属サイト |
| `group` | object | VLANグループ |
| `role` | object | 役割 |
| `tenant` | object | テナント |

**Shumoku での利用:** L2セグメントのグループ化、リンクのラベル。

### VLAN Groups

**エンドポイント:** `/api/ipam/vlan-groups/`

| フィールド | 型 | 説明 |
|-----------|------|------|
| `id` | integer | 一意識別子 |
| `name` | string | グループ名 |
| `vid_ranges` | array | 有効なVLAN ID範囲 |
| `scope_type` | string | スコープタイプ |

### Prefixes（プレフィックス）

**エンドポイント:** `/api/ipam/prefixes/`

| フィールド | 型 | 説明 |
|-----------|------|------|
| `id` | integer | 一意識別子 |
| `prefix` | string | CIDR表記（192.168.1.0/24） |
| `vrf` | object | 所属VRF |
| `vlan` | object | 関連VLAN |
| `status` | string | 状態 |
| `role` | object | 役割 |
| `is_pool` | boolean | IPプールとして扱うか |
| `scope` | object | スコープ（リージョン、サイト等） |

**Shumoku での利用:** サブネットの囲み表現。

### IP Addresses

**エンドポイント:** `/api/ipam/ip-addresses/`

| フィールド | 型 | 説明 |
|-----------|------|------|
| `id` | integer | 一意識別子 |
| `address` | string | IPアドレス（192.168.1.1/24） |
| `vrf` | object | 所属VRF |
| `status` | string | 状態 |
| `role` | string | 役割（loopback, secondary, vip等） |
| `assigned_object_type` | string | 割当先タイプ（dcim.interface等） |
| `assigned_object_id` | integer | 割当先ID |
| `assigned_object` | object | 割当先オブジェクト |
| `nat_inside` | object | NAT内部IP |
| `dns_name` | string | DNS名 |

**Shumoku での利用:** ノードやポートのラベル。

### VRFs

**エンドポイント:** `/api/ipam/vrfs/`

| フィールド | 型 | 説明 |
|-----------|------|------|
| `id` | integer | 一意識別子 |
| `name` | string | VRF名 |
| `rd` | string | Route Distinguisher |
| `enforce_unique` | boolean | IP重複を禁止するか |
| `import_targets` | array | インポートRT |
| `export_targets` | array | エクスポートRT |

---

## Virtualization（仮想化）

### Clusters

**エンドポイント:** `/api/virtualization/clusters/`

| フィールド | 型 | 説明 |
|-----------|------|------|
| `id` | integer | 一意識別子 |
| `name` | string | クラスタ名 |
| `type` | object | クラスタタイプ |
| `group` | object | クラスタグループ |
| `site` | object | サイト |

### Virtual Machines

**エンドポイント:** `/api/virtualization/virtual-machines/`

| フィールド | 型 | 説明 |
|-----------|------|------|
| `id` | integer | 一意識別子 |
| `name` | string | VM名 |
| `status` | string | 状態 |
| `cluster` | object | 所属クラスタ |
| `role` | object | 役割 |
| `platform` | object | プラットフォーム |
| `primary_ip4` | object | プライマリ IPv4 |
| `primary_ip6` | object | プライマリ IPv6 |
| `vcpus` | float | vCPU数 |
| `memory` | integer | メモリ（MB） |
| `disk` | integer | ディスク（GB） |

**Shumoku での利用:** `node` として表現。`type: server` または `type: virtual-machine`。

### VM Interfaces

**エンドポイント:** `/api/virtualization/interfaces/`

| フィールド | 型 | 説明 |
|-----------|------|------|
| `id` | integer | 一意識別子 |
| `virtual_machine` | object | 所属VM |
| `name` | string | インターフェース名 |
| `enabled` | boolean | 有効/無効 |
| `mode` | string | VLANモード |
| `untagged_vlan` | object | アンタグドVLAN |
| `tagged_vlans` | array | タグドVLAN一覧 |

---

## データの関連性

```
Region
  └── Site Group
        └── Site
              ├── Location
              │     └── Rack
              │           └── Device
              │                 └── Interface
              │                       ├── Cable (→ 別のInterface)
              │                       ├── IP Address
              │                       └── VLAN (tagged/untagged)
              └── VLAN Group
                    └── VLAN
                          └── Prefix
```

### Interface と IP Address の関係

- `IPAddress.assigned_object` → `Interface` への参照
- 1つの Interface に複数の IP Address を割当可能

### Interface と VLAN の関係

- `Interface.untagged_vlan` → アクセスポート用（1つ）
- `Interface.tagged_vlans` → トランクポート用（複数）
- `Interface.mode` で動作モードを指定（access, tagged, tagged-all, q-in-q）

### Cable と Interface の関係

- `Cable.a_terminations` / `Cable.b_terminations` → 両端の Interface
- パススルー（パッチパネル）経由の場合、Cable Trace API で完全パス取得

---

## Shumoku でのマッピング

| NetBox | Shumoku | 備考 |
|--------|---------|------|
| Device | Node | `role.slug` → `type` |
| Virtual Machine | Node | `type: server` |
| Interface | Port | 物理/仮想両対応 |
| Cable | Link | 物理接続 |
| Site | Subgraph | 最上位グループ |
| Location | Subgraph | ネスト可能 |
| Rack | Subgraph | 物理配置図用 |
| VLAN | Subgraph / Link属性 | L2セグメント表現 |
| Prefix | Subgraph | L3サブネット表現 |
| Manufacturer | vendor | アイコン選択 |
| Device Type | model | アイコン選択 |

---

## フィルタリング例

### 特定サイトのデバイスのみ取得

```
GET /api/dcim/devices/?site=tokyo-dc
```

### アクティブなデバイスのみ

```
GET /api/dcim/devices/?status=active
```

### 特定ロールのデバイス

```
GET /api/dcim/devices/?role=router
```

### デバイスに属するインターフェース

```
GET /api/dcim/interfaces/?device_id=123
```

### VLANに属するインターフェース

```
GET /api/dcim/interfaces/?vlan_id=100
```
