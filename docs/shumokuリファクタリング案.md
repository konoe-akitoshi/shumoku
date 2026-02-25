# パッケージ分割まわりのリファクタ提案

## イメージ

```
apps/
├─ server/
├─ cli/
packages/
├─ core/
│  ├─ package.json
│  ├─ model/
│  ├─ parser/
├─ renderer-svg/
│  ├─ package.json
├─ renderer-html/
│  ├─ package.json
├─ renderer-react/
│  ├─ package.json
```

## タスク

- [ ] npmに公開するパッケージを整理
  - coreに対してrendererをinjectする方式
  - coreだけでは使えない
  - packageを分けることで、rendererを追加しても依存が増えない
  - TipTapのextensionのようなイメージ
  - 将来的にはReactやSvelteのrendererを書きたい
- [ ] cliをappsに移動
  - cliは一種のアプリケーションなので
- [ ] netbox関連機能をserverへ移動
  - npmに公開する必要がないため


- [ ] appsからpackagesへの参照をnpmではなく相対pathで指定
  - npmへのpublishを待たないと変更が反映されないのは不便

## メモ

**packages/よりもlibs/のほうが明示的かも？**