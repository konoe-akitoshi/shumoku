# Topology: 全ソース同列 + 優先度マージ（resolve 一本化）

> ステータス: 設計（accepted direction, 2026-06-01）。実装未着手。
> 既存 `topology-foundation-resolve.md` / `topology-foundation-source-attachment.md`
> を **更新（superseding）** する判断を含む — §7 参照。

## 0. なぜこのドキュメントが要るか

`feat/node-attachments` PR で discovery タブを作り込む中で、根本的なモデルの
ねじれが繰り返し露呈した：

- 「ノードが2つに割れて見える」「community を足したら詳細が消える」「Reset したのに
  変わらない」「Access の行を ✕ しても消えない」——
  すべて **「人の上書き(authored)」を「観測(observed)」とは別の特別な層として扱って
  いた**ことに起因する。
- 実装は「authored を最優先の架空ソースとして resolve に流す」形だが、`authored ===`
  の特別分岐が散らばり、`priority` フィールドは存在するのに resolve が読んでいない。
- 加えて、過去に**実際に使われていた**複数ソース・マージ実装
  `libs/@shumoku/core/src/merge.ts`(742行) と Sources ページの「Merge Configuration」
  UI が、observation/resolve 移行で**呼び出しだけ外れて宙吊り**になっている
  （設定はできるが効かない）。resolve() と思想の異なる「2つ目のマージ経路」が
  公開 API として残ったまま。詳細と扱いは §5。

合意したモデル：**ソースは同じ機器を見るので重なる。Git のように重ね合わせ、
優先度の高いソースが各フィールドを勝ち取る。重ならない部分は別の島として出る。
人の手入力もただの「最優先のソース」。** 層の概念をやめ、全寄与を同列に扱う。

## 0.5 この PR の目的と完成チェックリスト

> 次 PR（このドキュメントが駆動する実装）は**一気に**やる。発散しないよう、目的と
> 「これが全部緑なら完成」の受け入れ条件をここに固定する。実装中はこのリストから
> 出ない。

### 目的（なぜやるか）
1. **observed / authored の2層の混同を構造から消す。** 「✕ で消えない」「community を
   足すと詳細が消える」「Reset したのに変わらない」「2つに割れて見える」を生んでいた
   根（authored を架空ソースとして特別分岐）を、**全ソース同列＋provenance** で除去する。
2. **宙吊りの Merge Configuration（既存・未配線）を resolve に正式に引き継ぐ**。設定が
   効かない状態を解消し、マージ経路を resolve 1 本に集約（merge.ts 撤去）。

### 完成チェックリスト（受け入れ条件＝テスト）
core / api / web それぞれに、以下を自動テストで満たすこと。**全部緑で「完成」。**

- [ ] **C1 同列マージ**: 観測ソース2つ＋人寄与を priority 順でフィールド単位マージ。
      priority 高が各フィールドを勝ち取り、持たないフィールドは次 priority が出る。(resolve test)
- [ ] **C2 空=値なし(決定1)**: 高 priority が `''`/`[]`/null のフィールドは、低 priority の
      実値が勝つ。(resolve test)
- [ ] **C3 人=最優先(決定3)**: 人寄与は partial node（identity＋触ったフィールドのみ）。
      キーの無いフィールドは主張なし＝観測が透ける。`label:''` sentinel に依存しない。(resolve test)
- [ ] **C4 Reset = 人寄与の除去**: 人寄与を取り除くと、そのノードは観測の素の状態に戻る
      （scan の name / community が出る）。層を剥がす挙動でない。(api + resolve test)
- [ ] **C5 二段構えにしない＋人は否定もできる(決定5)**: access は **1プロトコル=1行の単一の
      有効値**として常に編集可能に出す。provenance は「出どころ(scan / 人)」の**注記**だけで、
      読み取り専用の層を作らない。編集＝最優先の上書き、クリア＝上書き解除でソース値へ戻す、
      **✕＝削除（observed 由来でも）= `suppressedAttachments` に記録**して再スキャンでも復活
      させない。Reset で人の寄与（肯定も否定も）全破棄＝素のソース状態へ。(resolve suppression
      test + web helper unit test)
