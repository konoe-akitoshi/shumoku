# ベンダーアイコン一覧

Shumoku で使用可能なベンダー固有アイコンのリファレンス。

## インストール

```bash
npm install @shumoku/icons
```

```typescript
import { registerAllIcons } from '@shumoku/icons'

// アイコンを登録
registerAllIcons()
```

## 使用方法

### ハードウェアベンダー (Yamaha, Juniper 等)

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
    resource: instance
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
- `service` と `model` はどちらもアイコン検索に使用可能
- ハードウェアは `model`、クラウドは `service` を推奨

---

## サポートベンダー一覧

| ベンダー | アイコン数 | 用途 |
|---------|----------|------|
| Yamaha | 103 | ネットワーク機器 |
| Aruba | 55 | ネットワーク機器 |
| AWS | 477 | クラウドサービス |
| Juniper | 343 | ネットワーク機器 |

---

## Yamaha (103 アイコン)

### ルーター

| model | 説明 |
|-------|------|
| `rtx830` | RTX830 |
| `rtx1300` | RTX1300 |
| `rtx3500` | RTX3500 |
| `rtx3510` | RTX3510 |
| `rtx1220` | RTX1220 |
| `rtx1210` | RTX1210 |
| `rtx1200` | RTX1200 |
| `rtx810` | RTX810 |
| `nvr700w` | NVR700W |
| `nvr510` | NVR510 |
| `nvr500` | NVR500 |

### スイッチ

| model | 説明 |
|-------|------|
| `swx3220-16mt` | SWX3220-16MT |
| `swx3220-16tm` | SWX3220-16TM |
| `swx3100-10g` | SWX3100-10G |
| `swx3100-18gt` | SWX3100-18GT |
| `swx2322p-16mt` | SWX2322P-16MT |
| `swx2320-16mt` | SWX2320-16MT |
| `swx2310p-10g` | SWX2310P-10G |
| `swx2310p-18g` | SWX2310P-18G |
| `swx2310-10g` | SWX2310-10G |
| `swx2310-18g` | SWX2310-18G |
| `swx2221p-10nt` | SWX2221P-10NT |
| `swx2220-10nt` | SWX2220-10NT |
| `swx2210p-10g` | SWX2210P-10G |
| `swx2210p-18g` | SWX2210P-18G |
| `swx2210p-28g` | SWX2210P-28G |
| `swx2210-8g` | SWX2210-8G |
| `swx2210-16g` | SWX2210-16G |
| `swx2210-24g` | SWX2210-24G |
| `swx2200-8g` | SWX2200-8G |
| `swx2200-24g` | SWX2200-24G |
| `swx2200-8poe` | SWX2200-8PoE |

### 無線 LAN

| model | 説明 |
|-------|------|
| `wlx413` | WLX413 |
| `wlx323` | WLX323 |
| `wlx313` | WLX313 |
| `wlx222` | WLX222 |
| `wlx212` | WLX212 |
| `wlx202` | WLX202 |

### ファイアウォール

| model | 説明 |
|-------|------|
| `fwx120` | FWX120 |

### VoIP

| model | 説明 |
|-------|------|
| `rt-s1000` | RT-S1000 |

---

## Aruba (55 アイコン)

### デバイス

| model | 説明 |
|-------|------|
| `access-switch` | アクセススイッチ |
| `core-agg-leaf-switch` | コア/アグリ/リーフスイッチ |
| `ap500-series` | AP500 シリーズ |
| `ap500-series-microbranch` | AP500 マイクロブランチ |
| `ap600-series` | AP600 シリーズ |
| `outdor-ap` | 屋外 AP |
| `gateway-branch` | ブランチゲートウェイ |
| `gateway-campus` | キャンパスゲートウェイ |
| `gateway-headend` | ヘッドエンドゲートウェイ |

### 管理・機能

