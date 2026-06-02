# Topology Foundation: resolve() アルゴリズム

> **一部 SUPERSEDED — `topology-source-priority-merge.md`（実装済み）を参照。**
> 「authored を核に observed を畳む」骨子は **全ソース同列の priority フィールドマージ**
> （人＝最優先ソース、層は無い）に置き換わった。identity clustering / provenance /
> retraction の記述は引き続き有効。
>
> ステータス: ドラフト。`topology-foundation.md` の付属。
> 観測モデルの中核となる純粋関数の擬似コード仕様。

## 0. シグネチャ

```ts
function resolve(
  authored: NetworkGraph,
  snapshots: SnapshotEntry[],
  options?: ResolveOptions,
): ResolvedGraph
```

```ts
interface SnapshotEntry {
  sourceId: string
  capturedAt: number
  status: 'ok' | 'partial' | 'failed' | 'empty'
  graph: NetworkGraph | null   // failed のとき null
  // 連続失敗回数（retraction ヒステリシス用）
  consecutiveFailures?: number
}

interface ResolveOptions {
  // 失敗判定のヒステリシス N（既定 3）
  retractAfterMissedScans?: number

  // 観測の古さ閾値（ms）。これより古い観測は conflict 計算に使わない
  staleThresholdMs?: number    // 既定 30 日

  // 観測品質の権威表（field 名 → 優先 source パターン）
  fieldAuthority?: FieldAuthorityTable
}

// 出力は NetworkGraph と同型。要素に provenance.state が埋まる。
type ResolvedGraph = NetworkGraph
```

純粋関数。同じ入力なら同じ出力。副作用なし。

## 1. アルゴリズム全体像

```
resolve(authored, snapshots, options):
  1. 有効な snapshot 群を filter（failed は除外、stale は文脈で扱う）
  2. Node cluster を作る:
     - 各 cluster = 「1 つの実機」を表す観測の集合
     - authored.nodes が初期 cluster の核
     - snapshot.nodes を identity key で既存 cluster へマージ
  3. cluster ごとに resolved Node を生成:
     - identity を union
     - 各フィールドを field-resolve（一致/不一致/単一観測の判定）
     - provenance.state を埋める
  4. Port を親 cluster 内でマッチング:
     - Port cluster を作る（cluster 内）
     - resolved Port を生成
  5. Link をマッチング:
     - endpoint cluster ペアでグループ化
     - resolved Link を生成
     - dangling endpoint は ghost port として補完
  6. Subgraph:
     - identity を持たないので id ベースで union（authored 優先）
     - membership は authored を尊重
  7. retraction:
     - authored 由来でない要素で、最後の観測が「N 回連続失敗 or 観測なし」なら除外
  8. 構成
     - 結合した NetworkGraph を返す
```

各ステップは O(n) or O(n log n) で実装できる。

## 2. Step 2: Node cluster 構築（詳細）

```pseudo
clusters: Map<ClusterId, NodeCluster> = {}
keyIndex: Map<IdentityKey, ClusterId> = {}   // mgmtIp/chassisId/sysName/vendorId → cluster

function addToCluster(node, source):
  // priority 順に identity key を試す
  for key in keysOf(node.identity, priority='node'):
    if keyIndex.has(key):
      cluster = clusters[keyIndex[key]]
      cluster.members.push({ source, node })
      // 他のキーも同じ cluster に bind
      for k2 in keysOf(node.identity):
        keyIndex[k2] = cluster.id
      return cluster.id

  // どのキーもヒットしない → 新 cluster
  newCluster = { id: newClusterId(), members: [{ source, node }] }
  clusters[newCluster.id] = newCluster
  for k in keysOf(node.identity):
    keyIndex[k] = newCluster.id
  return newCluster.id

// authored を先に
for node in authored.nodes:
  addToCluster(node, source='authored')

// snapshot は capturedAt 昇順で
for snap in sortBy(snapshots, 'capturedAt'):
  if snap.status === 'failed': continue
  for node in snap.graph.nodes:
    addToCluster(node, source=snap.sourceId)
```

### 2.1 衝突検知

`addToCluster` で「cluster_A の mgmtIp と cluster_B の chassisId が同じ key の衝突を
持つ」状況は識別矛盾。検出して `identity-conflict` という診断要素を出す（rare ケース、
人手で解消）。

### 2.2 identity 未供給 node

`identity` がすべて空の node はそのまま新 cluster を作る。次回スキャンでもマッチしないので
**毎回新規 node に見える**（"unbound" quality）。Bootstrap UI でユーザが手動 bind すべし。

## 3. Step 3: フィールドの resolve

cluster.members を畳んで 1 つの resolved Node のフィールド集合を作る。