- [ ] **C6 provenance**: resolved の各 attachment（最低限）に由来ソースが付く。観測由来と
      人由来が区別できる。(resolve test)
- [ ] **C7 retraction 直交(決定4)**: 観測から消えたノードは retraction 対象だが、人寄与の
      あるノード／policy=disabled は残る。priority はこの判定に影響しない。(resolve test)
- [ ] **C8 identity 軸は不変(決定2)**: clustering は従来どおり any-key 一致。priority を
      clustering に効かせない（同一判定の回帰が無い）。(resolve test)
- [ ] **C9 Merge Config 引き継ぎ**: 旧 Merge Config の base/overlay 設定が priority/by-source
      設定として機能する（または明示的に移行）。merge.ts は撤去され、`index.ts` の
      re-export も消える。呼び出しゼロ→存在ゼロ。(grep + build)
- [ ] **C10 probe は identity マッチ**: probe マージが node id でなく identity で差し替え、
      id 振り直しでも重複しない。(api test、現 PR 持ち越し)
- [ ] **回帰**: 既存 resolve / discovery-policy / network-scan テストが全て緑。
      svelte-check 0/0、typecheck clean、biome clean。

### スコープ外（次PRでやらない）
- fieldAuthority（field×source の細粒度権威）。単一 priority で v1 は足りる(§3)。
- manual idMapping（自動 clustering で繋がらないノードの手動マージ）。島のまま許容(決定2)。
- facts attachment の実装（名前/機種を attachment 化）。別 PR(§ node-attachments doc)。

## 1. 中心概念：すべては「優先度付きソースの寄与(contribution)」

データソース / 観測スナップショット / 人の手入力を**区別しない**。すべて

> 「ある **source** が、ある時刻に、このトポロジを **こう見ている / こう主張している**」

という *contribution* として扱う。resolve はこれらを identity で束ね、フィールド
単位で「優先度が一番高く、かつその値を持っているソース」を勝たせる。

```
contribution = {
  sourceId: string          // 'man_xxx'(人) / 'ds_netbox' / 'ds_scan' / …
  priority: number          // 高いほど勝つ。人=最上位
  capturedAt: number        // 同priority時のタイブレーク(新しい方)
  graph: NetworkGraph       // そのソースが主張するグラフ
}
```

- **人(Manual)** = `priority` 最上位の、ただのソース。特別な型も特別な分岐も持たない。
  「authored だから勝つ」ではなく「priority が最上位だから勝つ」。
- 観測ソース(NetBox / Zabbix / network-scan) = それぞれの priority。要件で並べる。
- 既存の `topology_data_sources.priority`（DB に存在し `ORDER BY priority` までされて
  いるが resolve が無視している）を**そのまま配線**する。Manual には最上位の priority を
  与える（実装時に定数 or 既存 attach の priority で表現）。

## 2. フィールド単位マージ（Git 的）

resolve は identity（mgmtIp → chassisId → sysName → …）でノードをクラスタ化し、
**フィールドごとに**勝者を決める：

```
各フィールド f について:
  候補 = そのクラスタの寄与のうち f に値を持つもの
  勝者 = 候補を (priority desc, capturedAt desc) で並べた先頭
  値なし(候補ゼロ) → そのフィールドは出ない
```

帰結（= 望ましい挙動）：

- **変化がある部分だけ動く。** 人が `name` だけ触れば `name` だけ人の値、`ports` は
  scan の最新が黙って反映され続ける（Git の非衝突自動マージ）。
- **「持っているソースが勝つ」。** NetBox が `name` 権威でも `ports` を持たなければ、
  `ports` は値を持つ scan が出す。単一 priority でも「権威はあるが一部フィールドしか
  持たない」が自然に処理される。
- **重ならない島。** identity が一致しないノードは別クラスタ = 別ノードとして描かれる。
- **上書きの上書きも許容。** 「NetBox を人より上に」と priority を組めば、台帳(NetBox)が
  機器名を持ってきたとき人の編集も上書きされる——運用上正しい（台帳が正なら従う）。
  これは priority の設定だけで選べる。

