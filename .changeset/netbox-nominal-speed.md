---
'shumoku-plugin-netbox': patch
---

**netbox**: derive link bandwidth from the interface *type* when the operating
`speed` field is unset. NetBox's `speed` officially records the operating
speed and is rarely populated; the nominal capacity lives in `type`, a
required, NetBox-maintained enum whose Ethernet entries follow IEEE 802.3
naming (`100gbase-x-qsfp28` = 100 Gb/s). Explicit `speed` still wins; a link
runs at the lower of its two ends; entries with no fixed rate (virtual / lag /
wireless / SONET…) stay unrated. This lights up bandwidth-proportional link
widths and utilization denominators across the whole topology instead of only
on circuit links.
