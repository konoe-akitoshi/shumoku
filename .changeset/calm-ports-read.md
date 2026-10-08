---
"@shumoku/core": minor
---

Read network input in the new shape: groups written nested, segments, redundancy sets, routing domains and link endpoints. `YamlParser` reads a document in this shape and reports every issue at once with its path; documents in the older shape read as before. Adds `parseNetworkInput`, `readNetworkInput`, `isNetworkInput`, `toLegacyInput`, `fromLegacyInput` (writes an older document in the new shape and names what it leaves out) and the `inputSchema` namespace.
