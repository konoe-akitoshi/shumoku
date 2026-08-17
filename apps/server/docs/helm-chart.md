# Helm Chart

Shumoku Server を Kubernetes にデプロイするための Helm chart です。

## Prerequisites

- Kubernetes 1.25+
- Helm 3.x
- コンテナイメージが利用可能であること（ビルド済み or レジストリにプッシュ済み）

## Quick Start

```bash
# デフォルト設定でインストール
helm upgrade --install shumoku oci://ghcr.io/konoe-akitoshi/charts/shumoku

# namespace を作成してインストール
helm upgrade --install shumoku oci://ghcr.io/konoe-akitoshi/charts/shumoku --namespace shumoku --create-namespace

# values ファイルを指定してインストール
helm upgrade --install shumoku oci://ghcr.io/konoe-akitoshi/charts/shumoku -f my-values.yaml
```

本番環境へのデプロイでは、以下のようにChartのバージョンを固定することを推奨します。

```bash
helm upgrade --install shumoku oci://ghcr.io/konoe-akitoshi/charts/shumoku \
  --version 0.1.6-beta.3
```

## Configuration

`values.yaml` で設定可能なパラメータ一覧です。

### Image

| Parameter | Description | Default |
|---|---|---|
| `image.repository` | コンテナイメージのリポジトリ | `ghcr.io/konoe-akitoshi/shumoku` |
| `image.tag` | イメージタグ（未指定時は `appVersion`） | `""` |
| `image.pullPolicy` | イメージの pull ポリシー | `IfNotPresent` |

### Service / Ingress

| Parameter | Description | Default |
|---|---|---|
| `service.type` | Service の type | `ClusterIP` |
| `service.port` | Service のポート番号 | `8080` |
| `ingress.enabled` | Ingress を有効にするか | `false` |
| `ingress.className` | IngressClass 名 | `""` |
| `ingress.annotations` | Ingress の annotations | `{}` |
| `ingress.hosts` | ホスト・パスの設定 | `[{host: shumoku.local, paths: [{path: /, pathType: Prefix}]}]` |
| `ingress.tls` | TLS 設定 | `[]` |

### Persistence

| Parameter | Description | Default |
|---|---|---|
| `persistence.enabled` | PVC を作成するか | `true` |
| `persistence.accessMode` | アクセスモード | `ReadWriteOnce` |
| `persistence.size` | ストレージサイズ | `1Gi` |
| `persistence.storageClass` | StorageClass 名 | `""` |
| `persistence.existingClaim` | 既存の PVC 名を指定 | `""` |

### Application Config

`config` に値を設定すると ConfigMap としてマウントされます。

```yaml
config:
  server:
    port: 8080
    host: 0.0.0.0
    dataDir: /data
    pollInterval: 5000
    backgroundPollInterval: 60000
    concurrencyLimit: 3
```

トポロジーとデータソースはSQLiteを正本としてWeb UIまたはREST APIから管理します。
設定ファイルからYAMLトポロジーを読み込む旧経路はありません。

### Security

| Parameter | Description | Default |
|---|---|---|
| `podSecurityContext.runAsUser` | Pod の実行ユーザー | `1000` |
| `podSecurityContext.runAsGroup` | Pod の実行グループ | `1000` |
| `podSecurityContext.fsGroup` | ファイルシステムのグループ | `1000` |
| `securityContext.readOnlyRootFilesystem` | ルートFS を読み取り専用にするか | `true` |

### Other

| Parameter | Description | Default |
|---|---|---|
| `replicaCount` | レプリカ数 | `1` |
| `resources` | CPU/メモリの requests/limits | `{}` |
| `env` | 追加の環境変数 | `[]` |
| `nodeSelector` | Node selector | `{}` |
| `tolerations` | Tolerations | `[]` |
| `affinity` | Affinity ルール | `{}` |
| `serviceAccount.create` | ServiceAccount を作成するか | `true` |

## Examples

### Ingress を有効にして TLS 設定

```yaml
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt
  hosts:
    - host: shumoku.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: shumoku-tls
      hosts:
        - shumoku.example.com
```

### リソース制限を設定

```yaml
resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 512Mi
```

## Verification

chart の動作確認には以下のコマンドが使えます。

```bash
# Chart の情報を確認
helm show chart oci://ghcr.io/konoe-akitoshi/charts/shumoku

# レンダリング結果のプレビュー（クラスタ不要）
helm template test oci://ghcr.io/konoe-akitoshi/charts/shumoku

# config や ingress 有効時のプレビュー
helm template test oci://ghcr.io/konoe-akitoshi/charts/shumoku \
  --version 0.1.6-beta.3 --values my-values.yaml

# dry-run でインストールをシミュレーション（クラスタ必要）
helm install shumoku oci://ghcr.io/konoe-akitoshi/charts/shumoku --dry-run

# インストール後の状態確認
helm status shumoku
kubectl get pods -l app.kubernetes.io/name=shumoku
kubectl logs -l app.kubernetes.io/name=shumoku
```

## Uninstall

```bash
helm uninstall shumoku
# PVC は helm uninstall では削除されません。手動で削除してください：
# kubectl delete pvc shumoku
```
