# @shumoku/cli

## 0.3.1

### Patch Changes

- b7491ba: The CLI now carries the libraries released with core 0.6.0. It builds them into its own file, so CLI 0.3.0 still drew with core 0.5.0: no colour for a line's one VLAN, `external` and `cloud` nodes not always at the top, a VM on a host no line reaches left out, and the same network drawn differently when its links were listed in another order.

## 0.3.0

### Minor Changes

- 6f89ee5: **`shumoku render` reads the new network YAML and draws with the new engine.**
  
  - It reads only the new YAML. JSON written in the same shape is also read. The older YAML and graph JSON must be rewritten; see the YAML reference.
  - A network that cannot be read is refused with every issue listed at once, each with its path.
  - SVG, PNG and HTML are drawn by the new drawing engine. HTML adds pan, zoom and tooltips, and the whole network is one page: sheet navigation is gone.
  - The options are unchanged: `-f` / `--format`, `-o` / `--output` (default `output.<format>`), `--theme` and `--scale`.

## 0.2.28

### Patch Changes

- 97a473f: Define CLI options once in a typed command model shared by argument parsing, help output, and documentation generation.

## 0.2.27

### Patch Changes

- 581e351: Use the canonical ResolvedLayout-based static renderer for CLI SVG/PNG/HTML, server SSR output, Editor export, Playground, and the public SVG/PNG/HTML graph APIs. Preserve tooltip and hierarchical-navigation DOM metadata, add Svelte/static parity coverage for HA hulls, ports, edges, and themes, and isolate the old LayoutResult renderer behind deprecated compatibility exports and prepared-render fallbacks.

## 0.2.26

### Patch Changes

- 66a4b6d: Publish the Shumoku command-line renderer as the public `@shumoku/cli` npm package.
