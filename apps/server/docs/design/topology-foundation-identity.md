# Topology Foundation: Identity と Correlation

> ステータス: ドラフト。`topology-foundation.md` の付属。
> 観測モデルの**最深の論点**: 複数ソースの観測を同一実機に結びつける identity 設計。

## 0. なぜ identity が最深の論点か

観測モデルにおいて「更新」「削除」「メトリクス bind」「conflict 判定」**すべて**が
identity による同一性判定に乗る。identity が決まらないと：

- ある観測が *新規 node* なのか *既存 node の update* なのか判定不能
- スキャンで「見えなくなった」node を retract したいが、同一性が揺らぐと誤検知する
- メトリクスは port 単位で来るが、port を `id` で bind すると再起動で剥がれる
- 「NetBox 観測の R1」と「SNMP 観測の R1」が同じ実機かを判定できないと conflict すら検出できない

## 1. Identity 型（再掲）

`topology-foundation-schema.md` で定義した型を要約：

```ts
export interface Identity {
  // --- Node 用（device-identifying） ---
  mgmtIp?: string            // 管理 IP
  chassisId?: string         // LLDP chassisId（MAC or vendor 文字列）
  sysName?: string           // SNMP sysName
  vendorIds?: Record<string, string>  // 'netbox-device-id' 等

  // --- Port 用（interface-identifying） ---
  ifIndex?: number           // SNMP ifIndex（不安定）
  ifName?: string            // ifName ("GigabitEthernet1/0/1")
  mac?: string               // インタフェース MAC

  // vendorIds は Port にも使う（'netbox-interface-id' 等）
}
```

Node にも Port にも同じ型を使う（フィールドは部分的に重なる）。

## 2. ifIndex 不安定問題

### 2.1 何が起きるか

SNMP `ifIndex` は IF-MIB の interface table の index。**RFC は再起動を跨いだ持続を
要求していない**ため、多くの機器で reboot / 物理 NIC の追加抜去 / 論理 IF 作成削除で
再採番される。

```
[再起動前] GigabitEthernet1/0/1 → ifIndex 10001
           GigabitEthernet1/0/2 → ifIndex 10002

[再起動後] GigabitEthernet1/0/1 → ifIndex 10002
           GigabitEthernet1/0/2 → ifIndex 10001
```

結果: ifIndex 単独を port identity にすると **再起動で port が「別物」に見える**。
メトリクスマッピングが全壊し、`confirmed` だった port が突然 `discovered-only`
になる（旧 ifIndex の port が retract される）。

### 2.2 対策の階層

ベストプラクティスの順：

1. **device-side ifIndex persistence を有効化してもらう**
   - Cisco: `snmp-server ifindex persist`（IOS / IOS-XE / IOS-XR / NX-OS）
   - Juniper: 標準で persistent（特に対策不要）
   - Arista: 標準で persistent
   - shumoku 側からは「**カタログの推奨設定欄**」で明示し、UI で警告する
2. **複合キーで突合**: `ifIndex` 単独に依存しない。`ifName` を主、ifIndex を補助
3. **MAC を補助キー**: 物理 NIC は基本不変なので、ifName が変わるリネーム時の保険
4. **identity quality indicator** で「掴みが弱い port」を UI で surface

### 2.3 推奨 Port identity 優先順位

```
priority 1:  ifName + chassisId-of-parent-node   ← 最強（OS から見た正規名 + 所属機器）
priority 2:  ifName + parentNode.mgmtIp
priority 3:  ifIndex + parentNode.identity       ← 弱い（再起動非耐性）
priority 4:  mac                                  ← さらに弱い（仮想 NIC で揺れる）
priority 5:  plugin 内 deterministic id           ← 最終 fallback
```

resolver の port マッチングはこの優先順位で評価する。詳細は
`topology-foundation-resolve.md`。

## 3. Node identity 優先順位

```
priority 1:  mgmtIp + chassisId                   ← 強（実機 1 台に必ず一致）
priority 2:  chassisId                             ← 単独でも強い
priority 3:  mgmtIp                                ← 強いが DHCP / NAT で揺れる場合あり
priority 4:  vendorIds (例: netbox-device-id)     ← ソース内では強い、横断は不可
priority 5:  sysName                              ← 弱い（命名規約次第で衝突）
priority 6:  plugin 内 deterministic id           ← 最終 fallback
```

複数キーが揃うほど **identity quality** が上がる。

## 4. identity quality 計算

各 Node / Port について：

```ts
function identityQuality(id: Identity, kind: 'node' | 'port'): 'stable' | 'weak' | 'unbound' {
  if (kind === 'node') {
    if (id.chassisId && (id.mgmtIp || id.sysName)) return 'stable'
    if (id.chassisId || id.mgmtIp) return 'weak'
    return 'unbound'
  }
  // port
  if (id.ifName && (id.mac || id.ifIndex !== undefined)) return 'stable'
  if (id.ifName || id.mac) return 'weak'
  return 'unbound'
}
```

UI の Element inspector に表示。weak の port は「ifIndex 再採番でメトリクス bind が
切れるリスクあり」のツールチップを出す。

## 5. Correlation アルゴリズム（resolver 側）

resolver は複数 snapshot を畳んで resolved NetworkGraph を作る。中核は「ある観測が
既存 node/port の更新か新規かを判定するマッチング」。

### 5.1 Node マッチング

入力: 全 snapshot の全 Node を集めた集合 + authored の全 Node。

