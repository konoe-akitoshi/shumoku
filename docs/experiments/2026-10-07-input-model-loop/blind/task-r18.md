This is the external (internet-facing) part of ShowNet 2025, the network of the Interop Tokyo
show, AS290. Facts are from the public ShowNet 2025 topology map and PeeringDB (2026-10).

Border routers, all in AS290: mx204, ncs57c3 and cisco8712.

- kddi-cpe is connected to mx204 port 0-0-0. Behind kddi-cpe is a switch, ncs5501se.kote
  (port 0-0-1-3 to kddi-cpe), at the far end of a KDDI line. On that switch, port 0-0-1-0 goes to
  KDDI Internet Gateway (transit from KDDI), port 0-0-1-1 to the IX JPIX, and port 0-0-1-2 to the
  IX DIX-IE.
- OCN (transit) comes in through apn-cpe, which is connected to ncs57c3 port 0-0-0-24.
- The IX JPNAP is reached over IOWN Open APN, an optical network of NTT; on our side the
  wavelengths end at the optical devices wxd and wxt-1, which are connected to ncs57c3. Which
  wavelength carries JPNAP is not known.
- softbank-cpe is connected to cisco8712 port 0-2-0-0. Over it come the IXes BBIX Tokyo,
  BBIX Singapore and BBIX Hong Kong, and SmartInternet (transit from SoftBank).
- ucxg-cpe has two links to cisco8712, ports 0-1-0-0 and 0-1-0-1. Over them come the IXes JCIX,
  ENTERNET IX and IPA.

Peering LANs (PeeringDB) and AS290's addresses on them:
- JPIX: 210.171.224.0/23 and 2001:de8:8::/64; AS290 is 210.171.224.9 and 2001:de8:8::20:82:1.
- DIX-IE: 202.249.2.0/24 and 2001:200:0:fe00::/64; AS290 is 202.249.2.199 and 2001:200:0:fe00::122:1.
- JPNAP: 210.173.176.0/23 and 2001:7fa:7:1::/64; AS290 is 210.173.176.9 and 2001:7fa:7:1::290:1.
- BBIX Tokyo: 101.203.88.0/22 and 2001:de8:c::/64; AS290 is 101.203.88.109 and 2001:de8:c::290:1.
AS290 peers with other ASes over these IXes (34 on JPIX, 34 on JPNAP, 34 on BBIX Tokyo); who
they are is not listed here. On JPNAP, BBIX Tokyo and DIX-IE, AS290 also peers with the IX's
route server.
