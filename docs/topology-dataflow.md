# トポロジーの入力とデータの流れ

状態: 叩き台（2026-10-09）。入力モデルの再設計（docs/experiments/2026-10-07-input-model-loop、PR #820 /
#821 / #823）を、後続の処理と一緒に考え直すための文書。#821 と #823 はこの文書が固まるまで draft。

## 0. 進め方

前回の入力モデルのループは、入力の形だけを詰めた。確かめたのは LLM が書けるか・読めるかで、後続の処理に
合うかは測っていない。レビュー（ryota2357）で次の指摘を受けた。

- 入力の型や仕様は単独では決められない。データの流れやモジュールの設計と同時に決める。
- 「説明文が語彙を運ぶ」という事象を、命名・概念の分け方・後続から見た問題・本質のどれなのか切り分けていない。
- 仕様の範囲（具象構文・抽象構文・意味・内部データ）を分けていない。項目をまたぐ規則は JSON Schema で
  書けず、それを入力の仕様にしようとしていること自体が責任の分け方として誤り。

同じ失敗をしないために、次の手順で進める。

| 前回の失敗 | 今回の手順 |
| --- | --- |
| 入力の形だけを単独で詰めた | 後続から逆算する。データを読む側が何を読んでいるかを、コードの根拠付きで先に洗い出す（§1、§2） |
| 確かめたのは書けるか・読めるかだけ | 実例を一つ、入力から描画まで全段に通しながら設計する。どの段で何が落ちたかを記録する（§6） |
| 事象を記録しただけ | 問題ごとに原因を分類する: 命名 / 概念の分け方 / 後続との食い違い / 本質 / 不明。不明のものを検査で塞がない（§3、§4） |
| 抽象構文と意味の規則が一つのモジュールに混ざった | 段の境界の型を先に決め、実装はその後にする（§5） |
| 業務の判断を推測で埋めた | 業務の判断は問いとして挙げ、決めてもらう（§7） |

調査の進め方: origin/main（8f98bfc5）で Git 管理下のファイルだけを書き出したコピーを、Codex（gpt-6.1-sol）に
読み取り専用で読ませた。返ってきた記述には根拠の行番号を付けさせ、要所は Claude がコードで確かめた（「確認」と
書いたもの）。各アプリの UI 側（apps/server/web、apps/editor の表示）は、Codex がファイルを読めず未調査。

## 1. 今のデータの流れ

```
作る側                                   境界の型            後続
YamlParser / HierarchicalParser  ─┐
plugin.fetchTopology (NetBox,     ├─→ NetworkGraph ──┬─→ CLI・ライブラリ: computeNetworkLayout → 描画
  Zabbix, CV-CUE, NCE, New Relic) │  （ソースごと）   │
editor（.neted.zip の diagram）  ─┘                  └─→ server: 観測の記録 → contribution store
                                                          → entity registry（永続 id）
                                                          → resolve（ソースをまたいで同じ物を束ねる）
                                                          → NetworkGraph（統合後）
                                                          → filterDisconnected → レイアウト → 描画
```

- 作る側はすべて `NetworkGraph` を返す（`TopologyCapable.fetchTopology` は `Promise<NetworkGraph>`、
  `libs/@shumoku/core/src/plugin-types.ts:375`、確認）。ソースごとの出力、統合後のグラフ、レイアウトの入力が、
  すべて同じ `NetworkGraph` 型である。
- server では人の手も情報源の一つとして扱う。Manual ソースは他のプラグインと同じ扱いの入れ物
  （`apps/server/api/src/plugins/manual-plugin.ts:4-12`、確認）。プロジェクトの手直しは project overlay
  （`intrinsic`、最優先）として resolve の `authored` に入る（`apps/server/api/src/services/topology.ts:86-96`、確認）。
- server が YAML を読むのは、今はデモ用サンプルの取り込みだけで、それは project overlay に入る
  （`apps/server/api/src/services/topology.ts:2557-2562`、確認）。

## 2. 後続が読んでいるもの

