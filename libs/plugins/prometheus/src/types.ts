/**
 * Prometheus metric presets for common exporters
 */
export type PrometheusMetricPreset = 'snmp' | 'node_exporter' | 'custom'

/**
 * Custom metric configuration for Prometheus
 */
export interface PrometheusCustomMetrics {
  /** Metric name for inbound octets (e.g., "ifHCInOctets") */
  inOctets: string
  /** Metric name for outbound octets (e.g., "ifHCOutOctets") */
  outOctets: string
  /** Label name for interface identification (e.g., "ifName" or "device") */
  interfaceLabel: string
  /** Metric name for host up/down status (e.g., "up") */
  upMetric?: string
}

export interface PrometheusPluginConfig {
  /** Prometheus server URL */
  url: string
  /** Basic auth credentials (optional) */
  basicAuth?: {
    username: string
    password: string
  }
  /** Metric preset - determines which exporter's metric names to use */
  preset: PrometheusMetricPreset
  /** Custom metrics configuration (required when preset is 'custom') */
  customMetrics?: PrometheusCustomMetrics
  /** Label name used to identify hosts (default: "instance") */
  hostLabel?: string
  /** Additional label to filter hosts (e.g., "job") */
  jobFilter?: string
  /** Alertmanager URL (optional, derived from url if not specified) */
  alertmanagerUrl?: string
}

/**
 * Prometheus-specific mapping format
 */
export interface PrometheusNodeMapping {
  /** Instance label value (e.g., "192.168.1.1:9116") */
  instance?: string
  /** Job label value for filtering */
  job?: string
}

export interface PrometheusLinkMapping {
  /** Instance label value */
  instance?: string
  /** Interface label value (e.g., "eth0" or "GigabitEthernet0/0") */
  interface?: string
  /** Link capacity in bits per second */
  capacity?: number
}
