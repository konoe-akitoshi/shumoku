# Shumoku — 伝え方

Shumoku を外に向けて紹介するときの正本。website、README、スライド、フライヤー、ポスター、
イベントの告知文は、ここにある言葉と決まりを使う。媒体ごとに決め直さない。

- なぜそう考えるかは [PHILOSOPHY.md](PHILOSOPHY.md)、名前とロゴの由来は [ORIGIN.md](ORIGIN.md) にある。
  ここではそれらを繰り返さず、外に出す言葉だけを決める。
- 第三者が名前とロゴを使うときの決まりは [TRADEMARK.md](../TRADEMARK.md)。この文書とは別のもの。
- 日本語が正本。英語は日本語に合わせる。
- ここを変えたら、下の「参照している媒体」を次に作り直すときに合わせる。

## 見出し

| | 日本語 | 英語 |
| --- | --- | --- |
| 肩書き | ネットワーク構成図ソフトウェア | Network diagram software |
| 見出し | ネットワークにも、地図を。 | Networks need maps, too. |
| 約束 | 配線を変えても、集め直せば図が追いつきます。 | Network diagrams that don't drift away from reality. |

- 見出しは差し出す言い方にする。撞木釘は「静かに支える」もの、羽は「主張するためではない」ものだから。
  「ネットワークにも、地図が必要だ。」は理由を述べる文として PHILOSOPHY の中で使い、見出しには使わない。
- 相手に合わせるときは「〜にも、地図を。」の形で言い換える（例: 「IP 化した設備にも、地図を。」）。
- 英語は一般の事実として複数形で言う。"Your network…" の呼びかけは使わない。
- "Defined as data" は方法の説明なので、見出しにしない。「構成をデータで扱う」の説明の中で使う。

## 紹介文

**一文**

> Shumoku（しゅもく）は、機器から集めた接続情報でネットワーク構成図を作る、オープンソースのソフトウェアです。
>
> Shumoku is open-source software that draws network diagrams from the connection data your devices report.

**三文**

> 手で描いた構成図は、機器や配線が変わるたびに直す必要があり、やがて実際の構成と合わなくなります。
> Shumoku は、機器や管理台帳のデータから構成図を作り、監視システムの通信量とアラートをその図に重ねます。
> 構成が変わっても、データを取り直せば図も更新されます。
>
> Hand-drawn diagrams need fixing after every change, and eventually stop matching the network.
> Shumoku draws the diagram from your devices and inventory, then overlays traffic and alerts from your monitoring.
> When the network changes, collect the data again and the diagram follows.

## Shumoku がすること

順番は変えない。構成図を作るソフトウェアで、状態を重ねるのは三つ目の手順。

| | すること | 例 |
| --- | --- | --- |
| 集める / Collect | 機器や管理台帳から、接続情報を集めます。 | SNMP・LLDP、NetBox、YAML |
| 構成図にする / Draw | 機器の配置と配線を自動で決めて、構成図を作ります。 | ブラウザー、SVG、PNG |
| 状態を重ねる / Overlay | 監視システムの通信量とアラートを、図に重ねます。 | Zabbix、Prometheus、Grafana |

- 手順は役割で書き（機器、管理台帳、監視システム）、製品名は「例」として分ける。
- 例に名前のないシステムについては「プラグインを追加すればつなげられます」と添える。
- 対応するプラグインの一覧は `libs/plugins/` が正本。媒体に全部を並べるときはそこを見る。

**図で分かること**: ポートと接続先まで分かる／異常の場所が分かる／通信量が線で分かる。

**こんなときに**

- 構成図が古く、いまの構成と合っていない
- 全体の構成を、担当者しか把握していない
- 監視の画面が、ツールごとに分かれている
- 障害のとき、影響する範囲を追いにくい

## しないこと

- NetBox や監視ツールの代わりにはならない。構成情報や監視値を自分では集めず、それらが持つ情報を図にする。
- 測っていないものを測っているように書かない（例: 映像の品質、時刻同期）。
- できること、改善中のこと、今後のことを混ぜない。「できます」「改善しています」「目指しています」を使い分ける。

## 利用例

「どんな現場か → 名前 → 何に使ったか」の順で書く。名前やロゴだけを並べない。

