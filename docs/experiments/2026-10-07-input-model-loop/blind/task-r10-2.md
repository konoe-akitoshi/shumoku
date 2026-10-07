A company has an on-premises server room and uses AWS in the Tokyo region.

Server room:
- rt-1 is a Yamaha RTX3510 router.
- hv-1 and hv-2 are Dell PowerEdge R750 servers running VMware ESXi. They form the vSphere HA
  cluster prod. Each connects to rt-1 at 10G; the ports are not known, and each cable carries
  VLAN 10 (192.168.10.0/24) and nothing else.
- fw-v is a Palo Alto Networks VM-Series firewall running on hv-1. Its network adapter is in the
  port group for VLAN 10, with address 192.168.10.2.
- app-1 is a VM running Ubuntu somewhere in the prod cluster; nobody knows on which host. Its
  adapter is in the port group for VLAN 10, with address 192.168.10.20.

AWS:
- The VPC main has the address range 10.0.0.0/16 and two subnets: sub-a (10.0.1.0/24) in
  availability zone ap-northeast-1a, and sub-c (10.0.2.0/24) in ap-northeast-1c.
- web-c is an EC2 instance of type t3.medium running Amazon Linux, in sub-a with the private
  address 10.0.1.10.
- db-c is an Amazon RDS for MySQL database in sub-c with the address 10.0.2.20.
- The internet gateway igw-1 is attached to the VPC main.
- tgw-1 is a Transit Gateway, attached to the VPC main through sub-a and sub-c.
- rt-1 has a Site-to-Site VPN connection to tgw-1, made of two IPsec tunnels.