### 3.1 フィールド分類

`topology-foundation.md § 1.1` の3分類：
- **factual** (hostname / model / mgmtIp / 結線): 観測比較
- **chosen** (label / position / subgraph 所属 / notes): 人だけが書く、conflict 不能
- **intent vs reality**: 別フィールドに分離済み（モデル定義側で）

### 3.2 factual フィールドの resolve（中核）

```pseudo
resolveFactualField(field, cluster):
  observations = []
  for { source, node } in cluster.members:
    if node[field] !== undefined and not isStale(observation):
      observations.push({ source, value: node[field], observedAt: node.provenance.observedAt })

  if observations.length === 0:
    return { value: undefined, state: 'absent' }

  if all observations have same value:
    return { value: observations[0].value, state: 'confirmed' }

  // 不一致
  authoritative = pickAuthoritative(field, observations, options.fieldAuthority)
  return {
    value: authoritative.value,
    state: 'conflicting',
    // candidates は出力 NetworkGraph には乗らない。
    // observation API がスナップショットから都度生成。
  }
```

### 3.3 chosen フィールドの resolve

```pseudo
resolveChosenField(field, cluster):
  // 'authored' を含むメンバを最優先
  authoredObs = cluster.members.find(m => m.source === 'authored' && m.node[field] !== undefined)
  if authoredObs:
    return { value: authoredObs.node[field], state: 'confirmed' }

  // authored が値を持たないなら、最新の観測（あれば）
  latest = latestNonNullObservation(cluster.members, field)
  if latest:
    return { value: latest.value, state: 'discovered-only' }

  return { value: undefined, state: 'absent' }
```

### 3.4 観測品質の権威表

field × source パターンで「conflict 時の表示優先」を定義する小さなテーブル。MVP は
保守的なデフォルトで足りる：

```ts
const defaultAuthority: FieldAuthorityTable = {
  hostname: 'prefer-device-self',     // SNMP sysName > NetBox
  model: 'prefer-entity-mib',         // SNMP ENTITY-MIB > NetBox
  intended_rack: 'prefer-netbox',     // NetBox の意図
  observed_rack: 'prefer-autoscan',   // 実態
  // 未定義のフィールド: 最新観測を表示
  '*': 'most-recent',
}
```

「権威ソース指定」と「最新観測指定」のみで MVP は足りる。詳細は将来
`field-authority.md` を切り出すことになる（棚上げ）。

### 3.5 element 全体の state 算出

```pseudo
resolveElementState(resolvedFields, cluster):
  hasConflict = any field.state === 'conflicting'
  if hasConflict: return 'conflicting'

  hasAuthored = cluster.members.some(m => m.source === 'authored')
  hasDiscovered = cluster.members.some(m => m.source !== 'authored')

  if hasAuthored and hasDiscovered: return 'confirmed'
  if hasAuthored only: return 'authored-only'
  if hasDiscovered only: return 'discovered-only'
```

## 4. Step 4: Port マッチング

cluster 内の各 member の port を集める：

```pseudo
clusterPortClusters: Map<PortClusterId, PortCluster> = {}
portKeyIndex: Map<PortIdentityKey, PortClusterId> = {}

for member in cluster.members:
  for port in member.node.ports ?? []:
    // priority に従って既存 portCluster を探す
    matched = false
    for key in portKeysOf(port.identity, priority='port'):
      if portKeyIndex.has(key):
        portCluster = clusterPortClusters[portKeyIndex[key]]
        portCluster.members.push({ source: member.source, port })
        matched = true
        break
    if not matched:
      new portCluster
```

port のフィールド resolve は node と同じパターン。

## 5. Step 5: Link マッチング

```pseudo
// (from-cluster, to-cluster) ペアで Link を group 化
linkGroups: Map<EndpointPair, Link[]> = {}

for snap in snapshots:
  for link in snap.graph.links ?? []:
    fromCluster = lookupClusterOf(link.from.node)
    toCluster = lookupClusterOf(link.to.node)
    if !fromCluster or !toCluster:
      // dangling endpoint → ghost port を作る
      ghostPort = createGhostPort(link.from, snap.sourceId)
      // or 同様に to 側
      ...
    pair = normalizePair(fromCluster, toCluster)
    linkGroups[pair].push({ link, source: snap.sourceId })

for pair, group in linkGroups:
  resolvedLink = mergeLinkObservations(group)
  output.links.push(resolvedLink)
```

`mergeLinkObservations` は node と同じくフィールド単位の resolve。endpoint port は
port cluster の resolved id で固定。

## 6. Step 7: Retraction

