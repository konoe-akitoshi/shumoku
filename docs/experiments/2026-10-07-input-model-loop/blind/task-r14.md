Our network is AS64500. Its two border routers, br1 and br2, are in the data center DC-A.

- br1 port xe-0/0/0 has a 10G cable to a router of AS64510, our transit provider (we are its
  customer). We do not know that router's name. An eBGP session runs over this cable.
- br2 is on the internet exchange IX-T: the IX's peering LAN is 198.51.100.0/24 and br2's
  address on it is 198.51.100.10. AS64520 (.20) and AS64530 (.30) are also on IX-T.
- We peer with AS64520 over IX-T (settlement-free, an eBGP session between br2 and AS64520's
  address on the LAN). We have no session with AS64530.
- We also buy transit from AS64540. That eBGP session is from br2, but which cable or path it uses
  is not known.