| model | 説明 |
|-------|------|
| `central-apis` | Central APIs |
| `central-client-insights` | Central Client Insights |
| `central-netconductor` | Central NetConductor |
| `central-network-insights` | Central Network Insights |
| `central-network-management` | Central Network Management |
| `clearpass-policy-manager` | ClearPass Policy Manager |
| `orchestrator` | Orchestrator |

### 汎用

| model | 説明 |
|-------|------|
| `cloud` | クラウド |
| `firewall` | ファイアウォール |
| `router` | ルーター |
| `server-single` | サーバー (単体) |
| `server-multi` | サーバー (複数) |
| `virtual-machine` | 仮想マシン |

### クライアント

| model | 説明 |
|-------|------|
| `desktop` | デスクトップ |
| `laptop` | ラップトップ |
| `tablet` | タブレット |
| `mobile-1` | モバイル |
| `ip-phone` | IP 電話 |
| `printer` | プリンター |

---

## Juniper (343 アイコン)

### ルーター

| model | 説明 |
|-------|------|
| `mx80` | MX80 |
| `mx104` | MX104 |
| `mx150` | MX150 |
| `mx204` | MX204 |
| `mx240` | MX240 |
| `mx304` | MX304 |
| `mx480` | MX480 |
| `mx960` | MX960 |
| `mx10003` | MX10003 |
| `mx10004` | MX10004 |
| `mx10008` | MX10008 |
| `mx10016` | MX10016 |
| `ptx1000` | PTX1000 |
| `ptx3000` | PTX3000 |
| `ptx5000` | PTX5000 |
| `ptx10001-36mr` | PTX10001-36MR |
| `ptx10002-60c` | PTX10002-60C |
| `ptx10003` | PTX10003 |
| `ptx10004` | PTX10004 |
| `ptx10008` | PTX10008 |
| `ptx10016` | PTX10016 |
| `acx500` | ACX500 |
| `acx1000` | ACX1000 |
| `acx1100` | ACX1100 |
| `acx2000` | ACX2000 |
| `acx4000` | ACX4000 |
| `acx5400` | ACX5400 |
| `acx6360` | ACX6360 |
| `acx7100` | ACX7100 |
| `acx7509` | ACX7509 |

### スイッチ

| model | 説明 |
|-------|------|
| `ex2200` | EX2200 |
| `ex2300` | EX2300 |
| `ex3200` | EX3200 |
| `ex3300` | EX3300 |
| `ex3400` | EX3400 |
| `ex4200` | EX4200 |
| `ex4300` | EX4300 |
| `ex4400` | EX4400 |
| `ex4400-24p` | EX4400-24P |
| `ex4400-48p` | EX4400-48P |
| `ex4500` | EX4500 |
| `ex4550` | EX4550 |
| `ex4600` | EX4600 |
| `ex4650` | EX4650 |
| `ex6200` | EX6200 |
| `ex8200` | EX8200 |
| `ex9200` | EX9200 |
| `ex9250` | EX9250 |
| `ex9251` | EX9251 |
| `ex9253` | EX9253 |
| `qfx3500` | QFX3500 |
| `qfx3600` | QFX3600 |
| `qfx5100` | QFX5100 |
| `qfx5110` | QFX5110 |
| `qfx5120` | QFX5120 |
| `qfx5120-32c` | QFX5120-32C |
| `qfx5120-48t` | QFX5120-48T |
| `qfx5120-48y` | QFX5120-48Y |
| `qfx5130` | QFX5130 |
| `qfx5200` | QFX5200 |
| `qfx5210` | QFX5210 |
| `qfx5220` | QFX5220 |
| `qfx5700` | QFX5700 |
| `qfx10002` | QFX10002 |
| `qfx10008` | QFX10008 |
| `qfx10016` | QFX10016 |

### セキュリティ

