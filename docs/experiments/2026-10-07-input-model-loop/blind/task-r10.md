A company has an on-premises server room and uses AWS (Tokyo region).

Server room:
- The router rt-1 is a Yamaha RTX3510.
- The virtualization host hv-1 is a Dell PowerEdge R750 and runs VMware ESXi. It connects to rt-1
  at 10G; the ports are not known.
- On hv-1 run two VMs: fw-v, a Palo Alto Networks VM-Series firewall, and app-1, a VM running
  Ubuntu.

AWS:
- tgw-1 is an AWS Transit Gateway.
- web-c is an EC2 instance (type t3.medium) running Amazon Linux.
- rt-1 has an IPsec VPN connection to tgw-1.
