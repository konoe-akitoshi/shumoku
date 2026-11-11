# Device access（機器の直接読み取り）

SNMP で機器を直接読む機能（旧 deep-read / Discovery / autoscan）の設定と画面を整理したメモ。
利用者向けの説明は `topologies.ja.mdx`。

## 設計の要点

**人が機器に認証情報を割り当てる、のをやめた。** どの community が通るかは機器に聞けば決まる
事実なので、人に何百回も選ばせない。認証情報を登録して「読み取る」を押すと、認証情報を持たない
機器に Shumoku が各認証情報を1回ずつ試し、応答したものをその機器の行に書く
（OpenNMS の `snmp-fit -s` / Netdisco と同じ「試して、効いたものを機器ごとに覚える」）。
一覧は入力表ではなく結果表で、人が触るのは例外の数台だけ。

**認証情報はサーバー全体（`credential`）。** community はネットワークの事実であって、1枚の図の
属性ではない。図ごとに持たせると同じ community を図の数だけ入れ、ローテーションも図の数だけ
要る。一方で、1台のサーバーが別々のネットワーク（顧客・会場）を持つことがあり、ある拠点の
community を別の拠点の機器に撒いてはいけない。そこで **保存はサーバー全体、試すのは
`topology_credential` で明示的に結んだトポロジーだけ** にした。

- 同じネットワークを複数の図で見せる: 認証情報は1つ、複数のトポロジーに結ぶ。ローテーションは1回。
- 別々のネットワーク: 認証情報ごとに結ぶ先を分ける。結んでいないトポロジーでは試されず、
  機器への割り当ても拒否される（404）。
- 概念は3つ: 認証情報、読み取り（唯一の動詞）、機器の状態（導出）。
- 機器ごとの明示状態（`device_access` の行）が唯一の真実。継承・トポロジー既定・試す順の保存は
  持たない。試行は `credential_id` を行に書く操作で、計算され続ける所属ではない。
- 試す順は保存せず、そのトポロジーでの使用台数の多い順（同数なら名前順）。同じ community を共有
  する大多数の機器は1回の問い合わせで済む。
- 取得方法（method）はデータ。`services/access-methods.ts` が id・label・fields を持つ。
  UI はその fields からフォームを描く。`secret: true` の項目は API が返さず、`secret_json` に
  分けて保存する（一覧は `secret_json` を読まない。設定済みかどうかは SQL の中で判定する）。
- 読み取りは人の操作でのみ（`POST /topologies/:id/devices/read`）。Sync・定期実行は SNMP を送らない。
  試行は実機に問い合わせを送るので、`dryRun` で件数を先に返し、UI が確認を取ってから実行する。
  送りたくない機器は `enabled = 0`（対象外）にする。
- 旧 `mode`（auto / observe / disabled）と機器ごとの `intervalMs` は廃止（効いていたのは
  `disabled` だけだったので `enabled` に畳んだ）。

## テーブル（migration 037 の1本）

- `credential(id 'cr_…', name UNIQUE, method, params_json, secret_json, secret_changed_at,
  created_at, updated_at)` — `params_json` は秘密でない項目、`secret_json` は秘密の項目だけ。
- `topology_credential(topology_id, credential_id, added_at)` — PK は両方。どちらの削除も CASCADE。
- `device_access(entity_id PK → entity_registry, topology_id, credential_id → credential
  ON DELETE SET NULL, enabled, last_read_at, last_status, last_error, tried_at, assigned_by)`
  - `assigned_by`: `'probe'`（試行で見つけた）/ NULL（人が選んだ）。監査用。
  - 人が credential を選ぶ（外す）と `assigned_by` と `tried_at` は初期化される。
- 旧 `deep_read_config` は 037 で移行して削除。distinct な community ごとに1 credential
  （名前は `SNMP 1`…、秘密を名前に入れない）を作り、それを使っていたすべてのトポロジーに結ぶ。
  `disabled` の行は `enabled = 0` で残る。

## 再試行の時計（トポロジーごとに導出）

```
clock = max( 結んだ credential の secret_changed_at の最大, topology_credential.added_at の最大 )   // なければ 0
```

- `secret_changed_at` は作成と、パラメータ／秘密の **値** の変更で動く。名前の変更では動かない。
- `added_at` は結びを **追加** したときに動く。結びを外しても時計は動かない（外した先の機器は割り当てが
  外れ、導出で `unconfirmed` に戻る）。
