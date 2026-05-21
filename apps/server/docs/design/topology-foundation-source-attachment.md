# Topology Foundation: ソース ↔ トポロジ アタッチ設計

> ステータス: ドラフト。`topology-foundation.md` の付属。
> 実装未着手。protocol-probes と並行する設計レイヤ。

## 0. なぜこのドキュメントが要るか

v1 を一通り組み上げて UI まで触ったあとで、**複数ソースを 1 トポロジに同居させる
シナリオ**の詰めが足りないことが見えた。具体的には：

- NetBox / Zabbix / Discovery（snmp-lldp）は**並列の data source 種別**として扱える
  べきで、どれも topology / metrics / hosts / alerts を *任意の組合せ* で提供しうる
- 「データソースを設定する」と「設定済みソースをトポロジに attach する」は別レイヤ
- 観測モデルから merge tiebreaker priority を消したのは正しいが、**表示権威 (display
  authority)** や **アタッチ単位のスコープ・上書き** は別概念として残っている
- アタッチの状態機械（pending / syncing / ok / failed / stale）が explicit に
  なっていない

→ ここを固めないと plugin v2 への移行（特に Zabbix の `topology` capability 化）と、
protocol-probes の orchestrator が落とし所を見失う。

## 1. 二層のレイヤ

```
┌─ Data Source（system-wide） ───────────────────┐
│  - id, name, type (netbox / zabbix / snmp-lldp / …)│
│  - configJson: 接続クレデンシャル等              │
│  - capabilities: [topology, metrics, hosts, alerts]│
│  - status / fail_count                          │
└─────────────────────────────────────────────────┘
              ↑
              │ M:N
              ↓
┌─ Topology-Source Attachment（per-topology） ───┐
│  - topologyId, dataSourceId                    │
│  - purpose: topology | metrics                 │
│  - syncMode: manual | on_view | webhook        │
│  - optionsJson: プラグイン固有 + 共通 attach 設定│
│  - status: pending | syncing | ok | failed | stale│
│  - consecutive_failures / last_ok_captured_at  │
└─────────────────────────────────────────────────┘
```

- **Data Source は system-wide**。複数トポロジから共有される
- **Attachment は per-topology**。同じ data source を**異なる purpose で同じトポロジに
  複数 attach** することが許される（既存 schema の `UNIQUE(topology_id,
  data_source_id, purpose)` で 1 (topology × source × purpose) = 1 attachment）
- capabilities は data source 側に固定（プラグイン実装次第）、purpose は attachment 側
  で**capability の中から選ぶ**

## 2. capabilities × purpose の独立性

3 つを並列に扱うとどう見えるか：

| Data Source | 持ちうる capabilities | 主に attach される purpose |
|---|---|---|
| **NetBox** | topology, hosts | topology（意図） |
| **Zabbix** | topology, metrics, hosts, alerts | topology（hosts→graph）/ metrics（両方ありうる）|
| **Discovery (snmp-lldp)** | topology, autoscan, hosts, metrics | topology（実態） |
| Prometheus / Grafana / Aruba | metrics / alerts / hosts | metrics |

ポイント:
- **Zabbix を topology purpose で attach する** = hosts と interfaces から
  NetworkGraph を組み立てさせる
- **同じ Zabbix を同じトポロジに topology + metrics 両方で attach** することができる
  （hosts 一覧から構造、interfaces のカウンタからメトリクス）
- Zabbix が capabilities として `topology` を実装する必要があるのは plugin v2 で。
  現状 capabilities は `['metrics', 'hosts', 'alerts']`

## 3. ケース表（NetBox / Zabbix / Discovery を並列扱い）

| ケース | topology 出処 | metrics 出処 | 必要な実装 |
|---|---|---|---|
| 単体 (どれか 1 つ) | A | A or — | resolve は単一ソース → 簡単 |
| NetBox + Zabbix(metrics) | NetBox | Zabbix | 既存・purpose 分離 |
| NetBox + Discovery | NetBox + Discovery | （Discovery が IF stats 返せばそれも）| resolve() で merge ✓ |
| **NetBox + Zabbix(topology)** | NetBox + Zabbix | Zabbix or — | **Zabbix v2 化が必要** |
| **Zabbix(topology+metrics) 単体** | Zabbix | Zabbix | 同上 |
| Zabbix + Discovery | 両方 topology | Zabbix | 同上 + resolve() |
| 全部 (NetBox + Zabbix + Discovery) | 3 つの topology source | Zabbix | 同上、merge は同じ機構 |
| **authored + どれか** | authored layer + N sources | … | identity bind が要 |

