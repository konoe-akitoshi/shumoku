# Topology Foundation: Entity Registry — 安定エンティティIDと参照の永続化

> **ステータス**: **実装済み・prod 稼働**（server 0.1.4-beta.3 以降、照合強化・型ブランドは beta.4/5）。
> 実装の現在地は §3（フェーズ表・PR 付き）と §5（実装で確定/追加した設計）を参照。
> §0-2 は当初設計の記録として保存 — 実装は概ね忠実で、差分は §5 に明記。
> 前提: [topology-foundation-identity.md](./topology-foundation-identity.md)（identity キーと correlation 規則）、
> [topology-composition-store.md](./topology-composition-store.md)（contribution store / attachment 機構）。

## 0. 動機 — mapping 消失バグが暴いた構造問題

link mapping を auto-map → save → reload すると 0 件になるバグの根本原因は、
「保存の錨（port identity）をソースが出していない → サーバが**無言で** skip →
UI は 200 を見て保存成功と表示」だった。だがこれは氷山の一角で、掘ると構造問題が 3 つある:

1. **要素 ID が不安定**。resolved graph の `link.id` は `link-${index}`（連番）。
   React で index を key にするなと言われるのと同じアンチパターンで、
   これを永続データのキーにできない。node.id はソース local id 由来で semi-stable
   だが、リネームや「どのソースが勝つか」で変わる。
2. **identity 照合が保存ポイントごとに分散**している。metrics-binding の anchor 変換
   （`buildNodeBindingDesired` / `buildLinkBindingDesired`）は保存のたびに identity を
   引き直し、前提が欠けると skip する。将来「要素に何かを紐付ける」機能を作るたびに
   同じ照合機械を再実装することになり、同じバグを再生産する。
3. **ズレが不可視**。anchor できない mapping は console.warn だけで捨てられる。
   成熟した同種システム（Terraform の drift、CMDB の reconciliation）は
   ズレを必ず可視化する。

## 1. 先行事例と採用パターン

| システム | パターン |
|---|---|
| ServiceNow CMDB (IRE) | 識別ルール（優先順位つき指紋照合）→ **システム発番の恒久 ID (sys_id)** |
| New Relic / Datadog | entity GUID = 識別属性の決定的ハッシュ（識別属性を型ごとに固定できる前提） |
| Kubernetes | `name`（論理実体・再作成を跨ぐ）と `uid`（化身ごと）の使い分け |
| Terraform | 論理アドレス → 実リソースの対応表を 1 箇所（state）で管理、drift は必ず可視化 |
| MDM / 名寄せ | golden record にマスタ ID、統合(merge)はエイリアスとして一級操作 |

共通原則: **(a) 照合は 1 箇所に集約、(b) 参照は安定 ID の単純キー、(c) ズレは可視化**。

純粋な決定的ハッシュ ID（New Relic 型）は「証拠の増加で ID が変わる」
（sysName しか無かったノードに後から mgmtIp が観測されると最強キーが変わる）
問題があり、異種ソース混在のネットワーク発見には不安定。
エイリアス表が結局必要になるので、最初から **レジストリ型（adopt-or-mint）** を採る。

## 2. 設計

### 2.1 Entity Registry

```sql
CREATE TABLE entity_registry (
  id            TEXT PRIMARY KEY,   -- ULID（発番）
  topology_id   TEXT NOT NULL,
  kind          TEXT NOT NULL,      -- 'node' | 'port' | 'link'
  parent_id     TEXT,               -- port → 親 node entity id
  status        TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'retired'
  first_seen_at INTEGER NOT NULL,
  last_seen_at  INTEGER NOT NULL,
  retired_at    INTEGER
);

CREATE TABLE entity_identity_key (
  topology_id TEXT NOT NULL,
  entity_id   TEXT NOT NULL REFERENCES entity_registry(id),
  kind        TEXT NOT NULL,
  parent_id   TEXT,                 -- port キーは親スコープで一意
  key         TEXT NOT NULL,        -- 'chassisId'|'mgmtIp'|'sysName'|'ifName'|'mac'|'vendor:netbox-device-id'|'manual:<srcId>'
  value       TEXT NOT NULL,        -- 正規化済み
  UNIQUE (topology_id, kind, parent_id, key, value)
);

CREATE TABLE entity_alias (
  old_id TEXT PRIMARY KEY,          -- merge で吸収された側
  new_id TEXT NOT NULL              -- 生き残り
);
```

