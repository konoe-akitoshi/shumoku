# 配置（Arrangement）とドラッグの意図

ドラッグ編集を「座標」でなく「構造の上の相対配置」として扱うための設計メモ。背景の調査は
`reports/配置データの保存方式の比較.md`（リポジトリ外・非公開）。エンジン側の実装は
`libs/@shumoku/core/src/drawing/`、Editor 側は `apps/editor/src/lib/state/order-hints.ts`。

## 段階

```
構成 (YAML) → 構造 (Structure) → 相対配置 (Arrangement) + 人の意図 (drawing.order) → 座標 (Scene)
```

- **構成**: ノード・リンク・グループ。どのグループに属するかは構成の事実で、ドラッグで枠を越えた
  ときは **構成の編集**（`config.nodes[].group`）として書く。ヒントではない。
- **構造**: ユニット・流れ・境界。`Structure` が持つ。
- **相対配置**: 枠（frame）ごとの子の左右順と、各子が占める行（rank）。エンジンの `layers` 段が決めた
  値そのもので、座標を含まない。これを `Arrangement` という名前で `layoutParts` の出力に加え、
  `layoutNetwork(model)` が `{ scene, arrangement }` として返す。別の計算を並走させない：
  `layers.siblings` と `ranks` をそのまま読み替えたものである。
- **意図**: `drawing.order: Record<frame, id[]>`。枠ごとの **疎な id 列**。名指しした子の相対順だけを
  約束し、名指ししない子はエンジンが置く。行の意図（上下）は今回は持たない（後述）。
- **座標**: 毎回解く。保存しない。

## Arrangement の形

```ts
interface Arrangement {
  frames: Record<FrameId, Placed[]>   // 枠ごとの子、左から右。'' がトップ
  unmet: Record<FrameId, string[]>    // 意図のうちエンジンが聞き入れなかった id
}
interface Placed {
  id: string                 // ノード id / 冗長セット id / セグメント id / ルーティングドメイン id / グループ id
  kind: 'node' | 'unit' | 'segment' | 'domain' | 'group'
  rows: [lo, hi]             // 占める行。ノードは 1 行、グループはその中身の最初と最後の行
  movable: boolean           // 順序の意図が効くか。free な項目とサテライト（ホストの隣に立つ）は false
  members?: string[]         // unit のとき、左から右のメンバー
}
```

`unit` は冗長セットの id で表す。エンジン内部の `unit:<id>` は出さない。`drawing.order` にはノード・
グループに加えてセット id も書ける（`orderOf` が解釈する）。

## ドラッグの読み取り（Editor、`readDrop`）

ドロップは「枠」「行」「行内の位置」の三つの事実に分解し、**変わったものだけ**書く。

| ドロップ先 | 書くもの |
|---|---|
| 元のスロット（枠・行内順が同じ） | 何も書かない（`undefined`）。Undo 履歴にも積まない |
| 同じ枠の別スロット | `drawing.order[frame]` のみ |
| 別の枠 | 構成（親グループ）＋移動先の枠の順序。元の枠の列は触らない |
| 同じ枠の別の行 | 枠の順序は 1 列で全行に共通なので、その行の両隣に対する位置として順序だけ書く。行自体は構造が決める |

スロットの計算はドロップ時に **直前に解いた Arrangement** と Scene の箱から作る（`slotsOf` /
`slotAt`）。枠は中心点が入る最内のグループ、行はその枠の子の y 範囲が中心点に最も近い行、位置は
その行の子（枠の順序どおり）のうち中心 x が左にあるものの直後。ポインタからスロットへの変換はこの
一か所に閉じ、モデルへはスロットしか渡さない。

**除外するスロット**: 動かす要素が `movable: false`（free・サテライト）なら順序の意図は効かないので
順序は書かず、枠の移動だけ読む。

**順序列のマージ**: 新しい列 = 既存の列から動かした id を除き、行の両隣（u, v）を加え、エンジンの
枠内順序（Arrangement）でソートし、動かした id を u の直後（u が無ければ v の直前）に挿入する。
x 座標でのソートはしない。既存の列にあって Arrangement に無い id（不在のノード）は列の中の位置を
保って残す。結果の相対順が今の配置と同じなら何も書かない。

## エンジン側の意味（`pinned`）

ヒントの列は「名指しした子はこの相対順で立つ」。実現は `layers/start.ts` の `pinned`：
名指しした子のうち、すでにヒント順に並んでいる最長部分列はその場に残し、残り（動かした子）だけを
ヒントが直前に名指す子の直後（先頭なら直後の子の直前）へ挿し直す。名指ししない子は動かない。
旧実装は名指しした子が占めるスロットの中で並べ替えていたため、`[u, a, v]` を `[u, v, x, y, a]` に
かけると `v` が末尾へ飛んだ。sweep は各パス後に `pinned` を掛け直し、sift は名指しした子を動かさない
ので、意図はここだけで守られる。ヒントが無ければ `movable` をそのまま返すので、既存の図は変わらない。

## 優先順位と失敗の見え方

- **構造 > 意図 > 交差削減**。別の枠にいる id・free な id・サテライトの id を名指しても構造が勝つ。
- **消えた id は無視する**（エラーにしない）。`orderOf` が解釈できない名前を落とす。列からは消さず、
  Editor も `liveOrder` で間引かない（以前は間引いていたが、エンジンが無視するので不要）。
- **聞き入れなかった意図は `Arrangement.unmet` に出る**：名指しした id が存在するのに、その枠の
  movable な子として、ヒントの相対順で並ばなかったもの。Editor の状態バッジに数を出す。

## Editor と Server の一致

`drawNetwork(model)` が `model.drawing.order` を自分で読む。Editor は `layoutNetwork(currentModel())`
を、Server の bake（`derive-worker`）は `drawNetworkScene(resolved)` を呼ぶだけで、どちらも同じ
意図で描く。`resolveNetwork` は `project.drawing.order` を結果に通す（以前は `settings` だけ通して
いた）。`DrawOptions.hints` は廃止。Server の描画は order を持つモデルで変わるので
`RESOLVER_VERSION` を上げる。

## 退けた案

- **座標ピン**: エンジンは長さを読まずに離散決定を済ませるので、固定点を受ける段がない。Editor の
  Scene（平面図）が座標の正しい置き場。今回は作らない。
- **全兄弟を固定する列（旧 `readDrop`）**: 1 回のドロップで枠の交差削減が止まり、元に戻しただけでも
  書き込み、不在の id を捨て、別の行の兄弟まで x でソートしていた。
- **絶対ランク番号の保存**: 上流が 1 段増えると意味が変わる。エンジンの `Hints.rank` は下限として
  残っているが、YAML には出さない。
- **行の意図（「Y より下」「Y と同じ行」）を今回入れる**: 必要なら `below: Record<id, id>` を加え、
  ヒント無しで一度ランクを解いて `Hints.rank` の下限に一段だけ変換する形で入れられる（Kiel の
  二段階）。今回は要望が無く、順序だけで止める。別の行へのドロップは順序としてだけ読む。
- **Scene に Arrangement を載せる**: Scene は「座標だけ」の契約で、ゴールデンテストが Scene 全体を
  ハッシュしている。別の戻り値 `Drawing = { scene, arrangement }` にした。
- **ドラッグ中のスナップ表示**: `slotsOf` / `slotAt` はそのまま使えるが、Renderer に drag-move の
  通知を足す必要がある。今回はドロップ時の読み取りだけ。
