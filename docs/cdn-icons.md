# CDN Icons 開発ガイド

## アーキテクチャ

アイコンは Cloudflare R2 にホストされ、カスタムドメインで配信される。

```
CDN URL: https://icons.shumoku.packof.me
バケット: shumoku-icons
```

### URL構造

```
https://icons.shumoku.packof.me/v1/{vendor}/{normalized-name}.{ext}
```

| ベンダー | 拡張子 | 例 |
|----------|--------|-----|
| aruba | svg | `/v1/aruba/ap500-series.svg` |
| aws | svg | `/v1/aws/ec2-instance.svg` |
| juniper | png | `/v1/juniper/ex4400-24p.png` |
| yamaha | png | `/v1/yamaha/rtx3510.png` |

## ファイル名の正規化ルール

### Aruba

元ファイル名からプレフィックスを削除し、小文字+ハイフン形式に変換。

```
元: Device - AP500 Series.svg
↓
正規化: ap500-series.svg
```

処理:
1. `.svg` 拡張子を除去
2. `Device - `, `Client - `, `Generic - `, `Function - ` プレフィックスを削除
3. 小文字に変換
4. スペースをハイフンに置換

### AWS

AWS のファイル名は複雑な構造を持つ。サービス名とリソース名を抽出して結合。

```
元: Res_Amazon-EC2_Instance_48.svg
↓
正規化: ec2-instance.svg

元: Res_AWS-Lambda_Lambda-Function_48.svg
↓
正規化: lambda-lambda-function.svg
```

処理:
1. `.svg` 拡張子を除去
2. `_48` サフィックスを除去
3. `Res_` プレフィックスを除去
4. `Amazon-{Service}_{Resource}` または `AWS-{Service}_{Resource}` 形式をパース
5. サービス名: 小文字化、ハイフン除去
6. リソース名: 小文字化、アンダースコアをハイフンに変換
7. `{service}-{resource}.svg` 形式で出力

**注意**: Light/Dark バリアントがある場合、Light を使用（Dark はスキップ）

### Juniper / Yamaha

ファイル名をそのまま小文字化。

```
元: EX4400-24P.png
↓
正規化: ex4400-24p.png
```

## YAML での指定方法

### ベンダーアイコン

```yaml
nodes:
  # Yamaha - model で指定
  - id: rt-01
    vendor: yamaha
    model: rtx3510

  # AWS - service/resource で指定
  - id: ec2-01
    vendor: aws
    service: ec2
    resource: instance

  # AWS - resource 名に注意（ファイル名に従う）
  - id: lambda-01
    vendor: aws
    service: lambda
    resource: lambda-function  # "function" ではなく "lambda-function"
```

### カスタムアイコン

```yaml
nodes:
  - id: custom-01
    icon: https://example.com/my-icon.png
```

`icon` フィールドはベンダーアイコンより優先される。

## アイコンのアップロード

### 前提条件

- Cloudflare アカウントへのアクセス
- Wrangler CLI (`npx wrangler`)

### 手順

1. アイコンファイルを `packages/@shumoku/icons/src/{vendor}/` に配置
2. アップロードスクリプトを実行

```bash
cd packages/@shumoku/icons
./upload-to-r2.sh
```

### 個別アップロード

```bash
npx wrangler r2 object put "shumoku-icons/v1/yamaha/new-model.png" \
  --file ./src/yamaha/new-model.png \
  --content-type "image/png" \
  --remote
```

## 新規ベンダーの追加

1. `packages/@shumoku/icons/src/{vendor}/` ディレクトリを作成
2. アイコンファイルを配置
3. `packages/@shumoku/icons/upload-to-r2.sh` に正規化関数とアップロード処理を追加
4. `packages/@shumoku/renderer/src/cdn-icons.ts` を更新:
   - `SVG_VENDORS` または `PNG_VENDORS` に追加

```typescript
const SVG_VENDORS = new Set(['aruba', 'aws', 'new-vendor'])
```

## トラブルシューティング

### アイコンが表示されない

1. CDN URL を直接ブラウザで確認
2. 正規化ルールが正しいか確認
3. YAML の `service`/`resource`/`model` 値を確認

### 404 エラー

```bash
# アップロード済みファイルを確認
npx wrangler r2 object list shumoku-icons --prefix "v1/aws/" --remote | head
```

### キャッシュ

CDN には 1 日のキャッシュ設定がある。更新後すぐに反映されない場合はキャッシュをパージするか待機。
