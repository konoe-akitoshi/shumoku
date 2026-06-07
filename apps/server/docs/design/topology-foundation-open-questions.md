# Topology Foundation: 残る open questions

> ステータス: 議論中。ドキュメント群を書き終えた時点で、まだ user 決定が必要に
> なる論点を集約。各項目に**推奨案つき**。

便宜上、緊急度を3段階に分類：

- **🔴 必須**: v1 着手前に決定しないと方向性に影響
- **🟡 重要**: v1 中盤までに決めればよい
- **🟢 将来**: v2 以降の議論

## 🔴 必須

### Q1. メトリクスは v1 で persist するか  ✅ **回答済**: (a) v1 は realtime push のみ、persist は v2

User の感覚「更新情報やメトリクス情報はログとして残る」を真面目に受けると TSDB が要る。
v1 でどこまでやる？

**選択肢**:
- (a) **v1 は realtime push のみ**、persist は v2（推奨）
- (b) v1 から内蔵 SQLite TSDB を作る（`topology-foundation-metrics.md § 2.1` の設計）
- (c) v1 から外部 Prometheus 連携（運用者に Prometheus を強いる）

**推奨**: (a)。MVP の検証は観測モデルが動くことであり、TSDB は独立に積める。
ただし `metrics_samples` テーブルだけ migration で先に切っておくのは安価。

### Q2. MVP スライスのスコープ妥当性  ✅ **回答済**: catalog 統合 (sysObjectID → model 引き) も v1 に含める → `topology-foundation-mvp.md § 2.4` 追加済

`topology-foundation-mvp.md` で定義した v1 スコープ：

- ✅ authored 1 + SNMP-LLDP autoscan 1 で 4 state 表示
- ❌ catalog / 未知デバイス対応
- ❌ Workload 層 (Proxmox/k8s)
- ❌ shumoku-probe
- ❌ Conflict 解決操作の永続化

これで「土台が動いた」と言えるか、別スコープを望むか。

**推奨**: このスコープのまま。広げると検証が遅れる。

### Q3. conflict 解決操作の v1 スコープ  ✅ **回答済**: (a) v1 は表示のみ、操作 UI は v2

`topology-foundation.md` の Element inspector ワイヤフレームに `[Use SNMP] [Use NetBox]`
等のボタンを書いたが、v1 でこれをどこまで実装するか。

**選択肢**:
- (a) **v1 は conflict の「表示のみ」、操作ボタンは v2**（推奨）
- (b) ボタンは出すが、押すと「該当ソースを再 sync」するだけ（永続的な「Use X 決定」は無し）
- (c) sticky-decision テーブルを作って永続化

**推奨**: (a)。永続化メカニズム（sticky-decision）は設計が深く、MVP の検証外。

### Q4. v1 で editor をどう扱うか  ✅ **回答済**: (a) v1 は editor 改修ゼロ

editor (neted) は人の編集（project overlay / 手描きソース）の編集器だが、observation モデルとの接点をどこまで持たせるか。

**選択肢**:
- (a) **v1 は editor 改修ゼロ**。editor は NetworkGraph をそのまま編集（provenance は無視）（推奨）
- (b) editor で identity bind 操作を提供
- (c) editor で conflict / discovered-only を視覚化

**推奨**: (a)。editor の改修は v2 以降。identity bind は server Web UI 側で先に提供。

## 🟡 重要

### Q5. Bootstrap matching の自動化レベル

initial matching で高 confidence な match（>90%）を自動適用するか、常に user 確認を求めるか。

**選択肢**:
- (a) **常に user 確認**（false match を避ける）
- (b) 高 confidence は自動、低 confidence のみ確認（推奨）
- (c) ユーザ設定（per-source）

**推奨**: (b)。100 台観測で全部確認は非現実的。閾値は厳しめ（>90%）で false 0 を目指す。

### Q6. PR 分割戦略

