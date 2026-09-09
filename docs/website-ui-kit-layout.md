# Website UI kit: グリッド・文字・操作領域の設計記録

更新日: 2026-09-10。対象: `apps/website` のUIキットとPlayground。
本書は実装判断の根拠と再発防止のための開発ドキュメントであり、CSS規格や
Müller-Brockmannの原著そのものではない。Docsサイトへの適用完了は意味しない。

## 結論

タブの「均一な余白」は、全ての文字とアイコンの描画輪郭を同じ距離にすることではない。
まず周辺の見出し・操作行と共通の配置基準を持ち、その中で文字と図形を自然に配置する。
文字の輪郭だけを基準に部品の高さを決めると、ファイル名・フォント・ブラウザーに
依存する寸法体系になり、UI全体の整合性を失う。

採用する責務分担は以下。これはShumokuの設計判断であり、規格の要求ではない。

| 層 | 所有するもの | 所有しないもの |
| --- | --- | --- |
| ホスト（workbench） | ペイン幅、外側余白、行の配置、折り返し | 子ボタンの高さ・SVGの補正 |
| 共通compactスタイル | 操作行の最小高さ、行高、文字サイズ、入力方式別ターゲット | 各ページの配置 |
| FileTabs等の部品 | 内部の列、選択、フォーカス、アイコン配置 | ペインの外側余白 |
| アセット | 元のviewBox、パス、ストローク | ボタンのクリック領域 |

## 1. 今回の根本原因と撤回した実装

実装履歴の考察であり、以下の因果関係を外部文献が直接検証したわけではない。

1. **同じ寸法を別々に所有していた。** Button、Toolbar、FileTabsとホストCSSが
   それぞれ寸法を調整でき、局所修正が他の部品へ伝わらなかった。
2. **比較している対象が途中で変わった。** CSSのpadding、文字のline box、SVGの
   viewport、実際の描画輪郭、クリック領域を同じ「余白」と呼んでしまった。
3. **横方向の光学調整で縦方向のリズムを壊した。** X専用viewBox、文字のtrim、
   小さなglyph slotからはみ出すクリック領域を組み合わせた結果、タブだけが
   フォント依存の高さになった。直前の実測では約29.03px、周辺のボタンは32pxだった。
4. **検証用の見本が実物ではなかった。** UI previewのWorkspaceには汎用Tabsがあり、
   PlaygroundのFileTabsを隣接部品と一緒に比較する見本がなかった。

現在は専用viewBox、text-box-trim、疑似要素によるクリック領域拡張、glyph slotを撤去。
ラベルと×はそれぞれ実際のグリッド列を占有する。×は常時表示し、最後のファイルでは
無効化する。開いたファイルと保存済みファイルを二重管理する機能は追加しない。

## 2. 出典から言えること／採用判断

### グリッドは共通の基準であり、全ての輪郭を強制的に揃える装置ではない

使用した[グリッドスキル][grid]の §2.1 は寸法の一元化、§2.6 はboxとinkの区別、
§3 は複数幅での実測を扱う。ただしこれは第三者による実装ガイドであり、原著の
直接引用資料としては扱わない。特に大型見出し向けのcanvasによる光学補正を、
小さな操作部品へそのまま移植する判断は採用しない。

Shumokuでは基準単位を0.25rem、主要insetを0.5remとする。スキルの例示する
12列・8pxベースラインを編集画面へ無条件に強制しない。タブとボタンは同じ操作行に
属するが、ペイン見出しやスクロール行まで全て同じ高さである必要はない。

### line boxと描画輪郭は違う

[MDN: line-height][line]は行ボックスの高さを説明している。
[MDN: text-box-trim][trim]はフォントメトリクスに基づくblock方向の空間の
トリミングを扱う。個々のファイル名の全方向の輪郭を等距離にする機能ではない。

採用判断: compact部品は共通の1.5rem行高と最小高さで配置する。trimを使って
行の高さを縮めない。本文や大型見出しでの使用まで禁止するわけではない。
日本語、アクセント、descenderを含む文字を許容し、文字拡大時の切断を避ける。

### SVGは維持し、キャンバスとクリック領域を分ける

[MDN: viewBox][viewbox]が定義するのは、SVGのユーザー座標系と表示領域の対応である。
viewBoxがそのままパスの描画輪郭というわけではない。

