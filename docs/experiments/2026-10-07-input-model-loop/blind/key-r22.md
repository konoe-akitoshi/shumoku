# 22周目の答え（書く課題 = human/task-write.md）

型を見せずに例だけで書かせる試験の採点表。実行前に書いた。各項目は「その事実が今のモデルの意味で
書けているか」。書き方の細部（id の綴り、label の有無）は問わない。

1. 本社 > サーバ室 の入れ子のグループがあり、rt-1 と sw-1 がサーバ室にある。
2. rt-1 の製品が Yamaha の RTX3510（`yamaha/rtx3510` 相当）。
3. sw-1 の製品はメーカー不明の SWX2322P-16MT（`?/...`）。メーカーを補っていない。
4. rt-1 lan3 – sw-1 1 のリンクが 1G・cat6・3m。
5. そのリンクが VLAN 10 と VLAN 20 の両セグメントを運ぶ（`segments`）。
6. VLAN 10 のセグメントに vlan 10 と 192.168.10.0/24。
7. VLAN 20 は VRF guest（routing domain）に属する。
8. hv-1 の製品が Dell PowerEdge R750、ソフトウェアが ESXi。
9. hv-1 – sw-1 のリンクが 10G で、ポートを書いていない。
10. web-1 が hv-1 上で動く（`host`）。
11. web-1 のアダプタは VLAN 10 のセグメントへのリンク（segment 端点、virtual）。
12. web-1 のアドレス 192.168.10.20 が VLAN 10 のセグメントに書かれている。
13. VPC main が routing domain で 10.0.0.0/16。
14. sub-a がセグメントで 10.0.1.0/24、VPC main に属し、ap-northeast-1a に限られる（group）。
15. igw-1 が VPC 全体に付く（routing domain 端点のリンク）。
16. VPN が rt-1 – vgw-1 の virtual なリンク2本で、1つの connection にまとまる。
17. 補っていない: 書かれていない場所（hv-1 の場所など）、ポート、アドレス、存在の不確かさ（assumed）を
    足していない。

採点は項目ごとに ok / wrong。17 項目。
