---
'@shumoku/core': patch
---

`NodeObservation.answeredAt`: the address a device answered on when a source read it from the device itself (over SNMP). The Server's registry takes it as the device's own claim to that address, so an entity that knows the device by its address alone (an inventory, a monitor) and one that knows it by its chassis are merged when the device is read.
