# Scrollbar appearance and interaction

Import `scrollbar.css` (also imported by `ui.css`) and apply `ui-scrollbar` to the
actual scrolling element. Add `ui-scrollbar--quiet` for editor/workspace surfaces.

```html
<div class="ui-scrollbar ui-scrollbar--quiet" style="overflow: auto">
  <!-- scrollable content -->
</div>
```

- Default: native thin bars, theme-derived thumb and track colors.
- Quiet: on fine/hover devices, reveal on hover or keyboard focus. This is not an
  idle timer. The scrollbar space stays stable; only its appearance changes.
- Put `ui-scrollbar-surface` on a direct parent when hovering a related gutter
  should also reveal the scrollbar. The child can be a textarea.
- Supporting engines suppress arrows using a scoped non-standard WebKit rule.
  Bar/track/thumb use the default cursor; textarea content keeps its text cursor.
  The two-axis corner uses the track color, including in dark mode.
- Coarse input and forced colors retain native defaults. Appearance is not
  identical across browsers; do not replace native dragging with custom JS.

Appearance does not set overflow or intercept wheel events. `horizontalWheel`
is separately attached to FileTabs for vertical-to-horizontal wheel conversion.
CodeEditor instead forwards gutter wheel input to the textarea in its original
axes. Do not attach horizontal conversion to a two-axis editor.

The Workspace section of `/ja/ui-preview` uses the real FileTabs and CodeEditor,
with editable long lines to expose both bars. Check idle/hover/focus, arrow
absence, thumb dragging, the bottom-right corner, gutter scrolling, and theme
changes there. Reset files restores the sample; nothing is saved or transmitted.

Rationale and sources: [layout decisions](../../../../../docs/website-ui-kit-layout.md).