### 値の撤回 — フィールドは「空は保存しない」、attachment は「明示的に削除」

人の寄与は**対称**にする：足す / 上書き（肯定）だけでなく、**取り除く（否定）**もできる。
撤回の表現は対象で分ける：

- **フィールド（name 等）**: 「空にした(=出すな)」と「触っていない」を区別する *曖昧な*
  tombstone は持たない。代わりに **空は保存させない**（UI で必須フィールドの空入力を弾く）。
  人のフィールド主張は常に「値がある」だけ。name を戻したいときはその主張を消す＝クリア / Reset。
- **attachment（access / policy）**: 「この attachment を取り除く」は曖昧でない**明示操作**
  なので、否定の主張を持てる — `Node.suppressedAttachments`（attachment キーの配列、§決定5）。
  人は attachment を足す / 上書きするだけでなく**消せる（観測由来でも）**。消した主張は永続し
  再スキャンでも復活しない。Reset（人の寄与を全破棄）で戻る。

これで「観測 = 読み取り専用の層」が不要になる（人はどの値も足す・上書き・削除できる、ただの
最優先ソース）。曖昧な空フィールド tombstone は依然として持たない — 撤回の手段が対象ごとに
違うだけ。

## 3. 単一 priority を採用、fieldAuthority は将来拡張

既存 `source-attachment.md §6` は「merge tiebreaker priority を削除し、`fieldAuthority`
(field × source-type で prefer/neutral/avoid) で表示権威を決める」としていた。**v1 は
これを採らず、単一 priority 順に倒す**。理由：

- 今回の全問題（Reset / ✕ / 2層）は「人 vs scan」の2者で、単一 priority で解ける。
  fieldAuthority は過剰。
- fieldAuthority が活きるのは「NetBox と scan が同じフィールドで食い違う」構成だが、
  **その構成はまだ存在しない**（実ソースは network-scan + Manual のみ）。YAGNI。
- 実装コストが圧倒的に小さい。単一 priority は fieldAuthority の特殊ケースなので、
  将来必要になれば**後方互換に拡張**できる（priority 表 → field×source 表）。

→ `fieldAuthority` は doc 上「将来拡張点」として残す。v1 実装はしない。
conflict（同 priority で値が割れる）は今までどおり `provenance.state='conflicting'` で
surface する（既存どおり、勝者は capturedAt で決める）。

## 3.5 確定事項（実装前に詰めた決定）

レビューで挙がった未確定点を**決定**に落とす。前提：**「priority(値の勝敗)」と
「identity(同一性判定)」は直交する別軸**。混ぜない。

### 決定1: 「値を持つ」= 非 null かつ非空
フィールド勝者選択は「**非 null かつ非空**」を「値あり」とする。空文字 / 空配列 /
null は「持たない」扱いで次 priority に譲る。これは観測ソース由来でも人由来でも同じ
基準。よって「NetBox が name=`''` を返したら scan の実 name が勝つ」。人入力の空は
そもそも UI バリデーションで保存させない(§2.1)ので、空が層に乗るのは観測のみ。
- 実装: フィールド読み取りヘルパ `hasValue(v) = v != null && v !== '' && !(Array.isArray(v) && v.length === 0)`。

### 決定2: identity 軸と priority 軸を分離。v1 は自動 clustering のみ
- **identity（同一判定）**: 現行どおり「いずれかのキー(mgmtIp/chassisId/sysName/…)が
  一致すれば同一クラスタ」。priority は同一判定に**効かせない**。
- **priority（値の勝敗）**: クラスタ確定後の、クラスタ内フィールド勝者決定にのみ使う。
- 「自動 clustering で拾えず島に割れる食い違い」を人が手で繋ぐ **manual idMapping は
  v1 スコープ外**（旧 Merge Config の同名機能を将来引き継ぐ。§5.2）。v1 は割れたら島の
  まま＝既存挙動。これは「壊れ」ではなく既知の制限として受容する。

