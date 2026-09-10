# CodeEditor and line-number gutter

Line numbers are presentation, not editable text. The gutter is right-aligned,
excluded from assistive reading, fixed horizontally, and synchronized vertically
with the native textarea. This separation is also used by full editor libraries:
[CodeMirror gutters](https://codemirror.net/examples/gutter/) and
[fixed horizontal gutters](https://codemirror.net/docs/ref/#view.gutters).

This is a small textarea editor, not a replacement for CodeMirror or Monaco.
It does not add line selection, breakpoints, syntax highlighting, or virtualization.
Wrapping stays off so one logical line maps to one gutter row.

The gutter width uses the line-count digit length (minimum two digits), `ch`, and
shared padding tokens. The textarea and numbers inherit exactly the same font
and line height. Its clipping height binds to textarea `clientHeight`, excluding
the horizontal scrollbar. Svelte's [dimension binding](https://svelte.dev/docs/svelte/bind#Dimensions)
owns resize observation. The scroll event updates the visual translation; it
does not make the gutter a second scrolling surface.

Styles belong to CodeEditor rather than the workbench host. Check the last line,
horizontal overflow, 99-to-100 line changes, and narrow widths when editing it.

The textarea uses the shared `ui-scrollbar--quiet` appearance: hover anywhere in
the editor (including the gutter) or keyboard focus reveals the thumb. Supported
desktop engines suppress arrow buttons; coarse input/forced colors stay native.
`gutter-wheel.ts` forwards wheel movement to the textarea without turning vertical
movement into horizontal movement (except the usual Shift-wheel convention).
Ctrl/Meta zoom gestures pass through; events at an edge are not consumed.

Scrollbar pseudo-elements use the default arrow cursor rather than inheriting
the textarea's text cursor. The two-axis corner uses the shared track/background
color so native white corner paint does not show through in dark mode.

## Code surface

The editor uses `--ui-workspace-canvas` without a visible border or its own corner
radius. The enclosing workbench pane (or CompactWorkbenchExample) owns the radius
and clips its children's backgrounds with `overflow: clip`, without becoming a
scroll container. The textarea remains the scroll owner. Internal joins stay square.