- identity キーの優先順位・正規化は identity ドキュメント §2.3 / §3 に従う
  （node: chassisId > mgmtIp > sysName、port: ifName > mac > ifIndex）。
- link の identity は端点 port entity の正準ペア `sort(portA, portB)`。
  端点が安定なら link は自動的に安定する（独自キー不要）。
- Manual 要素は editor 発番 id が既に永続なので `manual:<sourceId>` キーで登録する。

### 2.2 adopt-or-mint — 照合の唯一の実行点

**sync のイングスト時**（observations 書き込み後、derive の前）に実行する:

1. 観測を identity でクラスタリング（既存 resolve の fold ロジック）。
2. 各クラスタをレジストリと照合（identity キー lookup、優先順位つき）。
   - 一致 → **adopt**: 既存 entity id を引き継ぎ、`last_seen_at` 更新、
     新出の identity キーを union（証拠の増加に ID が耐える）。
   - 不一致 → **mint**: ULID 発番 + キー登録。
   - 1 クラスタが複数 entity に一致 → **merge**: 最古を残し、他を alias 化。
     参照は alias 経由で自動追従。
3. N 回連続 sync で観測されなかった entity は **retire**（削除しない）。
   retired entity への参照は「孤児」として API から可視化する。

resolve（derive worker）はレジストリを**読むだけ**の純関数のままにする。
レジストリが変わったら `composition_revision` を bump してキャッシュを無効化する。

### 2.3 参照はすべて entity id の単純な行

mapping / override / suppressedAttachments / share projection は
entity id をキーとする普通の行になる。
identity 照合機械（`buildLinkBindingDesired` 等の anchor 変換）は**解体**する。
保存は常に成功し、対象が消えた時に**孤児として見える**
（「3 件の mapping が retire された要素を指しています。再割当てしますか？」）。

### 2.4 白紙化（Rebuild）との整合

Rebuild は**観測データ（derived）を消す**操作であり、
人間の層（overlay / attachment / **registry**）は残る。
再 sync で同じ機材が観測されれば adopt により**同じ entity id が再登場**する
——「再実装時に全く同じなら同じ ID」がレジストリ経由で成立する。
レジストリごと消す「完全初期化」は別の明示操作として提供する。

### 2.5 ID の露出

最終形では resolved graph の `node.id` / `port.id` / `link.id` が entity id になる
（表示名は label が担う。K8s の name/uid 分離と同型）。
移行期は既存 id を保ったまま `entityId` フィールドを追加で載せ、
参照系を entity id に移し終えてから id を差し替える（Phase 3）。

## 3. 実装フェーズ（全て出荷済み）

| Phase | 内容 | PR | 状態 |
|---|---|---|---|
| **0** | 止血: ポートスタブに `identity.ifName` 刻印 + `updateMapping` の skip 可視化 | #553 | ✅ |
| **1** | レジストリ本体: migration 025 + adopt-or-mint（ingest 時、**post-ingest 契約の読み戻し**）+ `entityId` 露出 | #558 | ✅ |
| **2** | 参照の移し替え: `metrics_mapping` 行（migration 026）、anchor 変換機械の解体、起動時 backfill、孤児可視化 API | #560 | ✅ |
| **3** | ID の反転: node/link id = entity id（**port id は名前を維持** — §5.2）。RESOLVER_VERSION 20 | #563 | ✅ |
| **4** | ライフサイクル: retire counter（migration 027）、孤児 reassign/discard + UI、registry reset | #565 | ✅ |
| 監査 Fix | PK に source_id（migration 028）/ partial ガード / skip 計上 / 曖昧 fallback 孤児化 | #567 | ✅ |
| 照合強化 | 段階照合・強キー拒否権・単値キー置換（migration 029）・merge ガード | #573 | ✅ |
| 仕上げ | EntityId 型ブランド / 射影簡約 / 複数ソース addressing / 契約ガード | #576-578, #572 | ✅ |

## 4. Open questions → 解決済み

当初の open questions は全て実装で確定した:

- **retire の N** = 3（`RETIRE_THRESHOLD_SYNCS`）。fetch 失敗（`status='failed'`）と
  **partial スキャン**は retire カウントに入れない（#567 — partial は「不在の証明」にならない）。
