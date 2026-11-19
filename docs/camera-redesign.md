# Camera 再設計メモ（pan / zoom / scroll / SpaceMouse）

状態: 一部実装済み（下の「実装の状況」）。対象: `@shumoku/renderer` の camera と、それを使う Editor の diagram ページ・
Server の `TopologyViewer`。この文書は開発メモで、サイトには出ない。

凡例: 「(未確認)」は出典または実機で確かめていない事項。§9 の計測か §10 の wheel-logger で確かめてから確定する。

実装の状況（2026-11-19）: 最初の PR で、自前の core を `attachCamera` の API のまま入れた。
§2 の原則、§3.1 の Space / 中ボタン / Alt / `leftDrag`、§3.2 の wheel（Alt で逆、Shift で横、`ctrlKey` は常に zoom）、
§4 の正規化と分類、§4.4 の量、§5.4 の「見失わない」制約、D1・D2・D3・D7、§6.2 の `display` をやめる、を含む。
単純さのため module は `camera.ts`（組み立て）、`camera-view.ts`、`camera-wheel.ts`（純関数）の 3 つにまとめ、
`getTransform` / `setTransform` は今の意味（viewBox の単位、`k = 1` が Fit）のまま残した。
残り: keyboard の語彙、視点の animation と履歴、設定 UI、書き込み方式（W2 / W3）の計測、touch。
SpaceMouse は 2 つ目の PR で、`camera.addMotion`（連続入力）と `spacemouse.ts`（report の解析・応答曲線・WebHID）、
Editor の「Connect SpaceMouse」として入れた（ボタンは Fit と Shift だけ。軸の向きは実機で確かめる）。

見直し（2026-11-19）: §4 の分類は自前の証拠（100 / 120 / 100⁄3 の notch 値と dpr 倍、同じ値の繰り返し、斜めの値、
学習する prior）をやめ、MapLibre の `scroll_zoom.ts` と同じ規則に替えた（OpenLayers も同じ考え方）。
4.000244140625 の倍数は wheel、4 px 未満は trackpad、それ以外は 400 ms の間の後の最初の event を 40 ms 待たせ、
単独なら wheel、続けば `|dt · d| < 200` で trackpad。種類は次の間まで保つ。どの規則も複数の OSS で使われているか、
MapLibre で長く使われているもので、notch 値の一致で判定する OSS は見つからなかった。
drag は MapLibre / use-gesture / d3-drag に合わせ、release が失われた drag を blur・`lostpointercapture`・
ボタンの上がった move で終え、pan 後の click の抑止は次の task で解く。
「ホイールの動作」（Auto / Zoom / Scroll）は Editor の Settings と Server の topology Settings → Display に置いた
（tldraw・Excalidraw も同じ設定を持つ）。SpaceMouse のボタンは機種ごとの表（Pro 系と 2 ボタン機）で読む。
§4 の本文は当時の設計で、今の実装とは違う。

見直し 2（2026-11-19）: MapLibre の規則でも、Linux（X11）の Chrome の 2 本指ドラッグが時々ズームになった。
MapLibre は判定を zoom の速さにしか使わないので外れても困らないが、こちらは外れると操作そのものが入れ替わる。
調べた結果（4 方向の調査）、ブラウザでは確実な判定はできず（X11 の Chrome と古い Windows の touchpad では
ブラウザも知らない。標準化は `WheelEvent.momentum` だけで機器は分からない）、自動判定を出した Miro・Lucid・
draw.io はどれも誤判定の苦情を抱えている。そこで判定をやめた: 素のホイールは `wheelBehavior`（既定 pan。
Figma・tldraw・Excalidraw・Visio・draw.io と同じ）、Ctrl/⌘＋ホイールとピンチは常に zoom、設定は Scroll / Zoom。
dashboard の widget は `cooperative`（Grafana の Node Graph・Google Maps の埋め込みと同じ）で、素のホイールは
ページへ渡して「Ctrl + scroll to zoom」を出す。

---

## 1. 問題と調査の要約

### 1.1 いまの camera の欠陥（調査で確定したもの）

| # | 欠陥 | 原因 |
|---|---|---|
| D1 | trackpad の pan 速度が図の大きさで変わる（大きい図では指の 1/3、小さい図では速すぎる） | 状態が viewBox の単位で、CSS px との比（`clientWidth / viewBox.width`）を掛けていない |
| D2 | wheel が pan になったり zoom になったりする | gesture の最初の 1 event の大きさだけで device を決めている（`|deltaY| ≥ 50` ⇒ mouse、`deltaX ≠ 0` ⇒ trackpad）。hi-res / free-spin の mouse、mac の加速つき notch（約 4 px）、tilt wheel、速い flick、Windows の旧式 touchpad で外れる |
| D3 | wheel zoom が 1 notch で約 14 % 即時に飛び、上限がない。`deltaMode` を正規化していない | 補間なし |
| D4 | gesture の始まりと終わりで引っかかる（疑い） | `display: none` の切り替えが SVG 全体の style 再計算と layout object の作り直しを起こす |
| D5 | 毎フレーム SVG 全体を描き直す（疑い） | `<g class="viewport">` の `transform` 属性を書き換えている。600 node × `feDropShadow` |
| D6 | 操作の語彙が足りない | 左 drag / Space+drag の pan、mouse での横 scroll、keyboard、範囲の制限、Fit 以外の視点操作、利用者による上書き、のどれも無い |
| D7 | 編集のたびに視点が動きうる | 状態が viewBox に相対なので、図の bounds が変わると同じ `{x, y, k}` が別の場所を指す |

### 1.2 他のソフトから採ったもの

| 決めたこと | 手本 |
|---|---|
| 状態を screen 空間の `{x, y, z}` 1 つにし、入力ごとの adapter と、フレームに 1 回の書き込みに分ける | tldraw、Excalidraw、MapLibre（handler 群 + 1 つの camera）、OpenLayers（interaction 群 + View） |
| wheel の挙動は Auto / Zoom / Pan の利用者設定を持ち、Auto は推測にすぎないと扱う | Miro、Lucidchart、draw.io、tldraw（`wheelBehavior`）。Miro の Auto は不評なので、切り替えを 1 操作で届く所に置く |
| 推測は時刻と大きさの両方で、burst 単位に行う | MapLibre（4.000244 の倍数、`|d| < 4`、`|dt·d| < 200`、400 ms で reset）、OpenLayers |
| 迷ったら pan | 誤った zoom は誤った pan より被害が大きい（調査 §7） |
| `ctrlKey` つき wheel は platform を問わず zoom | xyflow が macOS だけに絞って Windows の pinch を壊した反例 |
| mouse wheel の zoom は目標値へ補間し、連続する notch をつなぐ。trackpad の pinch は補間しない | MapLibre（200 ms、フレームあたり ×2 上限） |
| 編集 mode の左 drag は marquee、pan は Space+drag と中ボタン | Figma、tldraw、Excalidraw、draw.io、Inkscape、Krita |
| 閲覧 mode の左 drag は pan | Google Maps、MapLibre、Leaflet、React Flow の既定 |
| Shift+1 = Fit、Shift+2 = 選択に Fit、Shift+0 = 100 % | Figma、Penpot |
| 矢印キーは押している間ずっと流れる pan | Google Maps / Earth、Leaflet（80 px） |
| 図を見失わない範囲の制限 | tldraw の camera constraints、Leaflet の `maxBounds`、Figma の Recenter |
| mouse drag の慣性は既定で無し、touch だけ有り | 図の editor（Figma、Excalidraw）は無し、地図（MapLibre の 160 ms 履歴）は有り |
| SpaceMouse は pan と zoom だけ、ボタンは視点の機能だけ | AutoCAD の 3Dconnexion 2D mode、Blender の NDOF 設定（感度・deadzone・軸ごとの反転） |
| SpaceMouse の zoom の基準点は gesture の間は固定する | SketchUp / SolidWorks / Blender #38787 の「cursor 基準が流れる」報告への対処 |
| scroll できるページの中では wheel を奪わない選択肢 | Google Maps の `gestureHandling: cooperative`、OpenLayers の `onFocusOnly` |