### 決定3: 人の寄与は「partial node を持つ NetworkGraph contribution」
人ソースは他ソースと同じ `NetworkGraph` の寄与として保存する。その中の各 Node は
**identity + 人が設定したフィールドだけ**を持つ partial node（現 PR の thin overlay と
同じ形）。**フィールドが node に無い = そのフィールドは主張なし**。これで「触った vs
触ってない」は「キーが存在するか」で機械的に決まり、tombstone は不要（空は決定1で
保存しない）。新しい sparse 構造は導入しない — 既存の Manual グラフ保存をそのまま使う。
- 注意: 現状 thin overlay は `label:''` を「主張なし sentinel」にしているが、決定1で
  「空=値なし」に統一されるので、**`label` フィールドの有無**で主張を判定でき、`''`
  sentinel は不要になる（実装時に sentinel を撤去し「キー無し=主張なし」に寄せる）。

### 決定4: retraction は観測ソースにのみ作用、人は不変
- retraction（N 回観測されなければ撤去）は **観測ソースの寄与にのみ**適用。人ソースの
  寄与は撤去対象外（人が明示的に Reset するまで永続）。
- 順序: ①各観測ソースに retraction を適用して生き残る寄与を確定 → ②生き残った全寄与
  ＋人寄与を priority マージ。retraction と priority は段が違う（直交）。
- 既存ゲート `absenceImpliesRetraction`（policy=disabled は撤去しない）はそのまま観測
  寄与の retraction 判定に使う。priority とは無関係。

### 決定5: provenance は「注記」（層にしない）＋ 人の寄与を否定まで対称化
resolved の各フィールド・各 attachment に「どのソース由来か」(`provenance.source`)を
持たせる。ただし UI はこれを **層の境界（観測=読み取り専用 vs 人=編集可）としては使わない** —
それをやると「2層」が UI に蘇る（=今回まさに消す対象）。正しくは：**1つの有効値を
常に編集可能に出し、provenance はその値の出どころ表示に使うだけ**。

人の寄与は**対称**：足す / 上書き（肯定）に加え、**取り除く（否定 = `Node.suppressedAttachments`、
attachment キーの配列）** もできる。よって observed 由来の access も人が ✕ で削除でき
（suppression を記録するので再スキャンでも復活しない）、フィールドをクリアすれば上書き解除で
ソース値に戻り、Reset は人の寄与（肯定も否定も）を全破棄して素のソース状態に戻す。`resolve` は
suppression されたキーをマージ結果から落とし、その集合を resolved ノードに通す（UI 往復用）。

（初回実装で決定5を「観測=読み取り専用＋Override ボタン」と取り違え、二段構えを UI に
復活させた。**根因は「人が肯定しかできない非対称モデル」** — 観測より少なくする手段が無く、
設計が「observed は読み取り専用」へ逃げ続けた。否定プリミティブを足して対称化したのが本修正。
provenance=注記であって層ではない、を厳守する。）
- 粒度: 最低限 attachment 単位（access/policy ごとに由来）。フィールド単位(name 等)は
  resolved node に `fieldSources?: Record<string,string>` のような形で持てると理想だが、
  v1 は attachment 単位を必須・フィールド単位は余力で。

### 穴5: 現 PR から持ち越す既知の UI/マージ課題（このモデルで解く）
レビュー(Codex + self)で挙がったが、observed/authored の分離が無いと正しく直せない
ため priority モデルで解決する持ち越し：

- **Access 行の ✕ が observed 由来を消せない**: 現 UI はノードの *resolved* attachments
  を編集対象にしており、network-scan が付けた observed の `access:snmp`(community) も
  「人の上書き」として ✕ 表示される。✕ は authored だけを PATCH するので、observed は
  refresh で復活＝「消えない」。priority モデルでは「各フィールド/attachment の provenance
  （どのソース由来か）」を持ち、observed 由来の行は読み取り専用にして ✕ を出さない。
  ノード詳細は authored レイヤを別途知る必要がある（今は resolved しか渡していない）。
