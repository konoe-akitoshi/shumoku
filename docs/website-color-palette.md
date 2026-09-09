# Shumoku website palette

Source of truth: [palette.css](../apps/website/src/lib/ui/palette.css).
Preview: `/ja/ui-preview#palette-title` (development only).

## Direction

Low-saturation neutrals keep Shumoku's existing green logo distinct rather than
spreading its hue across large surfaces. The original wordmark uses #14ae67;
the symbol also includes #13ae67 and #8fc31f. These asset colors remain unchanged.
Light avoids a pure-white canvas; dark avoids pure black and pure-white body text.
This is a visual design choice, not a medical claim about eye strain. Ambient light,
screen brightness, personal preference and readability still matter.

| Role | Light | Dark |
| --- | --- | --- |
| Canvas | `#f5f5f4` | `#1c1f1d` |
| Surface / pane chrome | `#eceeeb` | `#272c28` |
| Field / workspace shell | `#e2e5e1` | `#313832` |
| Hover | `#d8dcd7` | `#3b433c` |
| Selected / pressed | `#cbd2cb` | `#48544a` |
| Main text | `#292c2a` | `#e1e5e1` |
| Secondary text | `#606560` | `#adb5ad` |
| Primary action | `#285d43` | `#326b4c` |
| Primary text | `#f7faf6` | `#f7faf6` |
| Link / focus | `#286449` | `#96c8a6` |
| Error | `#a4322d` | `#efa59b` |

## Ownership and limits

- Both themes use the same semantic roles but independently tuned, opaque colors.
  Do not add component-local mixtures for these roles.
- Workspace shell, chrome and canvas alias these roles; active file tabs use canvas.
- Keep state labels, native semantics and focus indicators; color is not the only cue.
- Logo assets and rendered diagram themes remain unchanged. YAML controls the diagram's theme.
- `palette.test.ts` checks intended normal-text pairs at 4.5:1 or greater, including
  primary hover/active text. This is not an app-wide accessibility compliance claim;
  disabled opacity, imagery, forced-colors and nested backgrounds need separate review.
- Future edits must update this table and inspect both themes in UI preview and Playground.