---

## 2. 設計の原則

1. **状態は 1 つ、単位は CSS px。** `View = { x, y, z }`、`screen = world × z + (x, y)`。`z = 1` は「world の 1 単位 = 1 CSS px」で、これが 100 %。
   viewBox との比は書き込みの時だけ使う。D1 と D7 はこれで構造上なくなる。
2. **入力は adapter、書き込みは 1 か所。** adapter は event を「意図」（pan の量、zoom の量と基準点、命令）に直して溜めるだけ。
   DOM を読まない・書かない。`requestAnimationFrame` の 1 回が溜まった意図を畳み、制約をかけ、DOM に 1 回書く。
3. **離散の入力と連続の入力を分ける。** wheel・pointer は量（delta）を出す。keyboard の押しっぱなしと SpaceMouse は速度を出し、フレームごとに `速度 × dt` で積分する。
4. **推測は補助。** device の推測が外れても、`ctrlKey` wheel = zoom、Space / 中ボタン drag = pan、keyboard、画面上のボタンは必ず効く。設定で推測を止められる。
5. **純関数に寄せる。** 正規化・分類・視点の計算・制約・補間・HID の解析は DOM 無しで試験できる関数にする。
6. **renderer は host を知らない。** 設定の保存、設定画面、SpaceMouse の接続ボタン、help は host（Editor / Server web）が持つ。renderer は型・既定値・検証の関数を出す。

---

## 3. 操作の仕様（この表が実装を縛る）

「閲覧」= `mode: 'view'`（Server の viewer）、「編集」= `mode: 'edit'`（Editor）。
左 drag の意味だけが mode で変わる。host は `leftDrag: 'pan' | 'none'` を camera に渡す（閲覧 = `'pan'`、編集 = `'none'`）。

### 3.1 pointer（mouse・pen・touch、OS 共通）

| 操作 | 閲覧 | 編集 | 備考 |
|---|---|---|---|
| 左 drag、空いた所から | pan | marquee（renderer） | |
| 左 drag、node / group の上から | pan（4 px を超えたら。超えなければ click = 選択） | 要素の drag（renderer） | 地図で marker の上から drag しても pan するのと同じ |
| Space を押しながら左 drag | pan | pan | cursor は `grab` / `grabbing`。入力欄に focus がある間は無効 |
| 中ボタン drag | pan | pan | `mousedown` の button 1 と `auxclick` を `preventDefault`（Windows の autoscroll、Linux の貼り付けを止める） |
| Alt + 左 drag | pan | pan | 互換のために残す。Linux では window manager が奪うことがあるので主役は Space |
| 右 drag | 何もしない | 何もしない | context menu（要素の上は renderer、空いた所は host）とぶつかるので採らない |
| 中ボタン double click | Fit | Fit | AutoCAD の zoom extents |
| touch 1 本指 | pan | `leftDrag` に従う | `touch-action: none` |
| touch 2 本指 | pinch zoom と pan を同時に | 同じ | 重心と距離の比。地図と同じで閾値の state machine は持たない |
| drag pan の慣性 | touch だけ | touch だけ | 設定 `dragInertia: 'touch' \| 'always' \| 'never'`、既定 `'touch'` |

pan の drag が 4 px を超えたら、その直後の `click` を 1 回だけ捨てる（選択が消えないように）。

### 3.2 wheel（`wheelBehavior` で決まる。Auto は §4 の分類に従う）

| 入力 | `zoom`（Mouse） | `pan`（Trackpad） | `auto` |
|---|---|---|---|
| wheel（修飾なし） | cursor へ zoom（補間つき） | 縦横に scroll（1:1） | 分類が wheel なら左、trackpad なら中 |
| Shift + wheel | 横に scroll | 横に scroll（`deltaX = 0` の時だけ `deltaY` を横に回す） | 同じ |
| Ctrl + wheel / ⌘ + wheel / pinch | cursor へ zoom | cursor へ zoom | 同じ。分類を通さない |
| Alt + wheel | 縦に scroll（逆の挙動） | cursor へ zoom（逆の挙動） | 分類の逆 |
| tilt wheel（`deltaX` だけ） | 横に scroll | 横に scroll | 同じ |

Alt + wheel で「もう一方」を出すのは draw.io の流儀。推測が外れた時にその場で逃げられる。

### 3.3 mouse（OS・種類ごと）

| OS / 種類 | 来る event | Auto の結果 | 外れた時 |
|---|---|---|---|
| Windows / Linux / ChromeOS、notch つき | `deltaY` = ±100（Chrome）、行数（Firefox、`deltaMode = 1`）、`deltaX = 0` | wheel → zoom | — |
| Windows、行数を変えた / 表示倍率 125 % など | 100/3 の倍数、または倍率で割られた値 (未確認) | wheel（倍率を掛け戻した notch 判定と、同じ値の繰り返しで拾う） | 設定を Mouse に |
| hi-res / free-spin（Logitech など） | 小さい・細かい値が連続 (未確認) | trackpad と区別できない → pan | 設定を Mouse に。`Ctrl` + wheel は常に zoom |
| tilt / thumb wheel | `deltaX` だけ | 横 scroll。分類の証拠には使わない | — |
| macOS、notch つき | 加速つき。遅い notch は 4.000244 の倍数、速いと数百。Shift は OS が `deltaX` に入れ替える | 4.000244 の倍数、または `wheelDeltaY` が 120 の倍数 (未確認) で wheel → zoom | 設定を Mouse に |
| Magic Mouse | trackpad と同じ pixel 値・慣性つき、pinch なし | trackpad → pan | zoom は ⌘ + scroll、`+` / `-`、画面のボタン |

### 3.4 trackpad（系統ごと）

