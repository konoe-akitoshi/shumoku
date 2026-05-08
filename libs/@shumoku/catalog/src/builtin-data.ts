// Auto-generated from YAML data files — do not edit manually
// Run: bun src/build-data.ts

import type { CatalogEntry } from './types.js'

export const builtinData = [
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
] as unknown as CatalogEntry[]