| 後続が必要とすること | 読んでいる欄 | 根拠 |
| --- | --- | --- |
| ソースをまたいで同じ機器を束ねる | `Node.identity`（mgmtIp → chassisId → sysName → vendorIds） | `libs/@shumoku/core/src/observation/identity.ts:33`（確認） |
| identity のないノードの永続 id | `manual:<sourceId>` = `Node.id`。他のソースとは束ならない | `apps/server/api/src/services/entity-registry.ts:201`（確認） |
| ポートを束ねる | `NodePort.identity.ifName`（なければ port id を ifName にする） | `apps/server/api/src/services/contribution-store.ts:85-88`（確認） |
| リンクの重複を除く | 端のノードの組（順不同）とインターフェース名。片端が一致すれば同じとみなす | `libs/@shumoku/core/src/observation/resolve.ts:1601`（`samePhysicalLink`） |
| 段（tier）を決める | `Node.spec.kind` と `HardwareSpec.type`（決まった語彙） | `libs/@shumoku/core/src/layout/role-tiers.ts:96`（確認） |
| 段と配置に速度を使う | 端のモジュール規格、なければ `Link.rateBps` | `libs/@shumoku/core/src/layout/link-utils.ts:73`（確認）、`problem.ts:382` / `:582` |
| HA の組 | `Link.redundancy`（リンクの属性） | `layout/auto-placement/flat-tree/parents.ts:41`（確認）、`port-placement.ts:138`、`composite/index.ts:212` |
| まとまり | `Node.parent`、`Subgraph.parent`、`Node.metadata.location` | `libs/@shumoku/core/src/layout/problem.ts:683`（`deriveNodeGroups`） |
| 範囲を絞る（scope） | `Subgraph.scope`、`membership` | `libs/@shumoku/core/src/observation/resolve.ts:145-150`（確認） |
| 存在を主張しない寄与 | `presence: 'anchor'` | `libs/@shumoku/core/src/observation/resolve.ts:122`（確認） |
| 監視との対応 | 属性の `metrics-binding`、ポートの ifName | `libs/@shumoku/core/src/observation/metrics-binding.ts:58`（`deriveMappingFromGraph`） |
| 描画 | `label`、`spec.icon/vendor/model`、`Link.vlan`、`Link.label`、`style` | `libs/@shumoku/renderer/src/static.ts:181` / `:292`（確認） / `:306` |

## 3. 新しい入力（#821）との食い違い

| 食い違い | 内容 | 原因の分類 |
| --- | --- | --- |
| identity がない | 手で書いたノードは `manual:<source>=id` になり、Zabbix などが見つけた同じ機器と束ならない。旧 YAML は `identity` を書けた（`parser.ts` の `YamlNode.identity` のコメントがこの用途を説明している） | 後続との食い違い。「入力は今の構成であって在庫ではない」という範囲を入力だけを見て決めた |
| speed が後続に届かない | `toLegacyInput` が speed を落とす。旧 YAML の形には `rateBps` がない。レイアウトは速度で段と配置を決める | 後続との食い違い（写し替えの漏れ。入力と内部モデルの境界を決めていなかった） |
| 冗長 | 入力は「ノードの組」、後続は「リンクの属性」 | 概念の分け方の違い。どちらに寄せるかは未決 |
| segment / routingDomain | 後続に対応する概念がない（リンクの `vlan` だけ） | 後続にない概念。後続で使うかどうかが未決（§7） |
| groups | 入力は場所だけ。後続の `Subgraph` は場所・ホストグループ・タグ・クラスタに使われ、scope（範囲を閉じる）の意味も持つ | 概念の分け方 |
| host（VM が載る先） | 後続に「上で動く」という関係がない。NetBox の VM はハードウェアのサーバーとして作られ、クラスタ名は metadata に入る | 後続にない概念 |
| assumed と presence | 入力の `assumed` は「存在が確かでない」。後続の `anchor` は「存在を主張しない」。似ているが同じかどうか未確認 | 不明 |
| type | 入力は自由文字列。レイアウトの段は決まった語彙のときだけ効く。旧パーサーの別名表（`switch`→`l2-switch`、`lb`、`ap` など、`libs/@shumoku/core/src/parser/parser.ts:872`）が語彙への読み替えを担っているが、入力のスキーマにはその語彙が現れない | 命名（語彙が入力の仕様に出ていない） |
| ラベルに事実を混ぜる | `toLegacyInput` が型番やアドレスをラベルに連結する（`<b>edge</b>,mx204,10.0.10.254`）。resolve はラベルを名前として比べ、優先度で選ぶ | 後続との食い違い（表示の都合をデータに入れた） |
| 書かないことの意味 | 入力は「書かない＝分からない」。resolve は欄ごとに優先度の高い非空の値を採るので噛み合う | 食い違いなし（確認が要る） |

## 4. 「説明文が語彙を運ぶ」の切り分け