```
1. authored Node を「コア」として初期化（cluster の核）
2. 全 snapshot Node を順に処理:
   a. priority 1 から順に identity key で既存 cluster と突合
   b. ヒットしたら同 cluster に統合
   c. どれもヒットしなかったら新 cluster を作る
3. 各 cluster が resolved NetworkGraph の 1 Node になる
4. cluster 内の identity を union（より多くのキーが揃う）
5. cluster 内のフィールドを resolve（事実/選択/intent vs reality）
```

**識別キーの衝突回避**: 複数 cluster が同じ identity key を主張すると矛盾なので、
matching 中に検出し UI に「identity 衝突」として上げる（rare ケース、検知できれば足る）。

### 5.2 Port マッチング

port は親 Node に従属。

```
1. 親 Node が cluster に統合された後で、その cluster 内の port をマッチング
2. priority 1 から ifName/mac/ifIndex で突合
3. 別 cluster の port とは突合しない（誤マッチ防止）
```

### 5.3 Link マッチング

Link は endpoint で識別される。両端の port が cluster 統合された後で：

```
link.from = (cluster_X, port_y), link.to = (cluster_Z, port_w)
```

同じ (from, to) ペアの link 観測を統合（順序を正規化）。

### 5.4 Dangling reference

snapshot A が link を主張するが、その endpoint port が cluster に存在しない場合：

```
1. 「観測された ghost endpoint」として placeholder port を作る
2. resolver の出力で provenance.source = '<snapshot A の source>',
   provenance.state = 'discovered-only' をマーク
3. UI には ghost として表示（半透明・破線）
```

これは「LLDP が隣接を語るが反対側を観測できていない」典型ケースを救う。

## 6. Bootstrap — 初回の identity 固定

新しい topology に authored で node を描き、初めて autoscan を attach する瞬間。
authored node に identity がほぼ無いと、autoscan が観測した実機と全くマッチしない。

### 6.1 UX フロー

```
Bootstrap matching — autoscan-source-1
─────────────────────────────────────────────────────
142 devices observed.  89 auto-matched by mgmtIp.
53 unmatched.  Review:

10.0.0.42  (sysName: rtr-edge-1)
  Likely match: "Edge Router 1" you drew    confidence 84%
  Reason: sysName fuzzy + same subnet as drawn group "Edge"
  Match key would be: mgmtIp = 10.0.0.42
  [Match]  [New node]  [Skip]

10.0.5.1   (sysName: sw-distri-A)
  No likely candidate in authored
  [New node]  [Skip]

[Apply all "New node" for remaining 47 ▾]
```

### 6.2 推測アルゴリズム（候補スコアリング）

```
score(authored_node, observed) =
   + (sysName と label の lower-case 完全一致なら) 50
   + (sysName と label の編集距離 ≤ 3 なら)        20
   + (authored.subgraph が observed の subnet を含むなら) 15
   + (port 数が ±20% 以内なら)                     10
   + (vendor 推定が一致するなら)                    5

→ threshold = 50 で候補表示、80 以上で "Likely match"
```

threshold やヒューリスティクスは v1 では保守的に（False match を避ける）。

### 6.3 ユーザの match 操作 = authored node に identity を埋める

「Match」を押した瞬間、authored 側の node に observed の identity key（mgmtIp 等）が
書き込まれる。以降は自動的に identity 突合される（**掴みが確立**）。

## 7. Identity を持たない authored Node の運用

人が editor で描いた直後は identity がほぼ無い（label とソフトな mgmtIp 程度）。
これらの node は：

- discover の自動 matching から外れる（誤マッチ防止）
- "quality: unbound" として表示
- bootstrap UI / Element inspector の "Bind identity" 操作で identity を補完できる

この**手動 bind 操作**は authored node に identity を**人が書き込む**ことなので、
provenance.source = 'authored' のまま identity だけ追加される。

## 8. authored の自由を守る

memory「Element unification」「Silent correctness over affordance」を踏まえ：

- authored 側に identity を書く UI は editor / Element inspector の両方で同等にできる
- 人が書いた identity を discovery が**自動で上書きしてはいけない**（observation で
  値が違っても、authored の値が「人が決めたキー」なら優先）
- 人がまだ identity を書いていない authored node は「未 bind」として diagnostic 表示

これは「フィールドの3分類」のうち**選択フィールド**（人が書く）に identity も入る
扱い。値の競合は人の判断で解消する。

## 9. 外部 sysObjectID 辞書（カタログにモデルが無い場合）

`topology-foundation.md § 2.4` で触れた未知デバイス対応。SNMP の `sysObjectID` は
enterprise OID で世界的に一意。代表的なベンダー OID 接頭辞は公開データで網羅可能：

```
1.3.6.1.4.1.9.*     Cisco
1.3.6.1.4.1.2636.*  Juniper
1.3.6.1.4.1.30065.* Arista
1.3.6.1.4.1.6527.*  Nokia
1.3.6.1.4.1.674.*   Dell
1.3.6.1.4.1.11.*    HPE
...
```

shumoku 同梱の小さな辞書で「ベンダー」までは引ける。具体モデル名は
sysObjectID → model 辞書を別途同梱（公開データ由来）。詳細はカタログ側設計と
連動するので別途棚上げ（`topology-foundation.md § 5-8`）。

## 10. テスト戦略

identity モデルは複雑度の中心。**観測モデルが純粋関数**である利点を最大限に：

- correlation テストは「snapshot 入力 → cluster 出力」の純粋テスト
- ifIndex 入替を再現する fixture を作り、port matching が壊れないことを assert
- 2 ソースの同一機器を異なる identity 構成で観測する scenario set
- Bootstrap の推測アルゴリズムは false positive / false negative 比率を測る回帰テスト

詳細は `topology-foundation-resolve.md` のテスト戦略節と統合。
</content>
