# ベンダーアイコン一覧

Shumoku で使用可能なベンダー固有アイコンのリファレンス。

## 使用方法

### ハードウェアベンダー (Yamaha 等)

```yaml
nodes:
  - id: router-1
    type: router
    vendor: yamaha
    model: rtx3510
```

### クラウドベンダー (AWS 等)

```yaml
nodes:
  - id: instance-1
    type: server
    vendor: aws
    service: ec2
    resource: instances  # オプション
```

### ネットワークベンダー (Aruba 等)

```yaml
nodes:
  - id: switch-1
    type: l2-switch
    vendor: aruba
    model: access-switch
```

**注**:
- `type` はデフォルトアイコンのフォールバックと形状に影響します
- `service` と `model` はどちらもアイコン検索に使用可能 (`service` が優先)
- ハードウェアは `model`、クラウドは `service` を推奨

---

## Yamaha

| model | 説明 |
|-------|------|
| `rtx3510` | RTX3510 ルーター |

---

## Aruba

### デバイス

| model | 説明 |
|---------------|------|
| `access-switch` | アクセススイッチ |
| `core-agg-leaf-switch` | コア/アグリ/リーフスイッチ |
| `ap500-series` | AP500 シリーズ |
| `ap500-series-microbranch` | AP500 マイクロブランチ |
| `ap600-series` | AP600 シリーズ |
| `outdor-ap` | 屋外 AP |
| `gateway-branch` | ブランチゲートウェイ |
| `gateway-campus` | キャンパスゲートウェイ |
| `gateway-headend` | ヘッドエンドゲートウェイ |
| `edgeconnect-enterprise-appliance` | EdgeConnect アプライアンス |
| `edgeconnect-enterprise-cloud` | EdgeConnect クラウド |
| `edgeconnect-enterprise-virtual` | EdgeConnect 仮想 |
| `uxi-sensor-classic` | UXI センサー (クラシック) |
| `uxi-sensor-new` | UXI センサー (新型) |

### 管理・機能

| model | 説明 |
|---------------|------|
| `central-apis` | Central APIs |
| `central-client-insights` | Central Client Insights |
| `central-netconductor` | Central NetConductor |
| `central-network-insights` | Central Network Insights |
| `central-network-management` | Central Network Management |
| `central-route-orchestrator` | Central Route Orchestrator |
| `central-tunnel-orchestrator` | Central Tunnel Orchestrator |
| `clearpass-policy-manager` | ClearPass Policy Manager |
| `fabric-composer` | Fabric Composer |
| `orchestrator` | Orchestrator |
| `orchestrator-global-enterprise` | Orchestrator Global Enterprise |
| `pensando-policy-and-services-manager` | Pensando Policy Manager |
| `uxi-apis` | UXI APIs |
| `uxi-dashboard` | UXI Dashboard |

### 汎用

| model | 説明 |
|---------------|------|
| `cloud` | クラウド |
| `cloud-internet-circuit` | インターネット回線 |
| `cloud-private-circuit` | プライベート回線 |
| `firewall` | ファイアウォール |
| `router` | ルーター |
| `server-single` | サーバー (単体) |
| `server-multi` | サーバー (複数) |
| `virtual-machine` | 仮想マシン |
| `wi-fi-signal` | Wi-Fi シグナル |

### クライアント

| model | 説明 |
|---------------|------|
| `desktop` | デスクトップ |
| `laptop` | ラップトップ |
| `tablet` | タブレット |
| `mobile-1` | モバイル 1 |
| `mobile-2` | モバイル 2 |
| `workstation` | ワークステーション |
| `ip-phone` | IP 電話 |
| `printer` | プリンター |
| `game-console` | ゲームコンソール |

### IoT

| model | 説明 |
|---------------|------|
| `iot-camera` | IoT カメラ |
| `iot-io` | IoT I/O |
| `iot-patient-monitor` | 患者モニター |
| `iot-plc` | PLC |
| `iot-scanner` | スキャナー |
| `iot-sensor` | センサー |
| `iot-tv-cast` | TV キャスト |

