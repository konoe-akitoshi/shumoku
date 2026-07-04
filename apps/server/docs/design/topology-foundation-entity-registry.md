# Topology Foundation: Entity Registry — 安定エンティティIDと参照の永続化

> **ステータス**: 設計確定・実装フェーズ分割済み。
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

## 3. 実装フェーズ

| Phase | 内容 | 規模 |
|---|---|---|
| **0** | 即効の止血: (a) contribution store のポートスタブ合成に `identity.ifName` を刻む（`ensurePortElement`）。(b) `updateMapping` が skip 数を返し、UI が警告表示（無言で捨てない） | 小 |
| **1** | レジストリ本体: migration + adopt-or-mint（ingest 時）+ resolved graph に `entityId` を露出 + registry 変更で revision bump | 中 |
| **2** | 参照の移し替え: mapping を entity id キーの行に再実装、既存 metrics-binding を移行、anchor 変換機械を解体、孤児可視化 API | 中 |
| **3** | ID の反転: resolved graph の id = entity id に。share projection / override / suppression の参照移行。RESOLVER_VERSION bump | 大 |
| **4** | ライフサイクル UX: retire/孤児の UI、merge レビュー UI | 中 |

Phase 0 は現行の binding 機構のまま bug を直す（port が ifName を持てば anchor が成立する）。
Phase 2 完了時点で Phase 0 の binding 経路は不要になるが、止血を先に出す価値がある。

## 4. Open questions

- retire 判定の N（連続未観測回数）はいくつか。source ごとの fetch 失敗と
  「本当に居ない」の区別（fetch 失敗 sync は retire カウントに入れない、が有力）。
- ifName リネーム（インタフェース名変更）は port entity の追跡不能ケース。
  mac / ifIndex の補助キーで拾えなければ孤児化 → UI 再割当てに倒す。
- entity_identity_key の値正規化（大文字小文字・ドメインサフィックス）の仕様化。
- マルチトポロジで同一機材（同じ機材が複数トポロジに登場）は
  topology_id スコープで別 entity とする（現状の設計を維持）。
