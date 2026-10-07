# 入力モデルの再設計ループ

方針は [`docs/network-model.ja.md`](../../network-model.ja.md)（PR #816）。
`model.ts` が今の最小モデル。`data/` は `examples/` を新形式に書き換えたもの。
`bun check.ts <例の名前...>` で、新形式→旧 YAML へ派生させ、元の YAML と
パース結果と SVG を比べる。

## 1周目（2026-10-07）: ノード・種別・二端点リンク（ポート任意）

`getting-started` は差分なし・SVG 一致。残り5例で落ちたもの:

| 落ちたもの | 件数 | 判定 |
| --- | --- | --- |
| nodes.parent / subgraphs | 64 / 21 | 構成。ただし意味が混在（場所・役割・VLAN）→ 要判断 |
| 複数行 label | 62 | 型番・IP・台数など**事実が表示文字列に埋まっている** → 事実はフィールドへ、組み立ては表示へ |
| rank | 50 | 削除済み概念（PR #816） |
| links.vlan | 35 | 構成。セグメントの候補と関係 |
| links/nodes の style、link type（dashed） | 48 | 表示。ただし dashed で VPN 等の意味を表している |
| vendor / model | 24 / 23 | 構成 → 足す |
| links.label | 13 | 「IPsec VPN」「Trunk VLAN200/300」「shared segment」など**事実が文字列に** |
| links.ip | 11 | 構成（インターフェースのアドレス）→ 要判断 |
| settings | 5 | 表示 |
| description | 5 | 文書の説明 → 足す |
| redundancy | 4 | HA/スタックの組。構成 → 要判断 |

## 2周目（2026-10-08）: 場所のグループ・セグメント・事実のフィールド化

足したもの: `groups`（場所だけ、入れ子可）、`segments`（VLAN・共有セグメント、`vlan`/`prefix`）、
ノードの `vendor`/`model`/`address`/`description`/`group`、リンクの `speed`/`segments`、
端点の `address`。ラベルは名前だけにし、事実の行は派生側で組み立てる。

`data/` は手で書き直した（1周目は機械下書き）。

**再現できたもの**: vendor/model（aws の service/resource を除く）、links.vlan（セグメントから全件）、
端点の IP、場所のグループ（拠点・クラウド・DC・Campus）。

**まだ落ちるもの**:

| 落ちたもの | 例 | 判定 |
| --- | --- | --- |
| 状態 | Active / Planned / Staged / Inventory / Decommissioning、Failed / Offline | 前者はライフサイクル（構成）、後者は観測（後段）。2例 |
| 場所でないグループ | Edge / Security（役割）、Production / Staging（環境）、VMware Cluster | 意味ごとに別の答え。下記 |
| 集約ノード | 「RT1/RT2」「FW1/FW2」「2x ESXi + VMs」「2x 1G (RT1/RT2)」 | 実データの不確かさと同じ根。候補 |
| トンネル | IPsec VPN ×3（dashed で表現） | 物理リンクと別種の接続。候補 |
| HA の組 | `redundancy: ha` ×4、「HA Keepalive」 | 候補 |
| VM と収容ホスト | 「vSwitch」リンク、Cluster の箱 | ケーブルでなく「上で動く」関係。候補 |
| LAG・回線の種類 | 「LACP 40G」「Dark Fiber」「PPPoE」、色で表した媒体 | 保留 |
| ソフトウェア・資源 | 「VMware ESXi 8.0」「4vCPU / 16GB」 | 保留 |
| 表示 | rank 50、style 47、settings 5、太字 | 対象外 |

**モデルが直したもの**: 共有セグメントのリンクで、両端の `ip` にネットワークアドレス
（`10.0.1.0/29`）が書かれていた。アドレスでなくプレフィックスなのでセグメント側に移した。

**派生側の課題**:

- 型番の表示名（`qfx5120-48y` → 「QFX5120」）はカタログが要る。
- prefix-subgraph のサブネットの箱は、ノードの address とセグメントの prefix から導ける。
  入力に書かなくてよい。
- 「10.1.20.1 (VLAN200)」の VLAN もリンクのセグメントから導ける。

**データの矛盾**: enterprise-ogp の web-srv（10.100.10.10）は、DMZ のゲートウェイ
（10.100.0.254/24）のサブネットの外にある。vm-app-01 と vm-db-01 は同じ /24 で VLAN が違う。

## 気付いたこと

- ポートを省くと、旧パーサーは毎回違う ID のポートを作る（比較では出現順に置換）。
- `bandwidth: 1G` は例の中で多用されているが、パーサーは読まずに捨てている。
- `location-based.yaml` は今のパーサーが扱わない形式（`network.locations`）。
- 例の作者は「shared segment」をリンクの label で、VLAN セグメントを subgraph で表している。
  セグメントという概念が無いことの回避策に見える（他ツール集計とも一致）。