| 現場 | 名前 | 何に使ったか |
| --- | --- | --- |
| イベント会場のネットワーク | JANOG57・JANOG58 NOC | 会場ネットワークの運用チームが、通信量を重ねた構成図で監視。 |
| 大学のキャンパスネットワーク | 電気通信大学 情報基盤センター | Zabbix と連携して、リンクの通信量を構成図に表示。 |
| 離れた拠点をつなぐ映像設備 | INTER BEE MoIP | Inter BEE 2026 の企画展示で、国内 4 拠点の設備を 1 枚の図に表示。 |

- 名前とロゴは、媒体ごとに掲載の可否を確かめる。website で載せていても、印刷物は別に確認する。
- 主催者のロゴが入った画面は、主催者の関与に見えかねない場面では使わない。
- 実在の環境の機器名、IP アドレス、接続設定は出さない。画面はサンプルか、公開の許可を得たものを使う。

## 名前と名義

| 名前 | 指すもの |
| --- | --- |
| Shumoku | ソフトウェア全体。初出では「Shumoku（しゅもく）」と読みを添える |
| Shumoku Server / Editor / CLI | それぞれのアプリ |
| Shumoku Project | 開発と発行の主体。配布物の発行者名、技術方針とリリースの判断はこの名前 |
| Shumoku Community | Meetup や出展など、人の集まり。発行者名には使わない |

- 商用サポートのパートナー（輝日株式会社 / TelHi Corporation）は「商用サポートパートナー」と書く。
  「公式」「独占」「総代理店」とは書かない。非独占で、技術方針とリリースは Shumoku Project が決める。
- 汎用の配布物の相談窓口は contact@shumoku.dev にする。パートナーの名前は、そのパートナーが出展・配布する
  ものにだけ載せる。
- ライセンスは「AGPL-3.0（オープンソース・無料）」。有償なのは支援の作業で、ソフトウェアではない。

## しるし

- **羽**が正式なロゴ。製品、website、文書、配布物のロゴの位置に使う。色と形を変えない。
- **シュモクザメ**は親しみのための挿絵。頭の形が撞木に似ていることから付いた名前で、由来とつながっている。
  印刷物、ステッカー、Meetup、コミュニティのページに使う。製品の画面と website の Hero には置かない。

## 見た目

- 白地に緑一色。強い色は緑だけにする。生成りなどの色の付いた地や、別の書体で組んだロゴは使わない。
- 主役は図。実際の画面と、公開パッケージが生成した図だけを見せる。架空の画面は描かない。
- 飾りは製品の図の言葉から取る（機器の枠、ポートのタグ、接続線、通信量の色分け）。新しい模様を作らない。
- website での具体的な決まりは `shumoku-website` の `docs/architecture/expression.md` にある。

## 文章

- 何をするソフトかを平らに書く。大げさな言い回しや決め台詞は、見出しの一つだけにする。
- 一つのまとまりで言うことは一つにする。
- 用語は次にそろえる。

| 使う | 使わない |
| --- | --- |
| 構成図 | トポロジー図（見出しや紹介文では。技術文書では「トポロジー」を使ってよい） |
| アラート | アラーム |
| 通信量 | 流量（見出しや紹介文では） |
| 機器、ポート、接続 | ノード、エッジ（利用者向けの文では） |

## 入口と連絡先

| | |
| --- | --- |
| 配布物の QR | `https://www.shumoku.dev/ja/connect`（英語の配布物は `/en/connect`）。紙面の表記は shumoku.dev/connect |
| website | https://www.shumoku.dev/ |
| 相談 | contact@shumoku.dev |
| X | @shumoku_dev |
| GitHub | konoe-akitoshi/shumoku |
| Discord | https://discord.gg/dyYbEsDZYr |

info@shumoku.dev と @konoe_akitoshi は使わない。

## 参照している媒体

- website: `shumoku-dev/shumoku-website` の `src/lib/content/`
- [README.md](../README.md)
- 概要スライド: [slides/shumoku-overview.ja.md](slides/shumoku-overview.ja.md)
- 配布物: 汎用フライヤー（B5）、イベントごとのフライヤーとポスター
- connpass、X、Discord の紹介文
