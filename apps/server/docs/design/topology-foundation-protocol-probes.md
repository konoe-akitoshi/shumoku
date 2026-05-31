# Topology Foundation: Protocol Probe アーキテクチャ

> ステータス: ドラフト。`topology-foundation.md` の後続詳細。
> v2 着手前に方向性を固めるためのもの。実装着手は別 PR。

## 0. 動機

v1 の `network-scan` プラグインは「識別 → IF-MIB walk → LLDP-MIB walk」を 1 つの
`scan()` 関数の中で逐次実行する**モノリシック**な構造。

ここから「CDP-MIB を足す」「BRIDGE-MIB を足す」「NETCONF を足す」と進めると：

- 1 プラグインに全プロトコルが詰まって肥大化する
- 機種ごとに「どれが使えるか」が決められない（catalog § 2.4 の宣言を活かせない）
- 1 プロトコルの実装失敗が他全プロトコルの blast radius になる
- 「カタログが宣言してるのにサーバに実装が無い」「実装はあるが catalog に宣言がない」が
  把握できない

→ **プロトコル実装をサーバ内コンポーネントに分解**し、**カタログが各 model に
適用可能なプロトコル ID を宣言**し、**オーケストレータが両者を突き合わせて実行**する。

`topology-foundation.md § 2.4` の「カタログ駆動の探索能力ヒント」が *実行可能な*
データ構造になる。

## 1. 全体像

```
┌── Server ─────────────────────────────────────────────┐
│  ProtocolProbe レジストリ (in-process)                 │
│   ├ snmp.system-mib   ← 識別フェーズ用                  │
│   ├ snmp.if-mib                                        │
│   ├ snmp.lldp-mib                                      │
│   ├ snmp.cdp-mib       ← v2                            │
│   ├ snmp.bridge-mib    ← v2                            │
│   ├ snmp.entity-mib    ← v2                            │
│   ├ snmp.ip-mib        ← v2 (ARP)                      │
│   ├ netconf.openconfig ← 将来                          │
│   ├ cli.cisco-ios      ← 将来                          │
│   └ http.meraki-api    ← 将来                          │
└────────────────────────────────────────────────────────┘
              ↑ probe id で参照
┌── Catalog ─────────────────────────────────────────────┐
│  model: catalyst-9300                                  │
│    discovery.probes:                                    │
│      - snmp.system-mib                                  │
│      - snmp.if-mib                                      │
│      - snmp.lldp-mib                                    │
│      - snmp.cdp-mib                                     │
│      - snmp.bridge-mib                                  │
└────────────────────────────────────────────────────────┘
              ↓ 突き合わせ
       Network Discovery Orchestrator
       （per-target に probes を選んで実行 → snapshot）
```

責務：

- **probe 実装**: 1 プロトコル / 1 トランスポートに閉じた小ユニット。サーバ内部
- **catalog 宣言**: 「この model はこの probe を喋れる」というメタデータだけ
- **オーケストレータ**: 識別 → 突き合わせ → 実行 → 部分結果のマージ
- **ユーザ向けデータソース**: クレデンシャル + ターゲットスコープだけを持つ
  （プロトコル選択は持たない）

## 2. ProtocolProbe インタフェース

