# UI kit maintenance

Before changing spacing, control dimensions, SVG viewports, or typography, read
`docs/website-ui-kit-layout.md` from the repository root. It separates sources,
project decisions, and verification limits.

- `compact.css` owns compact density and input-modality sizing. Reuse its tokens;
  do not independently size Button, Toolbar, and FileTabs in host CSS.
- Keep layout boxes, line boxes, SVG canvases, and hit targets distinct. Do not
  crop an icon or trim text to make a local screenshot look evenly padded.
- Keep interactive targets in the layout, without overlapping adjacent actions.
- Update the real-component UI preview when changing the geometry contract.
- Run website typecheck/tests, then inspect the preview and Playground at wide
  and narrow widths. Source/SSR guards do not prove rendered geometry.
- Report actual tested viewport/input conditions. Do not label a narrow desktop
  viewport as a verified touch device, or claim a grid harness ran when it did not.
