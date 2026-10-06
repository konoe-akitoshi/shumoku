# Shumoku の新しい構成データモデルの設計と実装計画

**最初の試作 P1a は、構成から表示情報を分離する最小案と再編案の比較。P1b で編集・拡張・情報源・外部変換の契約を検証する。**

前提: 既存形式との互換性を必須にせず、新モデルを Shumoku の構造の正本にする。
状態: M0 の概念比較・論理設計案と図を作成。P1a の座標・サイズ・ポート配置・代表的なスタイル・rank・配置方向を分離して試作。
外部レビューと P1a 全体、P1b〜P5 の実装・受入検証は未完了。
更新日: 2026-10-06。根拠は [再設計方針](network-model-direction.ja.md)と
[論理設計の図と変更例](network-model-design.ja.md)。
選択の根拠と反例は [概念選定レビュー](network-model-concept-review.ja.md)を参照。

## 最初に何を達成するか

単一ネットワークのノード・ポート・二端点接続・所属を記述し、Editor、異なる source、
描画、外部形式が同じ意味で扱える新モデルを作る。
標準的なモデルを目指す第一歩は、Shumoku に組み込まれた型を公開するだけでなく、
外部の実装が依存できる意味の仕様と適合試験を作ることである。
最初の完成は **M0 と P1 による土台の確認と試作**に区切る。
P2〜P5 の各製品への導入と公開準備は、その結果を使う次の到達点にする。
最初の試作では、既存 Editor の全保存経路や Server/CLI 全体の切替を要求しない。
P1 を P1a の表示分離と P1b の土台全体の検証に分ける。
P1a では全面再編・新 package の公開・source 更新・全 profile 方式の完成を要求しない。

| 初期の完成範囲 | 初期完了に要求しないもの |
| --- | --- |
| 構造、ID、端点、所属の契約 | 全プロトコル・全ネットワーク階層 |
| 属性の意味、単位、未知値、外部参照のスコープ | 全製品・全 plugin の属性辞書 |
| 最小編集・保存の試作で構造と拡張の参照が保たれること | Editor 全体の切替、旧 archive の互換読込と自動移行 |
| source 入力と解決結果を区別する契約 | 完全自動の実機同定と全競合の自動解決 |
| 小さな描画 consumer、profile 追加、静的な containerlab 変換例 | 全 renderer/CLI の切替、全 kind/link の変換と deploy |

コードを一度に全部置き換える必要はない。
ただし、旧 `NetworkGraph` を正本に固定して新しい構造と同期する設計は採らない。
中間の描画表現や旧コードの内部呼出が必要なら、新モデルから生成する派生値として扱う。

## 設計を検証する具体例

次のケースを P1 の fixture と契約の評価軸にする。
この表は、現在の実装が新モデルで動くことを確認済みという意味ではない。

| ケース | 試すこと | 成立の条件 |
| --- | --- | --- |
| Editor の基本操作を小さな試作で行う | 作成、改名、ポート削除、Undo、保存 | ID と所有参照が安定し、既知 profile・binding を一緒に変更・復元できる。未知 profile の影響する編集は止まる |
| 同じ構造を違う View で表示 | 階層図と別配置・ラベル | 接続と所属は変わらず、座標・表示名は構造と独立して保存される |
| NetBox と LLDP の小さな入力 | 外部参照、未知ポート、観測範囲 | 情報の不足を捏造せず、別 instance の同じ外部 ID を混同しない |
| 設計と観測が一致しない | 改名後の再取込、成功/失敗/partial/complete の時系列 | 設計を上書きせず、不一致と出所を保ち、撤回を source の宣言した範囲に限定する |
| router/switch を含む containerlab 静的定義 | core への変換と実行設定の保持 | 同じ端点構造へ入る。実行設定は別に保持し、出力不足を診断できる |

[router-switch.network.json](examples/network-model/router-switch.network.json) と
[router-switch.view.json](examples/network-model/router-switch.view.json) は P1 の形の例である。
[security View](examples/network-model/router-switch.security-view.json) は同じ構造の別表示、
[route profile](examples/network-model/router-switch.route-profile.json) は拡張の参照契約の例である。
新しい runtime schema による適合検証はこれから作る。
[pair.clab.yml](examples/network-model/pair.clab.yml) と
[pair-after-delete.clab.yml](examples/network-model/pair-after-delete.clab.yml) は
アダプター用の小さな補助 fixture として使えるが、対象モデルやリリースの範囲を定めない。