```ts
/** Stable id used in both the server registry and catalog declarations.
 *  Format: `<transport>.<feature>` — keeps mistypes obvious. */
export type ProbeId =
  | 'snmp.system-mib'
  | 'snmp.if-mib'
  | 'snmp.lldp-mib'
  | 'snmp.cdp-mib'
  | 'snmp.bridge-mib'
  | 'snmp.entity-mib'
  | 'snmp.ip-mib'
  | 'netconf.openconfig-interfaces'
  | 'cli.cisco-ios'
  | (string & {})   // open string — external probes can register their own

export interface ProtocolProbe {
  readonly id: ProbeId
  readonly displayName: string

  /** Which credential shape this probe consumes. Maps to a user-supplied
   *  credential profile by transport kind. */
  readonly transport: TransportKind

  /**
   * Run the probe against one device. Returns a *partial* observation
   * (just the slice this probe is responsible for — e.g. only ports for
   * `snmp.if-mib`, only links for `snmp.lldp-mib`). The orchestrator
   * merges partials into a per-device contribution to the snapshot.
   */
  probe(target: ProbeTarget, credentials: TransportCredentials): Promise<ProbeResult>
}

export type TransportKind = 'snmp-v2c' | 'snmp-v3' | 'netconf' | 'gnmi' | 'cli-ssh' | 'http'

export interface ProbeTarget {
  address: string                  // device IP / hostname
  /** Identity hints carried over from earlier probes in the same scan
   *  (e.g. sysObjectID after identification). */
  identity?: Identity
}

export interface ProbeResult {
  ok: boolean
  /** Partial observation. Fields not relevant to this probe are absent. */
  contribution: PartialContribution
  /** Probe-level warnings (e.g. one row in a walk timed out). */
  warnings?: string[]
}

export interface PartialContribution {
  /** Identity bits this probe could harvest (e.g. system-mib → sysName,
   *  sysObjectID; if-mib → port identities; lldp-mib → contributes to
   *  this node's ports + Link entries). */
  identity?: Partial<Identity>
  /** Vendor / model fields that should land in node.metadata. */
  metadata?: Record<string, unknown>
  /** Ports observed by this probe (typically from if-mib / ifXTable). */
  ports?: NodePort[]
  /** Links observed by this probe (typically from lldp-mib / cdp-mib). */
  links?: Link[]
}
```

設計判断：
- **`probe` が partial を返す**。Node 全体ではない。orchestrator がマージする
- **trans port が型に出る**。クレデンシャル整合性を probe 側で判断不要にする
- **`ProbeId` を open string**にする。`Alert.source: string` と同じ規約で外部 probe にも開く
- **`identity` を引き継ぐ**。識別後の probe には catalog/前段で得た情報を渡せる

## 3. オーケストレータ — 探索フロー

```pseudo
async function discover(targets: Target[], creds: Credentials, catalog: Catalog) {
  const obs: Map<address, PartialContribution[]> = {}
  const warnings: string[] = []

  for (const target of targets) {
    // Phase 1: identification（常に同じ最小セット）
    const identResults = []
    for (const probeId of IDENTIFICATION_PROBES) {  // ['snmp.system-mib', ...]
      const probe = registry.get(probeId)
      if (!probe) continue
      try {
        const r = await probe.probe(target, creds.for(probe.transport))
        identResults.push(r)
      } catch (e) { /* identification fail → skip device */ }
    }
    const ident = mergeIdentity(identResults)
    if (!ident.sysObjectID) {
      warnings.push(`${target.address}: identification failed, skipping`)
      continue
    }

    // Phase 2: カタログ照会
    const model = catalog.lookupBySysObjectID(ident.sysObjectID)
    const declared = model?.discovery?.probes ?? DEFAULT_PROBE_SET
    if (!model) {
      warnings.push(
        `${target.address}: model unknown for sysObjectID ${ident.sysObjectID}; ` +
        `using default probe set. Add this model to your catalog to refine.`
      )
    }

    // Phase 3: 突き合わせ
    const available = declared.filter(id => registry.has(id))
    const missing   = declared.filter(id => !registry.has(id))
    if (missing.length) {
      warnings.push(
        `${target.address}: catalog declares ${missing.join(', ')} but server ` +
        `lacks these probes. Install / upgrade required.`
      )
    }

    // Phase 4: 実行 — partial を集める
    const enrichedTarget = { ...target, identity: ident }
    for (const probeId of available) {
      const probe = registry.get(probeId)
      try {
        const r = await probe.probe(enrichedTarget, creds.for(probe.transport))
        obs[target.address] = (obs[target.address] ?? []).concat(r.contribution)
        warnings.push(...(r.warnings ?? []))
      } catch (e) {
        warnings.push(`${target.address}: probe ${probeId} failed — ${e.message}`)
      }
    }
  }

  return { snapshot: mergeIntoNetworkGraph(obs), warnings }
}
```

