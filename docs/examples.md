# Examples

様々なネットワーク構成のサンプルです。

## Simple Network

基本的な 3 層ネットワーク構成。

```yaml
name: "Simple Network"

settings:
  direction: TB
  theme: light

subgraphs:
  - id: core
    label: "Core"
  - id: distribution
    label: "Distribution"
  - id: access
    label: "Access"

nodes:
  - id: core-rt
    label: "Core Router"
    type: router
    parent: core

  - id: dist-sw-1
    label: "Dist SW 1"
    type: l3-switch
    parent: distribution

  - id: dist-sw-2
    label: "Dist SW 2"
    type: l3-switch
    parent: distribution

  - id: access-sw-1
    label: "Access SW 1"
    type: l2-switch
    parent: access

  - id: access-sw-2
    label: "Access SW 2"
    type: l2-switch
    parent: access

links:
  - from: { node: core-rt }
    to: { node: dist-sw-1 }
    bandwidth: 10G

  - from: { node: core-rt }
    to: { node: dist-sw-2 }
    bandwidth: 10G

  - from: { node: dist-sw-1 }
    to: { node: access-sw-1 }
    bandwidth: 1G

  - from: { node: dist-sw-2 }
    to: { node: access-sw-2 }
    bandwidth: 1G
```

## Data Center Network

データセンターのスパイン・リーフ構成。

```yaml
name: "Data Center"

settings:
  direction: TB

subgraphs:
  - id: spine
    label: "Spine Layer"
  - id: leaf
    label: "Leaf Layer"
  - id: servers
    label: "Servers"

nodes:
  - id: spine-1
    label: "Spine 1"
    type: l3-switch
    parent: spine

  - id: spine-2
    label: "Spine 2"
    type: l3-switch
    parent: spine

  - id: leaf-1
    label: "Leaf 1"
    type: l3-switch
    parent: leaf

  - id: leaf-2
    label: "Leaf 2"
    type: l3-switch
    parent: leaf

  - id: leaf-3
    label: "Leaf 3"
    type: l3-switch
    parent: leaf

  - id: srv-1
    label: "Server 1"
    type: server
    parent: servers

  - id: srv-2
    label: "Server 2"
    type: server
    parent: servers

  - id: srv-3
    label: "Server 3"
    type: server
    parent: servers

links:
  # Spine to Leaf (full mesh)
  - from: { node: spine-1 }
    to: { node: leaf-1 }
    bandwidth: 100G

  - from: { node: spine-1 }
    to: { node: leaf-2 }
    bandwidth: 100G

  - from: { node: spine-1 }
    to: { node: leaf-3 }
    bandwidth: 100G

  - from: { node: spine-2 }
    to: { node: leaf-1 }
    bandwidth: 100G

  - from: { node: spine-2 }
    to: { node: leaf-2 }
    bandwidth: 100G

  - from: { node: spine-2 }
    to: { node: leaf-3 }
    bandwidth: 100G

  # Leaf to Servers
  - from: { node: leaf-1 }
    to: { node: srv-1 }
    bandwidth: 25G

  - from: { node: leaf-2 }
    to: { node: srv-2 }
    bandwidth: 25G

  - from: { node: leaf-3 }
    to: { node: srv-3 }
    bandwidth: 25G
```

## Enterprise Network with Yamaha

Yamaha 機器を使用した企業ネットワーク。

```yaml
name: "Enterprise Network"

settings:
  direction: TB
  theme: light

subgraphs:
  - id: wan
    label: "WAN"
  - id: dmz
    label: "DMZ"
  - id: lan
    label: "LAN"

nodes:
  - id: internet
    label: "Internet"
    type: internet
    parent: wan

  - id: router
    label: "RTX3510"
    type: router
    vendor: yamaha
    model: rtx3510
    parent: wan

  - id: firewall
    label: "FWX120"
    type: firewall
    vendor: yamaha
    model: fwx120
    parent: dmz

  - id: core-sw
    label: "SWX3220"
    type: l3-switch
    vendor: yamaha
    model: swx3220-16mt
    parent: lan

  - id: ap
    label: "WLX413"
    type: access-point
    vendor: yamaha
    model: wlx413
    parent: lan

  - id: server
    label: "Server"
    type: server
    parent: lan

links:
  - from: { node: internet }
    to: { node: router }
    label: "PPPoE"

  - from: { node: router }
    to: { node: firewall }
    bandwidth: 1G

  - from: { node: firewall }
    to: { node: core-sw }
    bandwidth: 10G

  - from: { node: core-sw }
    to: { node: ap }
    bandwidth: 2.5G

  - from: { node: core-sw }
    to: { node: server }
    bandwidth: 10G
```

## AWS Architecture

AWS クラウドアーキテクチャ。

```yaml
name: "AWS Architecture"

settings:
  direction: TB

subgraphs:
  - id: vpc
    label: "VPC"
  - id: public
    label: "Public Subnet"
  - id: private
    label: "Private Subnet"

nodes:
  - id: igw
    label: "Internet Gateway"
    vendor: aws
    service: vpc
    resource: internet-gateway
    parent: vpc

  - id: alb
    label: "ALB"
    vendor: aws
    service: elb
    resource: application-load-balancer
    parent: public

  - id: nat
    label: "NAT Gateway"
    vendor: aws
    service: vpc
    resource: nat-gateway
    parent: public

  - id: ec2-1
    label: "Web Server 1"
    vendor: aws
    service: ec2
    resource: instance
    parent: private

  - id: ec2-2
    label: "Web Server 2"
    vendor: aws
    service: ec2
    resource: instance
    parent: private

  - id: rds
    label: "RDS"
    vendor: aws
    service: rds
    resource: instance
    parent: private

links:
  - from: { node: igw }
    to: { node: alb }

  - from: { node: alb }
    to: { node: ec2-1 }

  - from: { node: alb }
    to: { node: ec2-2 }

  - from: { node: ec2-1 }
    to: { node: rds }

  - from: { node: ec2-2 }
    to: { node: rds }

  - from: { node: ec2-1 }
    to: { node: nat }

  - from: { node: ec2-2 }
    to: { node: nat }
```

## Juniper Network

Juniper 機器を使用したネットワーク。

```yaml
name: "Juniper Network"

settings:
  direction: LR

nodes:
  - id: mx
    label: "MX480"
    type: router
    vendor: juniper
    model: mx480

  - id: qfx-1
    label: "QFX5120"
    type: l3-switch
    vendor: juniper
    model: qfx5120-48y

  - id: qfx-2
    label: "QFX5120"
    type: l3-switch
    vendor: juniper
    model: qfx5120-48y

  - id: ex-1
    label: "EX4400"
    type: l2-switch
    vendor: juniper
    model: ex4400-48p

  - id: ex-2
    label: "EX4400"
    type: l2-switch
    vendor: juniper
    model: ex4400-48p

  - id: srx
    label: "SRX4600"
    type: firewall
    vendor: juniper
    model: srx4600

links:
  - from: { node: mx }
    to: { node: srx }
    bandwidth: 100G

  - from: { node: srx }
    to: { node: qfx-1 }
    bandwidth: 100G

  - from: { node: srx }
    to: { node: qfx-2 }
    bandwidth: 100G

  - from: { node: qfx-1 }
    to: { node: ex-1 }
    bandwidth: 10G

  - from: { node: qfx-2 }
    to: { node: ex-2 }
    bandwidth: 10G
```
