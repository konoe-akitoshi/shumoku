# @shumoku/cli

## 0.3.0

### Minor Changes

- 9a907f0: Read and write the new network YAML. `readNetworkModel` reads it into a `NetworkModel`, `toNetworkGraph` builds the graph that layout and the renderers draw from a model, and `fromNetworkGraph` / `writeNetworkModel` split a graph back into its configuration and layers and write the configuration as YAML. `sampleNetworkModel()` is the sample network in the new form. The CLI now reads the new YAML (JSON written in the same shape also reads); older YAML and graph JSON must be rewritten.

### Patch Changes

- 62a8035: `readNetworkModel` now refuses a network it cannot read as written and lists every issue at once, each with its path: a field the input does not describe (with the closest field name and the fields allowed there), a value of the wrong shape (a rate without its unit, an `asn` out of range, `assumed: false`, an empty list), and an id nothing defines (a group, segment, routing domain, connection, node or host). It throws a `NetworkInputError` carrying the issues; `checkNetwork` returns them without throwing. The allowed fields are tied to the input types, so the two cannot drift. A port YAML reads as a number, such as `port: 1`, is read as that port's name.

## 0.2.28

### Patch Changes

- 97a473f: Define CLI options once in a typed command model shared by argument parsing, help output, and documentation generation.

## 0.2.27

### Patch Changes

- 581e351: Use the canonical ResolvedLayout-based static renderer for CLI SVG/PNG/HTML, server SSR output, Editor export, Playground, and the public SVG/PNG/HTML graph APIs. Preserve tooltip and hierarchical-navigation DOM metadata, add Svelte/static parity coverage for HA hulls, ports, edges, and themes, and isolate the old LayoutResult renderer behind deprecated compatibility exports and prepared-render fallbacks.

## 0.2.26

### Patch Changes

- 66a4b6d: Publish the Shumoku command-line renderer as the public `@shumoku/cli` npm package.
