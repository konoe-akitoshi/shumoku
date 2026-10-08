# 全段を通す最小の実例

docs/topology-dataflow.md の §6 の作業。作り物の入力を一つ、入力 → `NetworkGraph` → resolve → レイアウトと
通し、各段で何が落ちるかを見る。データはすべて作り物。

新しい入力のモジュールは main にない（PR #821 / #823）。動かすときは、input-wiring ブランチの
`libs/@shumoku/core/src/input/` の schema.ts、parse.ts、to-legacy.ts、index.ts を
`libs/@shumoku/core/src/_skeleton/` に写し、run.ts も同じ場所に置いて `bun libs/@shumoku/core/src/_skeleton/run.ts`
を実行する（`_skeleton/` はコミットしない）。

結果は docs/topology-dataflow.md の §6 に書いた。