ポイント:
- 識別フェーズは常に最小セット（典型は `snmp.system-mib` 1 つ）。catalog 照会前なので
  これだけは catalog 非依存
- 識別フェーズで catalog ヒットしない場合 → デフォルトプローブ集合で進行 + Warning
- 1 probe の失敗は他 probe を止めない。warning として記録
- 結果は per-device の `PartialContribution[]` で集めて最後にマージ

### 3.1 デフォルトプローブ集合

カタログに無い model に当たった時に走らせる安全集合：

```
DEFAULT_PROBE_SET = ['snmp.system-mib', 'snmp.if-mib', 'snmp.lldp-mib']
```

- LLDP は標準なのでほぼ全モダンスイッチで効く
- ベンダー固有 (cdp / bridge-mib) は入れない（タイムアウト連打を避ける）
- 識別が成立する程度には何かが返ってきている前提

## 4. 突き合わせの 4 ケース（重要）

| ケース | 取り扱い | UI 表示 |
|---|---|---|
| 宣言 X / 実装 X | 実行 | （通常） |
| **宣言 X / 実装なし** | スキップ | 🟡 Warning「`<probeId>` が必要だが未実装」 |
| 宣言なし / 実装あり | **silent スキップ** | （何も出さない） |
| **catalog ヒット無し** | デフォルトプローブで実行 | 🟡 Warning「model 未知、`Add to catalog` で能力を起こせます」 |

3 番目を silent にするのが鍵 — 「実装があるなら全部試す」だと未対応プロトコルで毎回
タイムアウトする。catalog を権威として「必要なものだけ叩く」。

## 5. クレデンシャル — トランスポート単位で分離

ユーザ向け Network Discovery データソースが持つもの:

```ts
interface NetworkDiscoveryConfig {
  /** トランスポート種別ごとのクレデンシャル。複数同居可能。 */
  credentials: {
    'snmp-v2c'?: { community: string }
    'snmp-v3'?: { username: string; authProtocol?: 'MD5' | 'SHA'; ... }
    'netconf'?: { username: string; sshKey: string }
    // 'http' は probe ごとにエンドポイント固有なので、probe 側 config に持たせる
    //   (Meraki API key 等)
  }
  /** ターゲットスコープ — seed list or CIDR include. */
  targets: { addresses: string[]; cidrs?: string[] }
  /** Per-device override（特殊機器に別 community を当てる等）. */
  perDevice?: Record<string /* address */, Partial<Credentials>>
}
```

orchestrator は `probe.transport` を見て、対応するクレデンシャルを `probe.probe()` に
渡す。クレデンシャルが無いトランスポートを宣言する probe は warning 付きでスキップ
（「catalog は NETCONF を宣言してるが NETCONF クレデンシャルが未設定」）。

## 6. カタログ側のスキーマ

`@shumoku/catalog` の model entry に `discovery` セクションを追加：

```yaml
model: catalyst-9300-48p
series: catalyst-9300
discovery:
  probes:
    - snmp.system-mib
    - snmp.if-mib
    - snmp.lldp-mib
    - snmp.cdp-mib
    - snmp.entity-mib
    - snmp.bridge-mib
```

series で継承、model で override（catalog の継承モデルそのまま）。デフォルト merge は
union（series が宣言したものに model が追加できる）。

「sysObjectID → model」リゾルバ
（`@shumoku/core/observation/sys-object-id.ts` 拡張）が必要：v1 は vendor までしか
返さない辞書なので、model 名 + discovery.probes を引ける拡張が要る。これは v1 catalog
辞書を v2 で深掘りする話と一致。