---

## AWS (524 アイコン)

### コンピューティング

| service | 説明 |
|---------|------|
| `ec2` | Elastic Compute Cloud |
| `lambda` | Lambda |
| `elasticbeanstalk` | Elastic Beanstalk |
| `elasticcontainerservice` | ECS |
| `elastickubernetesservice` | EKS |
| `elasticcontainerregistry` | ECR |

### ネットワーキング

| service | 説明 |
|---------|------|
| `vpc` | Virtual Private Cloud |
| `cloudfront` | CloudFront |
| `route53` | Route 53 |
| `apigateway` | API Gateway |
| `directconnect` | Direct Connect |
| `transitgateway` | Transit Gateway |
| `cloudwan` | Cloud WAN |
| `cloudmap` | Cloud Map |
| `appmesh` | App Mesh |

### データベース

| service | 説明 |
|---------|------|
| `rds` | RDS |
| `aurora` | Aurora |
| `dynamodb` | DynamoDB |
| `elasticache` | ElastiCache |
| `redshift` | Redshift |
| `documentdb` | DocumentDB |

### ストレージ

| service | 説明 |
|---------|------|
| `simplestorageservice` | S3 |
| `simplestorageserviceglacier` | S3 Glacier |
| `elasticfilesystem` | EFS |
| `elasticblockstore` | EBS |
| `storagegateway` | Storage Gateway |
| `filecache` | File Cache |
| `backup` | Backup |

### セキュリティ

| service | 説明 |
|---------|------|
| `identityaccessmanagement` | IAM |
| `keymanagementservice` | KMS |
| `certificatemanager` | Certificate Manager |
| `waf` | WAF |
| `shield` | Shield |
| `networkfirewall` | Network Firewall |
| `securityhub` | Security Hub |
| `inspector` | Inspector |

### 分析

| service | 説明 |
|---------|------|
| `athena` | Athena |
| `glue` | Glue |
| `emr` | EMR |
| `quicksight` | QuickSight |
| `lakeformation` | Lake Formation |
| `opensearchservice` | OpenSearch Service |
| `datazone` | DataZone |

### アプリケーション統合

| service | 説明 |
|---------|------|
| `simplenotificationservice` | SNS |
| `simplequeueservice` | SQS |
| `eventbridge` | EventBridge |
| `mq` | MQ |
| `msk` | MSK |

### マネジメント

| service | 説明 |
|---------|------|
| `cloudwatch` | CloudWatch |
| `cloudformation` | CloudFormation |
| `cloudtrail` | CloudTrail |
| `systemsmanager` | Systems Manager |
| `organizations` | Organizations |
| `trustedadvisor` | Trusted Advisor |

### IoT

| service | 説明 |
|---------|------|
| `iot` | IoT |
| `iotcore` | IoT Core |
| `iotanalytics` | IoT Analytics |
| `iotdevicedefender` | IoT Device Defender |
| `iotdevicemanagement` | IoT Device Management |
| `iotgreengrass` | IoT Greengrass |
| `iotsitewise` | IoT SiteWise |

### 機械学習

| service | 説明 |
|---------|------|
| `sagemakerai` | SageMaker AI |
| `rekognition` | Rekognition |
| `textract` | Textract |

### その他

| service | 説明 |
|---------|------|
| `amplify` | Amplify |
| `cloud9` | Cloud9 |
| `pinpoint` | Pinpoint |
| `simpleemailservice` | SES |
| `workspacesfamily` | WorkSpaces |
| `braket` | Braket |

---

## アイコンの追加

新しいベンダーアイコンを追加するには:

1. `packages/@shumoku/core/src/icons/{vendor}/` にアイコンファイル (SVG/PNG) を配置
2. `pnpm --filter @shumoku/core build:icons` を実行
3. `generated-icons.ts` が自動生成される

詳細は `packages/@shumoku/core/src/icons/build-icons.ts` を参照。
