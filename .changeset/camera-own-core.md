---
"@shumoku/renderer": minor
---

The camera (`attachCamera`) no longer uses d3-zoom or wheel-gestures. Its view is held in the container's CSS pixels, so:

- A trackpad pans one to one with the fingers whatever the diagram's size (it used to run slower on large diagrams and faster on small ones).
- Redrawing with new bounds keeps the view on the same place; a fitted view stays fitted.
- A mouse wheel notch zooms ×1.2 at the cursor, eased; a pinch zooms at once.
- A mouse wheel is told from a trackpad per burst from evidence (notch values, fine and diagonal deltas, their rate) and leans to panning when unsure. Ctrl/⌘ + wheel always zooms, Alt + wheel does the other thing, Shift + wheel scrolls sideways.
- Space + drag pans, as do the middle button and Alt + drag; the click after a pan no longer changes the selection.
- The drawing cannot be panned out of sight.

New options and methods: `wheelBehavior` (`'auto' | 'zoom' | 'pan'`) with `setWheelBehavior()`, and `leftDrag` (`'pan' | 'none'`) with `setLeftDrag()`. While moving, small labels are hidden with `visibility` instead of `display`, so a gesture no longer rebuilds their layout at its start and end.