## 7. 識別フェーズの詳細

```ts
const IDENTIFICATION_PROBES: ProbeId[] = [
  'snmp.system-mib',  // sysName / sysObjectID / sysDescr
  // 将来:
  //   'http.well-known-meta'  // /.well-known/-meta for HTTP-only gear
  //   'mdns.basic'            // mDNS で WS-Discovery 系を拾う
]
```

各識別 probe の trust:
- `snmp.system-mib`: SNMP-v2c が通れば最も確実。sysObjectID 必須
- `http.*`: ベンダー UI から model 名抜く（不安定、補助）
- `mdns.*`: プリンタ・IoT 機器など SNMP が無いもの

複数識別 probe の結果は union。`sysObjectID` が取れれば catalog 主、なければ
他フィールドから推測。

## 8. 既存実装からの移行（実装 PR の道筋）

PR 単位で：

**B-1**: `core/observation/probe-types.ts` — 上記の `ProtocolProbe` / `ProbeTarget` /
`PartialContribution` / `TransportKind` を core に追加。サーバ側で実装が動かす型。

**B-2**: `apps/server/api/src/services/probes/registry.ts` 新規 — `ProbeRegistry` で
`Map<ProbeId, ProtocolProbe>` 管理。

**B-3**: 既存 `libs/plugins/network-scan/src/discover.ts` を分解 →
3 個の probe モジュールに：
- `snmp.system-mib` probe
- `snmp.if-mib` probe（ifXTable も同じ probe 内で）
- `snmp.lldp-mib` probe

probe 自体は再利用しやすいよう `libs/probes/snmp/` 配下に置く（プラグインではない、
ライブラリ的位置付け）。

**B-4**: `apps/server/api/src/services/discovery.ts` 新規 — orchestrator 本体。
catalog 照会 → 突き合わせ → 実行。

**B-5**: `network-scan` プラグイン → 廃止予定マーク。Network Discovery データソースは
専用の **コンフィグ + 起動エンドポイント**（既存 `POST /datasources/:id/scan` に近い形）
に統合。

**C**: catalog 側 `discovery.probes` schema 追加 + sysObjectID → model の拡張辞書

**D**: 追加 probe 実装（`snmp.cdp-mib`, `snmp.bridge-mib`, `snmp.entity-mib`,
`snmp.ip-mib`）。各 probe = 単独 PR で安全に積める

## 9. 互換性 / 副作用

- v1 の API エンドポイント `POST /datasources/:id/scan` は維持する（UI を壊さない）。
  内部実装が「plugin.scan() を呼ぶ」から「orchestrator.discover() を呼ぶ」に変わる
- 既存 `topology_observations` テーブルはそのまま使える（出力は同じ Snapshot 形式）
- 既存 `provenance.source` には orchestrator 由来であることを示す id を入れる
  （例: `'discovery:<sourceId>'`）。**probe 単位の provenance は持たない** —
  「discovery のひとつのスナップショット」が観測単位

## 10. 残る論点

- catalog のローダはサーバから読めるか? 現状 catalog は editor 側パッケージ寄り。
  サーバから参照可能なように `@shumoku/catalog` の export を整理する必要がありそう
- per-device override（「この機器だけ snmp.cdp-mib を強制 OFF」「community を別にする」）
  をどこに持つか — v1 は `perDevice` を NetworkDiscoveryConfig に置く案
- probe 並列化 — 同一 device に対して probe を並列実行するか直列か
  （SNMP は多重 query で機器を落とすことがあるので、device 単位は直列、device 間は並列が無難）
- 識別 phase が失敗した時のフォールバック（ICMP / TCP scan で生存だけ確認 → bare host
  として記録）
- `ProbeId` の literal union を core に置くか、open string のみにするか（既存実装名は
  リテラルで surface、未来は open string で許容、の二段が現実的）
</content>
