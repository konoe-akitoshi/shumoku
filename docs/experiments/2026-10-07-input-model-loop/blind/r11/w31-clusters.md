c2: 1 (9) uses the expected border routers and flags inference; 2 (1,5) put JPIX/DIX-IE addresses on the switch and flag guesses; 3 (2,3,4) key addresses by `as290`.
c3: 3 (2,3,9) cleanly split v4/v6; 2 (1,4) split inconsistently, leaving JPIX’s v6 address under v4; 1 (5) largely omits IPv6.
c4: 3 (1,2,9) tag switch–IX links with segments; 2 (3,5) use untagged switch–IX links; 1 (4) links switch directly to segments; 0 carry segments over the CPE path to mx204.
c5: 3 (1,3,4) use aggregate peer nodes; 2 (2,5) omit peers; 1 (9) preserves counts in descriptions; only 3 and 9 retain “34.”
c6: 3 (1,3,4) attach route-server nodes to LANs; 1 (9) uses virtual router–server sessions; 2 (2,5) omit them; 4 additionally invents an unattached JPIX server.
c7: 5 (1–5) add speculative entities or service-path links; 1 (9) limits additions to explicit placeholders and flagged ownership inference; 0 invent upstream ASNs.

Reported-confusion clusters (writers may overlap):

- **Unnamed peers/counts — 6:** No structural representation for counted but unidentified peers.
- **Unknown optical path — 6:** JPNAP’s wavelength/path is unspecified; possible links risk overstating connectivity.
- **Dual stack — 5 (1,2,4,5,9):** Singular prefix, separate address families, and grouping one LAN are unclear.
- **Address ownership — 4 (1,4,5,9):** AS290 addresses lack named owning routers; address-key rules complicate attribution.
- **AS versus routing domain — 5 (1–5):** AS membership, domain attachment, and domain-keyed addresses are conflated.
- **Service/entity modeling — 4 (1,2,4,5):** IXes, transit, carriers, and lines lack clear entity or service-role representation.
- **LAN attachment/carriage — 3 (3,5,9):** Segment endpoints, service-path links, and incomplete carried-segment lists have unclear semantics.
- **Route-server peering — 3 (2,3,5):** Unclear whether LAN attachment or virtual links represent the peering relationship.