「全部入り」も「単体」もすべて同じ resolve() の入力本数違い、というのが**観測モデル
の旨味**。code path が分岐しない。

## 4. Attachment Config Schema

`topology_data_sources` の `options_json` に持たせる内容を、**プラグイン固有部** と
**共通 attach 設定部** に分ける：

```ts
interface TopologySourceOptions {
  // --- プラグイン固有 (既存) ---
  pluginOptions?: Record<string, unknown>  // NetBox: { siteFilter, tagFilter, … }

  // --- 共通 attach 設定 (新規) ---
  /**
   * このソースがこのトポロジで権威を持つフィールドクラス。
   * 既定の field-class authority 表を override する。
   * 設定無し → 既定表（`snmp-lldp` は hostname 権威、`netbox` は intended_* 権威 等）。
   */
  fieldAuthority?: {
    [fieldClass: string]: 'prefer' | 'avoid'
    // 例: { hostname: 'prefer', intended_rack: 'avoid' }
  }

  /**
   * このソースから取り込むスコープを更に絞る hint。
   * プラグイン固有のフィルタとは別 — クライアント側で post-filter する。
   */
  scopeFilter?: {
    includeCidrs?: string[]
    excludeCidrs?: string[]
    boundaryNodes?: string[]
  }

  /**
   * 表示順 / 同期順 — merge には影響しない、純粋に UX のための数値。
   * 既定 0。低い順に表示・同期。
   */
  displayOrder?: number
}
```

設計判断:
- `pluginOptions` をネストして共通設定と分離（既存スキーマと衝突しない）
- **merge tiebreaker priority は復活させない**。代わりに `fieldAuthority` で
  field-class 単位の表示権威を override
- `displayOrder` は UX 用のフィールド（list 表示順 / sync 起動順 等）。merge 不変

## 5. Attachment ライフサイクル（状態機械）

```
                ┌─────────────┐
                │   pending   │  attach 直後、まだ一度も sync してない
                └──────┬──────┘
                       │  sync 開始
                       ↓
                ┌─────────────┐
                │   syncing   │  進行中
                └──────┬──────┘
              ┌────────┴────────┐
        成功 ↓                ↓ 失敗
       ┌──────┐         ┌─────────┐
       │  ok  │←──成功──│  failed │←─┐
       └──┬───┘         └────┬────┘  │
          │ N 日 sync 無し       │連続失敗  │
          │（既定 7 日）         │N 回未満│
          ↓                    └────────┘
       ┌──────┐
       │stale │
       └──────┘
```

- `pending` は attach されたが captured_at が無い状態
- `failed` の `consecutive_failures < N`（既定 3）なら **retract しないゲート**を満たさず、
  resolve() は前回 ok 観測を尊重し続ける
- `consecutive_failures >= N` で初めて retraction の対象に入る
- `stale` は alert 用の派生状態（既定 `now - last_ok_captured_at > 7 day`）

state は `consecutive_failures` + `last_ok_captured_at` から**算出可能**だが、UI 表示と
indicator のために explicit enum を持たせる方が読みやすい（option: 列追加 vs derived）。

## 6. Display Authority — 「優先順位」の正しい在処

観測モデルで消した priority は merge 用だった。残しておく必要があるのは：

| 概念 | 用途 | 保持場所 |
|---|---|---|
| ~~merge tiebreaker priority~~ | 競合勝者決定 | **削除** — conflict は surface するだけ |
| **field-class authority** | conflict 時の既定表示値 | 既定表（field × source-type）+ attach 単位 override |
| **display order** | UI 並び順、sync 起動順 | attach の `displayOrder` |

field-class authority の既定表（v1 hard-code、v2 で settings に逃がす）：

```ts
const DEFAULT_FIELD_AUTHORITY: Record<string, Record<string, 'prefer' | 'neutral'>> = {
  // factual: 機器自身に近いほど信頼
  hostname:       { 'snmp-lldp': 'prefer', netbox: 'neutral', zabbix: 'neutral' },
  model:          { 'snmp-lldp': 'prefer', netbox: 'neutral', zabbix: 'neutral' },
  serial:         { 'snmp-lldp': 'prefer', netbox: 'neutral', zabbix: 'neutral' },
  // intent: 設計データを保持してるソースを優先
  intended_rack:  { netbox: 'prefer', 'snmp-lldp': 'avoid' },
  intended_site:  { netbox: 'prefer', 'snmp-lldp': 'avoid' },
  // observed: 実機観測を優先
  observed_rack:  { 'snmp-lldp': 'prefer', netbox: 'avoid' },
}
```

