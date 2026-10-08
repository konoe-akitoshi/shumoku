---
"@shumoku/core": minor
---

Add the new network input: `parseNetworkInput` and `readNetworkInput` read the current configuration as it is known (groups written nested, segments, redundancy sets, routing domains, link endpoints) and report every issue at once with its path. Its schema is exported as the `inputSchema` namespace. `toLegacyInput` writes it in the shape `YamlParser` reads, so it can be drawn until drawing reads the input itself. `YamlParser` is unchanged.
