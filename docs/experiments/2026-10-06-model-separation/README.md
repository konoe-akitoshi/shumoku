# P1a の最初の実験: 座標を構成から分離する

2026-10-06。**座標とポートの表示面を別保存し、既存の描画コードで再現できた。**
P1a 全体の完了や、新しい公開モデルの採用を意味しない。

[比較図](comparison.html)は案 A / B と縦 / 横の計四例をオフラインで表示する。
[検証結果](report.json)には保存した座標と実際の配置座標を記録した。
元の [実装計画](../../network-model-implementation-plan.ja.md#p1a-構成と表示を分離する最初の比較)に沿い、
今回は Node の座標と Port の表示面までに区切った。

## 今回動くもの

- 案 A: Node 内の Port と `from` / `to` を使う、現行に近い構成の部分集合。
- 案 B: 独立した Port 配列と二端点 Connection を使う、既存の設計 fixture。
- 別の presentation ファイルによるノード中心座標、ポートの表示面・順序の指定。
- JSON ファイルへの保存・再読込、構成から描画用 graph / layout / SVG を生成する一方向の処理。
- 不正な座標、参照先の欠落、端点の所有者違い、配置 ID の重複を診断する小さな validator。

案 A は [topology-a.json](topology-a.json)、案 B は
[router-switch.network.json](../../examples/network-model/router-switch.network.json)を入力とする。
[縦配置](vertical.presentation.json)と[横配置](horizontal.presentation.json)は両案で共有する。
これらは公開仕様の schema ではなく、今回の比較に必要な部分だけを検査する実験用の型である。
属性辞書や未知の profile の編集契約は実装していない。

## 確認できたことと設計への影響

| 観察・検証 | 判断できること |
| --- | --- |
| 両案から同じ描画用 graph と SVG を生成できた | この二ノードの座標分離には、Port の全面再編は必須ではない |
| 四例で保存座標と配置後の座標が一致した | Node の座標を構成に永続化せず、独立した presentation から供給できる |
| 再読込・描画・派生値の属性変更で入力の構成値が変わらなかった | 描画用データのコピーと正本の書込み経路を分けられる |
| 座標を省略した例では layout にだけ位置・サイズが生成された | 自動配置の結果を構成や presentation に書き戻す必要はない |
| 案 B の二つの所属と配線長 12.5 m の fixture が保存前後で同一だった | 表示変更によって保存済みの構成・物理事実を消さずに済む |

配線長は架空の測定値を持つ[独立した profile](../../examples/network-model/router-switch.route-profile.json)
をそのまま保存した。図上の距離から実長を推定せず、今回 profile の意味や参照契約は検査していない。
案 B の Group は保持するが描画しない。案 A に Group の同等表現を作っていないため、
**所属を含む両案の表現力が同等だとは判断できない**。

共通の presentation を使うため、案 A の Port にも topology 内で一意な ID を要求した。
これは現行の node 内スコープより強い実験条件であり、今後の ID 契約の採用根拠にはしない。
今回は Port が確定した一つの接続だけを扱う。平行接続、端点未特定、集合の折りたたみは未検証。
ポート順序の入力・再読込は扱うが、複数ポートの順序の描画比較は次のケースに残す。

## 既存コードとの接続と残る制約

`prepareRender()` → `computeNetworkLayout()` の通常経路は指定座標を固定するオプションを渡さない。
今回の試作は既存の `autoLayoutFlatTree(..., { fixed })` → `routeEdges()` →
`renderSvgString()` を呼び、構成と presentation からその都度派生値を作る。
独自の配置・描画エンジンは追加していない。既存 Editor や Server の保存経路もまだ変更していない。

表示サイズは現行の自動配置処理で footprint から計算される。
独立した保存サイズを尊重する経路は今回試していないため、座標と同時に移行できたとは扱わない。
一般の固定ノードの重なりや Group 境界への配置も今回の合格範囲に入れない。

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

検証: 6 テスト、実験用 TypeScript check、変更ファイルの Biome check が成功。
ブラウザで四つの SVG と外部通信なしを確認した。
全体 lint は未変更の Editor の `card-action.svelte` / `card-header.svelte` の整形差分で失敗。
全体 typecheck も未変更の `apps/server/scripts/dev-api-server.ts:59–60` にある
`SIGINT` / `SIGTERM` の型エラーで失敗したため、全体検証済みとは扱わない。
コミット時はこれら二つの全体チェックだけを除外し、変更ファイルの整形フックは実行する。

## 次の一件

**表示サイズと複数ポートの配置を別保存したケースを追加する。**
指定値と自動計算値の優先順位を決め、ノード・ポート・リンクの位置が矛盾しないかを検査する。
その後にスタイル / rank / 配置方向、選択 / 一段の折りたたみを順に試す。
この順序で不足の具体例を集めてから、案 A / B の採否を判断する。