| model | 説明 |
|-------|------|
| `srx100` | SRX100 |
| `srx110` | SRX110 |
| `srx210` | SRX210 |
| `srx220` | SRX220 |
| `srx240` | SRX240 |
| `srx300` | SRX300 |
| `srx320` | SRX320 |
| `srx340` | SRX340 |
| `srx345` | SRX345 |
| `srx380` | SRX380 |
| `srx550` | SRX550 |
| `srx650` | SRX650 |
| `srx1500` | SRX1500 |
| `srx4100` | SRX4100 |
| `srx4200` | SRX4200 |
| `srx4600` | SRX4600 |
| `srx5400` | SRX5400 |
| `srx5600` | SRX5600 |
| `srx5800` | SRX5800 |
| `vsrx` | vSRX |
| `vsrx3` | vSRX3 |

### 無線 LAN

| model | 説明 |
|-------|------|
| `ap12` | AP12 |
| `ap21` | AP21 |
| `ap32` | AP32 |
| `ap33` | AP33 |
| `ap34` | AP34 |
| `ap41` | AP41 |
| `ap43` | AP43 |
| `ap45` | AP45 |
| `ap47` | AP47 |
| `ap61` | AP61 |
| `ap63` | AP63 |

### SD-WAN

| model | 説明 |
|-------|------|
| `session-smart-router` | Session Smart Router |
| `nfx150` | NFX150 |
| `nfx250` | NFX250 |
| `nfx350` | NFX350 |

---

## AWS (477 アイコン)

### コンピューティング

| service | resource | 説明 |
|---------|----------|------|
| `ec2` | `instance` | EC2 インスタンス |
| `ec2` | `auto-scaling` | Auto Scaling |
| `ec2` | `ami` | AMI |
| `lambda` | - | Lambda |
| `elasticbeanstalk` | - | Elastic Beanstalk |
| `elasticcontainerservice` | - | ECS |
| `elastickubernetesservice` | - | EKS |
| `elasticcontainerregistry` | - | ECR |
| `fargate` | - | Fargate |

### ネットワーキング

| service | resource | 説明 |
|---------|----------|------|
| `vpc` | `vpc` | VPC |
| `vpc` | `internet-gateway` | Internet Gateway |
| `vpc` | `nat-gateway` | NAT Gateway |
| `vpc` | `router` | Router |
| `vpc` | `elastic-network-interface` | ENI |
| `cloudfront` | - | CloudFront |
| `route53` | - | Route 53 |
| `apigateway` | - | API Gateway |
| `directconnect` | - | Direct Connect |
| `transitgateway` | - | Transit Gateway |
| `elb` | `application-load-balancer` | ALB |
| `elb` | `network-load-balancer` | NLB |
| `elb` | `gateway-load-balancer` | GWLB |

### データベース

| service | resource | 説明 |
|---------|----------|------|
| `rds` | `instance` | RDS |
| `aurora` | - | Aurora |
| `dynamodb` | - | DynamoDB |
| `elasticache` | - | ElastiCache |
| `redshift` | - | Redshift |
| `documentdb` | - | DocumentDB |

### ストレージ

| service | resource | 説明 |
|---------|----------|------|
| `simplestorageservice` | `bucket` | S3 Bucket |
| `simplestorageserviceglacier` | - | S3 Glacier |
| `elasticfilesystem` | - | EFS |
| `elasticblockstore` | - | EBS |
| `storagegateway` | - | Storage Gateway |

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

### マネジメント

| service | 説明 |
|---------|------|
| `cloudwatch` | CloudWatch |
| `cloudformation` | CloudFormation |
| `cloudtrail` | CloudTrail |
| `systemsmanager` | Systems Manager |
| `organizations` | Organizations |

---

## アイコンの追加

新しいベンダーアイコンを追加するには:

1. `packages/@shumoku/icons/icons/{vendor}/` にアイコンファイル (SVG/PNG) を配置
2. `bun run build` を実行
3. `generated-icons.ts` が自動生成される

詳細は `packages/@shumoku/icons/src/build-icons.ts` を参照。
