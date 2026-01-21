/**
 * Vendor icon data for documentation
 * Icons are served from CDN: https://icons.shumoku.packof.me
 */

export const CDN_BASE_URL = 'https://icons.shumoku.packof.me/v1'

export type VendorKey = 'yamaha' | 'aruba' | 'juniper' | 'aws'

export const vendorConfig: Record<VendorKey, { name: string; ext: 'png' | 'svg' }> = {
  yamaha: { name: 'Yamaha', ext: 'png' },
  aruba: { name: 'Aruba', ext: 'svg' },
  juniper: { name: 'Juniper', ext: 'png' },
  aws: { name: 'AWS', ext: 'svg' },
}

export const vendorOrder: VendorKey[] = ['yamaha', 'aruba', 'juniper', 'aws']

export const vendorIcons: Record<VendorKey, string[]> = {
  yamaha: [
    'fwx120', 'nvr500', 'nvr510', 'nvr700w', 'nwr100',
    'rt105e', 'rt105i', 'rt105p', 'rt107e', 'rt140e', 'rt140f', 'rt140i', 'rt140p',
    'rt250i', 'rt300i', 'rt52pro', 'rt56v', 'rt57i', 'rt58i',
    'rta54i', 'rta55i', 'rtv01', 'rtv700', 'rtw65b', 'rtw65i',
    'rtx1000', 'rtx1100', 'rtx1200', 'rtx1210', 'rtx1220', 'rtx1300',
    'rtx1500', 'rtx2000', 'rtx3000', 'rtx3500', 'rtx3510', 'rtx5000',
    'rtx810', 'rtx830', 'rtx840', 'srt100',
    'swx2100_10poe', 'swx2100_16g', 'swx2100_24g', 'swx2100_5poe', 'swx2100_8g',
    'swx2110-16g', 'swx2110-5g', 'swx2110-8g', 'swx2110p-8g',
    'swx2200_24g', 'swx2200_8g', 'swx2200_8poe',
    'swx2210_16g', 'swx2210_24g', 'swx2210_8g',
    'swx2210p_10g', 'swx2210p_18g', 'swx2210p_28g',
    'swx2220_10nt', 'swx2220_18nt', 'swx2220_26nt', 'swx2220p_18nt', 'swx2220p_26nt', 'swx2221p_10nt',
    'swx2300_16g', 'swx2300_24g', 'swx2300_8g',
    'swx2310_10g', 'swx2310_18gt', 'swx2310_28gt', 'swx2310_52gt',
    'swx2310p_10g', 'swx2310p_18g', 'swx2310p_28gt',
    'swx2320-16mt', 'swx2320-30mc', 'swx2322p-16mt', 'swx2322p-30mc',
    'swx3100_10g', 'swx3100_18gt', 'swx3200_28gt', 'swx3200_52gt',
    'swx3220-16mt', 'swx3220-16tms', 'swx3220-30mc', 'swx3220-30tcs',
    'utx100', 'utx200',
    'wlx202', 'wlx212b', 'wlx212w', 'wlx222b', 'wlx222w',
    'wlx302_a', 'wlx302_z', 'wlx313', 'wlx322', 'wlx323', 'wlx402', 'wlx413',
    'yps_poe', 'yps_poe_bt',
  ],
  aruba: [
    'access-switch', 'ap500-series', 'ap500-series-microbranch', 'ap600-series',
    'central-apis', 'central-client-insights', 'central-netconductor',
    'central-network-insights', 'central-network-management',
    'central-route-orchestrator', 'central-tunnel-orchestrator',
    'clearpass-policy-manager', 'cloud',
    'cloud-function-container-grey', 'cloud-function-container-white',
    'cloud-internet-circuit', 'cloud-private-circuit',
    'core-agg-leaf-switch', 'desktop',
    'edgeconnect-enterprise-appliance', 'edgeconnect-enterprise-cloud', 'edgeconnect-enterprise-virtual',
    'fabric-composer', 'firewall', 'game-console',
    'gateway-branch', 'gateway-campus', 'gateway-headend',
    'iot-camera', 'iot-io', 'iot-patient-monitor', 'iot-plc', 'iot-scanner', 'iot-sensor', 'iot-tv-cast',
    'ip-phone', 'laptop', 'mobile-1', 'mobile-2',
    'orchestrator', 'orchestrator-global-enterprise', 'outdor-ap',
    'pensando-policy-and-services-manager', 'printer', 'router',
    'server-multi', 'server-single', 'tablet',
    'uxi-apis', 'uxi-dashboard', 'uxi-sensor-classic', 'uxi-sensor-new',
    'virtual-machine', 'wi-fi-signal', 'workstation',
  ],
  juniper: [
    'acx1000', 'acx1100', 'acx2000', 'acx2100', 'acx2200-dc', 'acx4000',
    'acx500-dc', 'acx500-o', 'acx500-o-poe',
    'acx5048-ac', 'acx5048-dc', 'acx5096-ac', 'acx5096-dc',
    'acx5448', 'acx5448d', 'acx5448m', 'acx6160', 'acx6360',
    'acx7020', 'acx7024-ac', 'acx7024-dc', 'acx710',
    'acx7100-32c', 'acx7100-48l', 'acx7300-16y', 'acx7300-2cd4c', 'acx7300-re',
    'acx7348', 'acx7509', 'acx7509-rcb', 'acx7509-re',
    'acx7900-18cd36c', 'acx7900-54cd', 'acx7900-re', 'acx7908',
    'ex2200-24p-4g', 'ex2200-24t-4g', 'ex2200-48p-4g', 'ex2200-48t-4g', 'ex2200-c',
    'ex2300-24mp', 'ex2300-24p', 'ex2300-24t', 'ex2300-48mp', 'ex2300-48p', 'ex2300-48t',
    'ex2300-c-12p', 'ex2300-c-12t',
    'ex3200-24p', 'ex3200-24t', 'ex3200-48p', 'ex3200-48t',
    'ex3300-24p', 'ex3300-24t', 'ex3300-48p', 'ex3300-48t',
    'ex3400-24p', 'ex3400-24t', 'ex3400-48p', 'ex3400-48t',
    'ex4100-24mp', 'ex4100-24p', 'ex4100-24t', 'ex4100-48mp', 'ex4100-48p', 'ex4100-48t',
    'ex4200-24f', 'ex4200-24p', 'ex4200-24t', 'ex4200-48p', 'ex4200-48t',
    'ex4300-24p', 'ex4300-24t', 'ex4300-48mp', 'ex4300-48p', 'ex4300-48t',
    'ex4400-24mp', 'ex4400-24p', 'ex4400-24t', 'ex4400-24x',
    'ex4400-48f', 'ex4400-48mp', 'ex4400-48p', 'ex4400-48t',
    'ex4600-40f-afi', 'ex4600-40f-afo', 'ex4650',
    'qfx5100-24q-afi', 'qfx5100-48s-afi', 'qfx5100-48t-afi',
    'qfx5110-32q', 'qfx5110-48s', 'qfx5120', 'qfx5120-32c', 'qfx5120-48t', 'qfx5120-48y',
    'qfx5130-32cd', 'qfx5130-48c', 'qfx5200-32c', 'qfx5200-48y',
    'qfx5210-64c', 'qfx5220-128c', 'qfx5220-32cd', 'qfx5230-64cd',
    'qfx10002-36q', 'qfx10002-60c', 'qfx10008', 'qfx10016',
    'srx1500', 'srx1600', 'srx2300', 'srx4100', 'srx4200', 'srx4300', 'srx4600-ac',
    'ptx1000-72q-ac', 'ptx10001', 'ptx10002-60c', 'ptx10003-80c', 'ptx10004', 'ptx10008', 'ptx10016',
    'ptx3000', 'ptx5000',
  ],
  aws: [
    'ec2-instance', 'ec2-ami', 'ec2-auto-scaling', 'ec2-elastic-ip-address',
    'lambda-lambda-function',
    'vpc-virtual-private-cloud', 'vpc-nat-gateway', 'vpc-internet-gateway', 'vpc-vpn-gateway',
    's3-bucket', 's3-glacier-archive', 's3-glacier-vault',
    'rds-amazon-rds', 'rds-multi-az', 'rds-proxy-instance',
    'dynamodb-attribute', 'dynamodb-global-secondary-index', 'dynamodb-item', 'dynamodb-items', 'dynamodb-table',
    'elasticloadbalancing-application-load-balancer', 'elasticloadbalancing-network-load-balancer',
    'cloudfront-download-distribution', 'cloudfront-edge-location',
    'route53-hosted-zone', 'route53-route-table',
    'elasticache-cache-node', 'elasticache-for-memcached', 'elasticache-for-redis',
    'efs-file-system', 'efs-one-zone',
    'sns-topic', 'sqs-queue', 'sqs-message',
    'kinesis-data-streams', 'kinesis-data-firehose',
    'apigateway-endpoint',
    'cognito-identity-pool',
    'iam-permissions', 'iam-role', 'iam-identity-center',
    'cloudwatch-alarm', 'cloudwatch-logs', 'cloudwatch-metrics-insights',
    'cloudformation-template', 'cloudformation-stack',
  ],
}

export function getIconUrl(vendor: VendorKey, id: string): string {
  const config = vendorConfig[vendor]
  return `${CDN_BASE_URL}/${vendor}/${id}.${config.ext}`
}