attachment の `fieldAuthority` がこの既定を**部分上書き**する。例：
"このトポロジでは NetBox が hostname も権威"
```json
{ "fieldAuthority": { "hostname": "prefer" } }
```

## 7. Hosts capability は identity を貢献する

これは plugin v2 で明示化したい。**Zabbix を metrics 目的で attach しても、
hosts capability があれば identity 補完に寄与してよい**:

- attachment.purpose = 'metrics' でも、内部的に `getHosts()` を呼んで identity 情報を
  集めるパスを別に持つ
- 結果は metrics mapping だけでなく、**resolve() の identity matching にも feed** する
- ただし *Node を生成しない* — あくまで identity の補強情報。Zabbix が `getHosts()` で
  返した host の mgmtIp / sysName を、他ソース由来 Node の identity に union する

これにより「NetBox（topology）+ Zabbix（metrics-only）」のとき、Zabbix の hosts inventory
が NetBox の identity を裏付ける（mgmtIp が一致 → identity が strengthen）。

設計表現:
```
fetchTopology(purpose='topology') → 完全な NetworkGraph として参加
getHosts() (always, if HostsCapable) → identity-only contribution
```

## 8. UX

`/topologies/[id]/settings` の現状の Sources セクションを拡張：

```
Sources attached
─────────────────────────────────────────────────
[NetBox HQ]  purpose: topology   syncMode: webhook    status: ok 2m ago
  options ▾                                          [Re-sync] [Detach]
    field authority: intended_rack=prefer
    site filter: tokyo-dc1

[Zabbix prod]  purpose: metrics    syncMode: on_view    status: ok 12s ago
  options ▾                                          [Re-sync] [Detach]
    (no overrides)

[Zabbix prod]  purpose: topology   syncMode: manual     status: pending
  options ▾                                          [Sync now] [Detach]
    (no overrides)

[SNMP main]  purpose: topology   syncMode: manual     status: ok 5m ago
  options ▾                                          [Sync now] [Detach]
    seeds: 10.0.0.1, 10.0.0.2
    field authority: hostname=prefer
```

- 同じ Data Source (Zabbix prod) を **異なる purpose で 2 行** 並べられる
- options 展開で attach 単位の上書きが見える
- status バッジが現在の lifecycle state を反映
- 「保留中の attachment は明示」(pending 表示)

## 9. plugin v2 への影響

`topology-foundation-plugin-contract.md` の前提が変わる：

- **Zabbix プラグインも `TopologyCapable` を実装する**。`fetchTopology(options)` で
  hosts → NetworkGraph を組み立てる
- **Prometheus / Grafana / Aruba** も将来的に topology capability を持ちうる
  （Aruba は controller の機器一覧から組める）が、v2 では Zabbix を優先
- plugin v2 では「`['metrics', 'hosts', 'alerts']` から `['topology', 'metrics', 'hosts',
  'alerts']` に拡張」のような capability 拡張が日常になる
- 既存 plugin の v2 書き換え対象は **NetBox（v1 で識別済）+ Zabbix** に拡大

これは `topology-foundation-plugin-contract.md § 5` の「実質的な書き換えは netbox 1 個
だけ」を修正する必要あり。

## 10. 実装方針（後続 PR で）

順番案:
1. `topology_data_sources.options_json` に共通設定を入れる JSON schema 文書化
2. attachment 状態算出ヘルパー（`status` enum を derivable に）
3. field-authority 既定表を core or server に置く（`topology-foundation-resolve.md` の
   conflict 解決パスがここを参照する）
4. Hosts-capability の identity 貢献パスを resolver / observation service に追加
5. Zabbix plugin の `TopologyCapable` 実装（v2、別 PR）
6. UI: attach 単位の options 展開、purpose 別行表示、state バッジ

## 11. 開いている論点

- **`fieldAuthority` のキー名（fieldClass）の正式定義** — `hostname` / `model` /
  `serial` / `intended_rack` / `observed_rack` ... 何を fieldClass とするかの enum を
  どこで持つか
- **attachment status の derived vs explicit** — 列で持つか算出か。算出だと UI で
  毎回計算するコストが少しある
- **Zabbix が `TopologyCapable` で何を返すべきか** — hosts のみ / hosts + LLD 由来の
  リンク / Zabbix Network Maps を構造として import するか
- **NetBox が `MetricsCapable` を持つ意味があるか**（NetBox はメトリクスストアではない）
  — 将来 NetBox の dynamic-status 等を引っ張る場合はありうる
- **field-authority override 時の UI** — checkbox grid? per-field dropdown?
  簡単な編集 UX をどう作るか
</content>
