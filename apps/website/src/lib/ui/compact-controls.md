# Compact controls

Rationale, citations, and review checklist: [UI kit layout decisions](../../../../../docs/website-ui-kit-layout.md).
Density is owned by `compact.css`; do not redefine it in host styles.
Scrollbar usage and interactive review: [scrollbar guide](scrollbar.md).

Use `Button size="compact"`, `Disclosure size="compact"`, and `Toolbar compact`
for dense editor tools. Component CSS owns dimensions; host styles only arrange
controls. FileTabs and these controls share `--ui-compact-height`: the compact
height for fine input and the regular control height for coarse input.

The grid uses shared spacing tokens, the same line height, and a common horizontal
label inset (`--ui-compact-label-inset`). Pane headings use that label inset too.
The host aligns control boxes, not individual glyph outlines.

FileTabs reserves actual grid columns for the label button and close button.
The close target is 24px on fine input and 44px on coarse input, always visible.
Its standard 16px Lucide canvas is centered without cropping or transforms.
There are no overflowing hit targets, font-metric-dependent tab heights, or
text trimming overrides. A 32px desktop tab shares the button row rhythm.
Glyph ink is not expected to have identical padding to text line boxes.

Playground uses viewport width to select one or two panes. In the single-pane
layout the Code/Preview switch replaces the pane title rather than adding a row.
Each pane is an inline-size container so its toolbar wraps when the pane narrows.
