---
'@shumoku/cli': minor
---

**`shumoku render` reads the new network YAML and draws with the new engine.**

- It reads only the new YAML. JSON written in the same shape is also read. The older YAML and graph JSON must be rewritten; see the YAML reference.
- A network that cannot be read is refused with every issue listed at once, each with its path.
- SVG, PNG and HTML are drawn by the new drawing engine. HTML adds pan, zoom and tooltips, and the whole network is one page: sheet navigation is gone.
- The options are unchanged: `-f` / `--format`, `-o` / `--output` (default `output.<format>`), `--theme` and `--scale`.