| 系統 | 2 本指 scroll | pinch | Auto の結果 | 既定で必要な逃げ道 |
|---|---|---|---|---|
| Mac Force Touch（Chrome / Edge / Firefox） | pixel 値、斜め、OS の慣性 | `ctrlKey` wheel、`deltaY ≈ −100·ln(scale)` | pan / zoom | — |
| Mac Safari | 同じ | `gesturestart` / `gesturechange` / `gestureend`。17 以降は `ctrlKey` wheel も来うる (未確認) | 同じ。gesture event が動いている間は `ctrlKey` wheel を捨てる（二重に効かせない）。iOS では gesture event を使わず touch の pointer で扱う（tldraw の規則） | — |
| Windows Precision Touchpad（Chrome / Edge） | 小さい端数の pixel 値、OS の慣性 | `ctrlKey` wheel | pan / zoom | pinch が速すぎる機種があるので `pinchSpeed` |
| Windows Precision Touchpad（Firefox） | pixel 値 | page に来ないことがある (未確認) | pan | zoom は `Ctrl` + scroll、keyboard |
| Windows 旧式（Synaptics / ELAN / ALPS） | driver が mouse wheel を偽装（±100 の notch、偽の慣性） | driver が `Ctrl` + wheel の notch を送る (未確認) | **mouse と区別できない** → zoom | 設定を Trackpad に（これ以外に直す方法は無い）。Alt + wheel で pan |
| Linux Wayland（Chrome / Firefox） | pixel 値 | `ctrlKey` wheel | pan / zoom | — |
| Linux X11 | Chrome は滑らかな値 (未確認)、Firefox は `deltaMode = 1` の端数 | **無い** | pan（端数の行は trackpad の証拠）| zoom は `Ctrl` + scroll、keyboard、画面のボタン |
| ChromeOS | Chrome と同じ (未確認) | `ctrlKey` wheel (未確認) | pan / zoom | — |
| iPad + Magic Keyboard | wheel | 届かないことがある | pan | 画面の zoom ボタン |

3 本指 drag と Force Click は wheel event を出さないので対象外。natural scroll の向きは OS が決めた符号のまま使う（page から分からない）。

### 3.5 keyboard

camera の keyboard adapter が扱うのは、pointer が図の上にあるか図に focus があり、かつ入力欄（`input` / `textarea` / `select` / `contenteditable`）に focus が無い時だけ。
Editor では下の「命令」は action registry（`apps/editor/src/lib/actions/builtin.ts`）に登録し、camera の命令を呼ぶ。Server web は camera の adapter をそのまま使う。

| キー | 動き | 種類 |
|---|---|---|
| ← ↑ → ↓ | 押している間 pan（800 px/s、150 ms で立ち上がる） | 連続 |
| Shift + 矢印 | 速い pan（×3） | 連続 |
| `+` / `=`、`-` | zoom の段（×1.25 / ÷1.25）、画面の中心へ、補間つき | 命令 `zoomIn` / `zoomOut` |
| Mod + `=` / Mod + `-` | 同じ（Editor の既存 shortcut を保つ） | 命令 |
| Shift + 1、Mod + 0 | 全体に Fit（Mod + 0 は Editor の既存） | 命令 `fit` |
| Shift + 2 | 選択に Fit | 命令 `fitSelection` |
| Shift + 0 | 100 %（画面の中心を保つ） | 命令 `zoom100` |
| Alt + Z / Alt + Shift + Z | 前の視点 / 次の視点 | 命令 `back` / `forward` |
| Space（押している間） | pan の待機（cursor `grab`） | 修飾 |
| Esc | 動いている補間を止める（選択の解除は renderer のまま） | — |