## 意味の境界と候補方式

| 判断 | 計画案での採用方針 |
| --- | --- |
| 正本 | Editor が編集する設計の NetworkTopology。source の主張と Resolution は同じ型を使えても書込み権限が異なる |
| 基本参照 | topology 内で一意な ID。Port は所有 node を持つ。端点は port、未特定なら node を参照 |
| 所属と表示 | Group は任意の名前付き Node 集合。親子・包含・通信制御を初期 core に置かない。表示の囲み・位置は View |
| source と状態 | SourceContribution は入力。Resolution は照合・採用・競合の結果 |
| 物理・外部形式 | domain profile / integration は版・参照契約を持つ。envelope は比較用の候補方式。未知 payload の保持と編集方針を分ける |

意味の契約を UI・DB・特定 plugin から独立させる。
再編案を採る場合の配置候補は `libs/@shumoku/network-model/` とする。
P1a では型の最終配置や公開 package を先に決めず、最小分離案との比較で必要な契約を選ぶ。
core の描画・layout はこのモデルを消費する側にする。
source と containerlab はアダプターとして追加できる構成にする。

属性辞書には対象・型・単位・値域・根拠・安定度を定義する。
構造 schema の版と、属性の意味の版、profile の版、製品の package version を同一視しない。
公開前の契約整理で URL や最終フィールド名を確定する。P1 中は draft で試せる。
ここでは未提供の schema URL を発行済みとは扱わない。

## 作業順と完了条件

各 P はレビュー可能な成果物の区切りであり、一つの巨大な PR を意味しない。
M0 で概念選定と論理設計を確認し、P1a の表示分離を先に試す。
P1a の結果を受けて P1b の変更・更新・拡張・変換の試作を行う。
その結果を受けて P2〜P5 の導入範囲を決める。

M0 の成果物は概念選定の比較表・五つの反例と、論理設計の ER 図二枚、データフロー、
削除と source 更新のシーケンス図、制約と五つの変更例である。
最小分離案との比較、構成・selection・presentation のフローも含む。
完了判定では、意味の要求と候補方式を分け、初期範囲外・追加時の影響・P1 の選択試験を明記する。
所有者・ID スコープ・端点の XOR・未知拡張・設計と観測の書込み境界が図と本文で一致することも確認する。
文書が揃ったことを外部レビュー済みや実装検証済みとは扱わない。物理 DB schema の実装は条件にしない。

| 作業 | 依存 | 成果物 | 完了証拠 | 状態 |
| --- | --- | --- | --- | --- |
| P1a 構成・表示分離の比較 | M0 | 最小分離案と再編案の fixture、小さな selection / presentation の試作 | 同じ構成から二つの見方を作り、構成不変・元 ID 対応・物理情報の保持を示す。再編が必要な理由を記録 | 進行中: 座標・サイズ・ポート配置・代表的なスタイル・rank・配置方向の分離と再読込を確認 |
| P1b 土台の契約と小さな試作 | P1a | 型・schema・validator・辞書、候補方式の比較、最小編集・source 更新・静的変換例 | 五つのケースが動き、Group / source 機能なしの単独利用と profile の情報追加を確認。候補方式の採否を記録 | 未着手 |
| P2 Editor の正本と基本編集 | P1 | 新しい project、atomic な編集、Undo、保存 | 作成・改名・削除・復元・再読込を新モデルで実演できる | 未着手 |
| P3 source 入力と解決結果の契約 | P1 | contribution/resolution、source scope、最小 adapter | 別 source の ID、不明値、partial/failed、不一致を保つ試験 | 未着手 |
| P4 containerlab adapter の導入 | P1。Editor 接続は P2 | 静的入出力、原定義・実行設定・対応表、診断 | NOS fixture と補助 Linux fixture の構造・設定の往復比較 | 未着手 |
| P5 製品 consumer と公開契約 | P1〜P4 | Library/CLI 等への導入、仕様・適合例 | P1 の共通 consumer 契約を製品へ適用し、独立利用できる | 未着手 |

