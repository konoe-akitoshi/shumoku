# FileTabs

See [layout decisions and sources](../../../../../docs/website-ui-kit-layout.md)
before changing dimensions, SVG viewports, or text metrics.

Controlled file-tab presentation, separate from general-purpose `Tabs`.
The caller owns the item list, selected value and close semantics. The component
does not store a second list of open files or implement reopening/persistence.

- `items`: `{ value, label, closable? }[]`
- `value`, `onselect`: selected file
- `onclose`: caller-defined removal action
- `closeLabel`: accessible action label; Playground explicitly uses “Delete”.
- `children(value)`: active editor content; file contents belong to the caller.

Arrow keys stop at the ends; Home/End select the first/last item. Selection and
resize reveal the active tab. Closing restores focus to the selected tab.

`reveal-horizontal.svelte.ts` owns container-local scrolling through a Svelte
attachment. It observes the row and its children, disconnects on selection
changes/unmount, and reveals the entire tab including the close button. Focus
uses `preventScroll` so browser focus handling does not scroll ancestors.
Oversized tabs use nearest-edge behavior rather than oscillating between edges.

Visual reference: [VS Code 1.137 Modern UI tabs](https://github.com/microsoft/vscode/blob/1.137.0/src/vs/workbench/contrib/modernUI/browser/media/tabs.css).
Retains its borderless active background and 4px corners. The row shares the
host's content inset; label padding belongs inside each tab, without shifting
the row or surrounding headings. Colors resolve through site tokens; coarse-pointer hit areas
are enlarged. This is not a complete implementation of VS Code editor behavior.
