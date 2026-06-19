---
'shumoku-plugin-netbox': patch
---

NetBox: pick the Authorization scheme from the token shape — `Bearer` for
v2 tokens (`nbt_<id>.<secret>`, NetBox 4.5+) and `Token` for legacy v1 —
and strip a pasted `Token `/`Bearer ` prefix. The token detail page shows
the full "example usage" header, so pasting it verbatim previously doubled
the scheme (`Authorization: Token Token …`) and returned HTTP 403. This
fixes that and adds v2-token support ahead of v1 removal in NetBox 4.7.
