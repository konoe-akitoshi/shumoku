# P1a の段階的な実験: 構成と表示を分離する

2026-10-06。**座標・表示サイズ・ポート配置に続き、色と線・配置方向を別保存できた。**
P1a 全体の完了や、新しい公開モデルの採用を意味しない。

[比較図](comparison.html)は案 A / B の座標、サイズ・ポート順序、スタイル・配置方向の計十二例を表示する。
[検証結果](report.json)には指定・配置後の座標とサイズ、ポート、接続端点、スタイルを記録した。
元の [実装計画](../../network-model-implementation-plan.ja.md#p1a-構成と表示を分離する最初の比較)に沿い、
座標とサイズの分離に続き、Node と Connection の代表的なスタイル・配置方向を試した。

## 今回動くもの

- 案 A: Node 内の Port と `from` / `to` を使う、現行に近い構成の部分集合。
- 案 B: 独立した Port 配列と二端点 Connection を使う、既存の設計 fixture。
- 別の presentation ファイルによるノード中心座標、表示サイズ、ポートの表示面・順序の指定。
- Node の塗りと線、Connection の線、TB / BT / LR / RL の配置指定。
- JSON ファイルへの保存・再読込、構成から描画用 graph / layout / SVG を生成する一方向の処理。
- 不正な座標・サイズ、参照先の欠落、端点の所有者違い、配置 ID・ポート順序の重複を診断する小さな validator。

案 A は [topology-a.json](topology-a.json)、案 B は
[router-switch.network.json](../../examples/network-model/router-switch.network.json)を入力とする。
[縦配置](vertical.presentation.json)と[横配置](horizontal.presentation.json)は両案で共有する。
追加の [4ノード構成 A](multiport.topology-a.json) / [B](multiport.topology-b.json)は、
[420 × 100 px・順序 1/2/3](multiport.forward.presentation.json)と
[560 × 160 px・逆順 3/2/1](multiport.reverse.presentation.json)で比較する。
さらに、枝分かれと一段深い接続を持つ [構成 A](styled.topology-a.json) / [B](styled.topology-b.json)を、
[青・TB 配置](styled.tb.presentation.json)と[橙・破線・LR 配置](styled.lr.presentation.json)で比較する。
これらは公開仕様の schema ではなく、今回の比較に必要な部分だけを検査する実験用の型である。
属性辞書や未知の profile の編集契約は実装していない。

## 確認できたことと設計への影響

| 観察・検証 | 判断できること |
| --- | --- |
| 両案から同じ描画用 graph と SVG を生成できた | この二ノードの座標分離には、Port の全面再編は必須ではない |
| 四例で保存座標と配置後の座標が一致した | Node の座標を構成に永続化せず、独立した presentation から供給できる |
| 追加の四例で指定サイズと実際の SVG の矩形サイズが一致した | サイズを構成から分離し、配置に必要な領域と描画の寸法を一致させられる |
| 3ポートの並びを逆転しても、各 Connection の元の接続先とポートへの付着が変わらなかった | 表示の並びとネットワークの接続順・接続先を分けられる |
| 青い上下配置を橙の左右配置と破線へ変更しても接続先が変わらなかった | 色や線・配置方向を構成属性と分け、派生表示にだけ適用できる |
| 再読込・描画・派生値の属性変更で入力の構成値が変わらなかった | 描画用データのコピーと正本の書込み経路を分けられる |
| 座標を省略した例では layout にだけ位置・サイズが生成された | 自動配置の結果を構成や presentation に書き戻す必要はない |
| 案 B の二つの所属と配線長 12.5 m の fixture が保存前後で同一だった | 表示変更によって保存済みの構成・物理事実を消さずに済む |

配線長は架空の測定値を持つ[独立した profile](../../examples/network-model/router-switch.route-profile.json)
をそのまま保存した。図上の距離から実長を推定せず、今回 profile の意味や参照契約は検査していない。
案 B の Group は保持するが描画しない。案 A に Group の同等表現を作っていないため、
**所属を含む両案の表現力が同等だとは判断できない**。

共通の presentation を使うため、案 A の Port にも topology 内で一意な ID を要求した。
これは現行の node 内スコープより強い実験条件であり、今後の ID 契約の採用根拠にはしない。
Port が確定した二ノード、三台への分岐、一段深い接続を持つ四ノードを扱う。
平行接続、端点未特定、集合の折りたたみは未検証。

## 表示サイズとポート配置の試作方針

サイズは図上の矩形の幅・高さを px で指定し、筐体の実寸や配線長とは分ける。
`nodeSizes` に指定がない Node は既存エンジンが計算する。
指定がある場合は、ラベルとポートが必要とする最小 footprint 以上ならその寸法をそのまま使う。
最小寸法未満は、黙って拡大せず診断する。この優先順位は試作の方針で、公開仕様の決定ではない。

指定サイズを placement 前に渡すため、サイズのある Node の自動配置でも必要な領域が予約される。
配置後に `placePorts()` と `routeEdges()` を再実行し、ポートを最終サイズの辺へ置き、
接続先が変わらないことを検査する。viewport の bounds に矩形が収まることも確認した。
自動計算したサイズ・座標は、構成や保存した presentation へ書き戻さない。

同じ面に全ポートの `order` を指定した例では、昇順に配置する。値は連続番号でなくてよい。
指定がない場合は最終的な接続先座標による並びを使い、固定座標へ移した後に再計算する。
一部だけ `order` を指定した場合の現行処理は「指定済みを先、その後に自動順」。
今回の図は全指定と全未指定を検証し、混在時の並びを新モデルの保証にはしない。
同じ Node・同じ面での `order` の重複は曖昧なため診断する。

サイズ拡大で固定座標の矩形が重なるケースは診断する。
現行エンジンは一部の衝突解消で `fixed` の座標も動かすため、最終座標と保存値の一致を明示検査する。
表示設定を満たせない場合に「再現できた」と扱わない。自動の修正を保存値へ反映する操作は実装していない。

## スタイル・配置方向の試作方針

Node の `fill`、Node / Connection の `stroke`・`strokeWidth`・`strokeDasharray` を
ID 指定の presentation に保存し、描画用の派生 Node / Link にだけ適用する。
この実験の色は三桁・六桁の hex、線幅は正の有限値、破線は非負の数の列に限定した。
フォント、透明度、Group のスタイル、CSS セレクター、任意の SVG 属性は未対応として扱う。
これは実験用の部分集合であり、将来のスタイル形式をこの形に固定しない。

`direction` は自動配置とポートの既定の面を決める。TB / BT / LR / RL の四方向を検査した。
`layerGap` は自動配置の段間隔を指定する正の px 値で、未指定なら既存の既定値を使う。
左右配置の例ではポート名が線を隠さないよう 200 px を指定した。段間隔も構成の事実とは分ける。
明示座標は図上の座標としてそのまま使い、明示ポート面は方向より優先する。
方向を変えても Connection の端点順・参照は書き換えず、通信方向の事実は生成しない。

旧 `Node.rank` は今回の配置経路で入力制約として参照されず、現在必要な用途もない。
旧項目を移すことを目的に追加した整列処理を削除し、`nodeRanks` を実験の保存形式と受入条件から外した。
構成と表示の分離は、旧表示項目をすべて再実装する要求ではない。
表示機能は現在必要な用途を根拠に選び、不要な項目は引き継がない。
配置アルゴリズム内部の段番号は計算上の派生値であり、保存する入力項目とは区別する。
2026-10-07 に core の型・読込・書出し・観測解決、NetBox の出力、Server の入力検査からも削除した。

## 既存コードとの接続と残る制約

`prepareRender()` → `computeNetworkLayout()` の通常経路は指定座標を固定するオプションを渡さない。
今回の試作は既存の `autoLayoutFlatTree(..., { fixed, direction })` → `placePorts()` → `routeEdges()` →
`renderSvgString()` を呼び、構成と presentation からその都度派生値を作る。
サイズの最小値検査と指定値の供給は、実験内の `nodeFootprint` 方針として配置エンジンへ渡す。
既存の配置・描画エンジンへ、サイズ方針と独立した表示設定を接続した。
この実験自体は Editor / Server を切り替えない。後続の製品変更として、Editor の
ZIP / JSON / IndexedDB でノード座標・表示サイズ・形と各要素のスタイルを分離した。
[実際の保存形と検証](../../network-model-storage-stage.ja.md)を参照。Server は未変更。

未接続の Port は現行 `placePorts()` の描画対象にならない。
その Port への表示指定は未対応として診断し、存在しない接続を補って描画しない。
全ポート一覧の表示、Group 境界、ラベル間の全衝突、サイズ不足時の縮小・折り返しは未検証。

## 再現手順

リポジトリルートから実行する。`bun install` 済みであることが前提。
実験は独立 workspace を増やさず、既存 core のビルドと依存を使う。
renderer は現在の `src/static.ts` を直接呼ぶ。公開 package の変更はない。

```powershell
bun run --cwd libs/@shumoku/core build
bun x vitest run --config docs/experiments/2026-10-06-model-separation/vitest.config.mts
bun x tsc -p docs/experiments/2026-10-06-model-separation/tsconfig.json
bun run docs/experiments/2026-10-06-model-separation/render.ts
bun x biome check --write docs/experiments/2026-10-06-model-separation
```

`render.ts` は比較 HTML と report を更新する。テストと描画実行は OS の一時ディレクトリへ
一意な JSON ファイルを書き、再読込後にそのファイルだけを削除する。
fixture と製品データは上書きしない。

検証: 18 テスト、実験用 TypeScript check、変更ファイルの Biome check が成功。
ブラウザで十二の SVG と外部通信なしを確認した。
全体 lint は未変更の Editor の `card-action.svelte` / `card-header.svelte` の整形差分で失敗。
全体 typecheck も未変更の `apps/server/scripts/dev-api-server.ts:59–60` にある
`SIGINT` / `SIGTERM` の型エラーで失敗したため、全体検証済みとは扱わない。
コミット時はこれら二つの全体チェックだけを除外し、変更ファイルの整形フックは実行する。

## 次の一件

製品側でも geometry・スタイルに続き、NodePort.placement、root GraphSettings、group direction を
表示側へ移した。派生する Subgraph.bounds は保存せず、読込時に保存済みノードを動かさず再計算する。
この実験と製品保存契約は別の schema である。[現在の保存形と検証](../../network-model-storage-stage.ja.md)を参照。

**次は spec.icon、Link.type / arrow / bends を実際の利用箇所から分類する。**
表示の経路と配線長に使う物理経路が混ざっている bends は、値を保持して意味を先に確かめる。
選択と一段の折りたたみは、その土台を使う後続作業とする。
構成本体の改善を表示範囲の試作で置き換えない。案 A / B の採否は必要な参照と保存の成立性で判断する。
