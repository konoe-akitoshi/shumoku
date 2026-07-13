# トポロジソースの忠実度と「上流（上位）」の決定

開発・設計メモ（サイト非公開）。2026-07-13 起票。**方針は未決**。
NetBox プラグインのあるトポロジ（イベント会場網、約 100 ノード）で
「図が上下逆さまになる／横並びになる」問題を調べた過程で見えた、より根の
深い設計論点を書き残す。実装判断の前にここで論点を固めることが目的。

> 数値・名前は調査時の一例を一般化したもの。特定の実インスタンスの
> ホスト名・IP・機器名・プロバイダ名は記載しない。

## 目次

- [1. きっかけ（症状）](#1-きっかけ症状)
- [2. 診断（なぜ逆さまになるか）](#2-診断なぜ逆さまになるか)
- [3. 決定打：上流は NetBox に事実として在るのに取れていない](#3-決定打上流は-netbox-に事実として在るのに取れていない)
- [4. NetBox から取れていない情報の棚卸し](#4-netbox-から取れていない情報の棚卸し)
- [5. なぜこうなっているか（スコープの由来）](#5-なぜこうなっているかスコープの由来)
- [6. 設計原則（事実と解釈を分ける）](#6-設計原則事実と解釈を分ける)
- [7. 選択肢と段階的な道筋](#7-選択肢と段階的な道筋)
- [8. 未決事項](#8-未決事項)

---

## 1. きっかけ（症状）

対象トポロジ（NetBox ソース、約 100 ノード）の図が「すごくグチャグチャ」
だった。順に切り分けた：

1. **グルーピングが無意味だった。** `groupBy` の既定は `'tag'`
   （`libs/plugins/netbox/src/plugin.ts:93`, `converter.ts:163`）。この NetBox の
   タグは環境／状態系（例: `prod`/`test`）しか無く、巨大 2 バケット（75/28）に
   潰れていた。役割系タグ（`router`/`core-switch`/`ap`…）は 1 つも使われて
   いなかった。
2. **`groupBy: 'location'` に変更**したところ、NetBox の location（十数件、
   フロア別の階層、最大ゾーン ~35 台）で綺麗にゾーン分けされ、クラッタは
   大きく改善した。
3. **しかし今度は上流→下流の向きが崩れた。** 下から上へ配線が伸びる／同格が
   横並びになる。これが本メモの主題。

## 2. 診断（なぜ逆さまになるか）

実データでランク計算を再現した（`buildLayoutProblem`）。結果は文字通り**上下反転**：

| rank（上ほど上流扱い） | ノード | 実際の役割 |
|---|---|---|
| 0（最上流扱い） | AP 47 台 | 本当は最末端 |
| 1 | フロア SW | アクセス層 |
| 2 | **コア SW / 400G 基幹** | ほぼ最上流 |
| 3（最下流扱い） | **対外エッジ SW（400G）** | **本当の上流・対外接続** |

メカニズム：

1. この NetBox の device role は `AP`/`network`/`other`/`server` の 4 種のみ。
   プラグインの `ROLE_TO_TYPE`（`libs/plugins/netbox/src/types.ts:479-495`）は
   `core-switch`→L3 等の英語命名辞書だが、`network`/`other` はヒットせず
   **全スイッチ・ルータが `generic`（tier 60）** に落ちる。
2. AP だけは role `ap` が辞書ヒットして `access-point`（**tier 50**）になる。
3. apex（頂点）選定は「非 sink・degree ありのうち **最小 tier**」を選ぶ
   （`libs/@shumoku/core/src/layout/problem.ts:407-416`）。tier 50 の AP が
   全て頂点候補になり、そこからの BFS 深さで図全体が組まれる → 反転。
4. 本来これを補正する境界デバイス判定（tier ≤ 20 の router/firewall を
   WAN エッジとして apex に）は、該当ノードが 0 なので発動しない
   （`problem.ts:440-454`）。
5. モード判定 `isRoleDrivenGraph`（`problem.ts:165-175`）は「型が解決できた
   割合 ≥ 50%」しか見ず、`generic` フォールバックも「解決できた」に数える。
   よって**階層情報が実質ゼロでも role-driven モードに入る**。

補足：ゾーン（location）の代表 rank を「ゾーン内で最も浅いノード」に取る実装
（`problem.ts:675-686`, `composite/index.ts:334,777-780`）もあり、部屋に役割の
異なる機器が同居すると効果が増幅する。ただし rank さえ正しく出ればこれは
むしろ自然な挙動なので、二次的要因。

**要点：中途半端に当たるメタデータは、全く当たらないより悪い。** 全ノードが
同格なら無難な絵で済んだのに、AP だけ型が付いたせいで「AP が唯一の意味ある
機器＝頂点」と解釈された。

## 3. 決定打：上流は NetBox に事実として在るのに取れていない

ユーザー指摘（NetBox 側で circuit / circuit termination まで接続済み）を確認。
ライブ NetBox に**上流が事実として在った**：

- Provider 2（プロバイダ A / B）
- Circuit 2（両方 status **`planned`**、拠点間ダークファイバー）
- Circuit termination 4（各 A/Z）：**4 件すべてデバイス interface にケーブル接続済み**

各回線は、対外エッジ SW と会場側 400G 機器の 400G ポートを、A/Z 両終端で
結んでいる（＝両端が自社デバイスのサイト間伝送）。

一方 shumoku 側は：

1. `/api/circuits/...` を**一度も呼んでいない**（`client.ts` の fetch メソッド
   一覧に circuits/providers/terminations が無い）。
2. リンクは `/api/dcim/cables/` のみから生成
   （`buildDevicesAndConnections`, `converter.ts:291-347`）。
3. **両端がデバイス interface でないケーブルを `continue` で捨てる**
   （`converter.ts:308-309`、鏡像 `:1079-1083`）。circuit termination には
   `.device` が無いので、**400G アップリンクは 1 本残らず消滅**している。

つまり「向きを決める 1 ビットの事実」は NetBox に在るが、取得も表現もされて
いない。レイアウトのヒューリスティックを弄る前に、この事実を取り込む方が筋。

## 4. NetBox から取れていない情報の棚卸し

ライブトポロジ生成で実際に叩くのは **devices + interfaces + cables のみ**
（`plugin.ts:116-120`。sites/tags/roles はフィルタ用 `:202-206`）。

**影響大（今回に直結）**
- **circuits（providers/circuits/terminations）** — 対外回線＝上流が見えない。
- **LAG / ポートチャネル** — `lag` フィールドは型にすら無い。400G 冗長やコア間の
  束ねが複数本のバラバラなリンクになり集約されない。
- **front-port / rear-port（パッチパネル）** — ケーブルトレースをしないので
  `機器→パッチパネル→機器` が「2 本の行き止まり」に分断される。

**中（見た目・正確さ）**
- interface の型定義済みだが未使用のフィールド：`mac_address`, `mtu`,
  `mode`(access/trunk), `enabled`, `type`(物理種別), `connected_endpoints`
  （`types.ts:75-113`）。グラフに渡るのは VLAN 番号と speed だけ。
- cable `status`（planned/connected, `types.ts:137-140`）未読 →
  **planned 回線を点線で区別、が現状データとして拾えない**。
- device `status` は読むが `fetchTopology` でフラグ未設定のため死んでいる。
- rack `position`/`face`（搭載位置）未モデル化 → ラック内物理配置が layout に
  使えない。

**IPAM 系**
- `ipam/vlans`/`vlan-groups`/`vrfs` 未取得。VLAN は番号のみ、名前も VRF も無い。
- `ipam/prefixes` は fetch メソッドが在るのに**一度も呼ばれない**。
  `groupBy:'prefix'` は primary_ip を /16 で切る自前ヒューリスティック
  （`converter.ts:424-429`）で、prefix エンドポイントは未使用。

**その他**：custom-fields、tenancy、platforms、console/power、device-types
エンドポイント等も未取得。

## 5. なぜこうなっているか（スコープの由来）

推測ではなくコードと履歴から言える。**根は 1 つ：「リンク＝2 つのデバイス間の
ケーブル」という前提でデータモデルが作られている。**

1. 終端の型 `NetBoxTermination.object` が `{ name, device }` しか持たない
   （`types.ts:122-130`）。circuit / patch-panel / console のような
   「デバイスでない終端」を**表現する型が無い**。取得しても入れる箱が無い。
2. リンク生成は cable-walking のみ（`converter.ts:302-347`）。両端がデバイスで
   なければ捨てる。「circuit は駄目」と判断したのではなく、**device↔device の
   物理配線図を描く道具として設計された**ため素通りさせているだけ。
3. README:3 も "Builds topology from DCIM/IPAM — devices, virtual machines,
   interfaces, and cables"。最初から物理 DCIM インポーターと位置づけ。
4. 履歴：2026-01-09 誕生から約 24 コミット、半年間ずっと**同じ device+cable
   モデルの上で属性を足す**改善（model/vendor、帯域、VLAN、ケーブル色、フィルタ、
   7 月のトップダウン階層 #526…）。**終端モデルを広げる変更は一度も無い。**

結論：「サボり」でも「難しくて断念」でもなく、**"物理配線図を描く"スコープを
初日に決め、その枠内で完成度を上げてきた結果、枠の外（対外回線・L3・LAG・
パッチパネル）が丸ごと残っている**。今回のトポロジでは、その枠の外が本質だった。

## 6. 設計原則（事実と解釈を分ける）

論点を「103 台の階層推定」ではなく「**頂点（apex）＝向きの決定**」に絞れる。
apex さえ正しければ BFS 深さでかなりまともに並ぶ（`role-tiers.ts` のコメントも
そう述べている）。向きを決める情報は分類より遥かに小さい。

ソース由来の情報を信頼度で層別する：

- **事実（構造・物理の観測値）**：リンク接続そのもの、interface speed（400G↔1G の
  勾配）、degree/中心性、**NetBox circuits（回線終端＝WAN エッジの事実）**。
  誰かの命名ではなく観測値。
- **解釈（人間が入れたラベル）**：role / tag / 命名規則。組織ごとに語彙が違い、
  辞書マッチは原理的に推測。**部分ヒットは全外しより悪い**（§2 で実証）。
- **将来の本命（ネットワーク自身の申告）**：default route の向き、OSPF/BGP 関係。
  「上流」の定義そのもの。取れれば推測不要（要 capability 追加、長期）。

原則：

1. **弱い証拠だけで向きを反転させない。** 低信頼時は凝った推測より無難な絵へ
   縮退する（graceful degradation）。
2. **推測をやめられる脱出口を用意する。** apex が決められない時、ユーザーには
   5 秒の質問。ノードを 1 つピン留め → 以後全部決まる。entity identity に
   紐付ければ re-sync でも生存。手書き YAML 側にも同概念（`layoutIntent` 等）。
3. **判断を透明化する。** `TierHint.source`（`role-tiers.ts:52-53`）は既に
   diagnostics 用に在る。「apex は ○○（理由・信頼度）」を UI に出せば疑える・
   直せる。信頼できない推測を黙って見せるのが最悪。

## 7. 選択肢と段階的な道筋

1. **今すぐ（防御・小）**：`isRoleDrivenGraph` を強化し、「アクセス層より上流の
   機器（tier ≤ 40）が 1 台も無ければ role-driven に入らない → discovered
   モード（degree ベース、メタデータ非依存）に落ちる」。今回のトポロジではコア SW の
   degree が最大なので構造だけで上側に来るはず。結論がどうであれこの床は要る。
2. **本命（事実の取り込み）**：NetBox circuits/terminations/providers を取得し、
   **終端モデルを device 以外に広げる**。回線の向こうに `DeviceType.Internet` /
   `Cloud` ノードを合成（core に型は既存 `types.ts:1515-1516`、`PortRole` の
   `wan`/`uplink` も既存 `:145`、プラグインが未使用なだけ）。Internet ノードは
   tier 0 なので apex が**推測なしで**決まる。上流問題の本筋。
   - 副産物：どのプロバイダに抜けているか描ける。LAG/パッチパネル対応の土台にも。
   - 注意：回線は両方 `planned`。status を見て点線等で区別 or 表示可否オプション。
3. **脱出口（UI）**：apex ピン留め + entity 永続化。
4. **長期**：ルーティング情報の capability 化。

「NetBox の情報は**使うが、信頼度を検証してから**使う」。事実で解決できるものを
推測で解決しない。

## 8. 未決事項

- **終端モデル拡張のスコープ**：circuit だけ通すのか、patch-panel（front/rear
  port trace）や console/power まで一般化するのか。`NetBoxTermination` を
  discriminated union に広げる設計。core の Link/Port モデルとの整合。
- **planned をどう扱うか**：非表示 / 点線 / オプション。現状 400g-01 は staged、
  他は planned という実態とのズレ調整も絡む。
- **§7-1 の防御を入れると既存の（role が綺麗な）トポロジを壊さないか**。回帰の
  ためのフィクスチャ（AP+generic+server only、role が綺麗、の両方）が要る。
- **Internet/Provider ノードの identity**：identity 契約（every node ≥1 identity
  key、root CLAUDE.md）を合成ノードでどう満たすか。circuit cid / provider slug を
  identity key にするか。
- **他ソース（Zabbix 等）への一般化**：§6 の原則は NetBox 固有ではない。core 側の
  apex/モード判定の強化は全ソースに効く。