P2 と P3 は契約確定後に独立して進められる。
表の P2〜P5 に対する P1 は、P1a と P1b の両方を指す。
consumer を更新する単位は型の依存関係で分割する。
公開 package の追加・変更には適切な changeset を付け、破壊的な変更を明示する。
互換性を設計制約から外すことは、リリースの変更説明を省くことではない。

### P1a 構成と表示を分離する最初の比較

2026-10-06 の[最初の実験](experiments/2026-10-06-model-separation/README.md)で、
案 A / B の二ノード・一接続を縦 / 横に描画し、座標の別保存・再読込と構成不変を確認した。
続く四ノードの実験では、表示サイズと三ポートの並びを別保存し、元の接続先・端点付着を保持した。
サイズの指定値と自動値の優先順位、最小値未満・座標衝突・未接続 Port の診断も記録した。
代表的な色・線のスタイル、同じ rank の整列、四方向の配置も別保存し、構成と接続先の保持を確認した。
現行経路は rank を参照しないため、試作の局所制約として処理し、固定座標との矛盾・整列後の衝突を診断した。
選択、折りたたみ、両案の所属表現の比較、全スタイルの扱いは残っている。
この結果だけで案 B の全面再編を採用せず、次は明示 ID・属性での選択と一段の折りたたみを試す。

この試作は既存製品を移行する作業ではない。同じ構成ケースを二つの候補形で表し、
小さな共通処理へ渡して、何を変える必要があるかを判定する。
旧 renderer 向けの一方向の派生値を使ってよいが、正本を二重化しない。

1. 現在の概念から表示項目を外す案 A と、Port などを再編する案 B の小さな fixture を作る。
2. 座標・表示用サイズ・ポートの配置指定を presentation へ分け、配置と保存・再読込を確認する。
3. スタイル・rank・配置方向を分け、従来の表示能力を維持できるかを確認する。
4. 明示 ID / 属性による選択と一段の折りたたみを試し、元要素への対応と境界接続を確認する。
5. 同じ構成の二つの View と平行接続・端点未特定・物理情報の保持を比べ、採用する形と理由を記録する。

各分離の前後で、見た目や表示範囲を変えても構成の要素・接続・意味上の属性が変わらないことを確認する。
画面を読めることと構成が同じことを別に検査し、既存の画像と完全に同じバイト列は要求しない。
物理的な校正・配線長・経由点は表示情報として消さない。
過去形式の互換読込や旧 API の維持は合格条件にしない。

| ケース | 完了証拠 |
| --- | --- |
| 座標・スタイル・rank を順に分離 | 前後の構成値の比較と、配置・色・線・同じ段の指定の表示例。計算済み scene が構成へ保存されない |
| 同じ構成を二つの見方にする | 別配置・別ラベル・選択条件でも元の接続と所属が同じ。View / presentation の再読込ができる |
| 集合の折りたたみと再展開 | 集約の元 Node / Connection の ID 群を保持。内部・境界を区別し、元の構成から再展開できる |
| 平行接続と端点未特定 | 両端 Node だけでは接続を識別しない。未知の Port を捏造せず、対応しない表現は診断する |
| 役割・建物・物理情報 | 条件に使う属性と表示属性が別。配線長・校正などを保持し、色や図の距離から事実を生成しない |

案 A が必要な意味と参照を保てる場合、全面再編を初期条件にしない。
案 B を採る場合は、案 A の不足と追加の契約で解消する理由を具体例で示す。
経路選択のアルゴリズム、CSS の全面導入、Canvas への置換、全製品の表示再現は P1a の完成条件にしない。
P1a の合格を受けて採用案の ER 図・fixture・P1b の型を更新する。

### P1b 土台の契約と小さな試作

1. P1a の採用案の意味・所有・ID を型・schema・validator と基本属性辞書へ落とし、下記の小さな比較で候補方式を選ぶ。
2. 小さな編集 command と保存で、改名・削除・Undo、既知・未知 profile と binding の影響を試す。
3. source の時系列 fixture で、設計の保持、partial/failed/complete、撤回の範囲と安定 ID を試す。
4. 小さな共通 consumer で、二つの View・複数所属・node 端点を描画する。
5. containerlab の静的変換例で構造と binding を確認し、核を変更せず profile を追加する。

