# Topology Foundation: MVP スライス（v1 スコープ）

> ステータス: ドラフト。`topology-foundation.md` の付属。
> 観測モデルを最小コストで end-to-end 動かす v1 の範囲定義。

## 0. なぜ MVP を切るのか

土台はかなりの広がりがある。全部を一度に作ると：

- 着手前に決めることが膨大になり進まない
- 並列に作ると整合が取れず手戻る
- 「土台が成立するか」の検証が遅れる

「最初の1スライス」で**観測モデルが end-to-end 通ることだけ**を示す。土台が破綻して
いないことが確認できれば、残りは積むだけになる。

## 1. v1 で動かすシナリオ

たった1つ：

> **authored で描いた小さな topology に、SNMP-LLDP autoscan を1個 attach。
> Element inspector で `confirmed` / `discovered-only` / `authored-only` /
> `conflicting` の4 state が見える。**

これだけ。

### 1.1 具体的な end-to-end ストーリー

1. ユーザが editor で 5 nodes / 8 links 程度の topology を描く（authored）
2. server の `/sources` で `snmp-lldp` プラグインインスタンスを作成、seed と community を設定
3. このソースを topology に attach
4. `/sources/[id]` から ad-hoc scan を実行
5. snapshot が `topology_observations` に1行入る
6. ユーザが topology viewer を開くと resolved グラフが描かれる:
   - authored のうち autoscan で確認できた node は `confirmed`（実線）
   - autoscan で見えるが authored に無い node は `discovered-only`（ゴースト）
   - authored に書いたが autoscan で見えない node は `authored-only`（破線）
   - field が食い違う node は `conflicting`（⚠ マーカー）
7. Element inspector を開くと、フィールドごとに観測元と値を side-by-side で見られる
8. Bootstrap matching UI が出て、authored node に identity を bind できる

これで土台の全部品が連動して動く証明になる。

## 2. v1 で**作る**もの

### 2.1 core（`libs/@shumoku/core`）

- [ ] `Provenance` / `Identity` 型を追加（`models/types.ts`）
- [ ] `Node` / `Link` / `Subgraph` / `NodePort` に optional `provenance` / `identity` を追加
- [ ] `src/resolve.ts` を新規実装
  - [ ] Node cluster 構築
  - [ ] Port マッチング
  - [ ] Link マッチング（dangling は v1 では「ghost にせず無視」でも可）
  - [ ] factual / chosen / intent-vs-reality の field-resolve
  - [ ] retraction（ヒステリシス N=3 既定）
- [ ] `src/identity.ts`（identity quality 計算、priority 順マッチング）
- [ ] fixture-driven テスト最低限（同意 / 食い違い / ifIndex 再採番 / dangling）

### 2.2 server（`apps/server/api`）

- [ ] migration 008: `topology_observations` テーブル追加、`priority` 等の廃止
- [ ] `services/observation.ts`: snapshot 保存 / GC / 検索
- [ ] `services/topology.ts` の `parse / render` 経路を `resolve()` 通過に変更
- [ ] API 追加:
  - [ ] `POST /sources/:id/scan` — ad-hoc scan
  - [ ] `GET /topologies/:id/observations` — snapshot 履歴一覧
  - [ ] `GET /topologies/:id/elements/:elementId/observations` — Element inspector 用
- [ ] 既存 `/topologies/:id/sync-from-source` を新フローに置き換え
- [ ] WebSocket: 構造変化 (`element-added` / `state-changed`) を流す（既存 metrics push に追加）

### 2.3 SNMP-LLDP プラグイン（新規 `libs/plugins/snmp-lldp`）

- [ ] SNMPv2c 対応のみ（v3 は v2）
- [ ] 識別フェーズ: sysObjectID / sysDescr / sysName
- [ ] System-MIB / IF-MIB / LLDP-MIB / IP-MIB walk
- [ ] `fetchTopology()`: snapshot 形式で返す。autoscan capability も同関数で
- [ ] `testConnection()`: identity 取得診断を返す
- [ ] configSchema: seed / community / scope (CIDR include/exclude)

Bun 互換の SNMP ライブラリ調査が必要（`net-snmp` npm パッケージは Node 前提、Bun での
動作確認）。動かない場合は wrapping か代替を検討。

### 2.4 Web UI（`apps/server/web`）

- [ ] サイドバー: `datasources` を `sources` に改名
- [ ] `/sources/[id]` 画面に scan 実行ボタン + 履歴
- [ ] `/topologies/[id]` viewer に state による視覚差別化:
  - [ ] `confirmed` / `discovered-only` / `authored-only` / `conflicting` の描画
  - [ ] グラフ上の ⚠ マーカー
- [ ] Element inspector パネル新規:
  - [ ] フィールドごとの観測 side-by-side
  - [ ] identity quality indicator
- [ ] Bootstrap matching UI（最小、確信度ソートのみ）

### 2.5 既存プラグインの最小対応

- [ ] **netbox**: `fetchTopology` を `Snapshot` 返却に書き換え、identity を埋める
- [ ] zabbix / prometheus / grafana / aruba: metrics/alerts/hosts のままで host の identity を充実（small）

