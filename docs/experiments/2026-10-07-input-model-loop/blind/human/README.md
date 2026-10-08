# 人による確認（約15分）

luna（軽いモデル）を人の認知負荷の目安にしてきたので、実際に人が書けて読めるかを確かめる。

1. `types.ts` を読む（形式の定義。コメントが説明）。
2. 書く: `task-write.md` の課題を YAML で書く。迷った点・書けなかった点・補った点と時間をメモ。
3. 読む: `read.yaml` を読んで `questions-read.md` に答える。迷った点もメモ。
4. 答え合わせ: 読む課題は `key-read.md`。書いた YAML はパーサーに通す（下）。

```sh
cd docs/experiments/2026-10-07-input-model-loop
bun -e "import {parseNetwork} from './model'; parseNetwork(Bun.YAML.parse(require('fs').readFileSync('blind/human/mine.yaml','utf8'))); console.log('ok')"
```

`key-read.md` は答えなので、読む課題が終わるまで開かないこと。
