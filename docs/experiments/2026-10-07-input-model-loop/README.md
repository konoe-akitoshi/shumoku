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

## 気付いたこと

- ポートを省くと、旧パーサーは毎回違う ID のポートを作る（比較では出現順に置換）。
- `bandwidth: 1G` は例の中で多用されているが、パーサーは読まずに捨てている。
- `location-based.yaml` は今のパーサーが扱わない形式（`network.locations`）。
- 例の作者は「shared segment」をリンクの label で、VLAN セグメントを subgraph で表している。
  セグメントという概念が無いことの回避策に見える（他ツール集計とも一致）。