前の視点のキーは Inkscape の `` ` `` が手本だが、JIS 配列ではその物理キーが IME の切り替えなので採らない。

### 3.6 SpaceMouse Pro（有線 046D:C62B、WebHID、Chrome / Edge）

役割は **camera だけ**。選択・click・drag は mouse のまま。

| 軸（raw） | 動き | 既定 |
|---|---|---|
| X（cap を左右へ） | 横 pan | object mode: cap を右へ → 図が右へ |
| Y（cap を奥 / 手前へ） | 縦 pan | object mode: 奥へ → 図が上へ |
| Z（cap を押す / 引く） | zoom | 引き上げる → 拡大（紙を手前に持ち上げる） |
| 回転 3 軸 | 無視 | — |

- 机の上の紙を動かす見立て（調査 §4 の「translation X/Y → pan、push/pull → zoom」）。`navigationMode: 'object' | 'camera'` で全軸の向きを反転、軸ごとの `invert` もある。
  軸の符号と割り当ては実機で確かめる（§12 Q2）。
- 速度制御: `a = clamp(raw / 350, −1, 1)`、deadzone `d = 0.06`、`f(a) = sign(a) · ((|a| − d) / (1 − d))²`（`|a| ≤ d` は 0）。
  pan 速度 = `f · 1600 px/s × panSensitivity`、zoom の速さ = `f · 2.0 /s × zoomSensitivity`（`z ← z · exp(rate · dt)`、最大で 1 秒に約 7.4 倍）。
- **dominant（既定で有効）**: pan の組（X, Y）と zoom（Z）のうち強い方だけを通す。切り替わりは 1.3 倍の差がついた時だけ。
  pan の中の X と Y は分けない（斜めに動けるように）。zoom 中に cap の横ずれで図が流れるのを止める。
- **zoom の基準点**: zoom が始まった時、pointer が図の上なら pointer の位置、そうでなければ画面の中心を screen 座標で取り、zoom が 150 ms 止まるまで固定する。
  cursor は動かさない。設定 `anchor: 'pointer' | 'center'`。
- **対象の camera**: ページに図が複数ある時は、最後に pointer が入った / 操作した camera だけが受ける。入力欄に focus がある間と、host の `isBlocked()` が真の間（modal など）は 0 として扱う。
- **止める条件**: window の `blur`、`visibilitychange`、device の `disconnect`、report が 500 ms 途絶えた時（押し続けている間 device が送り続けるかは (未確認)。logger で確かめて値を決める）。
- 積分は camera の rAF の中だけ。HID の `inputreport` は最新の軸の値を置き、scheduler を起こすだけ。

ボタン（Pro の bit。視点の機能だけ。host が上書きできる）:

| ボタン（bit） | 命令 |
|---|---|
| Fit (1) | `fit` |
| Menu (0) | `settings`（host が camera の設定 / help を開く） |
| T (2) | `zoom100` |
| F (5) | `fitSelection` |
| R (4) | `back` |
| 1 / 2 (12, 13) | 感度 − / ＋（0.25–4、×1.25 刻み） |
| 3 (14) | dominant の切り替え |
| 4 (15) | 基準点 pointer / 中心の切り替え |
| Shift (24) | 押している間は精密（速度 ×0.3） |
| Roll (8)、Esc (22)、Alt (23)、Ctrl (25)、Rotation lock (26) | 何もしない（Esc は mouse / keyboard の仕事） |

診断（host が表示する。renderer は状態を返す）:

| 状態 | 条件 | 案内 |
|---|---|---|
| `unsupported` | `navigator.hid` が無い（Firefox / Safari）、secure context でない、iframe の Permissions Policy に `hid` が無い | Chrome / Edge で開く。埋め込みなら `allow="hid"` |
| `needs-permission` | 許可済みの device が無い | 「接続」ボタン（`requestDevice` は利用者の操作が要る） |
| `open-failed` | `open()` が失敗 | Linux: hidraw の udev rule（`KERNEL=="hidraw*", ATTRS{idVendor}=="046d", ATTRS{idProduct}=="c62b", TAG+="uaccess"`）。他の app が占有 |
| `silent` | 開けたが、cap を動かす案内から 3 秒 report が無い | 3DxWare が device を握っている。driver を止めるか、この site を driver の対象から外す |
| `active` | report が来ている | 軸の値の live 表示（較正・確認用） |

他の機種は `profiles` の表（`productId` → 軸の report 形式、ボタンの bit の名前）を足すだけで対応する。表に無い 3Dconnexion の機種（vendor 0x256F / 0x046D）は軸だけ使い、ボタンは無視する。

---

## 4. wheel の正規化と分類

### 4.1 正規化（純関数 `normalizeWheel(e) → WheelSample`）

```ts
interface WheelSample {
  t: number          // event.timeStamp (ms)
  dx: number         // CSS px
  dy: number         // CSS px
  mode: 0 | 1 | 2    // 元の deltaMode
  rawX: number
  rawY: number
  wheelDeltaY: number | undefined  // 旧 property。notch の証拠に使う
  ctrl: boolean      // ctrlKey || metaKey
  shift: boolean
  alt: boolean
}
```

1. `deltaMode` を **delta より先に** 読む（Firefox は先に読まないと px に変換する）。
2. `mode = 1`（行）は ×40、`mode = 2`（ページ）は ×800（normalize-wheel、MapLibre と同じ定数）。
3. `shift && dx === 0` なら `dx ← dy`、`dy ← 0`（Windows / Linux は Shift で入れ替えない。macOS は OS が入れ替え済み）。
4. listener は `{ passive: false }` で、扱う event はすべて `preventDefault()`（ブラウザの page zoom と履歴の swipe を止める）。

### 4.2 意図の決定（純関数 `wheelIntent(sample, state, settings) → { intent, state }`）

```
if gestureEventActive                → 捨てる（Safari の二重を防ぐ）
if sample.ctrl                       → zoom(pinch)        // 分類しない
if strayAfterPinch(sample, state)    → 捨てる             // pinch の終わりから 150 ms 以内の ctrl なし trackpad 値（tldraw）
kind ← settings.wheelBehavior が 'zoom' → 'wheel'、'pan' → 'trackpad'、'auto' → classify(sample, state)
if sample.alt                        → kind を反転
if sample.dy === 0 || kind==='trackpad' → pan(−dx, −dy)   // dx だけの event は常に横 scroll
else                                 → zoom(wheel)
```

### 4.3 分類（`classify`、Auto の時だけ）

状態: `{ prior: 'wheel' | 'trackpad', burstKind, lastT, lastAbs, repeat }`。`prior` の初期値は全 platform で `'trackpad'`（迷ったら pan）。

- **burst**: 前の event から 400 ms 以上あいたら新しい burst。burst の種類は **最初の event で決めて、burst の間は変えない**（途中で pan が zoom に化けない）。
  burst の途中で得た証拠は `prior` を更新し、次の burst から効く。
- `a = max(|dx|, |dy|)`、`dt = t − lastT`、`dpr = devicePixelRatio`。
- **wheel の証拠（W）**。どれか 1 つ:
  - W1: `mode ≠ 0` かつ raw が整数（Firefox の行 notch）
  - W2: `dx === 0` かつ `isNotch(a)`、`isNotch(a × dpr)`、`isNotch(a / dpr)` のどれか。
    `isNotch(v)`: `v ≥ 30` で、`v` が 100、120、100/3 のどれかの整数倍（誤差 0.5 % 以内）
  - W3: macOS で `dx === 0` かつ `a` が 4.000244 の整数倍（誤差 0.01 以内、MapLibre）
  - W4: `wheelDeltaY` が 0 でない 120 の倍数で、かつ `|wheelDeltaY| ≠ 3 × |rawY|`（Chrome / Safari の trackpad は `wheelDelta = −3 × delta` になる (未確認)）
  - W5: `dx === 0`、`a ≥ 16` で、同じ `a` が 3 回続いた（notch は同じ値を繰り返す。trackpad は変わり続ける）
- **trackpad の証拠（T）**。W が無く、どれか 1 つ:
  - T1: `dx ≠ 0` かつ `dy ≠ 0`（斜め。tilt wheel は `dy = 0` なので当たらない）
  - T2: `a < 4`
  - T3: `mode = 1` かつ raw が整数でない（Firefox X11 の touchpad）
  - T4: `dt < 400` かつ `a × dt < 200`（MapLibre。細かい値が詰まって来る）
- 決定: burst の最初の event で、W があれば `wheel`、T があれば `trackpad`、どちらも無ければ `prior`。
  W と T の評価順は W が先（notch の値は trackpad からほぼ出ない）。
- `prior` の更新: 反対の証拠が **2 event 続いた** 時だけ変える。

この規則で外れると分かっているもの（設定で直す。§3.3、§3.4 に書いた通り）: hi-res / free-spin mouse → pan、Windows 旧式 touchpad → zoom。
40 ms 待って判断する MapLibre の方式は採らない。入力の遅れを足すより、`prior` で即座に動いて、外れは pan 側に倒す。

### 4.4 zoom と pan の量

| 入力 | 式 | 補間 |
|---|---|---|
| wheel の zoom | `Δln z = −clamp(dy, ±300) × 0.0018 × zoomSpeed × dir`（100 px の 1 notch = ×1.2） | 目標値 `zTarget` に足し、`ln z` を時定数 60 ms の指数で追わせる。基準点は burst の最初の pointer 位置で固定。フレームあたり ×2 を上限 |
| pinch（`ctrlKey` wheel） | `Δln z = −clamp(dy, ±40) × 0.01 × pinchSpeed`（mac の `−100·ln(scale)` と一致し、指に 1:1） | なし（即時） |
| Safari gesture | `Δln z = ln(scale / prevScale) × pinchSpeed` | なし |
| trackpad / 横 scroll の pan | `x −= dx × panSpeed`、`y −= dy × panSpeed`（CSS px、既定で 1:1） | なし（OS の慣性がそのまま来る） |
| wheel 設定 Pan での mouse notch | 同じ式（1 notch = 100 px） | 時定数 60 ms で追わせる（notch の段を滑らかに） |

`dir` は `invertZoom` で反転。`reduced motion`（`prefers-reduced-motion: reduce`）では補間と視点の animation を 0 ms にする。

### 4.5 設定と既定

```ts
interface CameraSettings {
  wheelBehavior: 'auto' | 'zoom' | 'pan'   // 既定 'auto'
  zoomSpeed: number        // 0.25–4、既定 1（wheel）
  pinchSpeed: number       // 0.25–4、既定 1
  panSpeed: number         // 0.25–4、既定 1
  invertZoom: boolean      // 既定 false
  dragInertia: 'touch' | 'always' | 'never'  // 既定 'touch'
  spaceMouse: {
    enabled: boolean                     // 既定 false（接続は利用者の操作）
    panSensitivity: number               // 既定 1
    zoomSensitivity: number              // 既定 1
    deadzone: number                     // 既定 0.06
    dominant: boolean                    // 既定 true
    anchor: 'pointer' | 'center'         // 既定 'pointer'
    navigationMode: 'object' | 'camera'  // 既定 'object'
    invert: { x: boolean; y: boolean; z: boolean }
    buttons: Record<string, CameraCommand>  // 既定は §3.6 の表
  }
}
```

- platform ごとの既定は **すべて同じ**（`auto`）。platform で分けるのは分類の中の W3 だけ。xyflow の反例のとおり、platform で機能を絞らない。
- renderer が出すもの: `defaultCameraSettings()`、`parseCameraSettings(unknown)`（壊れた保存値を既定に戻す純関数）。
  保存は host: Editor も Server web も `localStorage`（device に付く設定なので、account ではなくブラウザごとが正しい）。
- UI: host の設定に「Wheel: Auto / Mouse / Trackpad」「Zoom の速さ」「向きを反転」。Auto の横に「うまく動かない時は Mouse か Trackpad を選ぶ」と書く。

---

## 5. camera core の構成

### 5.1 module の境界

```
libs/@shumoku/renderer/src/lib/camera/
  view.ts          純: View の計算（zoomAt, panBy, fitBox, screen⇄world, viewBox の transform への変換）
  constrain.ts     純: zoom の範囲、見失わない制約
  wheel.ts         純: normalizeWheel, classify, wheelIntent
  motion.ts        純: 指数の追従、ease、視点の補間、慣性の減衰、速度の推定
  history.ts       純: 前 / 次の視点の stack
  settings.ts      純: CameraSettings、既定、parse
  scheduler.ts     rAF を 1 本だけ持つ。動くものが無ければ止まる
  writer.ts        DOM への書き込み（§6 の方式を差し替えられる interface）
  camera.ts        createCamera: 状態 + scheduler + writer + adapter の組み立て
  input/
    pointer.ts     drag pan、touch pinch、click の抑止、中ボタン
    wheel-input.ts wheel listener → wheel.ts
    gesture.ts     Safari の gesture event
    keyboard.ts    矢印（連続）、+/-、命令、Space
  spacemouse/
    hid-parse.ts   純: report → 軸 / ボタン
    profiles.ts    productId → 形式とボタン名
    ndof.ts        純: deadzone、曲線、dominant、基準点の固定 → 速度
    device.ts      WebHID の接続・再接続・診断の状態
  legacy.ts        attachCamera（互換）
  index.ts
