---
'@shumoku/core': minor
'@shumoku/renderer': patch
---

A line's colour now names one VLAN, and the colours are worked out rather than listed.

- **What is coloured.** A line carrying a single VLAN is drawn in that VLAN's colour, so the links of one VLAN can be followed by it. A trunk, which carries several VLANs, is drawn in the plain line colour; its caption lists what it carries. Before, every distinct set of VLANs got a colour of its own, so a trunk's colour named nothing.
- **Where the colours come from.** A theme now has `colors.lineTone`: an OKLCH lightness, the most chroma it allows, and a starting hue. The colours follow from it. The hues are spaced evenly, at the least chroma that keeps them apart, so a few VLANs are soft and more of them a little more vivid.
- **What every colour meets.** Contrast of at least 3:1 against every background a line can lie on (WCAG 2.1 non-text contrast), and four just-noticeable differences in OKLab from every other colour.
- **When there are more VLANs than that.** If a diagram has more single-VLAN VLANs than the tone can tell apart (7 in the light theme, 9 in the dark), none is coloured: a colour shared by two VLANs would say they are one.
- **New exports.** `lineColors`, `lineColorCapacity`, `fittingLineTone` (works out a tone from a new theme's backgrounds), `toneFits`, `contrastRatio`, `hueOf` and `oklchToHex`.
- **Removed.** `colors.vlans` is gone.
