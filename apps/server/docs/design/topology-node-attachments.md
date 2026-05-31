# Node attachments — the authored overlay model

Status: design / accepted direction (2026-06-01)

## なぜこの設計か

ノード詳細 UI を「今ある機能(SNMP community 1個)」に最適化して継ぎ足してきた結果、
operator が主張・設定できるものが散らばっている:

- 表示名 → `Node.label`
- 機種/vendor → `Node.spec`
- SNMP community → `DiscoveryPolicy.community`
- discovery mode/interval → `DiscoveryPolicy.mode/intervalMs`

これらは全部「**operator がノードに対して後から付け足す(=アタッチする)もの**」という
同じ性質を持つのに、別々のフィールド・別々の UI に散っている。現状に寄せた継ぎ足しを
やめ、俯瞰して「ノード = Observed の土台 + Authored overlay」という型に据え直す。

## 概念モデル

ノード(機材)についての知識は2層:

- **Observed** — discovery ソース(network-scan/SNMP, NetBox, Zabbix…)がワイヤ/インベントリ
  から読んだ事実。読み取り専用。複数ソースが寄与し `resolve()` が identity で畳む。
- **Authored overlay** — operator が主張・上書き・設定したもの。これが「アタッチ」する対象。
  単一フィールドの寄せ集めではなく、**型付き Attachment のリスト**。

`resolve()` は「Observed を土台に Authored overlay を被せる」。ノード詳細 UI は
この Authored overlay を編集する面。

## 型

```ts
// resolved node = identity(clustering keys) + observed facts + authored overlay
interface Node {
  // … 既存 …
  /** Operator が付けた authored overlay。順序は表示順。 */
  attachments?: Attachment[]
}

type Attachment = FactsAttachment | AccessAttachment | PolicyAttachment

/** 属性オーバーライド。observed 値の上に被さる(authored 優先)。node 限定。 */
interface FactsAttachment {
  kind: 'facts'
  name?: string
  model?: string
  vendor?: string
  role?: string
  icon?: string
  tags?: string[]
  notes?: string
}

/** 読み方 = protocol + 接続情報/認証。node/subgraph/topology に置け、継承する。
 *  複数持てる(将来 SNMP + SSH 併用など)。今は snmp のみ実装。 */
interface AccessAttachment {
  kind: 'access'
  protocol: 'snmp' | 'ssh' | 'netconf' | 'http' // 実装は snmp から
  // protocol 別 params(discriminated union で詰める):
  //   snmp: { community: string; version?: '2c' | '3' }
  //   ssh:  { username: string; secretRef?: string; port?: number }
  //   http: { token?: string; baseUrl?: string }
  [param: string]: unknown
}

/** 取得スケジュール。node/subgraph/topology に置け、継承する。 */
interface PolicyAttachment {
  kind: 'policy'
  mode?: 'auto' | 'observe' | 'disabled'
  intervalMs?: number
}
```

### 設計上の不変条件

- **kind は有限の既知セット**(`facts` / `access` / `policy`)で、各々が具体的な型付き
  フィールドを持つ。汎用 key-value プラグイン機構にはしない(over-abstract 回避、
  「自然な UI のまま」)。
- **拡張の仕方**:読み方が増える → `AccessAttachment.protocol` に値追加 + params 型追加。
  上書き属性が増える → `FactsAttachment` にフィールド追加。型の大改修は不要。
- **メトリクス mapping はここに含めない**(別概念。weathermap 用の host/interface 紐付けは
  既存の mapping タブのまま)。

## resolve セマンティクス

- `facts` attachment → resolved node の対応フィールドを **authored 優先で上書き**
  (name→label, model/vendor→spec)。observed はフォールバック。
- `access` / `policy` → resolved には載せない(scanner 供給用)。ただし「どこから来たか」の
  origin は UI 用に出す(継承表示)。
- 既存の identity clustering / 衝突回避 cluster id はそのまま。

## 継承(access / policy)

`access` と `policy` は topology default → subgraph → node のチェーンで継承
(現 `computeEffectivePolicy` の仕組みを attachments ベースに一般化)。
「この管理サブネットは全部 SNMP community=X」を subgraph に1回アタッチで配下に効く。
`facts` は node 限定(上書きは個別ノードの主張)。

## UI

ノード詳細を「**Observed(読取専用)/ Authored overlay(編集可能なアタッチ群)**」に分離:

```
┌ QNAS-02  ✎name              [● synced]                    ┐
│ Identity (observed): mgmtIp 192.168.13.27 · sysName … ·     │
│   chassisId …                            (clustering keys)  │
├ Observed (sources): TS-469U / QNAP · 6 ports · lab(SNMP) ·  │
│   last seen 12m                                            │
├ Authored overlay ─────────────────────────────  [+ Add ▾] ┤
│  ▸ Facts     name=QNAS-02  model=TS-469U  vendor=QNAP  ✎ ✕ │
│  ▸ Access:SNMP  community ••••  v2c                    ✎ ✕ │
│  ▸ Policy    mode=auto  interval=30m  (inherited:subgraph)✎│
└────────────────────────────────────────────────────────────┘
   [+ Add ▾] → Facts / Access(SNMP·SSH·NETCONF·HTTP) / Policy
```

- **Observed と Authored を視覚的に分離** — 「何が discovered で、何を自分が主張したか」が
  一目で分かる。
- overlay = **アタッチ一覧 + `+ Add`**。`+ Add` は既知 kind のメニュー。各 kind は小さな
  型付きエディタ。
- **Notice ノード** = overlay がほぼ空の状態。`+ Add → Access:SNMP` で community を付けると
  読めるようになる(現 community 入力はこの1アタッチに収まる)。

## 現状からの移行

| 現状 | 移行後 |
|---|---|
| `Node.label`(上書き)/ `spec.model,vendor` | `facts` attachment |
| `DiscoveryPolicy.community` | `access:snmp` の community |
| `DiscoveryPolicy.mode/intervalMs` | `policy` attachment |
| `computeEffectivePolicy`(mode/interval/community) | attachments の継承解決に一般化 |
| 固定セクションの node 詳細 | Observed / Authored overlay(リスト+Add) |

no-backcompat(pre-1.0):既存 DB の authored ノードは旧フィールドが degrade して
「未設定」相当になる。必要なら作り直す。

## 実装フェーズ

1. **core**: `Attachment` 型を追加、`Node.attachments`。`resolve()` で `facts` を上書き適用。
   `computeEffective*()` を access/policy attachments の継承解決に一般化(community/mode/
   interval を attachments から引く)。
2. **api**: discovery-policy PATCH を attachments 編集に再設計(facts/access/policy の
   add/update/remove)。autoscan resolver は `access:snmp` の community を ip→community に。
3. **web**: node 詳細を Observed / Authored overlay(アタッチ一覧 + Add)に組み替え。
   facts エディタ、access:snmp エディタ(community)、policy エディタ。
4. 検証 + 1ソース(network-scan)で end-to-end。

`access` の protocol は snmp のみ実装。ssh/netconf/http は型に枠だけ用意し、`+ Add` の
メニューに「(coming soon)」で出すか、実装まで出さないかは実装時判断。