```pseudo
function shouldRetract(cluster, options):
  // authored メンバがいる → retract しない
  if cluster.members.some(m => m.source === 'authored'): return false

  // それぞれのソースについて「主張がまだ valid か」を確認
  for source in distinct sources of cluster:
    latestSnap = latestSnapshotOf(source)
    if !latestSnap or latestSnap.status === 'failed': continue  // 失敗は無視

    if latestSnap.consecutiveFailures < options.retractAfterMissedScans:
      // ヒステリシス未到達
      // この source の主張がまだ「不在を確定」していない
      return false

    // この source は「N 回連続失敗」した
    // → この source の主張は除去対象だが、他 source がまだ主張しているなら残す

  // 全 source が retract 条件を満たし、authored もいない → 削除
  return true
```

要素ごとに `shouldRetract` を評価。残るものだけ resolved に含める。

## 7. 計算量

- Node 数 N、Snapshot 数 S、平均 Node/snap M → cluster 構築は O(N + S·M)
- Port: cluster あたりの port 数 P → 全 cluster で O(N·P)
- Link: snapshot 内 link 総数 L → O(L · log L)
- 全体: 中規模 topology (N=1000, S=5, P=48, L=2000) で十分 sub-second

resolved グラフのキャッシュ（content-hash でキャッシュキー）は v2 以降の最適化。
MVP は都度計算で十分。

## 8. テスト戦略

resolve() は純粋関数。**観測モデルの最大の利点が「テストしやすさ」**にここで効く。

### 8.1 fixture-driven テスト

```
tests/resolve/
  ├── fixtures/
  │   ├── single-source-snmp.json        # 1 source のみ
  │   ├── netbox-and-snmp-agreeing.json  # 2 source、完全一致
  │   ├── netbox-and-snmp-conflict.json  # hostname 不一致
  │   ├── ifindex-reshuffle.json         # 再起動シナリオ
  │   ├── dangling-link.json             # 片端のみ観測
  │   ├── retraction-hysteresis.json     # N-1 回失敗 vs N 回失敗
  │   └── ...
  └── resolve.test.ts                    # 全 fixture を流す
```

各 fixture は `{ authored, snapshots, expected_resolved }` の組。`expected_resolved` の
構造的等価性を assert。

### 8.2 プロパティテスト

- **idempotency**: `resolve(authored, [resolve(authored, snaps)]) === resolve(authored, [...snaps])`
- **commutativity**: `resolve(a, [s1, s2]) === resolve(a, [s2, s1])`
  （capturedAt が同じなら）
- **monotonicity**: snapshot を追加しても confirmed が unconfirmed に転落しない
  （ただし conflict 検出される場合は除く）

### 8.3 ifIndex 再採番テスト（必須）

```
fixture:
  snapshot t=1:  Port { ifName='Gi0/1', ifIndex=10001 }
                 Port { ifName='Gi0/2', ifIndex=10002 }
  snapshot t=2:  Port { ifName='Gi0/1', ifIndex=10002 }  ← swap
                 Port { ifName='Gi0/2', ifIndex=10001 }

expected:
  resolved Port 'Gi0/1' は 2 観測ともマッチ（ifName 主、ifIndex 副）
  resolved Port 'Gi0/2' も同様
  conflict は出さない（ifIndex は priority 3、ifName で先に解決）
```

これが通れば identity の核は動いている。

## 9. 既存 `core/src/merge.ts` との関係

調査の結果、`libs/@shumoku/core/src/merge.ts` に `mergeWithOverlays()` がある：

- 既存実装は「複数 NetworkGraph を id ベースで merge、`keep-first/keep-last/error/merge-properties` の戦略」
- 本ドキュメントの resolve はこれより**1 段深い**: identity ベースの cluster、フィールド単位の比較、provenance/state の刻印

**推奨実装方針**: 既存 `mergeWithOverlays` を resolve の*前処理*として使うのではなく、
別関数 `resolveObservations()` として新規追加。`mergeWithOverlays` は authored layer 内
（YAML 多ファイル import 等の素朴な合成）に残し、観測モデルとは責務を分ける。

## 10. 実装場所

resolve() は `libs/@shumoku/core/src/resolve.ts` として新規追加。理由：
- 純粋関数なので core が自然な置き場所
- editor / 他ツールから将来呼びたい場合も対応可
- server 側からは `import { resolve } from '@shumoku/core'` で使う

## 11. 残る詳細（棚上げ）

- field authority テーブルの完全版（field × source パターンの網羅）
- v2 以降の最適化（resolved キャッシュ、incremental resolve）
- conflict resolution の UX 操作（"Use X" を押した時の永続化先）—
  candidate に sticky-decision を保存する仕組みが要る
</content>
