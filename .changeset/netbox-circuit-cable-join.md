---
'shumoku-plugin-netbox': patch
---

**netbox**: style circuit links from the real leg cable instead of a hardcoded
`smf`. The circuit-termination API embeds only an abbreviated cable reference
(no `type`), so the builder now joins it by id against the already-fetched
cable list; when the type genuinely can't be resolved the link is left
unstyled rather than pretending the fiber type is known.
