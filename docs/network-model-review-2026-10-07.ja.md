# 構成・表示分離の実装レビュー

2026-10-07。指定された [coding スキル](https://github.com/ryota2357/dotfiles/blob/master/coding-agent/skills/coding/SKILL.md)
を読み、公開契約と実装の対応、不正な状態の型表現、テストの保証範囲、挙動の再現を軸にレビューした。
対象は `aa0cb026` までの保存分離、先行する rank 削除との整合、関連する説明と計画。
新モデル全体の適合検証や全製品のレビューを完了したものではない。

この記録の NodeGeometry、document v1、ZIP v2、DB v4 はレビュー時点の契約である。
後続のスタイル分離で NodePresentation、document v2、ZIP v3、DB v5 に更新した。
現在の保存形・図・検証範囲・残る作業は [実保存契約](network-model-storage-stage.ja.md)を参照。

## 判断

必要な表示情報を別保存へ移し、読込で runtime 値を作る方向は妥当。
Port や source を全面再編しなくても、この保存境界は成立している。
一方、保存・合成のテストだけで Editor の復元まで保証したと扱うことはできなかった。
部分的な geometry と transaction 中断の境界ケースを追加して、以下を修正した。

| 指摘 | 再現・根拠 | 修正 |
| --- | --- | --- |
| P1: 一部の座標が未指定だと、保存済みの geometry を上書きする | 実 Editor に A=(900,700)、300×120、B=座標なしを渡すと、A は (0,30)、80×60 に変わった | 自動配置の提案に保存 geometry を優先して合成し、最終位置でポート・edge・表示範囲を再計算。必要な group enclosure を拡張 |
| P2: DB 中断で、catch 済みでも未処理 rejection が出る | 実 IndexedDB で callback を待機させ、transaction を abort。呼出側の catch と別に unhandledrejection が発生 | callback と transaction 完了を同時に監視し、中断を直ちに返す。DB error が null の明示 abort は AbortError として返す |
| P2: geometry の型が runtime validator と異なる | `{ nodeId }` だけが旧 NodeGeometry 型で合法だが validator は拒否 | schema を「座標必須」または「サイズ必須」の union にし、同じ定義から型を導出 |
| P2: geometry がないノードの ID と旧 rank を保存境界で検査していない | コード確認: 旧検査は truthiness のみで `id: true` を通す。rank の不在も検査せずコピーしていた | 両操作で空でない文字列 ID と rank の不在を検査。重複 ID と合わせて回帰試験 |
| API の利用制約と試験の範囲が説明不足 | 公開 API に clone 可能な値という前提の説明が不足。asset 試験のコメントは loadProject まで実行したように読めた | public API の保証、失敗条件、例を追加。reader 試験と実 Editor 検証を区別 |

固定 geometry の復元は、自動配置結果を保存値へ合わせる処理である。
ノードや group の全衝突を自動で解消する契約ではない。group の囲みは保存ノードを動かさず拡張するため、
手動配置によって囲みが大きくなる場合がある。自動配置の品質改善と保存値の尊重を混同しない。

## 修正後の証拠

- core 関連 121 テスト、Editor 全 94 テストが成功。
- core build/typecheck、Editor typecheck、変更ファイルの Biome が成功。既存の Svelte warning 7件、optional-chain warning 2件は残る。
- geometry の三形（座標のみ、サイズのみ、両方）、不正 ID、重複 ID、旧 rank を保存 API で検査。
- 実際の配置結果を使い、部分 geometry の保持、未指定座標の補完、構成不変、入力不変と nested group の包含を試験。
- transaction の callback 待機中の中断、検査例外、DB error が null の abort を公開 helper 経由で試験。
  この単体試験の DB は制御可能な stub であり、実 IndexedDB の代替と主張しない。
- 隔離 Chromium の実 IndexedDB で修正前後を比較。修正後は未処理 rejection がゼロになった。
- 実 Editor で A の (900,700)、300×120 を保持し、B の未指定座標を補完、保存サイズ200×100を保持。
  最終座標で一接続の描画 edge を再生成し、JSON の topology に座標・サイズが混入しないことを確認。

既存全体 lint/typecheck の失敗は[保存分離の記録](network-model-storage-stage.ja.md)を参照。
今回の関連テスト成功を、リポジトリ全体の成功とは扱わない。

## 土台について残ること

`NetworkTopology` は現時点で「Node.position / size を除いた保存型」である。
Node/Link/Subgraph のスタイル、layout settings と既存の source 属性は残る。
したがって、この型名だけで描画から独立した標準モデルの設計が完了したとは判断しない。
描画用 runtime Node の存在そのものは問題ではないが、構成の正本へ戻す入口を増やさないことが必要。

次は実製品でのスタイル分離を完了し、構成側の許可項目を明確にする。
Port/Group/source/profile の新契約は、既存型や特定製品を参考にしたという理由で確定せず、
必要な参照・変更例で確認する。containerlab との変換や拡張契約の未検証は引き続き残る。