試験には、改名で同じ ID、重複 ID、存在しない port、所有者なし port、重複所属、
別 instance の同じ外部 key、不明な容量、partial/failed の意味を含める。
node 端点と port 端点の区別、両方を指定した不正な端点、実行出力には割当が必要な端点も試す。
型を作っただけでは完了にしない。どの consumer がどの意味を信頼できるかも文書化する。
静的 JSON の参照検査と、編集・source 更新の状態遷移試験を区別する。
profile は最低一つを実装し、別の未知 profile を保持した場合の編集制限も試す。
描画の試作は P2 より先に行い、既存 layout 用の一方向の派生表現を作ってもよい。
その派生表現を永続化の正本へ戻さない。

P1b の方式選択は、次の小さな対照例に限定する。全方式を製品へ実装する要求ではない。

| 比較・境界試験 | 完了証拠と判断 |
| --- | --- |
| Group と source 機能なしの単独利用 | 静的 topology を consumer が描画できる。集合を表示以外から参照する例が必要なければ Group の core 配置を再検討する |
| 端点 slot と端点 ID | 二端点の入替・付替え・保存後に端ごとの profile 参照を比較し、安定性と記述負担で方式を選ぶ |
| envelope と宣言的な参照パス | 同じ小さな profile の参照列挙・削除影響・再読込を比較し、未知 payload に対して保証できる範囲も記録する |
| topology にできない部分観測 | 所有 Node 未収集の Port などを、誤入力や実機の不在と混同せず未対応として保持・診断する |
| 二端点以外の意味 | 概念レビューの五反例のうち共有媒体と有向依存を未対応として診断する。二端点や Group への偽装を認めない |

source の sequence / record 置換は収集試作の候補方式として試す。
これらの実装がなくても静的 topology の適合を判定できるよう、構造の validator と分離する。

P1 の確認項目は、現行 [core 型](../libs/@shumoku/core/src/models/types.ts)、
[観測型](../libs/@shumoku/core/src/observation/types.ts)、
[Editor project](../apps/editor/src/lib/types.ts)、
[contribution codec](../apps/server/api/src/services/contribution-store.ts)の経験から抽出する。
旧形式へ変換できることは合格条件にしない。

### P2 Editor の正本と基本編集

1. project の network、views、domain profiles、integrations の保存契約を定義する。
2. 新モデルから Editor の派生表示状態を生成する。
3. 作成・接続・改名・削除を、参照調整付きの atomic 操作にする。
4. Undo、差分同期、全 snapshot 保存、assets の経路を新しい project に揃える。
5. 保存・再読込と、View/profile/integration の参照更新を実演する。

変更を吟味する箇所は [context](../apps/editor/src/lib/context.svelte.ts)、
[Undo](../apps/editor/src/lib/undo.svelte.ts)、
[persistence](../apps/editor/src/lib/persistence/)、
[Editor の接続モデル](../apps/editor/docs/design/connection-model.md)。
既存 ZIP v1 の読込、DB v3 への追加だけで済ませることを前提にしない。
新しい版と保存形は新しい正本に合わせて決める。

BOM、物理配線、校正の全 UI を同時再実装する必要はない。
基本ケースに必要な domain profile を定義し、未対応の操作・情報は診断する。
新規構造を旧 graph に保存して新モデルの編集ができたと扱わない。

### P3 source 入力と解決結果の契約

1. sourceId と接続先スコープを分け、external reference を記録する。
2. 設計・台帳・探索の小さな入力を共通構造に変換する。
3. snapshot の成功、失敗、partial と撤回の範囲を検証する。
4. 元の ID、同定の根拠、明示的な対応、採用先 ID を別に扱う。
5. 不一致と属性の出所を Resolution の結果として確認する。

初期は明示的な対応でよい。全 source の高度な自動同定は要求しない。
Server の [entity registry](../apps/server/api/src/services/entity-registry.ts) の知見を使い、
互換性のために旧 port ID を interfaceName と読み替える処理は新契約へ持ち込まない。
source ごとの元情報と、解決して使う構造を同じ保存対象にしない。
P1 で確認した設計・source・Resolution の書込み境界、record 置換と coverage の規則を適用する。
設計の構造と source の主張を、再計算後の一つの topology へ書き戻す同期は作らない。