採用判断: Lucide Xの標準viewBoxを維持し、CSSで16px相当のキャンバスを中央に置く。
ファイルタブだけで座標を切り詰めない。小さな描画を理由にクリック領域を縮小しない。
アイコンセット全体に問題がある場合は、アセット設計としてまとめて再検討する。

### 同じ数値だけでは同じ外寸にならない

[MDN: box-sizing][box]によれば、border-boxは指定寸法にpaddingとborderを含める。
採用判断: UIキットが自分のbox-sizingを明示し、Tailwind等のページ側resetに依存しない。
compactのサイズ指定は色のvariantより優先する。primaryだからcompact指定を無視して
大きくなる、というカスケードを許容しない。

### 画面の狭さと入力方式は独立

[MDN: pointer][pointer]は主ポインターの精度を判定する。幅による判定ではない。
[MDN: container queries][container]は親コンテナーの寸法等に基づく適応を扱う。

採用判断: 幅はペイン数と折り返しに、pointer: coarseは操作領域の拡大に使う。
狭いPCウィンドウをタッチ端末と決めつけない。逆にタッチ対応PCもあり、幅の確認だけで
タッチ確認済みとしない。現状の方針は主ポインター基準で、全ての複合入力を網羅する
保証ではない。any-pointerへの変更は対象端末で比較して決める。

### アクセシビリティ上の最低条件と設計上の余裕を混同しない

[WCAG 2.2 SC 2.5.8の解説][target]は24×24 CSS pxのターゲットまたは所定の例外を
説明する。44pxが全ての操作に必須だという規定ではない。

採用判断: fine入力の×は1.5rem、coarseでは2.75remを確保する（root 16px時に24/44px）。
角丸や隣接ターゲットの位置にも注意する。寸法トークンだけでWCAG適合を宣言しない。
rootの縮小、ズーム、カスタムスタイル、実際のクリック可能範囲を含めて確認する。

### VS Codeから借りる範囲を明示する

参照するのは更新され続ける紹介ページではなく、[VS Code 1.137.0のModern UI tabs.css][vscode]
という固定バージョンの実装。borderlessな選択面とコンパクトな操作行の参考にする。
このバージョンが今後も「最新版」だとは主張しない。

Shumokuは完全なVS Codeクローンではない。ファイル削除とエディターを閉じる操作は別概念。
Playgroundでは呼び出し側がcloseLabelにDeleteを指定し、削除とUndoを所有する。
外観の参考から不要な再オープン機能やファイルモデルを導入しない。

## 3. UIキットの実装契約

実装: [compact.css](../apps/website/src/lib/ui/compact.css)、
[file-tabs.css](../apps/website/src/lib/ui/file-tabs.css)、
[FileTabs.svelte](../apps/website/src/lib/ui/FileTabs.svelte)。

| 寸法 | 共通トークン | fine / coarse（root 16px時） |
| --- | --- | --- |
| 操作行の最小高さ | `--ui-compact-height` | 32 / 44px |
| 行高 | `--ui-leading` | 24 / 24px |
| ラベル開始inset | `--ui-compact-label-inset` | 8 / 8px |
| ×の操作領域 | `--ui-compact-action-size` | 24 / 44px |
| ×のSVGキャンバス | `--ui-compact-icon-size` | 16 / 16px |

数値は設計値であり、CSS仕様が指定した値ではない。remはrootの文字サイズに追従する。
pxを使わないこと自体が目的ではなく、共通の役割・所有者・依存関係を持つことが目的。
borderやfocus outlineにはpxを使ってよい。

- Button compact、Toolbar compact、FileTabsは同じCSS規則から高さと文字サイズを得る。
- ×は独立したbuttonで、ラベルのbuttonへ重ねない。SVGサイズで列幅を決めない。
- 行高と高さを別々に持つ。高さはminimumなので長いラベルの折り返し時に成長できる。
- FileTabsの長い名前は省略表示し、titleとaccessible nameには完全な名前を残す。
- 外側の揃いはペインinset、文字の開始位置はラベルinsetで管理する。
- コンポーネントの幅を中身の文字数によらず等しくする要件はない。
- ページCSSから`.ui-file-close`や`.ui-control`の寸法を上書きしない。
- 光学補正が必要なら、先に実際のフォント、line box、SVG viewport、hit targetを
  別々に測る。negative marginやtransformを足す前に、隣接部品への影響を確認する。

