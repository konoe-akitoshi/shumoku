# Shumoku の新しい構成データモデルの設計と実装計画

**次の一件は論理設計を図と変更例で確認する M0。続く P1 の試作で、基本構造・意味・参照規則と拡張の境界を検証する。**

前提: 既存形式との互換性を必須にせず、新モデルを Shumoku の構造の正本にする。
状態: M0 の論理設計案と図を作成。P1〜P5 の実装と受入検証は未着手。
更新日: 2026-10-05。根拠は [再設計方針](network-model-direction.ja.md)と
[論理設計の図と変更例](network-model-design.ja.md)。

## 最初に何を達成するか

単一ネットワークのノード・ポート・二端点接続・所属を記述し、Editor、異なる source、
描画、外部形式が同じ意味で扱える新モデルを作る。
標準的なモデルを目指す第一歩は、Shumoku に組み込まれた型を公開するだけでなく、
外部の実装が依存できる意味の仕様と適合試験を作ることである。
最初の完成は **M0 と P1 による土台の確認と試作**に区切る。
P2〜P5 の各製品への導入と公開準備は、その結果を使う次の到達点にする。
最初の試作では、既存 Editor の全保存経路や Server/CLI 全体の切替を要求しない。

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

## 決めた設計境界

| 判断 | 計画案での採用方針 |
| --- | --- |
| 正本 | Editor が編集する設計の NetworkTopology。source の主張と Resolution は同じ型を使えても書込み権限が異なる |
| 基本参照 | topology 内で一意な ID。Port は所有 node を持つ。端点は port、未特定なら node を参照 |
| 所属と表示 | 複数所属と任意の group 階層は構造。表示の囲み・位置は View |
| source と状態 | SourceContribution は入力。Resolution は照合・採用・競合の結果 |
| 物理・外部形式 | 版・全参照・payload を持つ domain profile / integration。未知 payload を保持し、扱えない参照変更を止める |

意味の契約を UI・DB・特定 plugin から独立させる。
候補の配置は新規 `libs/@shumoku/network-model/` とし、型・schema・validator・適合 fixture を持つ。
core の描画・layout はこのモデルを消費する側にする。
source と containerlab はアダプターとして追加できる構成にする。

属性辞書には対象・型・単位・値域・根拠・安定度を定義する。
構造 schema の版と、属性の意味の版、profile の版、製品の package version を同一視しない。
公開前の契約整理で URL や最終フィールド名を確定する。P1 中は draft で試せる。
ここでは未提供の schema URL を発行済みとは扱わない。

## 作業順と完了条件

各 P はレビュー可能な成果物の区切りであり、一つの巨大な PR を意味しない。
M0 で論理設計を確認し、P1 で小さな変更・更新・描画・変換の試作を行う。
その結果を受けて P2〜P5 の導入範囲を決める。

M0 の成果物は [論理設計](network-model-design.ja.md)の ER 図二枚、データフロー、
削除と source 更新のシーケンス図、制約と五つの変更例である。
所有者・ID スコープ・端点の XOR・未知拡張・設計と観測の書込み境界が図と本文で一致し、
残る選択を試作へ渡せることを確認する。物理 DB schema の実装はこの段階の条件にしない。

| 作業 | 依存 | 成果物 | 完了証拠 | 状態 |
| --- | --- | --- | --- | --- |
| P1 土台の契約と小さな試作 | M0 | 型・schema・validator・辞書、最小編集・source 更新・consumer・静的変換例 | 五つのケースが動き、核を変更しない profile 追加と未知 profile の保持・編集制限を確認 | 未着手 |
| P2 Editor の正本と基本編集 | P1 | 新しい project、atomic な編集、Undo、保存 | 作成・改名・削除・復元・再読込を新モデルで実演できる | 未着手 |
| P3 source 入力と解決結果の契約 | P1 | contribution/resolution、source scope、最小 adapter | 別 source の ID、不明値、partial/failed、不一致を保つ試験 | 未着手 |
| P4 containerlab adapter の導入 | P1。Editor 接続は P2 | 静的入出力、原定義・実行設定・対応表、診断 | NOS fixture と補助 Linux fixture の構造・設定の往復比較 | 未着手 |
| P5 製品 consumer と公開契約 | P1〜P4 | Library/CLI 等への導入、仕様・適合例 | P1 の共通 consumer 契約を製品へ適用し、独立利用できる | 未着手 |

P2 と P3 は契約確定後に独立して進められる。
consumer を更新する単位は型の依存関係で分割する。
公開 package の追加・変更には適切な changeset を付け、破壊的な変更を明示する。
互換性を設計制約から外すことは、リリースの変更説明を省くことではない。

### P1 土台の契約と小さな試作

1. M0 の意味・所有・ID・拡張参照を、型・schema・validator と基本属性辞書へ落とす。
2. 小さな編集 command と保存で、改名・削除・Undo、既知・未知 profile と binding の影響を試す。
3. source の時系列 fixture で、設計の保持、partial/failed/complete、撤回の範囲と安定 ID を試す。
4. 小さな共通 consumer で、二つの View・複数所属・node 端点を描画する。
5. containerlab の静的変換例で構造と binding を確認し、核を変更せず profile を追加する。

試験には、改名で同じ ID、重複 ID、存在しない port、所有者なし port、循環 group、
別 instance の同じ外部 key、不明な容量、partial/failed の意味を含める。
node 端点と port 端点の区別、両方を指定した不正な端点、実行出力には割当が必要な端点も試す。
型を作っただけでは完了にしない。どの consumer がどの意味を信頼できるかも文書化する。
静的 JSON の参照検査と、編集・source 更新の状態遷移試験を区別する。
profile は最低一つを実装し、別の未知 profile を保持した場合の編集制限も試す。
描画の試作は P2 より先に行い、既存 layout 用の一方向の派生表現を作ってもよい。
その派生表現を永続化の正本へ戻さない。

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
5. **拡張**: 核を変更せず profile を追加し、未知 profile を保持して影響する編集を止められる。

この五条件を確認してから、P2〜P5 の製品への導入と公開準備へ進む。
公開時には schema と意味、適合試験、成熟度・版・未対応範囲を揃える。

新しいプロトコルや全機能の移植は、この五条件の完了を先送りする理由にしない。
一方、既知のケースを属性の寄せ集めでしか表せない場合や、参照の意味が source で変わる場合は
基本設計の未完了として扱う。

## 現在地と次の一件

文書では、新規設計の目的に加え、M0 の図・更新規則と、P1 の試作完了条件を定めた。
新モデルの JSON 例は構文と参照を確認する。runtime schema による適合、Editor の動作、
source 変換、実際の containerlab 実行は未検証である。

P1 は型・validator だけでなく、編集・source 更新・描画・拡張の試作を含む。
従来の 8〜16 時間という仮置きは P1 全体の見積りに使わず、M0 の確認後に作業単位で見積もる。
P2 以降は P1 の結果と製品ごとの依存箇所を確認して見積もる。

**次の一件: M0 の ER 図と五つの変更例を確認し、残る契約の選択を P1 の試作へ渡す。**