### P4 containerlab による表現確認

1. 対象版と静的な二端点接続の対応表をアダプターで固定する。
2. router/switch の NOS fixture と補助 Linux fixture を用意する。
3. ノード名、interface 表記、実行設定、内部 ID の対応を記録する。
4. 未編集・対応する編集・保存後の往復を比較する。
5. 新規出力の不足設定と、変換不能な構造・参照の診断を試験する。

node の role から kind/image を補完しない。NOS の表記を全機種共通に正規化しない。
物理設計を仮想 lab へ実現した対応と、実機を再観測して同定した対応を区別する。
大きな起動設定の中の参照を理解できない場合は、影響する編集を止める。
core が表せる構造を containerlab が全て実行できるという約束はしない。

containerlab v0.79.0 は調査用の基準候補であり、実装時に schema・元 commit・ハッシュを固定する。
[同タグの schema](https://github.com/srl-labs/containerlab/blob/v0.79.0/schemas/clab.schema.json)
では links がある場合に最小要素数 1 が指定されているため、空接続の出力は links の省略も検査する。
このような制約はアダプターに閉じる。

実行用の deploy/destroy 試験は、対象 Linux 環境と取得可能な image を使う別の検証である。
NOS の image・license が用意できない場合は、構造と設定の往復試験までを実施し、
未検証の実行能力を明示する。モデルの設計判断を Linux image の選択で代用しない。

### P5 consumer と公開契約

1. layout・renderer が新モデルから派生データを作る入力経路を用意する。
2. 手書き・台帳・探索から得た同じ構造の描画を比較する。
3. Library/CLI が Editor や source を知らずにモデルを消費できることを確認する。
4. 仕様、schema、属性辞書、適合試験、未対応範囲を公開対象として揃える。
5. 新しい仕様だけを使う producer/consumer の独立例を確認する。

既存のカスタム layout engine の知見は使い、ELK は再導入しない。
新モデルで render するために旧 YAML の authoring schema を経由しない。
生成・消費のどちらかが source 固有の文字列や隠れた補完規則を必要とするなら、契約を修正する。

## 土台の試作完了を判定する五条件

1. **基本構造**: ID・所有・接続・所属を、意味の仕様と実データ検証で確認できる。
2. **編集**: 最小編集・保存の試作で、改名・削除・Undo が構造と関連文書の参照を保つ。
3. **情報源**: 時系列の更新で、設計を上書きせず、未知値・時刻・スコープ・不一致・ID を保つ。
4. **共通利用**: 小さな独立 consumer と静的な containerlab 変換例で意味と対応を確かめる。
5. **拡張**: 既存要素への情報を core 変更なしで追加し、未知 profile を保持して影響を診断できる。初期 Editor は扱えない編集を止める。

この五条件を確認してから、P2〜P5 の製品への導入と公開準備へ進む。
P1a の構成・表示分離だけでは五条件全体の完了にはならない。
公開時には schema と意味、適合試験、成熟度・版・未対応範囲を揃える。
新しい独立要素や topology 間の関係まで core 変更なしで追加できたとは扱わない。

新しいプロトコルや全機能の移植は、この五条件の完了を先送りする理由にしない。
一方、既知のケースを属性の寄せ集めでしか表せない場合や、参照の意味が source で変わる場合は
基本設計の未完了として扱う。

## 現在地と次の一件

文書では、新規設計の目的に加え、M0 の概念比較・反例・図と、P1 の試作完了条件を定めた。
新モデルの JSON 例は構文と参照を確認する。runtime schema による適合、Editor の動作、
source 変換、実際の containerlab 実行は未検証である。

次に実装するのは P1a の座標・スタイル分離と選択の比較である。
P1 全体は型・validator だけでなく、P1b の編集・source 更新・拡張の試作も含む。
従来の 8〜16 時間という仮置きは P1 全体の見積りに使わず、M0 の確認後に作業単位で見積もる。
P2 以降は P1 の結果と製品ごとの依存箇所を確認して見積もる。

**次の一件: M0 の最小分離案と再編案の比較をレビューし、P1a の小さな座標分離の試作へ進む。**