## 4. 回帰防止と検証手順

[geometry.test.ts](../apps/website/src/lib/ui/geometry.test.ts)は寸法所有者、禁止した
局所補正、SVG/ARIA構造をチェックする。**これはソース構造とSSRのテストであり、
ブラウザーのCSSカスケード・実寸・光学的品質を保証しない。**

UI previewのWorkspaceに[実際のFileTabsを使った比較見本](../apps/website/src/lib/ui/CompactWorkbenchExample.svelte)
を置く。見出し、Button compact、Toolbar compact、日本語と長い名前、無効な最後の×を
同じ場所で確認できる。Playgroundだけを調整して見本と乖離させない。

変更時は以下を実施する。

1. `cd apps/website`、`bun run typecheck`、`bun run test`。
2. `/ja/ui-preview#workspace-title` と `/ja/playground` を実ブラウザーで開く。
3. 1280px、390px、ペインを狭めたPC、ブレークポイント前後で確認する。
   設定した幅ではなく実際のinnerWidthを記録する。
4. 同一行の高さ、見出しと先頭タブの文字開始位置、×の中心と独立したhit target、
   ページ全体の意図しない横スクロールを測る。タブ列の横スクロールは許容する。
5. Arrow/Home/End、フォーカス表示、削除後のフォーカス、最後の×、Undoを確認する。
6. coarse入力、light/dark、文字拡大200%、日本語/長い名前も確認する。
   自動化環境で再現できなければ未確認と記録する。

直前の修正で確認したのは1280/390pxのfine入力表示、32px高の一致とキーボードEndによる
選択タブの表示。coarse実機・200%文字拡大まで確認したという記録ではない。
グリッドスキル付属のeditorial用ハーネスは実行していないため、そのPASSは主張しない。

本書追加時の共通化後にも、UI previewの1280/390pxでButton・Toolbar・日本語を含む
FileTabsが32px高／24px行高を共有することを確認した。390pxで最後の×の無効化と
削除後のtabへのフォーカス復帰、ページの横はみ出しがないことも確認。
Playgroundの390pxではprimaryのRenderを含むcompact部品の32px高を確認した。
いずれもfine入力のブラウザー検証であり、前記の未確認条件は残る。

## 5. コンテナースクロールの責務