- **probe マージが node.id 一致**: `mergeProbeIntoSnapshot` は probe 結果を **node id** で
  base に差し替える。device の id がスキャンで振り直されると差し替わらず重複が残る
  （resolve が read 時に identity で再クラスタするので画面上は1ノードに畳まれ実害は小だが、
  スナップショットに一時的な重複が残る）。priority/identity 一本化時に **identity マッチ**
  へ寄せる。

## 4. Reset / Hide / ✕ の再定義（このモデルでの意味）

- **Reset** = 「最初の Scan 時の状態に戻す」= **人ソースの、そのノードへの寄与を取り除く**。
  層を剥がすのではない。人の寄与が消えれば、次に priority の高いソース(scan)の値が
  各フィールドで自然に出る。
- **Access 行（community 等）** = 1プロトコル=1行の**単一の有効値**を常に編集可能に出す。
  - 入力を変える = 人の上書き（最優先）。
  - フィールドを空にする = 上書き解除でソース値へ戻る（行は残る）。
  - **✕（削除）はどの行にも出す**（observed 由来でも）。削除すると、ソースが供給している
    キーは suppression（`Node.suppressedAttachments`）として記録され、再スキャンでも復活せず
    その access は消える＝普通のノードになる。
  - **Reset** で人の寄与（上書きも削除も）を全破棄 → 素のソース状態に戻り、削除した access も
    復活する。
  `provenance` は「あなたの値 / scan が取得」の**注記**に使うだけで、読み取り専用の層は作らない。
  （observed を「人が消せない事実」とする旧 §4 は二段構えの誤り。人は最優先ソースとして
  どの値も足す・上書き・削除できる。）
- **Hide** = ノード自体を表示から除外（identity-keyed exclusion）。これはフィールド
  マージとは別概念のまま（現 PR の実装を維持）。

## 5. マージ経路は resolve() に一本化（既存 Merge Config を引き継ぐ）

### 5.1 Merge Configuration は「デッドコード」ではない — 宙吊りの旧実装

`libs/@shumoku/core/src/merge.ts`（`mergeNetworkGraphs` / `mergeWithOverlays` /
`simpleMerge`、742行）と、Sources ページの **Merge Configuration タブ**
（`isBase` / `match` / `onMatch` / `onUnmatched` を編集し `optionsJson` に保存）は
**対で設計され、過去に実際に使われていた機能**である。git 履歴で確定：

- `222ed91 feat(merge): add configurable multi-source topology merge` — 導入。
  `mergeWithOverlays` / `mergeNetworkGraphs` が実際に呼ばれていた。
- `43788de / 4bcffb4 feat: Discovery tab + capability-dispatched sync` —
  observation / resolve モデル導入時に**呼び出しだけが外れた**。UI(Merge Config) と
  merge.ts は残ったまま、中間配線が切れて宙吊りになった。

現状：**UI は今も base/overlay を編集・保存・再読込できる**（生きた UI）が、保存された
`onMatch`/`isBase` を実際のマージで**消費する箇所が無い**。`mergeWithOverlays` は
それを読めるが呼ばれておらず、`resolve()` は mergeConfig を引数に取らない。
→ 「設定できて保存もされるが、効かない」状態。

### 5.2 だから「削除」ではなく「要件の引き継ぎ」

Merge Config が解いていた問題 =「複数トポロジソースを base + overlay で重ねる」は、
本ドキュメントの「全ソース同列 + 優先度マージ」と**同じ要件**。Merge Config はその
*旧解法*（base 指定 + strategy ベースの id/name マッチ）、priority モデルは *新解法*。
よって：

- **merge.ts は単純削除しない。** その役割（複数ソース統合）を resolve が正式に引き継ぐ。
  引き継ぎ完了後に merge.ts を撤去し、`index.ts` の `export * from './merge.js'` も外す。
  マージは resolve 1 本に集約する。