- 認証情報なしの機器は `tried_at >= clock` なら `silent`、そうでなければ `unconfirmed`。

## 状態は保存せず導出する

| state | 条件 |
|---|---|
| `disabled` | `enabled = 0`（最優先） |
| `no-address` | mgmtIp がない |
| `lost` | credential あり、`last_status = failed` — 本当の例外 |
| `partial` | credential あり、`last_status = partial` |
| `ok` | credential あり、`last_status = ok` |
| `pending` | credential あり、まだ読んでいない |
| `silent` | credential なし、`tried_at >= clock` — 全部試して応答なし |
| `unconfirmed` | credential なし、上記以外（新規機器、または認証情報の追加・変更後） |

## 試行（`discovery/credential-trial.ts`）

- 1台1認証情報につき SNMP GET を1発（sysObjectID.0）、timeout 800ms、再送0。
  応答がなければ次へ。最初に応えたものを採る。
- 機器間は並行（上限16）。応答なしの機器が多くても、直列読み取りのように時間が掛からない。
- 誤った community と無応答の機器は SNMP v2c では区別できない。試行は両者を「応答なし」として扱う。
- 本読み取り（`deepReadDevices`）も並行化（上限8）。結果は与えた順に畳むので、応答順に依存しない。
- 人が指定した1台（`entityIds`）は、過去に `silent` でも試す。広い読み取りは再試行しない。
- 試す対象は2種類:
  1. 認証情報のない、有効で、アドレスのある機器（`silent` は `force` でなければ除く）。
  2. **lost retry**: 認証情報はあるが `last_status = failed` で `last_read_at < clock`、かつ
     そのトポロジーに **他の** 結んだ認証情報が1つ以上ある機器。今の認証情報を除いて試し、
     応答したものに付け替える（`assigned_by = 'probe'`）。どれも応答しなければ機器の行は
     触らない（`tried_at` を付けず、認証情報も外さない）。
- 計画（`dryRun`）は `toTry`・`credentials`・`retryLost`・`requests`
  （= `toTry × credentials + retryLost × (credentials − 1)`、上限）・`toRead` を返す。

## 権限

認証情報は秘密なので管理者の面（`/api/credentials*` は `admin:manage`。`/api/datasources` や
`/api/settings` と同じ扱い）。作成・編集・削除・応答確認（`POST /credentials/test`）は管理者だけ。
機器への割り当て・有効／無効・読み取りは `workspace:write`（ユーザー）。ユーザーとビューアは
`GET /topologies/:id/devices` で、**そのトポロジーが結んでいる** 認証情報の名前と使用状況だけを
見る。他のトポロジーの認証情報も、秘密も見えない。API は秘密を返さない（`secretsSet` のみ）。

## 応答確認（`POST /credentials/test`）

保存済みの何も送らず、書き込まない。`topologyId` の機器から最大10台
（`entityIds` があればそれ、なければその認証情報を使っている機器、次に認証情報のない機器を、
決定的な順に /24 ごとのラウンドロビンで）に1回ずつ問い合わせて `sent / answered / silent` を返す。
秘密は `params` にあればそれ、なければ `credentialId` の保存値。

## 既知の制約・まだやっていないこと

- 秘密は `secret_json` に平文で保存している（保存時暗号化は未対応。列は分けてあるので後から
  差し替えられる）。
- 同じ機器が複数のトポロジーに入っていると、トポロジーごとに別々に試行・読み取りする。問い合わせは
  重複するが、許容する（トポロジー横断の機器同一視はしない）。
- 試行は誤った community を機器に送る。機器側に authenticationFailure の trap やログが残り、
  IDS に sweep と見られ得る（一般知識で、実機では未確認）。だから確認を取る。
- 組み込みソース `deep-read` の実体（`data_sources` / `topology_data_sources` の偽の行、
  Sources 一覧 API での除外、優先度 100 固定）は残っている。source id を `snmp` に変えるには
  contribution 系テーブルの source_id 移行が要る。
- Sync 後に自動で読む（トポロジー単位の opt-in）、LLDP の管理アドレス（lldpRemManAddr）から
  隣接を辿る、SNMPv3、SNMP 以外の method（SSH / HTTP API）。