通常のスクロールはCSSのoverflowとブラウザーに任せる。選択タブの表示補助のみ
`reveal-horizontal.svelte.ts`のattachmentへ分離した。
[Svelte公式のattachments](https://svelte.dev/docs/svelte/@attach)は5.29以降で利用でき、
要素に紐づく副作用と後片付けを管理する。選択・項目の変更を内部のeffectで追跡し、
ResizeObserverは行と各項目の寸法変化を監視する。再実行・破棄時にdisconnectする。

[MDNのscrollIntoView](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView)
では既定の対象に祖先コンテナーも含まれる。採用判断として、タブ全体（×を含む）の
左右端を行の可視領域と比較し、行そのものにだけscrollByを実行する。
キーボードと削除後のfocusにはpreventScrollを指定し、ページのスクロールを防ぐ。
幅を超えるタブは近い側の端を表示し、既に両端を覆う場合は動かさない。
独自スクロールバーや常時スクロール位置をstateに同期する仕組みは追加しない。

`reveal-horizontal.test.ts`は移動量の計算を検証する。ブラウザーではページのscrollYが
変わらないこと、×がタブ列内に入ることを別途確認する必要がある。

## 6. スクロールバーの外観

スクロール制御とは別に、`scrollbar.css`の`.ui-scrollbar`で外観を共通化する。
FileTabs、汎用Tabsの横スクロール列、CodeEditorのtextareaに直接適用する。
[MDN: scrollbar-width](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scrollbar-width)
は非継承プロパティなのでラッパーだけに指定しない。fine入力ではthin、coarse入力では
autoとする。基本スタイルのthinの実際の太さはOS／ブラウザーに任せる。
FileTabsには下記の限定的な外観の上書きがある。JavaScript製のスクロールバーには置き換えない。

[MDN: scrollbar-color](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scrollbar-color)
に従いthumb／trackにサイトのmuted／bg色を使う。テーマ変更に追従し、forced-colorsでは
色も幅もautoへ戻す。非対応ブラウザーは標準表示へフォールバックする。スクロールがない
場合まで領域を予約するgutterは追加しない（タブ行やペインの余白を変えないため）。

### タブ列の操作時表示とホイール

FileTabsとCodeEditorは`.ui-scrollbar--quiet`を使い、fine入力ではhover／キーボードフォーカス時に
thumbを表示する。マウスを置いたままなら表示を維持する。「一定時間操作がないと消える」
タイマー方式ではない。高さは維持するため表示切り替えでタブ列が動かない。
標準CSSだけでは矢印ボタンの有無を指定できないため、対応エンジンでは限定的な
`::-webkit-scrollbar-button`指定で非表示にする。coarse／forced-colorsでは標準表示を優先する。
CodeEditorでは縦横両方のバーに同じ表示方針を適用する。行番号上のhoverでも本文のバーを
表示する。行番号上のwheelは本文へ元の縦横方向で転送し、下記のタブ用の縦→横変換とは分離する。

[MDN: ::-webkit-scrollbar](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/::-webkit-scrollbar)
は非標準機能であり、通常は標準のscrollbar-*を優先する。ただし矢印だけの非表示には
標準の代替指定がないため、この要件に限って使用する。対応エンジンでは標準の色・幅を
autoに戻したうえで意図的に上書きする方式であり、旧ブラウザー向けfallbackではない。
非対応エンジンで矢印非表示は保証しない。独自スクロールバー依存やidle監視は追加しない。

`horizontal-wheel.ts`のattachmentは横だけがoverflowするタブ列で、縦ホイールを横移動へ
変換する。pixel／line／page単位を換算し、横成分を持つジェスチャー、Shift、Ctrl／Metaは
変更しない。端やoverflowがない場合はpreventDefaultせずページへ渡す。
この処理はスクロールバー自体の置き換えではない。タッチ・キーボードの標準操作を維持する。

## 7. 現在位置の文字マーカー

NavLinkと汎用Tabsは`selection-marker.css`を共有する。選択・hover時は文字ラベルに
不透明な緑背景と白文字を付け、font-weightは400を維持する。本文リンクの下線、
FileTabsの選択面、操作ボタンのvariantは別の役割として維持する。

ラベルspanは左右に`--ui-marker-inset`（0.25rem）を持つ。その分を親のpaddingから
差し引き、文字位置・操作領域・縦リズムを維持する。これはグリッドスキルの
boxとinkの分離を踏まえたプロジェクト判断で、特定の余白を原著が要求するわけではない。
focusは操作領域のリング、forced-colorsの選択表示はラベルの輪郭で区別する。
hoverと選択の同じ外観は今回採用した仕様であり、hover中も現在位置をより明確に
区別する必要が出た場合は別途検討する。比較用の袋文字・ノード記号の実装は撤去した。

## 8. 古典的な理論から何を借りたか

ここでいう「古典」は、グラフィックデザイン、知覚の原理、初期のUI設計原則を
まとめた便宜的な呼び方である。同じ時代・同じ種類の理論ではない。
原典、後年の解説、第三者のスキル、Shumokuでの実験結果を区別する。
「古典的だから正しい」「下線だから古い」「角丸だからモダン」とは判断しない。

### 出典と適用範囲

| 資料 | 資料から読み取れること | 今回の適用判断 |
| --- | --- | --- |
| Massimo Vignelli, *The Vignelli Canon*, 「Semantics」「Syntactics」[原典PDF][canon] | 対象の意味を理解して形を決め、部分と全体の関係に一貫性を持たせる。掲載の地下鉄図では点の塗り／白抜きや文字の太さが情報を区別する | 同じ状態には同じ表現を割り当てる。ただし路線図の記号をそのままUIへ移植しない |
| Müller-Brockmannの考え方を翻案した[グリッドスキル][grid] §2.1・2.6 | 寸法の一元化、配置ボックスと文字の描画輪郭の区別を扱う | 文字マーカーの内側余白と操作領域を分離。Noticeは行高に基づくアイコン列と本文列を持つ。0.25remなどの具体値はプロジェクトの選択 |
| Jakob Nielsen, 1994年の[10ヒューリスティクス][heuristics]（参照ページの解説は更新版） | 状態の可視性、一貫性、必要な情報への集中を重視する。ミニマリズムはフラットな外観の強制ではない | 現在位置を残しながら装飾を減らす。下線・背景面・太字のいずれかを必須とする原則ではない |
| NN/G, [共通領域の解説][common-region] | 同じ境界内の要素をまとまりとして知覚する。共通領域は初期ゲシュタルト原理への後年の追加 | 背景を付ける範囲によって、文字の強調とカード全体のまとまりを使い分ける。「全てをカードにする」という意味ではない |
| Matthew Butterick, [Bold or italic][emphasis] | 書体の太字・斜体を用いた強調の実用的な説明 | ウェイト差は候補として比較したが、今回は選択前後の文字形を維持するため採用しなかった。現代の解説であり、20世紀の原典とは扱わない |

### 比較した表現と採否

以下は理論の結論ではなく、UI previewで比較し、ユーザーと決めた設計記録。

- **緑の下線**：現在位置は示せるが、今回の見た目の方向に合わず撤回。
  本文リンクの識別用下線まで否定していない。
- **ボタン全体の淡い背景＋太字**：状態は明確だが、囲いを増やした印象が強く撤回。
- **文字のウェイト差のみ**：成立する候補だが、今回求めた文字を変えない表現とは異なる。
- **輪郭／塗りのノード記号**：題材との関連はあるが、接続状態との混同リスクもある。
  古典の作例にあるという理由だけでは採用しない。
- **袋文字・別色の文字輪郭**：小さい日本語では輪郭が密集した。また、`font-weight: 400`
  のままでもstrokeを追加すると字形の外形は太くなる。ウェイト指定と知覚上の太さを
  混同した説明は誤りだった。`paint-order: stroke fill`は描画順を変えるだけで、
  外形の拡大を防ぐものではない。[CSSの描画順の説明][paint-order]
- **文字全体の不透明マーカー**：採用。緑背景と白文字、左右の短い余白で文字を強調する。
  下半分だけの線、半透明、選択時のウェイト変更は使わない。

選択とhoverの外観は同じだが、`aria-current`／`aria-selected`が表す状態とhoverは
別物である。キーボードfocusも別のリングで示す。未選択は`--site-muted`とし、
既存の明暗背景に対して約5.5:1／7.6:1の文字コントラストを確認した。
これは指定した色の組み合わせの計算結果で、UI全体のアクセシビリティ適合宣言ではない。

### Noticeへの適用：補足情報を操作部品のように見せない

`Local example`は操作でも強い警告でもなく、文脈を説明する静的な注記である。
大きな角丸カードから細い左罫線へ変更したのは、補足の強調度を抑えるための判断。
古典理論がカードや角丸を禁止しているからではない。

`notice.css`は、共通行高のアイコン枠と`minmax(0, 1fr)`の文章列を定義する。
見出し・本文の左端を揃え、アイコンは先頭行の枠内で中央に置く。SVGのviewBoxを
切り詰めたり、文字に合わせて個別のmargin補正を足したりしない。
罫線とアイコンの色に加え、異なるアイコン形状と文言で種類を伝える。
静的な注記にlive regionを付けず、動的な成功／失敗には既存のstatus／alertを維持する。

### 次の変更時の判断順序

1. 何を伝える部品かを決める：移動、操作、選択、説明、警告を混同しない。
2. 同じ役割の既存部品を探し、色・寸法・状態の所有者を一つにする。
3. 文字の描画、行ボックス、背景、操作領域を別々に確認する。
4. 意味に不要な枠・記号を減らす。ただし識別やfocusまで削らない。
5. 明暗テーマ、狭幅、長い日本語、キーボードで実表示を確認する。
6. 「好み」「資料に書かれた原則」「実測結果」を分けて報告する。

## 9. UIキット全体の役割別レビューと追加

既存の表現を一律に置き換えるのではなく、役割ごとに不足と責務を確認した。
これは今回の実装範囲であり、全ページの全状態を監査したという意味ではない。

| 系統 | 維持・改善した契約 |
| --- | --- |
| Button / LinkButton / IconButton | 操作と移動を区別。variantとcompact寸法の所有者を維持 |
| NavLink / Tabs / FileTabs | 文字マーカーとファイル選択面を区別。ファイルタブへマーカーを移植しない |
| Toolbar / Disclosure | キーボード契約を維持。native detailsのopen状態にもghostの開状態の面・境界を適用 |
| TextField / TextArea / SelectField / Checkbox | hint/errorと外部aria-describedbyの結合をfield.tsへ集約。段落の既定marginを部品内でリセット |
| Panel / Notice / EmptyState | 表面、文脈説明、未生成状態を区別。全てを角丸カードやalertにしない |
| CodeEditor / スクロール | 既存のネイティブスクロールと共通compact寸法を維持 |

追加したSelectFieldは文字列値の単一選択、Checkboxは独立した真偽値を扱う。
ブラウザー標準の入力を包み、独自ポップアップ、選択キー処理、二重の選択stateを作らない。
これはキットの既存のSvelte 5ラッパー方針を拡張する判断である。
Checkboxの操作領域はラベル全体に持たせ、チェックの図形サイズとは分離した。
EmptyStateはPlaygroundの描画前表示へ実適用し、選択入力はUI previewに見本を追加した。

グリッドスキルからは共通寸法とbox/inkの分離を適用した。独立した入力のラベル、説明、
エラーは同じ配置規則を使い、見本だけの局所的な余白調整を避ける。
具体的な寸法は既存トークンを利用するプロジェクト判断である。

検索付きcombobox、日付ピッカー、汎用modal、toast基盤は今回追加しない。
必要な利用箇所と操作契約が決まってから追加し、部品数自体を目的にしない。
`form-controls.test.ts`はネイティブ構造・説明参照・空状態の意味を検証する。
SSRテストだけでは実操作・視覚品質を保証しないため、見本でも確認する。

今回の検証: website typecheckはエラー・警告0、17ファイル75テスト成功。
UI previewで1280/390pxのfine入力、狭幅の明暗テーマ、Selectの矢印キー、Checkboxの
Spaceとクリックを確認した。SelectとCheckboxラベルは44px高、ページ横はみ出しなし。
Playgroundの空状態は1280pxと390px（Previewへ切り替え）で確認。
coarse実機・200%文字拡大は今回未検証。editorialハーネスは実行していない。

### SelectFieldの開状態も設計対象とする

初期実装は入力欄のみを装飾し、開いた選択肢の余白・色・文字位置を管理していなかった。
`select-field.css`で入力欄とpicker双方に`appearance: base-select`を適用する。
[MDNのCustomizable select](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Customizable_select)
に基づく段階的拡張で、非対応ブラウザーでは標準pickerを維持する。
完全なブラウザー間の見た目統一を保証する機能ではない。

共通の最小操作高と左右insetを選択肢にも利用して文字開始位置を揃える。
チェックマークは表示せず、選択・hover・focusはそれぞれ背景、背景、内側outlineで示す。
開状態でも入力欄とpickerの共通角丸を維持する。
フォーム値とキーボード動作はselectが所有し、独自のhidden inputや開閉stateを増やさない。
通常のoptionのみを使い、SSRに新しいHTML入れ子構造を導入しない。
開状態は1280/390pxで実表示を確認。これはcoarse実機の検証ではない。

## 参照文献

すべて2026-09-10参照。本文のリンク箇所が各出典の適用範囲。
Webドキュメントは更新されるため、仕様の事実とプロジェクトの選択を再確認すること。

[grid]: https://github.com/alex-hyperagent/hyperagent-public-skills/blob/main/skill-muller-brockmann-grid-systems.json
[line]: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/line-height
[trim]: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-box-trim
[viewbox]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/viewBox
[box]: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/box-sizing
[pointer]: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/pointer
[container]: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries
[target]: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
[vscode]: https://github.com/microsoft/vscode/blob/1.137.0/src/vs/workbench/contrib/modernUI/browser/media/tabs.css
[canon]: https://www.rit.edu/vignellicenter/sites/rit.edu.vignellicenter/files/documents/The%20Vignelli%20Canon.pdf
[heuristics]: https://www.nngroup.com/articles/ten-usability-heuristics/
[common-region]: https://www.nngroup.com/articles/common-region/
[emphasis]: https://practicaltypography.com/bold-or-italic.html
[paint-order]: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/paint-order
