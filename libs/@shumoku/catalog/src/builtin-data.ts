// Auto-generated from YAML data files — do not edit manually
// Run: bun src/build-data.ts

import type { CatalogEntry } from './types.js'

export const builtinData = [
  {
    id: 'allied/at-x230-18gp',
    label: 'Allied Telesis AT-x230-18GP',
    spec: {
      kind: 'hardware',
      type: 'l3-switch',
      vendor: 'allied',
      model: 'at-x230-18gp',
    },
    tags: ['l3-switch', 'poe-source', 'alliedware-plus'],
    properties: {
      power: {
        max_draw_w: 330,
        poe_out: {
          standard: '802.3at',
          budget_w: 247,
          max_per_port_w: 30,
          ports: 16,
        },
      },
      switching: {
        capacity_gbps: 36,
        forwarding_rate_mpps: 26.8,
        mac_table_size: 16000,
      },
      ports: {
        downlink: [
          {
            count: 16,
            name_pattern: 'port1.0.{n}',
            faceplate_label_pattern: '{n}',
            speed: '1g',
            cage: 'rj45',
            poe: true,
          },
        ],
        uplink: [
          {
            names: ['port1.0.17', 'port1.0.18'],
            faceplate_labels: ['17', '18'],
            speed: '1g',
            cage: 'sfp',
          },
        ],
      },
      physical: {
        form_factor: '1U',
        fanless: false,
        dimensions_mm: {
          w: 341,
          d: 231,
          h: 44,
        },
        weight_g: 3000,
        mounting: ['rack', 'desk'],
      },
      management: {
        layer: 3,
        stackable: false,
        image: 'alliedware-plus',
        protocols: [
          'ssh',
          'telnet',
          'http',
          'https',
          'snmp-v1',
          'snmp-v2c',
          'snmp-v3',
          'lldp',
          'rip',
          'static-routing',
        ],
      },
    },
  },
  {
    id: 'cisco/catalyst-2960l/ws-c2960l-24ps-jp',
    label: 'WS-C2960L-24PS-JP',
    spec: {
      kind: 'hardware',
      type: 'l2-switch',
      vendor: 'cisco',
      model: 'ws-c2960l-24ps-jp',
    },
    extends: 'cisco/catalyst-2960l',
    tags: ['poe-source', 'japan-sku'],
    properties: {
      power: {
        poe_out: {
          standard: '802.3at',
          budget_w: 195,
          max_per_port_w: 30,
          ports: 24,
        },
      },
      switching: {
        capacity_gbps: 56,
        forwarding_rate_mpps: 41.67,
      },
      physical: {
        fanless: true,
      },
      ports: {
        downlink: [
          {
            count: 24,
            name_pattern: 'Gi1/0/{n}',
            faceplate_label_pattern: '{n}',
            interface_name_pattern: 'GigabitEthernet1/0/{n}',
            speed: '1g',
            cage: 'rj45',
            poe: true,
          },
        ],
        uplink: [
          {
            names: ['Gi1/0/25', 'Gi1/0/26', 'Gi1/0/27', 'Gi1/0/28'],
            faceplate_labels: ['25', '26', '27', '28'],
            interface_names: [
              'GigabitEthernet1/0/25',
              'GigabitEthernet1/0/26',
              'GigabitEthernet1/0/27',
              'GigabitEthernet1/0/28',
            ],
            speed: '1g',
            cage: 'sfp',
          },
        ],
      },
      management: {
        layer: 2,
        image: 'lan-lite',
      },
    },
  },
  {
    id: 'cisco/catalyst-2960l/ws-c2960l-48ps-jp',
    label: 'WS-C2960L-48PS-JP',
    spec: {
      kind: 'hardware',
      type: 'l2-switch',
      vendor: 'cisco',
      model: 'ws-c2960l-48ps-jp',
    },
    extends: 'cisco/catalyst-2960l',
    tags: ['poe-source', 'japan-sku'],
    properties: {
      power: {
        poe_out: {
          standard: '802.3at',
          budget_w: 370,
          max_per_port_w: 30,
          ports: 48,
        },
      },
      switching: {
        capacity_gbps: 104,
        forwarding_rate_mpps: 77.38,
      },
      physical: {
        fanless: false,
      },
      ports: {
        downlink: [
          {
            count: 48,
            name_pattern: 'Gi1/0/{n}',
            faceplate_label_pattern: '{n}',
            interface_name_pattern: 'GigabitEthernet1/0/{n}',
            speed: '1g',
            cage: 'rj45',
            poe: true,
          },
        ],
        uplink: [
          {
            names: ['Gi1/0/49', 'Gi1/0/50', 'Gi1/0/51', 'Gi1/0/52'],
            faceplate_labels: ['49', '50', '51', '52'],
            interface_names: [
              'GigabitEthernet1/0/49',
              'GigabitEthernet1/0/50',
              'GigabitEthernet1/0/51',
              'GigabitEthernet1/0/52',
            ],
            speed: '1g',
            cage: 'sfp',
          },
        ],
      },
      management: {
        layer: 2,
        image: 'lan-lite',
      },
    },
  },
  {
    id: 'cisco/catalyst-2960l',
    label: 'Catalyst 2960-L Series',
    spec: {
      kind: 'hardware',
      type: 'l2-switch',
      vendor: 'cisco',
    },
    tags: ['l2-switch', 'access', 'campus', 'lan-lite'],
    properties: {
      switching: {
        mac_table_size: 16000,
        vlan_count: 256,
        jumbo_frame_bytes: 10240,
      },
      physical: {
        form_factor: '1U',
        operating_temp_c: {
          min: -5,
          max: 45,
        },
        mounting: ['rack'],
      },
      management: {
        stackable: false,
        protocols: [
          'snmp-v1',
          'snmp-v2c',
          'snmp-v3',
          'ssh',
          'telnet',
          'http',
          'https',
          'tftp',
          'syslog',
          'radius',
          'tacacs+',
        ],
        dram_mb: 512,
        flash_mb: 256,
      },
    },
  },
  {
    id: 'cisco/catalyst-3560cg/ws-c3560cg-8pc-s',
    label: 'WS-C3560CG-8PC-S',
    spec: {
      kind: 'hardware',
      type: 'l3-switch',
      vendor: 'cisco',
      model: 'ws-c3560cg-8pc-s',
    },
    extends: 'cisco/catalyst-3560cg',
    tags: ['poe-source'],
    properties: {
      power: {
        max_draw_w: 150,
        poe_out: {
          standard: '802.3at',
          budget_w: 124,
          max_per_port_w: 30,
          ports: 8,
        },
      },
      switching: {
        capacity_gbps: 20,
        forwarding_rate_mpps: 14.9,
      },
      physical: {
        dimensions_mm: {
          w: 270,
          d: 239,
          h: 44,
        },
        weight_g: 1950,
      },
      ports: {
        downlink: [
          {
            count: 8,
            name_pattern: 'Gi0/{n}',
            faceplate_label_pattern: '{n}',
            interface_name_pattern: 'GigabitEthernet0/{n}',
            speed: '1g',
            cage: 'rj45',
            poe: true,
          },
        ],
        uplink: [
          {
            names: ['Gi0/9', 'Gi0/10'],
            faceplate_labels: ['9', '10'],
            interface_names: ['GigabitEthernet0/9', 'GigabitEthernet0/10'],
            speed: '1g',
            cage: 'combo',
          },
        ],
      },
      management: {
        layer: 3,
        image: 'ip-base',
      },
    },
  },
  {
    id: 'cisco/catalyst-3560cg',
    label: 'Catalyst 3560-CG Compact Series',
    spec: {
      kind: 'hardware',
      type: 'l3-switch',
      vendor: 'cisco',
    },
    tags: ['l3-switch', 'compact', 'fanless', 'campus'],
    properties: {
      switching: {
        mac_table_size: 12000,
        vlan_count: 1005,
        jumbo_frame_bytes: 9198,
      },
      physical: {
        form_factor: 'compact',
        fanless: true,
        operating_temp_c: {
          min: -5,
          max: 45,
        },
        mounting: ['desk', 'wall', 'rack'],
      },
      management: {
        stackable: false,
        protocols: [
          'snmp-v1',
          'snmp-v2c',
          'snmp-v3',
          'ssh',
          'telnet',
          'http',
          'https',
          'tftp',
          'syslog',
          'radius',
          'tacacs+',
        ],
        dram_mb: 128,
        flash_mb: 64,
      },
    },
  },
  {
    id: 'cisco/catalyst-3560cx/ws-c3560cx-12pc-s',
    label: 'WS-C3560CX-12PC-S',
    spec: {
      kind: 'hardware',
      type: 'l3-switch',
      vendor: 'cisco',
      model: 'ws-c3560cx-12pc-s',
    },
    extends: 'cisco/catalyst-3560cx',
    tags: ['poe-source'],
    properties: {
      power: {
        max_draw_w: 310,
        poe_out: {
          standard: '802.3at',
          budget_w: 240,
          max_per_port_w: 30,
          ports: 12,
        },
      },
      switching: {
        capacity_gbps: 28,
        forwarding_rate_mpps: 20.83,
      },
      ports: {
        downlink: [
          {
            count: 12,
            name_pattern: 'Gi1/0/{n}',
            faceplate_label_pattern: '{n}',
            interface_name_pattern: 'GigabitEthernet1/0/{n}',
            speed: '1g',
            cage: 'rj45',
            poe: true,
          },
        ],
        uplink: [
          {
            names: ['Gi1/0/13', 'Gi1/0/14'],
            faceplate_labels: ['13', '14'],
            interface_names: ['GigabitEthernet1/0/13', 'GigabitEthernet1/0/14'],
            speed: '1g',
            cage: 'rj45',
          },
          {
            names: ['Gi1/0/15', 'Gi1/0/16'],
            faceplate_labels: ['15', '16'],
            interface_names: ['GigabitEthernet1/0/15', 'GigabitEthernet1/0/16'],
            speed: '1g',
            cage: 'sfp',
          },
        ],
      },
      management: {
        layer: 2,
        image: 'lan-base',
      },
    },
  },
  {
    id: 'cisco/catalyst-3560cx/ws-c3560cx-8pc-s',
    label: 'WS-C3560CX-8PC-S',
    spec: {
      kind: 'hardware',
      type: 'l3-switch',
      vendor: 'cisco',
      model: 'ws-c3560cx-8pc-s',
    },
    extends: 'cisco/catalyst-3560cx',
    tags: ['poe-source'],
    properties: {
      power: {
        max_draw_w: 300,
        poe_out: {
          standard: '802.3at',
          budget_w: 240,
          max_per_port_w: 30,
          ports: 8,
        },
      },
      switching: {
        capacity_gbps: 22,
        forwarding_rate_mpps: 16.07,
      },
      ports: {
        downlink: [
          {
            count: 8,
            name_pattern: 'Gi1/0/{n}',
            faceplate_label_pattern: '{n}',
            interface_name_pattern: 'GigabitEthernet1/0/{n}',
            speed: '1g',
            cage: 'rj45',
            poe: true,
          },
        ],
        uplink: [
          {
            names: ['Gi1/0/9', 'Gi1/0/10'],
            faceplate_labels: ['9', '10'],
            interface_names: ['GigabitEthernet1/0/9', 'GigabitEthernet1/0/10'],
            speed: '1g',
            cage: 'rj45',
          },
          {
            names: ['Gi1/0/11', 'Gi1/0/12'],
            faceplate_labels: ['11', '12'],
            interface_names: ['GigabitEthernet1/0/11', 'GigabitEthernet1/0/12'],
            speed: '1g',
            cage: 'sfp',
          },
        ],
      },
      management: {
        layer: 2,
        image: 'lan-base',
      },
    },
  },
  {
    id: 'cisco/catalyst-3560cx/ws-c3560cx-8tc-s',
    label: 'WS-C3560CX-8TC-S',
    spec: {
      kind: 'hardware',
      type: 'l3-switch',
      vendor: 'cisco',
      model: 'ws-c3560cx-8tc-s',
    },
    extends: 'cisco/catalyst-3560cx',
    tags: [],
    properties: {
      power: {
        max_draw_w: 24,
      },
      switching: {
        capacity_gbps: 22,
        forwarding_rate_mpps: 16.07,
      },
      ports: {
        downlink: [
          {
            count: 8,
            name_pattern: 'Gi1/0/{n}',
            faceplate_label_pattern: '{n}',
            interface_name_pattern: 'GigabitEthernet1/0/{n}',
            speed: '1g',
            cage: 'rj45',
          },
        ],
        uplink: [
          {
            names: ['Gi1/0/9', 'Gi1/0/10'],
            faceplate_labels: ['9', '10'],
            interface_names: ['GigabitEthernet1/0/9', 'GigabitEthernet1/0/10'],
            speed: '1g',
            cage: 'rj45',
          },
          {
            names: ['Gi1/0/11', 'Gi1/0/12'],
            faceplate_labels: ['11', '12'],
            interface_names: ['GigabitEthernet1/0/11', 'GigabitEthernet1/0/12'],
            speed: '1g',
            cage: 'sfp',
          },
        ],
      },
      management: {
        layer: 2,
        image: 'lan-base',
      },
    },
  },
  {
    id: 'cisco/catalyst-3560cx',
    label: 'Catalyst 3560-CX Series',
    spec: {
      kind: 'hardware',
      type: 'l3-switch',
      vendor: 'cisco',
    },
    tags: ['l3-switch', 'compact', 'fanless', 'campus'],
    properties: {
      switching: {
        mac_table_size: 16000,
        vlan_count: 1023,
        jumbo_frame_bytes: 9198,
      },
      physical: {
        form_factor: 'compact',
        fanless: true,
        operating_temp_c: {
          min: 0,
          max: 45,
        },
        mounting: ['desk', 'wall', 'rack'],
      },
      management: {
        stackable: false,
        protocols: ['snmp-v1', 'snmp-v2c', 'snmp-v3', 'ssh', 'cli', 'web'],
        dram_mb: 512,
        flash_mb: 256,
      },
    },
  },
  {
    id: 'cisco/catalyst-4948e/ws-c4948e',
    label: 'WS-C4948E',
    spec: {
      kind: 'hardware',
      type: 'l3-switch',
      vendor: 'cisco',
      model: 'ws-c4948e',
    },
    extends: 'cisco/catalyst-4948e',
    tags: [],
    properties: {
      power: {
        max_draw_w: 300,
      },
      ports: {
        downlink: [
          {
            count: 48,
            name_pattern: 'Gi1/{n}',
            faceplate_label_pattern: '{n}',
            interface_name_pattern: 'GigabitEthernet1/{n}',
            speed: '1g',
            cage: 'rj45',
          },
        ],
        uplink: [
          {
            names: ['Te1/49', 'Te1/50', 'Te1/51', 'Te1/52'],
            faceplate_labels: ['49', '50', '51', '52'],
            interface_names: [
              'TenGigabitEthernet1/49',
              'TenGigabitEthernet1/50',
              'TenGigabitEthernet1/51',
              'TenGigabitEthernet1/52',
            ],
            speed: '10g',
            cage: 'sfp+',
          },
        ],
      },
      management: {
        layer: 3,
        image: 'ip-base',
      },
    },
  },
  {
    id: 'cisco/catalyst-4948e',
    label: 'Catalyst 4948E',
    spec: {
      kind: 'hardware',
      type: 'l3-switch',
      vendor: 'cisco',
    },
    tags: ['l3-switch', 'top-of-rack', 'datacenter', 'dual-psu'],
    properties: {
      switching: {
        capacity_gbps: 96,
        forwarding_rate_mpps: 72,
        mac_table_size: 32000,
        vlan_count: 4094,
        jumbo_frame_bytes: 9216,
      },
      physical: {
        form_factor: '1U',
        fanless: false,
        dimensions_mm: {
          w: 445,
          d: 493,
          h: 43,
        },
        weight_g: 6400,
        operating_temp_c: {
          min: 0,
          max: 40,
        },
        mounting: ['rack'],
      },
      management: {
        stackable: false,
        protocols: [
          'snmp-v1',
          'snmp-v2c',
          'snmp-v3',
          'ssh',
          'telnet',
          'http',
          'https',
          'tftp',
          'syslog',
          'radius',
          'tacacs+',
          'ospf',
          'eigrp',
          'bgp',
          'is-is',
        ],
        dram_mb: 256,
        flash_mb: 64,
      },
    },
  },
  {
    id: 'cisco/catalyst-9200l/c9200l-24t-4x-e',
    label: 'C9200L-24T-4X-E',
    spec: {
      kind: 'hardware',
      type: 'l3-switch',
      vendor: 'cisco',
      model: 'c9200l-24t-4x-e',
    },
    extends: 'cisco/catalyst-9200l',
    tags: ['non-poe', 'network-essentials'],
    properties: {
      power: {
        max_draw_w: 36.28,
      },
      switching: {
        capacity_gbps: 128,
        forwarding_rate_mpps: 190.4,
      },
      physical: {
        dimensions_mm: {
          w: 445,
          d: 288,
          h: 44,
        },
        weight_g: 4350,
      },
      ports: {
        downlink: [
          {
            count: 24,
            name_pattern: 'Gi1/0/{n}',
            faceplate_label_pattern: '{n}',
            interface_name_pattern: 'GigabitEthernet1/0/{n}',
            speed: '1g',
            cage: 'rj45',
          },
        ],
        uplink: [
          {
            count: 4,
            name_pattern: 'Te1/1/{n}',
            faceplate_label_pattern: '{n}',
            interface_name_pattern: 'TenGigabitEthernet1/1/{n}',
            speed: '10g',
            cage: 'sfp+',
          },
        ],
      },
      management: {
        layer: 3,
        image: 'network-essentials',
      },
    },
  },
  {
    id: 'cisco/catalyst-9200l',
    label: 'Catalyst 9200L Series',
    spec: {
      kind: 'hardware',
      type: 'l3-switch',
      vendor: 'cisco',
    },
    tags: ['l3-switch', 'stackable', 'access', 'enterprise'],
    properties: {
      switching: {
        mac_table_size: 16000,
        vlan_count: 4094,
        jumbo_frame_bytes: 9198,
      },
      physical: {
        form_factor: '1U',
        fanless: false,
        operating_temp_c: {
          min: -5,
          max: 45,
        },
        mounting: ['rack'],
      },
      management: {
        stackable: true,
        stack_members_max: 8,
        protocols: [
          'snmp-v1',
          'snmp-v2c',
          'snmp-v3',
          'ssh',
          'telnet',
          'https',
          'netconf',
          'restconf',
          'syslog',
          'radius',
          'tacacs+',
        ],
        dram_mb: 2048,
        flash_mb: 4096,
      },
    },
  },
  {
    id: 'cisco/catalyst-9300/c9300-24ux',
    label: 'C9300-24UX',
    spec: {
      kind: 'hardware',
      type: 'l3-switch',
      vendor: 'cisco',
      model: 'c9300-24ux',
    },
    extends: 'cisco/catalyst-9300',
    tags: ['poe-source', 'upoe', 'mgig'],
    properties: {
      switching: {
        capacity_gbps: 640,
        forwarding_rate_mpps: 476.19,
      },
      power: {
        poe_out: {
          standard: 'cisco-upoe',
          budget_w: 560,
          max_per_port_w: 60,
          ports: 24,
        },
      },
      physical: {
        dimensions_mm: {
          w: 445,
          d: 513,
          h: 44,
        },
        weight_g: 8250,
      },
      ports: {
        downlink: [
          {
            count: 24,
            name_pattern: 'Gi1/0/{n}',
            faceplate_label_pattern: '{n}',
            interface_name_pattern: 'GigabitEthernet1/0/{n}',
            speed: '10g',
            cage: 'rj45',
            poe: true,
          },
        ],
      },
      management: {
        layer: 3,
        image: 'network-advantage',
      },
    },
  },
  {
    id: 'cisco/catalyst-9300',
    label: 'Catalyst 9300 Series',
    spec: {
      kind: 'hardware',
      type: 'l3-switch',
      vendor: 'cisco',
    },
    tags: ['l3-switch', 'stackable', 'enterprise', 'modular-uplink'],
    properties: {
      switching: {
        mac_table_size: 32000,
        vlan_count: 4094,
        jumbo_frame_bytes: 9198,
      },
      physical: {
        form_factor: '1U',
        fanless: false,
        operating_temp_c: {
          min: -5,
          max: 45,
        },
        mounting: ['rack'],
      },
      management: {
        stackable: true,
        stack_members_max: 8,
        protocols: [
          'snmp-v1',
          'snmp-v2c',
          'snmp-v3',
          'ssh',
          'telnet',
          'https',
          'netconf',
          'restconf',
          'gnmi',
          'syslog',
          'radius',
          'tacacs+',
          'ospf',
          'eigrp',
          'bgp',
          'is-is',
        ],
        dram_mb: 8192,
        flash_mb: 16384,
      },
    },
  },
  {
    id: 'dell/optiplex-3070-micro',
    label: 'Dell OptiPlex 3070 Micro',
    spec: {
      kind: 'hardware',
      type: 'server',
      vendor: 'dell',
      model: 'optiplex-3070-micro',
    },
    tags: ['pc', 'mini-pc', 'desktop', 'compact'],
    properties: {
      ports: {
        lan: [
          {
            names: ['NIC'],
            faceplate_labels: ['LAN'],
            speed: '1g',
            cage: 'rj45',
          },
        ],
      },
      physical: {
        form_factor: 'compact',
        dimensions_mm: {
          w: 36,
          d: 182,
          h: 178,
        },
        mounting: ['desk'],
      },
    },
  },
  {
    id: 'fs/s3100-8tms-p',
    label: 'FS S3100-8TMS-P',
    spec: {
      kind: 'hardware',
      type: 'l2-switch',
      vendor: 'fs',
      model: 's3100-8tms-p',
    },
    tags: ['l2-switch', 'smart-managed', 'poe-source', 'multi-gig', 'fanless'],
    properties: {
      power: {
        poe_out: {
          standard: '802.3at',
          budget_w: 125,
          max_per_port_w: 30,
          ports: 8,
        },
      },
      switching: {
        capacity_gbps: 76,
        forwarding_rate_mpps: 49.1,
      },
      ports: {
        downlink: [
          {
            count: 6,
            name_pattern: 'GE{n}',
            faceplate_label_pattern: '{n}',
            speed: '1g',
            cage: 'rj45',
            poe: true,
          },
          {
            names: ['GE7', 'GE8'],
            faceplate_labels: ['7', '8'],
            speed: '1g',
            cage: 'rj45',
          },
          {
            names: ['MGE1', 'MGE2'],
            faceplate_labels: ['MG1', 'MG2'],
            speed: '5g',
            cage: 'rj45',
            poe: true,
          },
        ],
        uplink: [
          {
            names: ['XGE1', 'XGE2'],
            faceplate_labels: ['X1', 'X2'],
            speed: '10g',
            cage: 'sfp+',
          },
        ],
      },
      physical: {
        form_factor: 'desktop',
        fanless: true,
        mounting: ['desk', 'wall', 'rack'],
      },
      management: {
        layer: 2,
        image: 'airware',
        protocols: [
          'ssh',
          'telnet',
          'http',
          'https',
          'snmp-v2c',
          'snmp-v3',
          'lacp',
          'lldp',
          'igmp-snooping',
          'voice-vlan',
        ],
      },
    },
  },
  {
    id: 'generic/ip-phone',
    label: 'IP Phone',
    spec: {
      kind: 'hardware',
      type: 'cpe',
      vendor: 'generic',
      model: 'ip-phone',
    },
    tags: ['poe-consumer', 'voip'],
    properties: {
      power: {
        max_draw_w: 5,
        poe_in: {
          standard: '802.3af',
          class: 2,
          max_draw_w: 5,
        },
      },
    },
  },
  {
    id: 'hpe/aruba-ap-315',
    label: 'Aruba AP-315',
    spec: {
      kind: 'hardware',
      type: 'access-point',
      vendor: 'hpe',
      model: 'aruba-ap-315',
    },
    tags: ['wifi-5', 'indoor', 'ceiling-mount', 'poe-consumer', 'apin0315'],
    properties: {
      power: {
        max_draw_w: 14.4,
        poe_in: {
          standard: '802.3at',
          class: 4,
          min_class: 3,
          max_draw_w: 14.4,
          by_class: {
            '3': {
              standard: '802.3af',
              max_draw_w: 13.6,
              note: 'On 802.3af without IPM: USB disabled, 2.4 GHz TX -3 dB',
            },
            '4': {
              standard: '802.3at',
              max_draw_w: 14.4,
            },
          },
        },
      },
      wireless: {
        standard: 'wifi-5',
        radios: 2,
        mimo: '4x4:4',
        bands: ['2.4ghz', '5ghz'],
        antenna_type: 'internal',
        max_data_rate_mbps: 2033,
      },
      ports: {
        uplink: [
          {
            names: ['E0'],
            speed: '1g',
            cage: 'rj45',
            poe: true,
          },
        ],
      },
      physical: {
        form_factor: 'ceiling',
        dimensions_mm: {
          w: 182,
          d: 180,
          h: 48,
        },
        weight_g: 650,
        mounting: ['ceiling', 'wall'],
        operating_temp_c: {
          min: 0,
          max: 50,
        },
      },
    },
  },
  {
    id: 'hpe/aruba-ap-505',
    label: 'Aruba AP-505',
    spec: {
      kind: 'hardware',
      type: 'access-point',
      vendor: 'hpe',
      model: 'aruba-ap-505',
    },
    tags: ['wifi-6', 'indoor', 'ceiling-mount', 'poe-consumer'],
    properties: {
      power: {
        max_draw_w: 16.5,
        poe_in: {
          standard: '802.3at',
          class: 4,
          min_class: 3,
          max_draw_w: 16.5,
          by_class: {
            '3': {
              standard: '802.3af',
              max_draw_w: 11,
              note: 'Reduced mode — USB disabled, reduced radio capability',
            },
            '4': {
              standard: '802.3at',
              max_draw_w: 16.5,
            },
          },
        },
      },
      wireless: {
        standard: 'wifi-6',
        radios: 2,
        mimo: '2x2',
        bands: ['2.4ghz', '5ghz'],
        antenna_type: 'internal',
      },
      ports: {
        uplink: [
          {
            names: ['E0'],
            speed: '1g',
            cage: 'rj45',
          },
        ],
      },
      physical: {
        form_factor: 'ceiling',
        dimensions_mm: {
          w: 160,
          d: 161,
          h: 37,
        },
        weight_g: 500,
        mounting: ['ceiling', 'wall'],
      },
    },
  },
  {
    id: 'hpe/aruba-ap-515',
    label: 'Aruba AP-515',
    spec: {
      kind: 'hardware',
      type: 'access-point',
      vendor: 'hpe',
      model: 'aruba-ap-515',
    },
    tags: ['wifi-6', 'indoor', 'ceiling-mount', 'poe-consumer', 'smart-rate', 'apin0515'],
    properties: {
      power: {
        max_draw_w: 20.8,
        poe_in: {
          standard: '802.3at',
          class: 4,
          min_class: 3,
          max_draw_w: 20.8,
          by_class: {
            '3': {
              standard: '802.3af',
              max_draw_w: 13.5,
              note: 'IPM-enabled reduced mode on 802.3af',
            },
            '4': {
              standard: '802.3at',
              max_draw_w: 20.8,
            },
          },
        },
      },
      wireless: {
        standard: 'wifi-6',
        radios: 2,
        mimo: '4x4:4',
        bands: ['2.4ghz', '5ghz'],
        antenna_type: 'internal',
        max_data_rate_mbps: 2690,
      },
      ports: {
        uplink: [
          {
            names: ['E0'],
            speed: '2.5g',
            cage: 'rj45',
            poe: true,
          },
        ],
        lan: [
          {
            names: ['E1'],
            speed: '1g',
            cage: 'rj45',
          },
        ],
      },
      physical: {
        form_factor: 'ceiling',
        dimensions_mm: {
          w: 200,
          d: 200,
          h: 46,
        },
        weight_g: 810,
        mounting: ['ceiling', 'wall'],
      },
    },
  },
  {
    id: 'hpe/aruba-ap-535',
    label: 'Aruba AP-535',
    spec: {
      kind: 'hardware',
      type: 'access-point',
      vendor: 'hpe',
      model: 'aruba-ap-535',
    },
    tags: ['wifi-6', 'indoor', 'ceiling-mount', 'poe-consumer', 'smart-rate', 'lacp', 'apin0535'],
    properties: {
      power: {
        max_draw_w: 30,
        poe_in: {
          standard: '802.3bt',
          class: 5,
          min_class: 4,
          max_draw_w: 30,
          by_class: {
            '4': {
              standard: '802.3at',
              max_draw_w: 25,
              note: 'Single 802.3at: USB+E1 disabled without IPM. Dual 802.3at (E0+E1) = full 30W. 802.3af is NOT supported.',
            },
            '5': {
              standard: '802.3bt',
              max_draw_w: 30,
            },
          },
        },
      },
      wireless: {
        standard: 'wifi-6',
        radios: 2,
        mimo: '4x4:4',
        bands: ['2.4ghz', '5ghz'],
        antenna_type: 'internal',
        max_data_rate_mbps: 3550,
      },
      ports: {
        uplink: [
          {
            names: ['E0', 'E1'],
            speed: '5g',
            cage: 'rj45',
            poe: true,
          },
        ],
      },
      physical: {
        form_factor: 'ceiling',
        dimensions_mm: {
          w: 240,
          d: 240,
          h: 57,
        },
        mounting: ['ceiling', 'wall'],
        operating_temp_c: {
          min: 0,
          max: 50,
        },
      },
    },
  },
  {
    id: 'hpe/aruba-instant-on-1830-48g-class4-poe',
    label: 'Aruba Instant On 1830 48G PoE+ (JL815A)',
    spec: {
      kind: 'hardware',
      type: 'l2-switch',
      vendor: 'hpe',
      model: 'aruba-instant-on-1830-48g-class4-poe',
    },
    tags: ['l2-switch', 'smart-managed', 'poe-source', 'fanless', 'jl815a'],
    properties: {
      power: {
        max_draw_w: 462.5,
        poe_out: {
          standard: '802.3at',
          budget_w: 370,
          max_per_port_w: 30,
          ports: 24,
        },
      },
      switching: {
        capacity_gbps: 104,
        forwarding_rate_mpps: 77.37,
        mac_table_size: 16384,
        vlan_count: 256,
        jumbo_frame_bytes: 10240,
      },
      ports: {
        downlink: [
          {
            count: 24,
            name_pattern: '{n}',
            faceplate_label_pattern: '{n}',
            speed: '1g',
            cage: 'rj45',
            poe: true,
          },
          {
            names: [
              '25',
              '26',
              '27',
              '28',
              '29',
              '30',
              '31',
              '32',
              '33',
              '34',
              '35',
              '36',
              '37',
              '38',
              '39',
              '40',
              '41',
              '42',
              '43',
              '44',
              '45',
              '46',
              '47',
              '48',
            ],
            faceplate_labels: [
              '25',
              '26',
              '27',
              '28',
              '29',
              '30',
              '31',
              '32',
              '33',
              '34',
              '35',
              '36',
              '37',
              '38',
              '39',
              '40',
              '41',
              '42',
              '43',
              '44',
              '45',
              '46',
              '47',
              '48',
            ],
            speed: '1g',
            cage: 'rj45',
          },
        ],
        uplink: [
          {
            names: ['49', '50', '51', '52'],
            faceplate_labels: ['49', '50', '51', '52'],
            speed: '1g',
            cage: 'sfp',
          },
        ],
      },
      physical: {
        form_factor: '1U',
        fanless: true,
        mounting: ['rack', 'desk'],
      },
      management: {
        layer: 2,
        stackable: false,
        dram_mb: 512,
        flash_mb: 256,
        protocols: [
          'snmp-v1',
          'snmp-v2c',
          'ssh',
          'https',
          'lldp',
          'lacp',
          'igmp-snooping',
          'stp',
          'rstp',
          'mstp',
        ],
      },
    },
  },
  {
    id: 'hpe/aruba-instant-on-ap11',
    label: 'Aruba Instant On AP11',
    spec: {
      kind: 'hardware',
      type: 'access-point',
      vendor: 'hpe',
      model: 'aruba-instant-on-ap11',
    },
    tags: ['wifi-5', 'indoor', 'ceiling-mount', 'poe-consumer', 'apin0303'],
    properties: {
      power: {
        max_draw_w: 10.1,
        poe_in: {
          standard: '802.3af',
          class: 3,
          min_class: 3,
          max_draw_w: 10.1,
        },
      },
      wireless: {
        standard: 'wifi-5',
        radios: 2,
        mimo: '2x2',
        bands: ['2.4ghz', '5ghz'],
        antenna_type: 'internal',
        max_data_rate_mbps: 1167,
      },
      ports: {
        uplink: [
          {
            names: ['E0'],
            speed: '1g',
            cage: 'rj45',
            poe: true,
          },
        ],
      },
      physical: {
        form_factor: 'ceiling',
        dimensions_mm: {
          w: 152,
          d: 152,
          h: 34,
        },
        weight_g: 193,
        mounting: ['ceiling', 'wall'],
        operating_temp_c: {
          min: 0,
          max: 40,
        },
      },
    },
  },
  {
    id: 'hpe/aruba-instant-on-ap11d',
    label: 'Aruba Instant On AP11D',
    spec: {
      kind: 'hardware',
      type: 'access-point',
      vendor: 'hpe',
      model: 'aruba-instant-on-ap11d',
    },
    tags: ['wifi-5', 'desk', 'poe-consumer', 'poe-passthrough'],
    properties: {
      power: {
        max_draw_w: 27.4,
        poe_in: {
          standard: '802.3at',
          class: 4,
          max_draw_w: 27.4,
        },
        poe_out: {
          standard: '802.3af',
          budget_w: 15.4,
          max_per_port_w: 15.4,
          ports: 1,
        },
      },
      wireless: {
        standard: 'wifi-5',
        radios: 2,
        mimo: '2x2',
        bands: ['2.4ghz', '5ghz'],
        antenna_type: 'internal',
      },
      ports: {
        downlink: [
          {
            names: ['E1', 'E2'],
            speed: '1g',
            cage: 'rj45',
          },
          {
            names: ['E3'],
            speed: '1g',
            cage: 'rj45',
            poe: true,
          },
        ],
        uplink: [
          {
            names: ['E0/PT'],
            speed: '1g',
            cage: 'rj45',
          },
        ],
      },
      physical: {
        form_factor: 'desktop',
        dimensions_mm: {
          w: 86,
          d: 150,
          h: 40,
        },
        weight_g: 313,
        mounting: ['desk', 'wall'],
      },
    },
  },
  {
    id: 'hpe/proliant-dl360-gen10',
    label: 'HPE ProLiant DL360 Gen10',
    spec: {
      kind: 'hardware',
      type: 'server',
      vendor: 'hpe',
      model: 'proliant-dl360-gen10',
    },
    tags: ['server', '1u', 'rack', 'redundant-psu', 'ilo5'],
    properties: {
      ports: {
        lan: [
          {
            count: 4,
            name_pattern: 'NIC{n}',
            faceplate_label_pattern: '{n}',
            speed: '1g',
            cage: 'rj45',
          },
        ],
        management: [
          {
            names: ['iLO'],
            faceplate_labels: ['iLO'],
            speed: '1g',
            cage: 'rj45',
          },
        ],
      },
      physical: {
        form_factor: '1U',
        mounting: ['rack'],
      },
      management: {
        protocols: ['ipmi', 'redfish', 'snmp-v2c', 'snmp-v3', 'ssh', 'https'],
      },
    },
  },
  {
    id: 'hpe/proliant-dl380p-gen8',
    label: 'HPE ProLiant DL380p Gen8',
    spec: {
      kind: 'hardware',
      type: 'server',
      vendor: 'hpe',
      model: 'proliant-dl380p-gen8',
    },
    tags: ['server', '2u', 'rack', 'redundant-psu', 'ilo4', 'discontinued'],
    properties: {
      ports: {
        lan: [
          {
            count: 4,
            name_pattern: 'NIC{n}',
            faceplate_label_pattern: '{n}',
            speed: '1g',
            cage: 'rj45',
          },
        ],
        management: [
          {
            names: ['iLO'],
            faceplate_labels: ['iLO'],
            speed: '1g',
            cage: 'rj45',
          },
        ],
      },
      physical: {
        form_factor: '2U',
        mounting: ['rack'],
      },
      management: {
        protocols: ['ipmi', 'redfish', 'snmp-v2c', 'snmp-v3', 'ssh', 'https'],
      },
    },
  },
  {
    id: 'nec/ix2106',
    label: 'NEC UNIVERGE IX2106',
    spec: {
      kind: 'hardware',
      type: 'router',
      vendor: 'nec',
      model: 'ix2106',
    },
    tags: ['router', 'branch', 'compact', 'fanless', 'ipsec', 'l2tp'],
    properties: {
      power: {
        max_draw_w: 7,
      },
      ports: {
        wan: [
          {
            names: ['GE0'],
            faceplate_labels: ['WAN'],
            interface_names: ['GigaEthernet0.0'],
            speed: '1g',
            cage: 'rj45',
          },
        ],
        lan: [
          {
            count: 4,
            name_pattern: 'LAN{n}',
            faceplate_label_pattern: '{n}',
            interface_name_pattern: 'GigaEthernet1.0',
            speed: '1g',
            cage: 'rj45',
          },
        ],
      },
      physical: {
        form_factor: 'compact',
        fanless: true,
        dimensions_mm: {
          w: 135,
          d: 196,
          h: 36,
        },
        operating_temp_c: {
          min: 0,
          max: 50,
        },
        mounting: ['desk', 'wall', 'rack'],
      },
      management: {
        layer: 3,
        dram_mb: 256,
        protocols: [
          'ipsec',
          'ikev1',
          'ikev2',
          'l2tpv2',
          'l2tp-ipsec',
          'etherip',
          'gre',
          'ospf',
          'bgp4',
          'pppoe',
          'dhcp',
          'nat',
          'snmp-v1',
          'snmp-v2c',
          'snmp-v3',
          'ssh',
          'telnet',
        ],
      },
    },
  },
  {
    id: 'nec/ix3315',
    label: 'NEC UNIVERGE IX3315',
    spec: {
      kind: 'hardware',
      type: 'router',
      vendor: 'nec',
      model: 'ix3315',
    },
    tags: ['router', 'edge', 'enterprise', 'ipsec', 'openflow', 'sdn'],
    properties: {
      power: {
        max_draw_w: 75,
      },
      ports: {
        wan: [
          {
            names: ['GE0', 'GE1'],
            faceplate_labels: ['WAN1', 'WAN2'],
            speed: '10g',
            cage: 'combo',
          },
          {
            names: ['GE2', 'GE3'],
            faceplate_labels: ['SFP1', 'SFP2'],
            speed: '1g',
            cage: 'sfp',
          },
        ],
        lan: [
          {
            count: 16,
            name_pattern: 'LAN{n}',
            faceplate_label_pattern: '{n}',
            speed: '1g',
            cage: 'rj45',
          },
        ],
      },
      physical: {
        form_factor: '1U',
        fanless: false,
        dimensions_mm: {
          w: 430,
          d: 393,
          h: 43,
        },
        weight_g: 5500,
        mounting: ['rack'],
      },
      management: {
        layer: 3,
        protocols: [
          'ipsec',
          'ikev1',
          'ikev2',
          'l2tpv2',
          'l2tp-ipsec',
          'etherip',
          'gre',
          'ospfv2',
          'ospfv3',
          'bgp4',
          'pppoe',
          'dhcp',
          'nat',
          'openflow',
          'snmp-v1',
          'snmp-v2c',
          'snmp-v3',
          'ssh',
          'telnet',
        ],
      },
    },
  },
  {
    id: 'netgear/gs108pp',
    label: 'Netgear GS108PP',
    spec: {
      kind: 'hardware',
      type: 'l2-switch',
      vendor: 'netgear',
      model: 'gs108pp',
    },
    tags: ['l2-switch', 'unmanaged', 'poe-source', 'desktop', 'smb'],
    properties: {
      power: {
        poe_out: {
          standard: '802.3at',
          budget_w: 123,
          max_per_port_w: 30,
          ports: 8,
        },
      },
      switching: {
        capacity_gbps: 16,
        mac_table_size: 4000,
      },
      ports: {
        downlink: [
          {
            count: 8,
            name_pattern: '{n}',
            faceplate_label_pattern: '{n}',
            speed: '1g',
            cage: 'rj45',
            poe: true,
          },
        ],
      },
      physical: {
        form_factor: 'desktop',
        fanless: false,
        dimensions_mm: {
          w: 236,
          d: 102,
          h: 27,
        },
        weight_g: 600,
        mounting: ['desk', 'wall', 'rack'],
      },
      management: {
        layer: 2,
        stackable: false,
        protocols: [],
      },
    },
  },
  {
    id: 'panasonic/switch-m8egpwr-plus',
    label: 'Switch-M8eGPWR+ (PN28089K)',
    spec: {
      kind: 'hardware',
      type: 'l2-switch',
      vendor: 'panasonic',
      model: 'switch-m8egpwr-plus',
    },
    tags: ['poe-source', 'l2-switch', 'managed', 'poe-plus'],
    properties: {
      power: {
        max_draw_w: 310,
        idle_draw_w: 17,
        poe_out: {
          standard: '802.3at',
          budget_w: 240,
          max_per_port_w: 30,
          ports: 8,
        },
      },
      switching: {
        capacity_gbps: 20,
        forwarding_rate_mpps: 14.8,
        mac_table_size: 8000,
      },
      ports: {
        downlink: [
          {
            names: ['1', '2', '3', '4', '5', '6', '7', '8'],
            speed: '1g',
            cage: 'rj45',
            poe: true,
          },
        ],
        uplink: [
          {
            names: ['9', '10'],
            speed: '1g',
            cage: 'combo',
          },
        ],
      },
      physical: {
        form_factor: '1U',
        dimensions_mm: {
          w: 330,
          d: 250,
          h: 44,
        },
        weight_g: 3000,
        mounting: ['rack'],
      },
      management: {
        layer: 2,
        protocols: ['snmp-v1', 'snmp-v2c', 'ssh', 'cli', 'web'],
      },
    },
  },
  {
    id: 'panasonic/switch-m8epwr',
    label: 'Switch-M8ePWR (PN27089K)',
    spec: {
      kind: 'hardware',
      type: 'l2-switch',
      vendor: 'panasonic',
      model: 'switch-m8epwr',
    },
    tags: ['poe-source', 'l2-switch', 'managed'],
    properties: {
      power: {
        max_draw_w: 161,
        idle_draw_w: 10.6,
        poe_out: {
          standard: '802.3af',
          budget_w: 124,
          max_per_port_w: 15.4,
          ports: 8,
        },
      },
      switching: {
        capacity_gbps: 5.6,
        forwarding_rate_mpps: 4.1,
        mac_table_size: 16000,
        buffer_mb: 1.5,
      },
      ports: {
        downlink: [
          {
            names: ['1', '2', '3', '4', '5', '6', '7', '8'],
            speed: '100m',
            cage: 'rj45',
            poe: true,
          },
        ],
        uplink: [
          {
            names: ['9', '10'],
            speed: '1g',
            cage: 'combo',
          },
        ],
      },
      physical: {
        form_factor: '1U',
        dimensions_mm: {
          w: 210,
          d: 280,
          h: 44,
        },
        weight_g: 2300,
        mounting: ['rack'],
      },
      management: {
        layer: 2,
        protocols: ['snmp-v1', 'snmp-v2c', 'ssh', 'cli', 'web'],
      },
    },
  },
  {
    id: 'seiko/ts-2210',
    label: 'Seiko TS-2210',
    spec: {
      kind: 'hardware',
      type: 'generic',
      vendor: 'seiko',
      model: 'ts-2210',
    },
    tags: ['time-server', 'ntp', 'gps', 'discontinued'],
    properties: {
      ports: {
        management: [
          {
            names: ['MGMT'],
            speed: '100m',
            cage: 'rj45',
          },
        ],
      },
      physical: {
        form_factor: '1U',
        mounting: ['rack'],
      },
      management: {
        protocols: ['ntp', 'snmp-v2c', 'snmp-v3', 'ssh', 'https', 'syslog'],
      },
    },
  },
  {
    id: 'yamaha/rtx1210',
    label: 'Yamaha RTX1210',
    spec: {
      kind: 'hardware',
      type: 'router',
      vendor: 'yamaha',
      model: 'rtx1210',
    },
    tags: ['router', 'vpn', 'ipsec', 'l2tpv3', 'fanless', 'smb'],
    properties: {
      power: {
        max_draw_w: 14.5,
      },
      ports: {
        lan: [
          {
            count: 8,
            name_pattern: 'LAN1.{n}',
            faceplate_label_pattern: '{n}',
            interface_name_pattern: 'LAN1',
            speed: '1g',
            cage: 'rj45',
          },
          {
            names: ['LAN2'],
            faceplate_labels: ['LAN2'],
            speed: '1g',
            cage: 'rj45',
          },
          {
            names: ['LAN3'],
            faceplate_labels: ['LAN3'],
            speed: '1g',
            cage: 'rj45',
          },
        ],
      },
      physical: {
        form_factor: 'desktop',
        fanless: true,
        dimensions_mm: {
          w: 220,
          d: 239,
          h: 42,
        },
        weight_g: 1500,
        operating_temp_c: {
          min: 0,
          max: 45,
        },
        mounting: ['desk', 'wall', 'rack'],
      },
      management: {
        layer: 3,
        dram_mb: 256,
        flash_mb: 32,
        protocols: [
          'ipsec',
          'ikev1',
          'ikev2',
          'l2tpv3',
          'l2tp-ipsec',
          'gre',
          'ospf',
          'bgp',
          'pppoe',
          'dhcp',
          'nat',
          'snmp-v1',
          'snmp-v2c',
          'snmp-v3',
          'ssh',
          'telnet',
          'https',
          'syslog',
        ],
      },
    },
  },
] as unknown as CatalogEntry[]
