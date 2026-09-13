# Shumoku website palette

更新: 2026-09-14。会話で確認した「ブランド緑＋暖色ニュートラル」案へ復元。

Source of truth: [palette-model.ts](../apps/website/src/lib/ui/palette-model.ts).
Generated artifact: [palette.css](../apps/website/src/lib/ui/palette.css).
Regenerate: `bun apps/website/scripts/palette.ts --write`.
Preview: `/ja/ui-preview#palette-title` (development only).

## 原典 → 採用判断

- [Ottosson / Oklab](https://bottosson.github.io/posts/oklab/): 知覚的な明度・色度を扱える色空間。
  採用: OKLCHのL/C/hからsRGBへ変換し、色域外はL/hを保ってCを減らす。
  LとWCAG相対輝度は別物なので、最終8-bit HEXでコントラストを再計算する。
- [Carbon / Color usage](https://carbondesignsystem.com/elements/color/usage/): 色を用途とレイヤーで管理。
  採用: canvas/surface/field/shellとhover/pressedを分離。独立した手作業の灰色を増やさない。
- [Adobe / 60–30–10](https://www.adobe.com/express/learn/blog/best-color-palettes-for-websites-and-classrooms):
  主・副・アクセントの配分を考える実用目安。科学的な最適比率やWCAG要件ではない。
  採用: 広い暖色ニュートラル背景→補助面→限定的な高彩度の緑の順に視覚的な主従を作る。
  編集画面の面積を厳密に60/30/10にするためのレイアウト変更はしない。面積比は未計測。
- [WCAG / Contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html):
  通常文字は原則4.5:1。採用: 主文字・補助文字は状態面まで4.5以上、通常の主要背景はより余裕を確保。
- [WCAG / Non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html):
  識別に必要なUI境界や状態は隣接色に3:1。全ての装飾面の差を3:1にする規定ではない。
  採用: 入力・secondaryの輪郭とフォーカスは3以上。静的な区切り線は弱い別トークン。
- [WCAG / Use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) と
  [CUDOの3つのポイント](https://cudo.jp/?page_id=86): 色だけに情報を依存させない。
  採用: Noticeは異なるアイコンと文言、選択は持続するマーカー／輪郭、selectは標準チェックを残す。
  focusは青い輪郭、選択は緑の塗り・輪郭。色相だけで区別させない。

## 設計値

ユーザーレビューに基づき、無彩色→全体を緑系に統一した案→緑＋暖色ニュートラル案へ更新。
ロゴの実色をOKLCHに変換し、緑のh≈155.515°はブランド・操作色で維持する。
背景・文字はh=80°の石色に分離。Cは `min(.018, L×.06, (1−L)×.35)`。
明暗端では彩度を下げ、ベージュを強く主張させず主役の緑を引き立てる。
これはプロジェクトの造形判断であり、アクセシビリティ規格が定めた色ではない。
主な面の明度は0.06刻みを維持。
Light: site canvas L=.98 / surface .92 / workspace shell .92 / hover .86 / pressed .80 / field .995。
Workspaceは独立したchrome .96 / canvas .995で、操作面より作業面を明るくする。
Dark: shell .14 / canvas .20 / surface .26 / field .32 / hover .38 / pressed .44。
文字はLight .20・補助 .38、Dark .98・補助 .86。境界はLight .50、Dark .74。
緑の通常L/CはLight .46/.11、Dark .82/.10。
focusはh=250°、errorはh=30°。全入力値・色域調整はモデルで追跡できる。

前の無彩色案でダークの境界L=.68はpressed面に2.71:1となり、検査で.74へ修正した。
規格の最低値を丸めて合格扱いせず、実装色で検証する。

基礎パレットは緑11色・暖色ニュートラル13色・黄緑6色の計30色。
`--brand-green-*` / `--brand-neutral-*` / `--brand-lime-*`としてCSSにも生成する。
500にはロゴの元色をそのまま保持し、round-tripをテストする。
基礎色は素材、`--site-*` / `--ui-*`は用途。通常の部品では用途トークンを使う。
明るいロゴ色をそのまま白文字の背景にはせず、主要操作用には読みやすい明度を選ぶ。
黄緑はブランド表現用の補助パレットとして用意し、今回の操作画面へ強制的には増やさない。
全基礎色がどんな文字色との組合せでも適合するという意味ではない。

## 色覚確認

UI previewには明暗の実コンポーネント見本とP/D/T型・グレースケール切替を追加。
[Machado et al. (2009) の著者公開行列](https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html)
のseverity 1.0をlinear RGBに適用する。SVG側もlinearRGBを指定する。
これは混同しやすさの近似で、当事者の視覚の忠実な再現ではない。
[CUDOのシミュレーション上の注意](https://cudo.jp/?page_id=90)に従い、実利用者による評価の代用とはしない。
変換後の主要操作文字・ニュートラルの補助文字を自動検査するが、その数値はWCAG適合判定ではない。

## Direction (current implementation)

Warm stone neutrals support backgrounds and typography, while green identifies
the brand and primary actions. The original wordmark uses #14ae67;
the symbol also includes #13ae67 and #8fc31f. These asset colors remain unchanged.
Light avoids a pure-white canvas; dark avoids pure black and pure-white body text.
This is a visual design choice, not a medical claim about eye strain. Ambient light,
screen brightness, personal preference and readability still matter.

| Role | Light | Dark |
| --- | --- | --- |
| Canvas | `#fbf8f3` | `#191610` |
| Brand wash | `#e9fbee` | `#022110` |
| Section band | `#d7d0c4` | `#0b0906` |
| Surface / pane chrome | `#ebe4d8` | `#28231c` |
| Field | `#fefdfc` | `#383229` |
| Workspace shell | `#d7d0c4` | `#0b0906` |
| Hover | `#d7d0c4` | `#474138` |
| Selected / pressed | `#c4bdb1` | `#585248` |
| Main text | `#191610` | `#fbf8f3` |
| Secondary text | `#474138` | `#d7d0c4` |
| Primary action | `#07693c` | `#8ed8a8` |
| Primary text | `#fbf8f3` | `#191610` |
| Link | `#07693c` | `#8ed8a8` |
| Focus | `#125a98` | `#95c9ff` |
| Error | `#9a2a1e` | `#feac9e` |

### Disabled controls

WCAG 1.4.3は操作不能なUI部品を文字コントラスト要件から除外するが、除外を
低可読性の目標にはしない。無効なbutton/input/tab/toolbar actionは
`--site-muted`を各ニュートラル面上に通常opacityで表示する。無効状態はnativeの
`disabled`、ニュートラルな面、補助文字色、`not-allowed` cursorで伝え、色や薄さだけに
依存しない。両テーマの組合せを4.5:1以上として自動検査する。

2026-09-14に開発用UI previewを566×698 CSS px、DPR 1でDOM計測した。
直接の文字ノード316件のうち、変更前に4.5:1未満だった有効文字は0件。
唯一の該当は無効primary buttonの4.38:1で、今回その背景とopacity方針を修正した。
この計測は疑似要素、背景画像、canvas/SVG内の情報、全ての動的状態を網羅しないため、
ページ全体のWCAG適合宣言には使わない。

## Ownership and limits

- Both themes use the same semantic roles but independently tuned, opaque colors.
  Do not add component-local mixtures for these roles.
- Workspace shell, chrome and canvas alias these roles; active file tabs use canvas.
- Keep state labels, native semantics and focus indicators; color is not the only cue.
- Logo assets and rendered diagram themes remain unchanged. YAML controls the diagram's theme.
- `palette.test.ts` checks intended normal-text pairs at 4.5:1 or greater, including
  primary hover/active and disabled text. This is not an app-wide accessibility
  compliance claim; imagery, forced-colors and nested backgrounds need separate review.
- Diagram health, severity and link states must pair color with labels, icons, line styles or
  another non-color cue. CVD simulation is a review aid, never the sole acceptance test.
- Long landing pages alternate canvas and dedicated section bands for rhythm. Reserve the
  brand wash for one high-value band; do not turn every section into a green-tinted panel.
  Section bands use `--site-section-alt`, not the component `--ui-surface`, so cards and
  controls do not merge into their surrounding page background.
- Future edits must update this table and inspect both themes in UI preview and Playground.
