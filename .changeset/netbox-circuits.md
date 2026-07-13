---
'shumoku-plugin-netbox': patch
---

**netbox**: import circuits (provider-supplied transport) that the plain
cable-walker dropped. A device interface cabled to a circuit-termination rather
than to another device was skipped entirely, so dark fibers between sites and
uplinks to providers were invisible.

- Fetch `/api/circuits/circuits/` + `/api/circuits/circuit-terminations/` and
  join each circuit back to the device interface it lands on.
- A circuit whose both ends land on owned devices becomes a device↔device link
  (the provider/CID is the label, the port speed the rate).
- A circuit with only one owned end synthesizes a single provider boundary node
  (`DeviceType.Internet`) per provider and links the device to it.
- Non-active circuits (e.g. `planned`) render dashed.
- Circuits are optional: instances without the circuits app, or a token without
  access, degrade to the device/cable graph without failing the sync.