- **ifName リネーム** → mac/ifIndex の補助キーで拾えなければ孤児化し、mapping ページの
  「Orphaned mappings」から再割当て/破棄（実装どおり）。
- **値の正規化** = `normalizeKeyValue`（entity-registry.ts）: mgmtIp/mac/sysName は
  trim+lowercase、chassisId/ifName/vendor:* は trim のみ。書き手は registry の1箇所。
- **マルチトポロジ** = topology_id スコープ維持（意識的な限界 — §6）。

## 5. 実装で確定・追加した設計（当初設計との差分）

### 5.1 照合は段階式 + 拒否権（#570/#573 — 当初のフラット OR を置換）
- キー階級: node は STRONG（chassisId / vendor:* / manual:*）> MUTABLE（mgmtIp / sysName）、
  port は ifName / manual:* > mac > ifIndex（ifName・mac が無いときのみ収集）。
- 階級を降順に照合し、最初に候補が出た階級で停止。**強キー拒否権**: 候補と観測が同じ
  STRONG 名前空間で異なる値を持てば別機材として除外。**相互整合**: MUTABLE 階級では
  両側に sysName があれば一致必須（IP 再利用ガード）。mgmtIp の食い違いは拒否でなく置換で扱う。
- **単値キーのソース別置換**: 同一ソースが mgmtIp/sysName（port は ifIndex）の別値を報告
  したら旧行を削除して置換（stale-IP の磁石を殺す）。`entity_identity_key.source_id`
  （migration 029）がこの帰属を持つ。
- **merge ガード**: 自動 merge は「全候補が STRONG キーを共有」or「≥2 階級一致」のみ。
  弱キー1本の複数一致は最良候補に adopt + `[Registry] ambiguous match` 警告（merge-review の証跡）。

### 5.2 ID 露出の非対称（意図的）
node.id / link.id は entity id（ULID）だが、**port.id はインタフェース名のまま**
（+ `entityId` フィールド併存）。port id は Phase 0 の ifName 刻印・Zabbix 照合・mapping の
interface フォールバックが「port id = ifName」を前提にする意味論的な名前であり、
ULID 化すると壊れる。K8s の name/uid 分離と同型。

### 5.3 registration は post-ingest 契約の読み戻し（構造的に強制）
`adoptOrMintForGraph` は graph 引数を持たない — `buildGraph()` で ingest 済み契約を読み戻す。
NetBox 型ソースは raw graph に ports[] を持たず（リンク端点文字列からスタブ合成）、
raw graph を渡す実装はポート/リンク entity を全滅させる（実際に起きた）。
引数を無くすことで呼び出し側が壊せない形にした。

### 5.4 mapping のトリガ意味論（二層無効化）
mapping は「行の上の読み出し時導出データ」— 編集は RAM 投影キャッシュの無効化のみで
composition_revision を **bump しない**（多分レイアウトの再bakeを誘発しないため。保存は ~12ms）。
identity/構成の変化（ingest・registry reset）だけが revision bump → 再bake。
share 閲覧者へは in-memory `mappingVersion` を SSE で流して補完（#572）。
保存後の反映は poll scheduler への poke で即時化。

### 5.5 型ブランド（#576）
`EntityId = string & brand`。`asEntityId` は信頼境界（mint 1・DB 読み 4・HTTP 2）のみ。
ロジック途中でキャストしたくなったら署名が間違い、が規律。

### 5.6 プラグイン契約の強制（#572）
topology を emit するプラグインは node に ≥1 identity キー、port に ifName（または
port id = インタフェース名の慣習）を出すこと — `validateTopologyIdentityContract`
（core plugin-kit）を各プラグインのテストに組み込んで強制。HostsCapable の interface 項目は
`HostItem.interfaceName` を populate すること。

## 6. 意識的に受け入れた限界（再訪トリガー付き）

| 限界 | 再訪トリガー |
|---|---|
| per-topology entity スコープ（同一機材が複数トポロジで別 entity） | CMDB 級の横断在庫・クロストポロジ検索 |
| 単一プロセス前提（registry/scheduler/metrics-hub の in-memory 状態） | マルチインスタンス/HA 展開 |
| retired entity の GC なし | churn の激しい長期運用環境 |
| merge-review は警告ログのみ（UI なし） | ambiguous-match 警告が実運用で頻出したら |
| mapping 編集の RMW 楽観ロックなし（後勝ち） | 複数オペレータ運用（#569 残項目） |