- **Merge Config UI は捨てない。** 概念を priority モデルにマッピングして作り直す：
  - `isBase`（基準ソース） → priority 最上位（or base=最優先の表現）
  - `onMatch: merge-properties`（マッチしたらフィールド統合） → §2 のフィールド単位
    マージそのもの（priority 順で各フィールド勝者選択）
  - `onMatch: keep-base / keep-overlay` → 「base のみ採用 / overlay で全上書き」を
    priority の極端設定として表現できるか、要件次第で UI を簡素化
  - `match: name / attribute / manual idMapping` → resolve の identity clustering に
    対応。`manual idMapping` だけは identity キーに無い概念なので、引き継ぐか落とすか
    要判断（v1 は identity ベースに寄せ、manual mapping は将来 or 廃止候補）。
  - `onUnmatched: add-to-subgraph / ignore` → 「重ならない島」を出すか抑制するか。
    §2 の「重ならない部分は別ノード(島)」がデフォルト。`ignore` 相当が要るかは要件次第。
- 移行時、既存トポロジの `optionsJson` に残る Merge Config は priority 設定へ
  読み替える（no-backcompat で捨ててもよいが、base 指定だけは priority に移すと親切）。
- `mergeProbeIntoSnapshot`（probe = 1ノード再スキャンを前回スナップショットへ畳む、
  現 PR で追加）は **write-time マージ**。新モデルでも「probe も network-scan ソースの
  寄与の更新」として整合する（snapshot を完全形に保つための実装詳細）。read-time の
  resolve とは役割が違うので残してよい。ただしコメントで「これは1ソース内のスナップ
  ショット更新であって、ソース間マージではない」と明記する。
- `mergeMetricsData`（メトリクス集約）はグラフと別ドメイン。今回の対象外。ただし
  「ソース優先度」概念がグラフと二重定義にならないよう、将来は priority を共有したい
  （v1 では触らない、メモのみ）。

## 6. データモデルへの変更（最小）

- `resolve(contributions: Contribution[])` に作り替え。現行の
  `resolve(authored, snapshots)` は「authored = priority 最上位の contribution」に
  正規化する薄いアダプタにして後方互換を保つ（呼び出し側の一括書き換えを避ける）。
- `foldNodeCluster` / `foldPortCluster` の「`authored ?? members[0]`」「最初に値を持つ
  メンバ」を、**priority desc, capturedAt desc でのフィールド単位勝者選択**に置換。
- `topology_data_sources.priority` を `parseTopology` → contributions に伝播。Manual は
  最上位。
- 型 `Attachment`(access/policy) や `exclusions`、Hide、Reset の UI 経路は概ね維持。
  「authored だけ特別」分岐が priority 一般化で消えるぶん、むしろ単純化する。

## 7. 既存ドキュメントとの関係

- **`topology-foundation-resolve.md`**: 「authored を核に observed を畳む」骨子を、
  「全寄与を priority でフィールドマージ」に更新。identity clustering / provenance /
  retraction の記述は流用。→ 本ドキュメントが該当箇所を supersede。
- **`topology-foundation-source-attachment.md §6`**: `fieldAuthority` 採用判断を
  「v1 は単一 priority、fieldAuthority は将来拡張」に更新（§3）。それ以外（attach の
  ライフサイクル、hosts capability の identity 寄与、UX）は有効。
- **`topology-node-attachments.md`**: overlay モデルの記述を「人 = 最優先ソース」に
  読み替え。facts attachment 未実装の注記はそのまま。

## 8. 移行と現 PR(#332)の扱い

現 PR は「overlay モデル上での UI / 機能（Access・policy・Hide・Reset・Rescan・
Rebuild・Sync-all）」を積んでおり、**動作している**。本設計（全ソース同列 + priority
へのコア作り替え）は **データモデルの手術**で別物。

判断：**現 PR はこの設計の前段として閉じる**（overlay UI と Hide/Reset/Rebuild は
priority モデルでもそのまま活きる）。priority 一本化 + merge.ts 撤去は**次 PR**で
コアから着手する。理由：現 PR を膨らませると再び迷走する。本 doc を「次の大仕事」の
基点として残す。

> 補足：現 PR の `resolve` は既に「authored = 最優先」で実質 priority モデルの特殊形に
> なっているため、次 PR はゼロからではなく「特別分岐の一般化 + priority 配線 +
> Merge Config の resolve への引き継ぎ（その後 merge.ts 撤去）」という差分作業になる。