## 3. v1 で**作らない**もの（明示）

棚上げを明示することが MVP の本体。以下は**全部 v2 以降**:

- [ ] カタログとの統合（discovery capabilities 宣言、未知デバイスからカタログ草稿）
- [ ] sysObjectID 外部辞書同梱
- [ ] SNMPv3
- [ ] NETCONF / RESTCONF / gNMI
- [ ] Proxmox / libvirt / VMware / Kubernetes プラグイン
- [ ] `shumoku-probe`（ステートレス中継）
- [ ] メトリクスログ永続化（time series 保存）— realtime push のみ
- [ ] conflict 解決 UI の操作部分（"Use X" 等のボタンは表示のみ、永続化は v2）
- [ ] resolved グラフのキャッシュ・incremental resolve
- [ ] field authority テーブルの完全版（v1 は3〜4 field のみハードコード）
- [ ] 観測 lineage / 時間遡行 UI
- [ ] dangling link の ghost endpoint 描画（v1 は無視）
- [ ] subgraph 観測（v1 は authored のみ subgraph を持つ）
- [ ] workload 層 / multi-layer 描画
- [ ] L3 / 経路 MIB の取り込み
- [ ] policy scope の `no-types` / `boundary-nodes`（v1 は CIDR include/exclude のみ）

## 4. v1 の受け入れ基準

```
GIVEN authored topology with 5 nodes
  AND snmp-lldp source attached, configured with valid seed and community
  AND seed device 's mgmtIp matches one authored node 's identity
  AND ad-hoc scan completes status='ok'

THEN topology viewer renders 5 authored nodes
  AND nodes also seen by snmp display as 'confirmed'
  AND nodes only authored display as 'authored-only'
  AND devices discovered by snmp but not in authored display as 'discovered-only'

GIVEN a node 's hostname differs between authored and snmp observation
THEN that node displays as 'conflicting' with ⚠ marker
  AND Element inspector shows both observations with source / observedAt

GIVEN port-level: SNMP returns Gi0/1 with ifIndex 10001
  AND subsequent scan returns Gi0/1 with ifIndex 10002
THEN port matching uses ifName, port remains 'confirmed'
  AND no spurious retraction occurs

GIVEN a scan returns status='failed'
THEN no retraction is applied to any node
  AND last_ok_captured_at is preserved
```

これらが green になれば v1 完了。

## 5. リスクと先回り

### 5.1 SNMP ライブラリの Bun 互換性
**risk**: `net-snmp` npm が Bun で動かない可能性
**先回り**: v1 着手前にスパイクで動作確認。動かなければ：
  (a) Bun の Node compat で動くようパッチ
  (b) 自前 SNMP（最小: System / LLDP / IF / IP MIB だけ実装）
  (c) Python or Go の SNMP daemon を spawn して JSON-RPC で通信（一時しのぎ）

### 5.2 identity 充実度のテスト fixture 不足
**risk**: 実機 SNMP を毎回叩くテストは現実的でない
**先回り**: snmpsim を docker で起動して fixture 用 device を模擬。CI で動かす。
あるいは録音した SNMP walk を再生する mock を作る。

### 5.3 resolved 計算の重さ
**risk**: 大きな topology で resolve が重い
**先回り**: v1 では 1000 nodes 程度を想定。プロファイル取って sub-second を目標。
キャッシュは v2。

### 5.4 既存プラグインの v2 移行が想定より重い
**risk**: netbox plugin は内部実装も含めて結構変える
**先回り**: 既存テスト fixture を流用して挙動の変化を assert。

## 6. 実装順序（推奨）

1. **core の型追加 + resolve.ts スケルトン**（1-2 day）。テスト fixture 1-2 個で動作確認
2. **DB migration 008 + observation サービス**（1 day）
3. **SNMP-LLDP プラグインのスパイク**（2-3 day）。Bun 互換性確認、識別 + LLDP walk
4. **netbox plugin の v2 化**（1-2 day）
5. **resolve.ts の本実装 + テスト網羅**（2-3 day）
6. **server API 追加 + WebSocket 拡張**（1-2 day）
7. **Web UI: state 視覚化 + Element inspector**（3-4 day）
8. **Bootstrap matching UI 最小版**（1-2 day）
9. **end-to-end の受け入れ基準消化**（1-2 day）

合計目安: **2〜3 週間**（1 人換算）。1, 3, 4 は並列に着手可。

## 7. PR 戦略

土台が大きいので 1 PR には収まらない。推奨分割：

1. `topology-foundation`: design docs（本ドキュメント群）— **既に PR #289 で進行中**
2. `topology-foundation-core`: core 型追加 + resolve スケルトン + テスト
3. `topology-foundation-db`: migration 008 + observation サービス
4. `topology-foundation-snmp`: snmp-lldp プラグイン
5. `topology-foundation-netbox-v2`: netbox plugin の v2 化
6. `topology-foundation-resolve`: resolve.ts 本実装 + 全 fixture テスト
7. `topology-foundation-api-ws`: API/WS 拡張
8. `topology-foundation-ui`: Web UI 一式

各 PR は前段に依存する。2-3 day x 8 PR が大体の感覚。
</content>
