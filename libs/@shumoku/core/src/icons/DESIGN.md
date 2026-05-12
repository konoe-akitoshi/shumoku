# Built-in Icon Design Guidelines

`libs/@shumoku/core/src/icons/default/*.svg` の 14 個の組み込みデバイスアイコンに適用するデザインルール。新規アイコン追加・既存アイコン修正のときは、まずこの文書を読むこと。

---

## 目的

`DeviceType` enum の各値にデフォルトで割り当てられるアイコン。Diagram 上で `Product` 紐付けがないノード（または `Product.icon` が `'auto'`）で使われる。
表示サイズは **16–64 px** が想定範囲。CDN フェッチではなく `defaultIcons` に **インライン SVG として埋め込み**、`renderer-svg` 経由で `<image href="data:...">` または直接 inline でレンダされる。

主な制約:
1. 小サイズで読めること（detail を入れすぎない）
2. ライト / ダーク両テーマで成立すること（白要素なし）
3. ネットワークエンジニアが一目でデバイス種別を識別できること（伝統的な意匠を尊重）

---

## デザインの源流

| Source | 取り入れたもの |
|---|---|
| **Shownet 2025 icons** (https://github.com/interop-tokyo-shownet/shownet-icons) | レイヤー別カラーコーディングの発想、ネットワーク機器のシルエット archetype |
| **Network VISIO / topology stencils** | Cisco / Juniper / Fortinet / Allied Telesis / HPE Aruba / Brocade-Extreme / Yamaha / F5 / Palo Alto Networks / Apresia などで共通する、router=horizontal puck、L2/L3 switch=chassis + arrows、firewall=brick wall、AP=dome + waves、server=rack、cloud、globe、database=cylinder などの canonical な見た目 |
| **Apple HIG App Icons** ([Icon shape](https://developer.apple.com/design/human-interface-guidelines/app-icons#Icon-shape)) | キーラインによる visual weight balance（square / circle / vertical-rect / horizontal-rect の 4 keylines） |
| **Material Design 3 / Material Symbols** | 24 dp グリッド、2 px stroke、rounded line caps & joins |
| **IBM Carbon Icons** | 数学的グリッド整列、半単位 (`.5`) スナップ |
| **Streamline Icons** | two-tone（stroke 100% + fill 18%）スタイル |

### Network stencil からの抽象化方針

各ベンダーの VISIO ステンシルは製品図・ブランド図・論理トポロジ図が混ざっている。Shumoku の組み込みアイコンでは、製品固有の外観やロゴは取り込まず、ネットワークエンジニアが複数ベンダーの図面で共通して見慣れている**機能シンボル**だけを抽象化する。

| Device class | 共通して採用する要素 | 採用しない要素 |
|---|---|---|
| Router | 横長 capsule + 4 本垂直 uplink ケーブル + 端点ドット | Cisco horizontal puck の 3D 表現（小サイズで spool に見える） |
| L2/L3 switch | 横長 chassis、上部に矢印（L2 = 1 段双方向、L3 = 2 段双方向） | 実機 faceplate、型番、ポート数の再現 |
| Firewall | offset masonry brick wall | ベンダーロゴ、UTM 製品筐体 |
| VPN | 二重 capsule（外側 tunnel + 内側 tunnel）+ 中央 flow 矢印 | **Padlock は不採用**（stock icon library と被る・shield+key も乱用される） |
| Load balancer | 1 input → 3 outputs の分岐、アプリ配信の fan-out | F5 BIG-IP など製品固有筐体 |
| Server | 3-bay rackmount（各段 LED + port line） | 実機前面写真 |
| Database | Lucide-clean cylinder（top ellipse + body + 1 ridge） | ストレージ製品固有形状 |
| AP | 円形 disc + 中央 LED + 左右 ((●)) omnidirectional arcs（Tabler `access-point` ベース） | **WiFi 3-arc 縦扇形は不採用**（汎用 "wifi signal" 記号と区別したい）。dome 単独も lamp に見えるので不採用 |
| CPE | antenna 2 本 + modem + port LED row | — |
| Console-server | 横長 chassis + 2×5 port matrix | 特定メーカーのポート配列 |
| Cloud | Lucide-clean single-curve cloud silhouette | — |
| Internet | Globe（円 + meridian + equator） | — |
| Generic | Hexagon（flat-top）+ center dot | — |

採用判断は「Shumoku の diagram 上で 16–64 px 表示したとき、ラベルなしでも device class が読めるか」を最優先にする。

採用しなかったもの:
- Shownet 流の **3D illustrational gradient**（small UI には重すぎる、ファイルサイズが 12KB+ になる）
- Apple HIG の **squircle background plate**（背景は透過にする方針なので使わない）
- 各ベンダーの製品固有 VISIO stencil の **外観トレース**（権利面だけでなく、Shumoku の抽象 diagram では型番差がノイズになる）
- **AP の 3-arc WiFi 波**（stock icon library で乱用される汎用 "wifi signal" 記号と被るため）— 代わりに Tabler `access-point` (`((●))`) を踏襲
- **VPN の padlock**（stock 度が高すぎる）— 代わりに「二重 tunnel + 中央 flow 矢印」（encrypted pipe メタファー）

---

## デザイン仕様

### 1. グリッド (IBM Carbon)

- `viewBox="0 0 24 24"`
- **Live area**: 20×20（各辺 2 unit padding）— どの path の座標も `[2, 22]` の範囲内に収める
- 座標は **半 unit (`.5`)** にスナップする

### 2. ストローク (Material Design 3 / IBM Carbon)

- `stroke-width="2"`
- `stroke-linecap="round"` / `stroke-linejoin="round"`
- `<svg>` ルートで設定 → 子要素が継承するスタイルにする
- `build-icons.ts` は `<svg>` ルートを取り除いて fragment 化するため、可視要素は必ず `<g fill="none" stroke="url(#g-X)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` で包む
- 個別 element は本当に必要な時だけ override（例: dot は `stroke="none"`）

### 3. フィル (Streamline two-tone)

| 要素 | スタイル |
|---|---|
| 本体 (main body shape) | `fill="url(#g-X)" fill-opacity="0.18"` + 継承 stroke |
| アクセント (small dots / indicators) | `fill="url(#g-X)" stroke="none"`（fill 100%） |
| ディテール stroke (lines / arrows / arcs) | `fill="none"`（svg ルート継承）+ gradient stroke |

**禁則**:
- **白要素を使わない** — ライトテーマで透明・無印になるため
- **背景プレートを使わない** — squircle / rounded-square 等を icon の後ろに敷かない。グリフ自体が透過 background 上のシルエット

### 4. グラデーション

```xml
<linearGradient id="g-NAME" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="24">
  <stop offset="0" stop-color="LIGHT"/>
  <stop offset="1" stop-color="DARK"/>
</linearGradient>
```

- **`gradientUnits="userSpaceOnUse"` は必須**。デフォルト (`objectBoundingBox`) では、bbox の幅または高さが 0 な line element（水平線・垂直線）に対してグラデーションが invalid → ストロークが描画されない
- 縦方向 (上=light → 下=dark)、`y1="0" y2="24"`

### 5. Apple HIG キーライン適合

各 icon は **canvas の 70–85% を充填** し、シルエットに最も合うキーラインに整列する:

| Keyline | 寸法 (24×24 grid) | 適用するシルエット |
|---|---|---|
| Square | 19.2×19.2 centered（80%） | 矩形デバイス全般（firewall, server, console-server） |
| Circle | r=9.6 at (12,12)（80% diameter） | 円形シルエット（internet globe, generic hexagon, **access-point disc**） |
| Vertical rectangle | 16.7×20.3（69.5%×84.6%） | 縦長（database cylinder, cloud silhouette） |
| Horizontal rectangle | 20.3×16.7（84.6%×69.5%） | 横長（**router capsule**, L2/L3 switch, cpe, **vpn tunnel**） |

どの path 座標も live area `[2, 22]` を超えないこと。

---

## OSI レイヤー別カラー

ネットワーク機器を**機能レイヤー**で色分け。Diagram 上で一目で device 種別が判別できる:

| Hue | Light → Dark | Layer / Class | Devices |
|---|---|---|---|
| emerald | `#34D399 → #059669` | L3 routing | `router`, `l3-switch`, `vpn` |
| blue | `#60A5FA → #2563EB` | L2 / wireless | `l2-switch`, `access-point` |
| sky | `#38BDF8 → #0284C7` | Boundary | `cloud`, `internet` |
| red | `#F87171 → #DC2626` | L3 security | `firewall` |
| orange | `#FB923C → #EA580C` | L4-L7 services | `load-balancer` |
| violet | `#A78BFA → #7C3AED` | App / data | `server`, `database` |
| slate | `#94A3B8 → #475569` | L1-L2 access | `cpe`, `console-server` |
| gray | `#D1D5DB → #6B7280` | Fallback | `generic` |

新しいデバイスタイプを追加するときは、機能レイヤーから既存のいずれかに割り当てる。新色追加は避ける（パレットが増えると識別性が落ちる）。

---

## 14 アイコンの archetype

| Icon | 意匠 (origin) | キーライン |
|---|---|---|
| `router` | 横長 capsule（chassis）+ 4 本の垂直 uplink ケーブル + 端点ドット | horizontal rect |
| `l3-switch` | Switch chassis + 上部 2 段水平双方向矢印（multi-route） | horizontal rect |
| `l2-switch` | Switch chassis + 上部 1 段水平双方向矢印（forwarding） | horizontal rect |
| `firewall` | Offset masonry brick wall（3 段 + 中央オフセット） | square |
| `load-balancer` | 1→3 tree（1 input + 3 outputs + 接続線） | square + circle |
| `server` | 2-bay rackmount（Lucide-clean 横ストライプ + LED + port line） | square |
| `access-point` | 円形 disc + 中央 LED + 左右 `((●))` arcs（Tabler `access-point` 公式由来） | circle |
| `cpe` | 縦 antenna 2 本 + 横長 modem chassis + 4 LED row | horizontal rect |
| `console-server` | 横長 chassis + 2×5 port matrix | horizontal rect |
| `cloud` | Single-curve cloud silhouette（Lucide-clean） | horizontal rect |
| `internet` | Globe（円 + meridian + equator）（Lucide-clean） | circle |
| `vpn` | 二重 capsule（外側 tunnel + 内側 tunnel）+ 中央 flow 矢印 | horizontal rect |
| `database` | Cylinder（top ellipse + body + 1 ridge）（Lucide-clean） | vertical rect |
| `generic` | Hexagon（flat-top）+ center dot | circle |

### AP と VPN の特殊事情

- **AP**: 業界の universal symbol は **3-arc WiFi 波** だが、これは「WiFi 信号」の汎用記号としても乱用されており、AP デバイスとの区別が曖昧。Tabler が `access-point` として採用している **`((●))` (中央 + 左右 concave arcs)** は **omnidirectional broadcast** を縦扇形ではない形で示すことで、汎用 WiFi アイコンと差別化できる。Shumoku では Tabler 流を踏襲（`circle disc + 中央 LED + 左右 arcs`）。
- **VPN**: 業界の universal symbol は **padlock** だが、`Lock`/`Security`/`Auth` などの一般アイコンと完全に被るため device class として読みにくい。Shumoku では「encrypted tunnel」メタファーで **二重 capsule + 中央 flow 矢印** を採用。**外側 capsule = 公衆ネットワーク経路、内側 capsule = 暗号化レイヤー、矢印 = 通信方向**。

---

## 新規アイコン追加手順

1. `DeviceType` enum (`libs/@shumoku/core/src/models/types.ts`) に新しい値を追加
2. `libs/@shumoku/core/src/icons/default/<name>.svg` を作成
   - この文書のデザイン仕様を満たすこと
   - キーライン適合を確認するため、Gallery ([下記](#動作確認)) で見ながら調整するのが楽
3. `libs/@shumoku/core/src/icons/build-icons.ts` の `deviceTypeToIcon` マップに mapping を追加
4. 再生成して lint:
   ```sh
   cd libs/@shumoku/core
   bun src/icons/build-icons.ts
   bun x biome check src/icons
   bun run typecheck
   ```
5. PR の説明には、どのキーラインに整列させたか / どの archetype を参考にしたかを書く

## ブラッシュアップ評価ループ

既存アイコンを更新するときは、以下を 1 セットとして繰り返す。

1. **Reference survey**: ShowNet と主要ネットワーク stencil 群を確認し、device class ごとの共通記号だけを抽出する
2. **Shumoku abstraction**: 24×24 / 2px stroke / two-tone に落とし込み、製品固有ディテールを削る
3. **Guideline score**: live area、キーライン、白要素なし、fragment 生成後の style 維持、16px での識別性を確認する
4. **Regenerate**:
   ```sh
   cd libs/@shumoku/core
   bun src/icons/build-icons.ts
   ```
5. **Verify**:
   ```sh
   bun x biome check src/icons
   bun run typecheck
   ```

評価で迷った場合は、細部のリアリティよりも「トポロジ図での読みやすさ」「同色グループ内の形状差」「ラベルなしの device class 識別」を優先する。

## 動作確認 (Gallery)

Apple HIG キーラインを背景に重ねた一覧 HTML を以下のスクリプトで生成できる:

```sh
# build-gallery.mjs は SVG ファイルを読み、各 icon の周りに
# squircle / square / circle / vertical-rect / horizontal-rect の
# キーラインを薄いストロークで重ねた HTML を出力する。
bun build-gallery.mjs
```

（スクリプトは `C:\Users\...\AppData\Local\Temp\build-gallery.mjs` にある。プロジェクトに固定で置きたい場合は `libs/@shumoku/core/src/icons/build-gallery.ts` として追加してもよい。）

ダーク / ライト両テーマで、icon が:

- キーラインの live area `[2, 22]` を超えていない
- 70–85% の canvas 充填
- 白要素なし（透過背景でも見える）
- 同色 OSI グループ内でも形状で識別できる

を満たしているか目視確認する。
