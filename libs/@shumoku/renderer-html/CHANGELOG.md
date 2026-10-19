# @shumoku/renderer-html

## 0.2.30

### Patch Changes

- fa09791: Draw what the network YAML says beyond nodes and links. `toNetworkGraph` gives nodes, segment nodes and links `annotations`: typed facts (`identity`, `relation`, `address`, `note`, `detail`, `status`, `badge`) such as the product model, AS number, host or host pool, redundancy set, routing domain, addresses no link end shows, VIPs, description, bandwidth, connection and cable. Annotations are for display and are not split back into the configuration.
  
  A node is drawn as a card: icon and name, a subtitle with model, AS and software, then rows for relations, addresses and the description, up to four, with `+N more`. A link has a boxed caption of up to three lines (what it is, what it carries, its description) above the wires. Supplementary details (cable, prefixes of routing domains and of segments with a VLAN) and the full text of anything shortened are in the SVG title and the tooltip. Layout, interactive rendering and static SVG share one sizing.
  
  A VM gets a VM badge and a hosted node a Hosted badge. Hosting is not a link: a graph `Node` carries `host`, no line or port is drawn, and layout places the node under its host. An assumed node has a dashed outline and an assumed link is dotted (`LinkType` gains `dotted`). A node or segment that names no group is drawn in the one group its segments or joined nodes are in.
- Updated dependencies [9507212]
- Updated dependencies [9598bb7]
- Updated dependencies [633eb93]
- Updated dependencies [e47fa79]
- Updated dependencies [fa09791]
- Updated dependencies [6fa346d]
- Updated dependencies [f320ed5]
- Updated dependencies [eef0f8d]
- Updated dependencies [9a907f0]
- Updated dependencies [62a8035]
- Updated dependencies [5976907]
- Updated dependencies [5a11931]
- Updated dependencies [4927cd8]
- Updated dependencies [df01433]
- Updated dependencies [f325bf1]
- Updated dependencies [aa0cb02]
- Updated dependencies [195ee20]
  - @shumoku/core@1.0.0
  - @shumoku/renderer@0.1.6
  - @shumoku/renderer-svg@0.2.30

## 0.2.29

### Patch Changes

- 704357a: Escape sheet names embedded in the hierarchical HTML output's inline script, so a name containing `</script>` can't inject markup into the exported page.
- Updated dependencies [9830a35]
- Updated dependencies [0e8b8b4]
- Updated dependencies [704357a]
  - @shumoku/core@0.4.2
  - @shumoku/renderer@0.1.5
  - @shumoku/renderer-svg@0.2.29

## 0.2.28

### Patch Changes

- Updated dependencies [97a473f]
  - @shumoku/core@0.4.0
  - @shumoku/renderer@0.1.3
  - @shumoku/renderer-svg@0.2.28

## 0.2.27

### Patch Changes

- bbc9212: Isolate the deprecated LayoutResult SVG renderer behind an explicit legacy compatibility boundary.
- Updated dependencies [bbc9212]
  - @shumoku/renderer-svg@0.2.27

## 0.2.26

### Patch Changes

- 581e351: Use the canonical ResolvedLayout-based static renderer for CLI SVG/PNG/HTML, server SSR output, Editor export, Playground, and the public SVG/PNG/HTML graph APIs. Preserve tooltip and hierarchical-navigation DOM metadata, add Svelte/static parity coverage for HA hulls, ports, edges, and themes, and isolate the old LayoutResult renderer behind deprecated compatibility exports and prepared-render fallbacks.
- Updated dependencies [1be13c4]
- Updated dependencies [581e351]
- Updated dependencies [d9625fb]
- Updated dependencies [e60404d]
- Updated dependencies [14db853]
- Updated dependencies [48199ff]
- Updated dependencies [368672f]
- Updated dependencies [d2b560c]
- Updated dependencies [97a4cf6]
- Updated dependencies [b19c2ec]
- Updated dependencies [6dcfdc3]
- Updated dependencies [caf0c50]
- Updated dependencies [97a4cf6]
- Updated dependencies [d943f92]
- Updated dependencies [3764162]
- Updated dependencies [4639a38]
- Updated dependencies [912bf6f]
- Updated dependencies [0e3bed0]
- Updated dependencies [d2051be]
- Updated dependencies [e5c79a4]
- Updated dependencies [2e27e77]
- Updated dependencies [caf0c50]
- Updated dependencies [caf0c50]
- Updated dependencies [38b4086]
- Updated dependencies [a8370b8]
- Updated dependencies [091471f]
  - @shumoku/core@0.3.0
  - @shumoku/renderer@0.1.1
  - @shumoku/renderer-svg@0.2.26