22周目では、型の説明文を抜くと書ける事実が 84〜90 件から 58 件に落ちた。項目ごとの原因は分けていない。
分かっているものだけ挙げ、残りは §6 の作業で分ける。

| 項目 | 分類 | 理由 |
| --- | --- | --- |
| `routingDomain` に AS を書く | 命名 | 名前が「経路の領域」とも読める。パーサーで AS 名を拒むのは、名前の問題を検査で塞いだもの |
| `speed` と `bandwidth` の区別 | 命名 | 区別をつけたのは説明文で、名前ではなかった（23周目） |
| VPC やポートグループを何に当てるか | 本質 | 抽象的な概念と具体的な語彙の対応は、どこかで伝えるしかない |
| その他（22周目 key の残り） | 未分類 | |

## 5. 仕様の層

| 層 | 中身 | 誰が持つか |
| --- | --- | --- |
| 具象構文 | YAML そのもの。独自の制約はない | YAML の読み込み |
| 抽象構文 | どの欄がどんな形の値を持つか | スキーマ（zod から生成した JSON Schema を公開の仕様にする） |
| 意味 | 参照先があるか、循環しないか、など項目をまたぐ規則 | 入力を内部モデルへ変換するモジュール。公開の仕様にはしない |
| 内部モデル | 後続が読む型 | 後続の設計で決まる（§7 の Q4） |

「入力を受け付ける部分が全部を拒否しなければならない」という前提は置かない。意味の規則は、内部モデルへ
変換するモジュールの責任であり、後続の必要に合わせて変えてよい。

候補になる構造: 入力をプラグインと同じ「作る側」の一つにする。入力 → 抽象構文 → 意味の解決 →
ソースごとの `NetworkGraph` → 以降は他のソースと同じ流れ。こうすると、意味の段で何を作るべきかは
`NetworkGraph` と resolve の必要（§2）で決まる。

## 6. 次の作業: 全段を通す最小の実例

入力の fixture を一つ選び、次の段をすべて通す。

1. 入力 → ソースごとの `NetworkGraph`
2. 同じ機器を含む「見つかった側」のグラフ（Zabbix の出力を模したもの、identity 付き）と resolve で統合する
3. レイアウト
4. 描画

各段で落ちた事実、束ならなかったもの、段の決め方が変わったものを記録し、§3 の分類を付ける。CLI だけの
使い方（resolve を通らない）も別に通す。

### 1回目（2026-10-09）

作り物の小さな例で試した（コア 2 台の冗長組、上流ルーター、アクセススイッチ 1 台、速度付きリンク 4 本、
管理セグメント）。見つかった側は Zabbix を模したグラフで、同じ 4 台を sysName と管理 IP 付きで持ち、
サーバー 1 台を足した。スクリプトは docs/experiments/2026-10-09-dataflow-skeleton/。

| 段 | 結果 | §3 との対応 |
| --- | --- | --- |
| 1. 入力 → `NetworkGraph` | 4 本すべてで `rateBps` が空、レイアウトから見た速度も空。冗長組はコア同士の直結リンクだけが `redundancy: ha` になった。`switch` は `l2-switch`（段 40）に読み替えられた | speed、冗長、type |
| 2. resolve（Manual ソースとして） | 9 ノード。同じ 4 台が二重になった | identity |
| 2. resolve（project overlay として） | 同じく 9 ノード | identity |
| 2. resolve（仮に identity を書いた場合） | 5 ノード、リンク 5 本。上流とコアのリンクもポート名で 1 本に束なった | identity が要ることの裏付け |
| 3. レイアウト | 統合後の 5 ノードで完了 | |

この例では、手で書いた側の速度は統合後にも残らない。見つかった側が速度を持たないリンクでは、段を決める
材料が型だけになる。

## 7. 決めてもらうこと（業務の判断）

- **Q1:** 手で書く YAML は server で何として扱うか。Manual ソース（他のソースと優先度で比べる）、
  project overlay（常に最優先）、それとも CLI・ライブラリだけのものか。
- **Q2:** 手で書いたノードを、見つかった機器と束ねる必要があるか。必要なら、入力に identity
  （管理 IP、sysName など）を書けるようにする。「今の構成であって在庫ではない」という範囲の見直しになる。
- **Q3:** segment / routingDomain / host を、後続（レイアウト・描画・監視）で使う予定があるか。ないなら
  入力から外すか、後続に足すか。
- **Q4:** 内部モデルは `NetworkGraph` を育てるか、新しく作るか。
