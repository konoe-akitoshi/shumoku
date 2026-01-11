(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,230283,e=>{"use strict";var r=e.i(645841),t=e.i(914614);e.i(649256),e.i(368482);var a=e.i(419707),a=a;e.i(32847);var l=e.i(44717),l=l;e.i(836815);var n=e.i(566555),n=n;let i=`
name: "Enterprise Network"
description: "Enterprise network with HA routers, firewall, DMZ and campus"

settings:
  theme: light

subgraphs:
  # Cloud Layer
  - id: cloud
    label: "Cloud Services"
    vendor: aws
    service: vpc
    resource: virtual-private-cloud-vpc
    style:
      fill: "#f0f8ff"
      stroke: "#0072bc"
      strokeDasharray: "5 5"

  # Edge Layer
  - id: edge
    label: "Edge (HA Routers)"
    style:
      fill: "#fff5f5"
      stroke: "#d4a017"
      strokeWidth: 2

  # Security Layer
  - id: security
    label: "Security"
    style:
      fill: "#fef2f2"
      stroke: "#dc2626"
      strokeWidth: 2

  # DMZ
  - id: dmz
    label: "DMZ"
    style:
      fill: "#fefce8"
      stroke: "#ca8a04"

  # Campus Layer
  - id: campus
    label: "Campus"
    style:
      fill: "#fffbf0"
      stroke: "#d4a017"

  # NOC (nested in campus)
  - id: noc
    label: "NOC"
    parent: campus
    style:
      fill: "#e6f7ff"
      stroke: "#0055a6"
      strokeWidth: 2

  # Building A (nested in campus)
  - id: building-a
    label: "Building A"
    parent: campus
    direction: TB
    style:
      fill: "#f0fdf4"
      stroke: "#22c55e"

  # Building B (nested in campus)
  - id: building-b
    label: "Building B"
    parent: campus
    direction: TB
    style:
      fill: "#fef3c7"
      stroke: "#f59e0b"

nodes:
  # ========== Cloud Layer ==========
  - id: cloud-services
    label:
      - "<b>Services VPC</b>"
      - "CIDR: 172.16.0.0/16"
      - "---"
      - "DNS / DHCP / Monitoring"
    type: server
    vendor: aws
    service: ec2
    resource: instances
    parent: cloud

  - id: vgw
    label:
      - "<b>VPN Gateway</b>"
      - "Peer: 169.254.x.x"
    type: vpn
    vendor: aws
    service: vpc
    resource: vpn-gateway
    parent: cloud

  # ========== Edge Layer ==========
  - id: isp1
    label:
      - "<b>ISP Line #1</b>"
      - "(Primary)"
    type: internet
    parent: edge

  - id: isp2
    label:
      - "<b>ISP Line #2</b>"
      - "(Secondary)"
    type: internet
    parent: edge

  - id: rt1
    label:
      - "<b>Edge-RT-1 (Master)</b>"
      - "Mgmt: 10.0.0.1"
      - "VRRP VIP: 10.0.0.254"
    type: router
    vendor: yamaha
    model: rtx3510
    parent: edge

  - id: rt2
    label:
      - "<b>Edge-RT-2 (Backup)</b>"
      - "Mgmt: 10.0.0.2"
      - "VRRP VIP: 10.0.0.254"
    type: router
    vendor: yamaha
    model: rtx3510
    parent: edge

  # ========== Security Layer ==========
  - id: fw1
    label:
      - "<b>FW-1 (Active)</b>"
      - "Mgmt: 10.0.100.1"
    type: firewall
    vendor: juniper
    model: SRX4100
    parent: security

  - id: fw2
    label:
      - "<b>FW-2 (Standby)</b>"
      - "Mgmt: 10.0.100.2"
    type: firewall
    vendor: juniper
    model: SRX4100
    parent: security

  # ========== DMZ ==========
  - id: dmz-sw
    label:
      - "<b>DMZ-SW</b>"
      - "Mgmt: 10.100.0.1"
    type: l2-switch
    parent: dmz

  - id: web-srv
    label:
      - "<b>Web Server</b>"
      - "10.100.10.10"
    type: server
    parent: dmz

  - id: mail-srv
    label:
      - "<b>Mail Server</b>"
      - "10.100.10.20"
    type: server
    parent: dmz

  # ========== NOC ==========
  - id: core-sw
    label:
      - "<b>Core-SW</b>"
      - "Mgmt: 10.1.0.1"
      - "Inter-VLAN Routing"
    type: l3-switch
    vendor: juniper
    model: QFX5120-48T
    parent: noc

  - id: dist-sw
    label:
      - "<b>Distribution-SW</b>"
      - "Mgmt: 10.1.0.2"
      - "Uplink: 40G"
    type: l3-switch
    vendor: juniper
    model: EX4400-48T
    parent: noc

  # ========== Building A ==========
  - id: sw-a1
    label:
      - "<b>SW-A1 (Floor 1)</b>"
      - "Mgmt: 10.10.0.1"
    type: l2-switch
    vendor: juniper
    model: EX2300-24P
    parent: building-a

  - id: sw-a2
    label:
      - "<b>SW-A2 (Floor 2)</b>"
      - "Mgmt: 10.10.0.2"
    type: l2-switch
    vendor: juniper
    model: EX2300-24P
    parent: building-a

  - id: ap-a1
    label: "AP-A1"
    type: access-point
    vendor: aruba
    model: ap500-series
    parent: building-a

  - id: ap-a2
    label: "AP-A2"
    type: access-point
    vendor: aruba
    model: ap500-series
    parent: building-a

  # ========== Building B ==========
  - id: sw-b1
    label:
      - "<b>SW-B1 (Floor 1)</b>"
      - "Mgmt: 10.20.0.1"
    type: l2-switch
    vendor: yamaha
    model: swx2310_28gt
    parent: building-b

  - id: sw-b2
    label:
      - "<b>SW-B2 (Floor 2)</b>"
      - "Mgmt: 10.20.0.2"
    type: l2-switch
    vendor: yamaha
    model: swx2310_28gt
    parent: building-b

  - id: ap-b1
    label: "AP-B1"
    type: access-point
    vendor: aruba
    model: ap500-series
    parent: building-b

  - id: ap-b2
    label: "AP-B2"
    type: access-point
    vendor: aruba
    model: ap500-series
    parent: building-b

links:
  # ISP to Routers
  - from:
      node: isp1
      port: eth0
      ip: 203.0.113.2/30
    to:
      node: rt1
      port: wan1
      ip: 203.0.113.1/30
    bandwidth: 10G

  - from:
      node: isp2
      port: eth0
      ip: 198.51.100.2/30
    to:
      node: rt2
      port: wan1
      ip: 198.51.100.1/30
    bandwidth: 10G

  # VPN Tunnels
  - from:
      node: vgw
      port: tun0
      ip: 169.254.100.1/30
    to:
      node: rt1
      port: tun1
      ip: 169.254.100.2/30
    label: "IPsec VPN"

  - from:
      node: vgw
      port: tun1
      ip: 169.254.101.1/30
    to:
      node: rt2
      port: tun1
      ip: 169.254.101.2/30
    label: "IPsec VPN"

  # Router HA Keepalive
  - from:
      node: rt1
      port: ha0
      ip: 10.255.0.1/30
    to:
      node: rt2
      port: ha0
      ip: 10.255.0.2/30
    label: "Keepalive"
    redundancy: ha
    style:
      minLength: 300

  # Router to Firewall
  - from:
      node: rt1
      port: lan1
      ip: 10.0.1.1/30
    to:
      node: fw1
      port: outside
      ip: 10.0.1.2/30
    bandwidth: 10G

  - from:
      node: rt2
      port: lan1
      ip: 10.0.1.5/30
    to:
      node: fw2
      port: outside
      ip: 10.0.1.6/30
    bandwidth: 10G

  # Firewall HA
  - from:
      node: fw1
      port: ha
    to:
      node: fw2
      port: ha
    label: "HA Sync"
    redundancy: ha
    style:
      minLength: 300

  # Firewall to Core
  - from:
      node: fw1
      port: inside
      ip: 10.0.2.1/30
    to:
      node: core-sw
      port: eth1
      ip: 10.0.2.2/30
    label: "Active"
    bandwidth: 10G

  - from:
      node: fw2
      port: inside
      ip: 10.0.2.5/30
    to:
      node: core-sw
      port: eth2
      ip: 10.0.2.6/30
    label: "Standby"
    bandwidth: 10G

  # Firewall to DMZ
  - from:
      node: fw1
      port: dmz
      ip: 10.100.0.2/24
    to:
      node: dmz-sw
      port: uplink
      ip: 10.100.0.1/24
    label: "DMZ"
    vlan: 100
    bandwidth: 10G

  # DMZ servers
  - from:
      node: dmz-sw
      port: eth1
    to:
      node: web-srv
      port: eth0
    vlan: 100
    bandwidth: 1G

  - from:
      node: dmz-sw
      port: eth2
    to:
      node: mail-srv
      port: eth0
    vlan: 100
    bandwidth: 1G

  # Core to Distribution
  - from:
      node: core-sw
      port: ae0
      ip: 10.0.3.1/30
    to:
      node: dist-sw
      port: ae0
      ip: 10.0.3.2/30
    label: "40G LACP"
    bandwidth: 40G

  # Distribution to Buildings
  - from:
      node: dist-sw
      port: eth10
      ip: 10.10.0.254/24
    to:
      node: sw-a1
      port: uplink
      ip: 10.10.0.1/24
    label: "Trunk"
    vlan: [10, 20]
    bandwidth: 10G

  - from:
      node: dist-sw
      port: eth20
      ip: 10.20.0.254/24
    to:
      node: sw-b1
      port: uplink
      ip: 10.20.0.1/24
    label: "Trunk"
    vlan: [10, 30]
    bandwidth: 10G

  # Building A cascade
  - from:
      node: sw-a1
      port: eth24
      ip: 10.10.1.1/30
    to:
      node: sw-a2
      port: uplink
      ip: 10.10.1.2/30
    label: "Cascade"
    vlan: [10, 20]
    bandwidth: 10G

  - from:
      node: sw-a1
      port: eth1
    to:
      node: ap-a1
      port: eth0
    vlan: 20
    bandwidth: 1G

  - from:
      node: sw-a2
      port: eth1
    to:
      node: ap-a2
      port: eth0
    vlan: 20
    bandwidth: 1G

  # Building B cascade
  - from:
      node: sw-b1
      port: eth24
      ip: 10.20.1.1/30
    to:
      node: sw-b2
      port: uplink
      ip: 10.20.1.2/30
    label: "Cascade"
    vlan: [10, 30]
    bandwidth: 10G

  - from:
      node: sw-b1
      port: eth1
    to:
      node: ap-b1
      port: eth0
    vlan: 30
    bandwidth: 1G

  - from:
      node: sw-b2
      port: eth1
    to:
      node: ap-b2
      port: eth0
    vlan: 30
    bandwidth: 1G
`,d=`
name: "Simple Network"

settings:
  direction: TB

subgraphs:
  - id: core
    label: "Core"
    style:
      fill: "#f0f4f8"
      stroke: "#4a5568"

  - id: servers
    label: "Servers"
    style:
      fill: "#fff5f5"
      stroke: "#c53030"

nodes:
  - id: router
    label: "Router"
    type: router
    parent: core

  - id: switch
    label: "Switch"
    type: l2-switch
    parent: core

  - id: server1
    label: "Server 1"
    type: server
    parent: servers

  - id: server2
    label: "Server 2"
    type: server
    parent: servers

links:
  - from: router
    to: switch
    label: "10G"
    bandwidth: 10G

  - from: switch
    to: server1
    bandwidth: 1G

  - from: switch
    to: server2
    bandwidth: 1G
`;e.i(508611);var o=e.i(49292);function s(){let[e,s]=(0,t.useState)(i),[p,b]=(0,t.useState)(null),[c,u]=(0,t.useState)(null),[m,h]=(0,t.useState)(null),[f,w]=(0,t.useState)(!1),g=async()=>{w(!0);try{let r=n.parser.parse(e);if(r.warnings&&r.warnings.length>0){let e=r.warnings.filter(e=>"error"===e.severity);if(e.length>0){h(`Parse errors: ${e.map(e=>e.message).join(", ")}`),b(null),u(null),w(!1);return}}let t=new a.HierarchicalLayout,i=await t.layoutAsync(r.graph);b(i);let d=new l.SVGRenderer().render(r.graph,i);u(d),h(null)}catch(e){h(`Error: ${e instanceof Error?e.message:String(e)}`)}finally{w(!1)}};return(0,r.jsxs)("div",{className:"flex h-[calc(100vh-64px)] flex-col",children:[(0,r.jsxs)("div",{className:(0,o.cn)("flex items-center justify-between px-6 py-4","border-b border-neutral-200 dark:border-neutral-700","bg-white dark:bg-neutral-900"),children:[(0,r.jsx)("h1",{className:"text-xl font-semibold",children:"Playground"}),(0,r.jsxs)("div",{className:"flex items-center gap-3",children:[(0,r.jsxs)("select",{className:(0,o.cn)("rounded px-3 py-2 text-sm","border border-neutral-300 dark:border-neutral-600","bg-white dark:bg-neutral-800","focus:outline-none focus:ring-2 focus:ring-blue-500"),onChange:e=>{"enterprise"===e.target.value?s(i):"simple"===e.target.value&&s(d)},children:[(0,r.jsx)("option",{value:"enterprise",children:"Enterprise Network"}),(0,r.jsx)("option",{value:"simple",children:"Simple Network"})]}),(0,r.jsx)("button",{onClick:g,disabled:f,className:(0,o.cn)("rounded px-4 py-2 text-sm font-medium","bg-blue-600 text-white","hover:bg-blue-700 disabled:opacity-50"),children:f?"Rendering...":"Render"}),(0,r.jsx)("button",{onClick:()=>{if(!c)return;let e=window.open("","_blank");e&&(e.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Network Diagram</title>
            <style>
              body { margin: 0; background: #f5f5f5; padding: 20px; min-height: 100vh; }
              .container { background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); display: inline-block; padding: 20px; }
            </style>
          </head>
          <body>
            <div class="container">${c}</div>
          </body>
        </html>
      `),e.document.close())},disabled:!c,className:(0,o.cn)("rounded px-4 py-2 text-sm font-medium","border border-neutral-300 dark:border-neutral-600","bg-white dark:bg-neutral-800","hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50"),children:"Open SVG"}),(0,r.jsx)("button",{onClick:()=>{if(!c)return;let e=new Blob([c],{type:"image/svg+xml;charset=utf-8"}),r=URL.createObjectURL(e),t=document.createElement("a");t.href=r,t.download=`network-diagram-${new Date().toISOString().slice(0,10)}.svg`,t.click(),URL.revokeObjectURL(r)},disabled:!c,className:(0,o.cn)("rounded px-4 py-2 text-sm font-medium","border border-neutral-300 dark:border-neutral-600","bg-white dark:bg-neutral-800","hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50"),children:"Download"})]})]}),m&&(0,r.jsx)("div",{className:"border-b border-red-300 bg-red-100 px-6 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400",children:m}),(0,r.jsxs)("div",{className:"flex flex-1 overflow-hidden",children:[(0,r.jsxs)("div",{className:(0,o.cn)("flex w-1/2 flex-col","border-r border-neutral-200 dark:border-neutral-700"),children:[(0,r.jsx)("div",{className:(0,o.cn)("px-4 py-2","border-b border-neutral-200 dark:border-neutral-700","bg-neutral-50 dark:bg-neutral-800"),children:(0,r.jsx)("span",{className:"text-sm font-medium text-neutral-600 dark:text-neutral-400",children:"YAML"})}),(0,r.jsx)("textarea",{value:e,onChange:e=>s(e.target.value),className:(0,o.cn)("flex-1 resize-none p-4 font-mono text-sm","bg-white dark:bg-neutral-900","focus:outline-none"),spellCheck:!1})]}),(0,r.jsxs)("div",{className:"flex w-1/2 flex-col",children:[(0,r.jsx)("div",{className:(0,o.cn)("px-4 py-2","border-b border-neutral-200 dark:border-neutral-700","bg-neutral-50 dark:bg-neutral-800"),children:(0,r.jsx)("span",{className:"text-sm font-medium text-neutral-600 dark:text-neutral-400",children:"Preview"})}),(0,r.jsx)("div",{className:"relative flex-1 overflow-hidden bg-neutral-100 dark:bg-neutral-800",children:c?(0,r.jsx)("div",{className:"h-full w-full overflow-auto p-4",dangerouslySetInnerHTML:{__html:c}}):(0,r.jsx)("div",{className:"flex h-full items-center justify-center text-neutral-400 dark:text-neutral-500",children:'Click "Render" to generate diagram'})})]})]})]})}e.s(["default",()=>s],230283)}]);