```

依存: Svelte も `@shumoku/core` も import しない。d3 も使わない。`package.json` に subpath `"./camera"` を足し、Svelte を使わない host からも使えるようにする
（`"."` からも同じものを再 export する）。

### 5.2 型と API

```ts
/** screen = world × z + (x, y)。単位は container の左上からの CSS px。z = 1 が 100 %。 */
interface View { x: number; y: number; z: number }

type CameraCommand =
  | 'fit' | 'fitSelection' | 'zoom100' | 'zoomIn' | 'zoomOut' | 'back' | 'forward'
  | 'settings' | 'help'
  | 'sensitivityUp' | 'sensitivityDown' | 'toggleDominant' | 'toggleAnchor'

interface CameraOptions {
  settings?: Partial<CameraSettings>
  leftDrag?: 'pan' | 'none'                 // 既定 'none'（いまの挙動）
  wheel?: 'always' | 'cooperative' | 'off'   // 既定 'always'。cooperative は Ctrl/⌘ つきだけ扱い、他は page に渡す
  keyboard?: boolean                         // 既定 true
  minZoom?: number; maxZoom?: number         // 既定は §5.4
  fitPadding?: number                        // CSS px、既定 24
  fitMaxZoom?: number                        // 既定は maxZoom
  panFilter?: (e: PointerEvent) => boolean   // 真を返した pointerdown を pan として取る（互換）
  selection?: () => Iterable<string>         // fitSelection 用。host が渡す
  isBlocked?: () => boolean                  // modal などの間、連続入力を止める
  oncommand?: (c: CameraCommand) => boolean | undefined  // 真を返すと host が処理済み
}

type Phase = 'start' | 'move' | 'settle'

interface Camera {
  getView(): View
  setView(v: View, o?: { animate?: boolean }): void
  panBy(dx: number, dy: number): void                       // CSS px
  zoomBy(factor: number, anchor?: Point, o?: { animate?: boolean }): void  // anchor は container 内の CSS px
  zoomTo(z: number, anchor?: Point, o?: { animate?: boolean }): void
  fit(o?: { animate?: boolean }): void
  fitBox(world: Box, o?: { animate?: boolean; maxZoom?: number }): void
  fitElements(ids: Iterable<string>, o?: { animate?: boolean }): boolean
  focusNode(id: string, o?: { areaRatio?: number; animate?: boolean }): boolean
  back(): boolean
  forward(): boolean
  run(command: CameraCommand): void
  screenToWorld(p: Point): Point                            // client 座標 → world
  worldToScreen(p: Point): Point
  setOptions(o: Partial<CameraOptions>): void               // 付け直さずに変える
  addSource(s: VelocitySource): () => void                  // 連続入力（SpaceMouse など）
  subscribe(fn: (view: View, phase: Phase) => void): () => void  // 書き込みの後、フレームに 1 回
  refresh(): void                                           // scene の bounds が変わった時（自動でも検知する）
  destroy(): void
}

interface VelocitySource {
  /** このフレームの速度。pan は CSS px/s、zoom は ln z /s。動いていなければ null。 */
  sample(now: number): { vx: number; vy: number; vz: number; anchor?: Point } | null
}

