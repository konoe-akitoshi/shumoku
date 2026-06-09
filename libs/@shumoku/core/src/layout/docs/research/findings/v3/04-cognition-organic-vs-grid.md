# v3 Findings 04: 認知/HCI — 非定型・放射状は本当に見やすいか

## 判定: 仮説『非定型＝見やすい』は**一般命題として偽。限定版のみ真。**

- ❌ **「整いすぎ/グリッド整列が逆に難しい」は支持されない**。計測で害を出すのは整列の規則性でなく **(a)経路自身を横切る交差 (b)直角折れエッジの連続性断絶 (c)matrix的過剰離散化**。ノードがグリッド整列でもエッジ滑らか＆低交差なら害でない（階層・深さ把握はむしろ整列木が最良）。
- ❌ **「放射状=有機=見やすい」は二重に誤り**。放射状は有機(force)と別物で、**階層タスクで最も遅く・最も嫌われる**。
- ✅ **真の限定版**: **force-directed/有機配置は経路追跡・近傍探索・(中規模)クラスタ把握で直交・階層より読みやすい**（Gestalt good-continuation＋関連ノード近接）。

## 決定的証拠: Burch et al. 2011 TVCG（eye-tracking, n=36）
traditional/orthogonal/radial の木でLCA探索:
- 完了時間 **traditional 11.65s < orthogonal 14.84s < radial 20.95s (p<0.005)＝放射状約2倍遅い**。正答率は全≈97.5%(差なし)。
- 放射状=解を何度もcross-check（自信持てず）、深さ読み取りにくい。
- 主観(1=very good): traditional 1.42 / orthogonal 2.55 / **radial 3.42(最下位)**「intuitiveでない」。
- **root=上が最速・最も好まれた**（右がよい仮説は棄却、右が最遅）。
- 放射状が活きるのは: 空間効率(多ノード省スペース)、全体俯瞰、同心円=深さ一目、**中心=重要の表現**。深さの精密比較・ラベル読み・経路追跡では不利。

## タスク別の勝者（複数study）
| タスク | 勝つレイアウト | 放射状 | 根拠 |
|---|---|---|---|
| Path trace | force/有機(滑らかエッジ低交差) | ✗ | Ware'02,Huang'08,Pohl'09,Ghoniem'05 |
| Blast radius(近傍/subgraph) | force | △(中心起点○,多段✗) | Pohl'09,Ortega'20 |
| Capacity(精密比較/次数) | 整列/直交,大規模matrix | ✗ | Ghoniem'05 |
| Overview/階層深さ | **traditional整列木(root上)** | ✗(最遅最嫌) | **Burch'11** |
| 全体俯瞰/中心性/省スペース | **radialが活きる** | ✓ | Burch,McGrath |

## 他の load-bearing 知見
- **Purchase GD'97**: 交差最小化が「by far最重要」。直交性/対称/角度分解能は弱い。
- **Ware'02**: 最短経路では「経路自身を横切る交差数」＋path continuityが効く（図全体の交差でなく）。
- **Huang'08(eye-track)**: 交差はpath-searchを遅らせるがnode-locatingは無影響。geometric-path tendency=目標方向へ直進的に辿る→交差消すため経路を曲げると逆に遅い。
- **Ghoniem&Fekete'05**: 20ノード超でmatrixが大半勝つ**が経路探索だけnode-link一貫勝利**。過剰離散化はpath continuation破壊。
- **Archambault&Purchase'13**: **mental map保存がcomprehensionを助ける決定的証拠はどの実験でも未取得**。効くのはorientation/route系のみ。「安定した形が読解を助ける」は過大評価。
- **McGrath/Blythe/Krackhardt'97**: レイアウトで観察者の推論(中心性/グループ数)が有意に変わる。**中心配置=prominent と知覚**。自由配置は「位置に意味」を誤読させる両刃（コア=中心は意図的なら武器、無意味なら誤情報）。

## Shumokuへの示唆
1. **放射状をデフォルトにしない**。運用中核(path trace/階層/容量比較)で計測上不利。採るなら**「全体俯瞰モード」「コア=中心の重要度提示」に用途限定**。
2. **仮説の正しい部分を翻訳**: 害の元凶は直角折れエッジ・経路を横切る交差・過剰離散化。→**滑らかエッジ＋経路自身の交差最小化＋関連ノード近接**。ノード整列自体は避けなくてよい。
3. **「位置に意味」を意図的に**(コア=中心、同セグメント=近接)。
4. **mental map過信を避ける**（安定化はorientation系のみ）。

## 限界（正直な但し書き）
Burch=単一タスク(LCA)・木・静的・n=36。Ortega n=11小。Pohlもサンプル小。「force強い」は中規模(大規模高密度はmatrix逆転)。「有機が好まれる」の多くはpreference指標でcomprehensionと乖離。**最も信頼できる強い主張は2点: ①放射状は階層・経路タスクで不利(複数一致) ②経路追跡は滑らかエッジ・低経路交差が効く(複数一致)**。

## Sources
- Burch et al. TVCG2011: https://ieeexplore.ieee.org/document/6065011/ (PDF joules.de/files/burch_evaluation_2011.pdf)
- Purchase GD'97: https://link.springer.com/chapter/10.1007/3-540-63938-1_67
- Huang/Eades/Hong 2008: https://arxiv.org/pdf/0810.4431
- Pohl/Schmitt/Diehl CompAesth2009: http://diglib.eg.org/handle/10.2312/COMPAESTH.COMPAESTH09.049-056
- Ghoniem/Fekete/Castagliola InfoVis2004/IV2005: https://journals.sagepub.com/doi/10.1057/palgrave.ivs.9500092
- Ortega Mattsson KTH2020: http://www.diva-portal.org/smash/get/diva2:1472455/FULLTEXT01.pdf
- Archambault&Purchase IJHCS2013: https://www.sciencedirect.com/science/article/abs/pii/S107158191300102X
- McGrath/Blythe/Krackhardt: https://www.cmu.edu/joss/content/articles/volume5/McGrathBlythe/McGrathBlytheViz4-05.html
