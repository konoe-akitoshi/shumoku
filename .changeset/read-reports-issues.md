---
"@shumoku/core": patch
"@shumoku/cli": patch
---

`readNetworkModel` now refuses a network it cannot read as written and lists every issue at once, each with its path: a field the input does not describe (with the closest field name and the fields allowed there), a value of the wrong shape (a rate without its unit, an `asn` out of range, `assumed: false`, an empty list), and an id nothing defines (a group, segment, routing domain, connection, node or host). It throws a `NetworkInputError` carrying the issues; `checkNetwork` returns them without throwing. The allowed fields are tied to the input types, so the two cannot drift. A port YAML reads as a number, such as `port: 1`, is read as that port's name.