`topology-foundation-mvp.md § 7` で 8 PR に分割案を提示：

1. design docs (PR #289 進行中)
2. core 型 + resolve スケルトン
3. DB migration + observation サービス
4. SNMP-LLDP プラグイン
5. netbox plugin v2
6. resolve.ts 本実装
7. API/WS 拡張
8. Web UI

これで進めるか、別の切り方を望むか。

**推奨**: この分割。各 PR が独立にレビュー可能、stack のしやすさ。

### Q7. SNMP プラグインの実装手段（Bun 互換性）

Bun で SNMP を扱う決定打が無い。

**選択肢**:
- (a) `net-snmp` npm を Bun で動かす（先にスパイク）
- (b) 自前で SNMP 最小実装（System / IF / LLDP / IP MIB だけ）
- (c) 外部 Python/Go daemon を spawn して JSON-RPC

**推奨**: (a) をまずスパイクで試し、ダメなら (c)。(b) は MVP には重すぎる。

### Q8. v1 で catalog 統合はどこまで  ✅ **回答済**（Q2 で）: sysObjectID → vendor/model 同梱辞書まで v1。capability 宣言は v2

`topology-foundation.md § 2.4` のカタログ駆動探索は v2 棚上げにしたが、
sysObjectID による識別は v1 でも要る。

**選択肢**:
- (a) **v1 は sysObjectID を identity に入れるだけ。カタログ参照はしない**（推奨）
- (b) v1 で sysObjectID → ベンダー名の同梱辞書のみ
- (c) v1 で catalog の discovery 宣言まで実装

**推奨**: (a)。識別は十分に取れる範囲で。capability hint は v2。

## 🟢 将来（v2 以降）

### Q9. field authority テーブルの完全版設計

`topology-foundation-resolve.md § 3.4` の field authority。v1 は hardcode 3-4 field。
v2 で網羅 + 設定可能化する際、どの粒度で：

- field 名 × source パターン
- field クラス × source 種別
- ユーザ override 可能

→ v1 完了後の知見を見て v2 設計。

### Q10. realtime WS プロトコル詳細

構造変化（element-added / retracted / state-changed）の WS メッセージ形式。
delta フォーマットの最適化、subscribe フィルタ。

→ 実装時の細かな決定。

### Q11. observation lineage / 時間遡行 UI

`topology_observations` を全保持すれば lineage 機能が無料で付くが、容量と UX 設計が
要る。

→ v2 検討。

### Q12. shumoku-probe（ステートレス中継）の最小仕様

到達不能セグメント向け中継。Prometheus snmp_exporter 型。

→ v2。

## ドキュメント間の整合性確認

これらの open question は以下を相互参照：

- Q1 ↔ `topology-foundation-metrics.md`
- Q2, Q6, Q7 ↔ `topology-foundation-mvp.md`
- Q3 ↔ `topology-foundation.md § 4.3 ②` + `topology-foundation-resolve.md § 11`
- Q4 ↔ `topology-foundation-identity.md § 6`
- Q5 ↔ `topology-foundation-identity.md § 6`
- Q8 ↔ `topology-foundation.md § 2.4`

## 設計のうち user 決定を待たず私が前提化した項目

これらは「分かれ目だが、推奨案で進めれば後で修正可能」と判断したもの：

| 項目 | 前提した方向 |
|---|---|
| retention 既定（snapshots 10件 / metrics 7日生） | 数値はチューニング可能、構造の問題ではない |
| Subgraph に identity を持たせない | k8s namespace 等で必要になれば追加 |
| `priority` / legacy 列を v1 で削除 | no-backcompat 前提通り |
| `autoscan` を別 capability | topology と独立して扱えるほうが UI/UX が綺麗 |
| identity quality 表示は node/port 両方 | 計算は安価、両方出して困らない |
| watchTopology() 廃止 | 観測モデルは server 側で snapshot 比較 |
</content>
