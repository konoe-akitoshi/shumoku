---
'@shumoku/core': patch
---

Layout: root at an Internet node even at degree 1, and stop reserving crowded-channel space where a single link crosses.

Three fixes to vertical structure, all found chasing one symptom (an upstream chain rendering upside-down and airy):

- **Rank root**: a tier-0 (Internet / Cloud) node was disqualified from seeding the rank root by the "management stub" guard, which rejects degree-1 boundary roles when fat trunks exist elsewhere. The real WAN edge looks exactly like that stub — one link, usually no speed on it — so the map rooted at the first internal router and rendered the Internet *below* the access layer. Tier 0 is a declaration, not a guess, so it is now exempt.
- **Composite band spacing**: the band gap is sized for a crowded channel (edges leaving a wide band, travelling sideways, then descending). Channels are now measured by how many links actually cross them; one crossing link needs only port-label clearance. Same rule inside zone hulls.
- **Flat-tree block sizing**: a top-level node with no parent subgraph is its own single-member block but has no hull and no label strip, yet was padded like one — reserving phantom space around every such node in every gap the tidy-tree measures.