function createCamera(svg: SVGSVGElement, options?: CameraOptions): Camera
```

### 5.3 1 フレームの流れ（scheduler）

1. `dt = min(now − last, 50 ms)`
2. 溜まった離散の意図を畳む（pan の合計、zoom の `Δln z` と基準点）
3. `VelocitySource` を全部 sample して積分（keyboard、SpaceMouse）
4. 動いている補間を進める（wheel zoom の追従、視点の animation、touch の慣性）
5. `constrain(view, frame)`（§5.4）
6. 変わっていれば writer が 1 回書く
7. `subscribe` の listener を呼ぶ
8. まだ動くものがあれば次の rAF を取る。無ければ止まり、150 ms 後に `settle`（class を外す、鮮明に描き直す、履歴に積む）

利用者の入力（pointer、wheel、keyboard、SpaceMouse）は視点の animation を必ず打ち切る。
adapter は layout を読まない。container の矩形は `ResizeObserver` と gesture の開始時に 1 回だけ取って持つ。

### 5.4 範囲と Fit

- `fitZ` = 図（world の bounds）が `fitPadding` を残して収まる z。
- `minZoom` の既定 = `min(0.1, fitZ × 0.5)`（いつでも全体の半分の大きさまで引ける）。`maxZoom` の既定 = `max(4, fitZ × 2)`。
- 見失わない制約: 図の bounds が、画面の各辺から `min(80 px, 画面の 1/4)` 内側に入った矩形と必ず交わるように `x, y` を clamp する（tldraw の constraints、Leaflet の `maxBounds`）。
  ゴムのような戻りは作らない。clamp は純関数。
- 既定の Fit は今と同じく「収まる最大」（小さい図は拡大される）。Editor は `fitMaxZoom: 1` などを渡せる（§12 Q4）。
- **fitted の印**: Fit の後、利用者がまだ動かしていなければ、container の大きさや図の bounds が変わった時に Fit し直す（dashboard の widget の resize）。
  動かした後は、画面の中心の world 点を保つ。
- 図の bounds が変わっても（Editor の編集のたび）`View` は world に対する値なので、見えている場所は動かない（D7）。

### 5.5 視点の animation と履歴

- `fit` / `fitBox` / `focusNode` / `zoom100` / `zoomIn` / `zoomOut` / `back` / `forward` は 250 ms、ease-out cubic。画面の中心の world 点を線形に、`ln z` を線形に補間する。
  遠くへ飛ぶ `focusNode` の軌跡が不自然なら van Wijk–Nuij（`d3.interpolateZoom`、MapLibre の `flyTo`）の式に差し替える。式は `motion.ts` に閉じる。
- 履歴: 命令で飛ぶ直前の視点を積む。手の操作は `settle` の時、前に積んだ視点から十分に離れていれば積む（中心が画面の 1/4 以上、または z が 1.25 倍以上）。上限 20。
  `TopologyWidget` の `savedTransform` の退避と復元は `back()` に置き換えられる。

### 5.6 既存 API との互換と移行

| 既存 | 新 | 扱い |
|---|---|---|
| `attachCamera(svg, options)` | `createCamera(svg, options)` | `attachCamera` は `legacy.ts` の薄い wrapper として残し `@deprecated`。次の minor で消す |
| `getTransform()` / `setTransform({x,y,k})` | `getView()` / `setView()` | wrapper が `view.ts` の `toViewBoxTransform` / `fromViewBoxTransform` で変換する（`k = z / s0`、`t = (x − offset) / s0 + viewBox の原点`、`s0` は viewBox が container に収まる倍率）。意味は今と同じ（viewBox の単位、`k = 1` が Fit） |
| `zoomBy(f)` | `zoomBy(f)` | 同じ（画面の中心へ） |
| `zoomTo(k, point?)`、`panTo(x, y)` | `zoomTo(z, anchor?)`、`setView` / `fitBox` | wrapper が今の意味のまま変換する。今の正確な意味は `camera.test.ts` の期待値を移して固定する |
| `panToNode(id, areaRatio?)` | `focusNode(id, { areaRatio })` | 同じ。animation つきが既定 |
| `reset()` | `fit()` | 同じ |
| `detach()` | `destroy()` | 同じ |
| `scaleExtent: [min, max]`（Fit に対する倍率） | `minZoom` / `maxZoom`（絶対） | wrapper が `× fitZ` で変換 |
| `wheelZoomSensitivity` / `pinchZoomSensitivity` | `settings.zoomSpeed` / `settings.pinchSpeed` | wrapper が既定値との比に直す |
| `panFilter` | そのまま | 意味を保つ |
| svg の class `camera-gesture` | そのまま | 最初に動いたフレームで付け、`settle` で外す。名前も付く場所も変えない |
| `<g class="viewport">` が必要 | そのまま | — |
| `screenToWorld(svg, x, y)` ほか `svg-coords.ts` | そのまま | `getScreenCTM` を使うので、§6 のどの書き込み方式でも正しい値を返す |

新しく付く目印（host が style に使える）: `data-camera-lod="far|mid|near"`（§6.3）、class `camera-pan-ready`（Space 押下中）、`camera-panning`（drag 中）。

consumer の変更:

- `TopologyViewer.svelte`: `createCamera(svg, { leftDrag: 'pan', ... })`。options が変わった時は付け直さず `setOptions`（今は参照が変わると付け直して視点を失う）。
  `getCameraTransform` / `setCameraTransform` は残す。
- Editor の diagram ページ: `CameraHandle` に `fitSelection` / `zoom100` / `back` / `forward` を足し、`builtin.ts` に action を足す。`selection` を camera に渡す。
- `ShumokuRenderer.svelte`: `handlePointerDown` の `e.altKey` の除外をやめる。代わりに規約を 1 つ置く:
  **camera は自分が取った `pointerdown` を svg の capture 段で `stopPropagation` する。** renderer の handler は外側の `div` の bubble 段にあるので、camera が取った drag（Space、中ボタン、Alt、`leftDrag: 'pan'`）は renderer に届かない。renderer は camera を知らないまま。
  pan の後の `click` も同じ場所で 1 回止める。
- 共存の確認項目: 選択の click（4 px 未満は click のまま）、marquee（編集で左 drag、Space を押していない時）、context menu（右ボタンには触らない）、port label の double click（左の double click には触らない。中ボタンの double click だけ使う）、要素の drag（編集で要素の上からの左 drag は renderer）。

---

## 6. 描画と LOD

### 6.1 書き込み方式の候補

`writer.ts` は `write(view, frame, phase)` だけを持つ interface にして、方式を差し替えられるようにする。

| 方式 | 書く先 | 見込み | 懸念 |
|---|---|---|---|
| W1 | `g.viewport` の SVG `transform` 属性（今と同じ） | 互換は完全。毎フレーム paint + raster | D5 そのもの |
| W2 | `g.viewport` の CSS `transform`、gesture の間だけ `will-change: transform` | SVG の内側の要素に compositor の layer が付けば、gesture の間は paint なし（bitmap の移動と拡縮）。`settle` で `will-change` を外して鮮明に描き直す | Chrome が SVG の `<g>` に layer を付けるか (未確認)。拡大中はぼやける。layer の memory |
| W3 | `<svg>` 要素そのもの（HTML の box）の CSS `transform`、gesture の間 `will-change` | layer は確実に付く（xyflow は HTML の div にこれをしている） | gesture の間、svg の背景と hit 領域も一緒に動く。`e.target === svgElement` で空いた所を判定している marquee と、背景色の扱いを直す必要がある |

どれでも `getScreenCTM` は CSS transform を含むので overlay の座標は合う（Firefox / Safari でも確かめる）。

**進め方**: 最初の切り替え（PR 3）は W1 のまま出す。挙動の修正と描画の変更を 1 つの PR に混ぜない。その上で §9 の計測をして、
予算に入る最も単純な方式を選ぶ。予想は「W1 + §6.2 の軽量化で 600 node は足りない、W2 が効けば W2、効かなければ W3」。

gesture 中の方針（W2 / W3 の時）: pan だけなら bitmap の移動で鮮明なまま。zoom は gesture 開始時の倍率の bitmap を拡縮し、
倍率が開始時から 2 倍 / 半分を超えたら、その場で 1 回描き直す（ぼやけと欠けを抑える）。`settle`（150 ms）で必ず鮮明に戻す。

### 6.2 描画そのものを軽くする

- **`display` の切り替えをやめる**（D4）。gesture 中に隠すものは `visibility: hidden` にする（layout object を作り直さない）。
  W2 / W3 で gesture 中に paint が起きなくなれば、隠す必要そのものが無くなる。その時 `camera-gesture` は host の animation を止める目印としてだけ残る。
- **影**: `feDropShadow` の filter が node ごとに掛かっている。計測で支配的なら、(a) `far` / `mid` の LOD で影を外す、(b) gesture 中だけ外す（今と同じ）、
  (c) filter をやめて、ずらした半透明の矩形で影を描く、を比べる。(c) は static の出力の見た目も変わるので、採るなら drawing の変更として別 PR にする。
- 見えていない要素の間引き（culling）は 600 node では採らない。DOM の出し入れの方が高くつく。

### 6.3 zoom による LOD

camera は、閾値をまたいだ時だけ svg に `data-camera-lod` を書く（毎フレームではない。10 % の hysteresis）。

| 値 | 条件（既定） | host の style の例 |
|---|---|---|
| `near` | `z ≥ 0.6` | すべて描く |
| `mid` | `0.3 ≤ z < 0.6` | port label と link の caption を `visibility: hidden`（画面上で約 5 px を下回り読めない） |
| `far` | `z < 0.3` | さらに node の影を外す |

閾値は option。style は `ShumokuRenderer` の `hostStyles` に置き、kit の static 出力には触れない。
読めない文字を描かないのは地図と同じ考え方。

---

## 7. Svelte

- core は `.ts` で Svelte を import しない。Editor（svelte ^5.57.1、SvelteKit 2.70、Vite 8）と Server web、Svelte を使わない host が同じものを使う。
- 付け方は `$effect` のまま: `$effect(() => { if (!svg) return; const c = createCamera(svg, untrack(() => options)); return () => c.destroy() })`。
  **peer の `svelte ^5.0.0` は上げない。** `{@attach}`（5.29 以降）は使わない。`<svg>` は `Diagram` の中にあり host からは届かないので、使う利点も無い。
  新しい `use:` action、store、`on:` も書かない。
- options の変化は別の `$effect` で `camera.setOptions(...)`。付け直さない。
- **フレームごとの値を reactivity に入れない。** `View` を `$state` に置かない。フレームごとに要る overlay は `camera.subscribe` で DOM を直接書く。
  zoom の % 表示のような UI は `phase === 'settle'` の時だけ `$state` を更新する（動いている間も出したければ 100 ms に 1 回まで）。
- wheel は `addEventListener('wheel', fn, { passive: false })` を core が自分で付ける。Svelte の event 属性には頼らない。listener は `AbortController` 1 つでまとめて外す。
- SSR: core は `createCamera` の中でだけ DOM に触る。module の読み込み時に `window` / `navigator` を読まない（`navigator.hid` も `device.ts` の関数の中で読む）。
- `ShumokuRenderer` は camera を持たない（host が付ける、今のまま）。規約は §5.6 の capture 段の `stopPropagation` だけ。
- 規則: Biome、`!` なし、`any` なし（WebHID の型は `@types/w3c-web-hid` を devDependency に足すか、使う分だけ自前の interface を書く）、`for…of`、引数を書き換えない。

---

## 8. library をどうするか

**結論: d3-zoom、d3-selection、wheel-gestures を外し、自前の小さな core を書く。**

| 観点 | d3-zoom + wheel-gestures | 自前の core |
|---|---|---|
| D1（単位） | transform は svg の user 空間。`extent` と変換を毎回かませる必要がある | 状態が CSS px。問題が生じない |
| wheel | 今も d3 の wheel を使っていない（wheel-gestures で置き換えている）。分類は結局自前 | `wheel.ts` の純関数 |
| 連続入力（SpaceMouse、矢印） | `zoom.transform` を毎フレーム呼ぶことになり、d3 の event と gesture の状態を迂回する | `VelocitySource` が第一級 |
| 補間・animation | d3-transition が要る（依存が増える）。利用者の入力での打ち切りを自分で書く | scheduler の 1 段 |
| 制約 | `translateExtent` は viewBox 空間。「見失わない」は `constrain` を自分で書く | 純関数 |
| pointer の調停 | `filter` で除外するだけ。Space、mode ごとの左 drag、click の抑止は外に書く | adapter の中 |
| 試験 | DOM と d3 の内部状態（`__zoom`）が要る | 大半が DOM なしの純関数 |
| bundle | d3-zoom とその依存（selection、transition、interpolate、drag、dispatch、timer、ease、color）+ wheel-gestures。数値は PR で `vite build` の差を載せる (未確認) | 目標は gzip 4 kB 以下（SpaceMouse を除く） |
| 保守 | 既知の device 問題は上流でも未解決（xyflow #3759） | 自分たちの fixture で直せる |

手本は tldraw、Excalidraw、MapLibre、OpenLayers（いずれも自前）。xyflow は d3-zoom を使い続けて、その制約を引き継いでいる。
wheel-gestures が与えるのは burst の終わりと慣性の推定だけで、§4.3 の burst 管理で足りる。

---

## 9. 性能の予算と計測

### 9.1 予算（600 node、影あり、基準機 = maintainer の開発機。加えて DevTools の CPU 4× throttle）

| 項目 | 予算 |
|---|---|
| wheel / pointer の handler 1 回 | 0.3 ms 以下。layout を読まない（forced reflow 0 回） |
| DOM への書き込み | フレームに 1 回 |
| pan / zoom 中のフレーム時間 | p95 ≤ 16.7 ms（throttle 4× で ≤ 33 ms） |
| gesture の最初のフレーム | ≤ 32 ms |
| `settle` の描き直し | 1 回、≤ 100 ms |
| 入力から描画まで | 1 フレーム（trackpad の pan・pinch は補間なし） |
| 止まっている時 | rAF 0 本、listener だけ |

### 9.2 計測の道具（PR 1 で入れる）

- `libs/@shumoku/renderer` の dev ページ（`index.html` + `src/dev.ts`）に bench を足す: 100 / 300 / 600 node の固定 scene、
  `?bench=pan|zoom|mixed` で camera API を rAF ごとに 5 秒動かす決まった経路。
- 記録: rAF の間隔（p50 / p95 / 最大）、`PerformanceObserver` の `long-animation-frame`。結果を画面と console に JSON で出す。
- Chrome DevTools: Performance の trace（Recalculate Style / Layout / Paint / Layerize / Raster / Commit の内訳）、
  Rendering の Paint flashing と Frame Rendering Stats、Layers panel（`g.viewport` に layer が付くか、memory）。
- 実入力の経路は、wheel-logger の trace を `dispatchEvent(new WheelEvent(...))` で再生して同じ bench に流す。

### 9.3 決めるために測る組み合わせ

| 軸 | 値 |
|---|---|
| 書き込み方式 | W1、W2（`will-change` あり / なし）、W3 |
| 影 | filter、なし、矩形の影 |
| label | 描く、`visibility: hidden`、`display: none` |
| 動き | pan だけ、zoom だけ、混合、gesture の開始 / 終了の 1 フレーム |
| 大きさ | 100 / 300 / 600 node |

現行（d3 版）を同じ bench で先に測って基準にし、PR ごとに同じ表を PR の説明に貼る。Firefox と Safari は、選んだ方式で座標が合うこと・極端に遅くないことだけ確かめる。

---

## 10. 段階的な PR

どれも単独で merge できる大きさにする。`@shumoku/renderer` に触る PR は changeset を入れる。

| PR | 中身 | 試験 | changeset / docs |
|---|---|---|---|
| 1 | dev ページに **wheel-logger** と **bench**。logger は event ごとに `t`、`deltaX/Y/Z`、`deltaMode`、`wheelDeltaX/Y`、修飾キー、`devicePixelRatio`、UA を記録し、利用者が device 名と「何をしたか」を書いて JSON で保存する。現行 camera の基準値を測る | — | 空の changeset |
| 2 | 純関数の core: `view.ts`、`constrain.ts`、`wheel.ts`、`motion.ts`、`history.ts`、`settings.ts`。まだどこにも繋がない | 単体試験。logger の trace を `__fixtures__/wheel/*.json` に置き、fixture ごとに期待する分類（device 名から）を表で照合。zoomAt が基準点を動かさない性質、clamp、補間の収束 | 空の changeset |
| 3 | `createCamera`（scheduler、writer W1、pointer / wheel / Safari gesture の adapter）、`attachCamera` を wrapper に。d3-zoom、d3-selection、wheel-gestures を外す。D1、D2、D3、D7 が直る | 旧 `camera.test.ts` の期待値を wrapper に対して保つ。jsdom で adapter の調停（`stopPropagation`、click の抑止） | patch。挙動が変わるので `.ja.mdx` |
| 4 | 操作の語彙: Space + drag、閲覧の左 drag（`TopologyViewer`）、keyboard adapter、animation つきの `fit` / `fitElements` / `focusNode`、100 %、前 / 次の視点、範囲の制約、fitted の印、`setOptions`。Editor の action と shortcut、`ShumokuRenderer` の `altKey` 除外の削除 | 純関数 + Editor の registry の試験。手での確認表（§3 の各行） | minor（新しい公開 API）。Editor / Server の `.ja.mdx` |
| 5 | 設定: 型は PR 2 済み。Editor と Server web の設定 UI、`localStorage`、Alt + wheel | `parseCameraSettings` | patch。`.ja.mdx` |
| 6 | 描画: §9 の結果で writer を選ぶ。`display` の切り替えをやめる、`data-camera-lod`、overlay の style の見直し（`NodeStatusOverlay`、`WeathermapLinkOverlay`） | bench の表を PR に貼る | patch |
| 7 | touch: 2 本指の pinch、1 本指の pan、touch の慣性 | `motion.ts` の慣性、pinch の計算 | patch |
| 8 | SpaceMouse: `hid-parse.ts`、`profiles.ts`、`ndof.ts`、`device.ts`、host の接続 UI と診断表示、logger に HID の記録を足す | report の bytes → 軸 / ボタン、deadzone・曲線・dominant・基準点の固定を fixture で | minor。`.ja.mdx`（対応ブラウザ、3DxWare、udev） |
| 9 | `attachCamera` と旧 options を消す | — | minor |

---

## 11. リスク

| リスク | 対処 |
|---|---|
| Auto の推測が特定の device で外れる | 外れは pan 側に倒す。Alt + wheel、設定、`Ctrl` + wheel は常に効く。logger の fixture を増やして規則を直す |
| `wheelDeltaY` や表示倍率での delta の変わり方が想定と違う | W2 / W4 は fixture で確かめてから有効にする。確かめられなければその規則を外しても、W1 / W3 / W5 と設定で成り立つ |
| W2 で SVG の内側に layer が付かない / ぼやけが気になる | W3 か W1 + 軽量化に切り替える。writer は差し替え可能 |
| 閲覧 mode の左 drag が pan になり、既存の利用者の手癖と変わる | これは欠けていた機能の追加（今は左 drag が何もしない）。node の click による選択は 4 px の閾値で保つ |
| capture 段の `stopPropagation` が host の listener を黙らせる | 止めるのは camera が取った `pointerdown` と、その直後の `click` 1 回だけ。規約を `ShumokuRenderer` の冒頭の comment と docs に書く |
| SpaceMouse: 3DxWare が動いていると report が来ない | 診断の `silent` で案内する。driver と共存する方法は無い（WebHID の制約） |
| SpaceMouse の軸の符号・ボタンの bit が資料と違う | logger で実機の値を取ってから `profiles.ts` を確定する |
| dashboard の中で wheel を奪い、ページが scroll できない | `wheel: 'cooperative'`（§12 Q3） |
| Safari / Firefox で CSS transform 後の `getScreenCTM` がずれる | PR 6 で 3 ブラウザの座標を確かめる。ずれるなら overlay の変換を camera の `worldToScreen` に寄せる |

---

## 12. maintainer に決めてほしいこと

自分で決められなかったものだけ。どれも推奨を先に書く。

- **Q1. 閲覧 mode の左 drag を pan にしてよいか。** 推奨: する。Server の viewer は中ボタンの無い laptop で今は drag で動かせない。編集 mode は marquee のまま。
- **Q2. SpaceMouse の既定の向きと軸。** 推奨: object mode（cap を右へ → 図が右へ）、奥 / 手前 = 縦 pan、押す / 引く = zoom、引き上げて拡大。
  実機を持っているのは maintainer なので、PR 8 の最初に logger で 2 分触って決めてほしい。設定で全部反転できる。
- **Q3. scroll する dashboard の中の widget で wheel を奪うか。** 推奨: ページが縦に scroll する配置の widget だけ `wheel: 'cooperative'`（Ctrl / ⌘ + wheel と pinch だけ zoom、素の wheel はページへ）。
  1 画面に収まる dashboard と topology の全画面表示は `'always'`。どの画面がどちらかは Server web 側の判断になる。
- **Q4. Fit で小さい図を 100 % より大きくするか。** 推奨: Server は今のまま拡大する（widget を埋める）。Editor は `fitMaxZoom: 1.5` 程度で抑える（node 3 個の図が画面いっぱいにならない）。
- **Q5. 「前の視点」のキー。** 推奨: Alt + Z / Alt + Shift + Z。別の案があれば action の定義 1 行で変わる。
- **Q6. wheel-logger の trace を誰が採るか。** 推奨: PR 1 を先に merge し、maintainer と協力者が手元の device（Windows 旧式 touchpad、Magic Mouse、hi-res mouse、Linux X11 / Wayland が特に欲しい）で採って fixture にする。
  fixture が無い device の規則は「(未確認)」のまま、設定での上書きに頼る。
