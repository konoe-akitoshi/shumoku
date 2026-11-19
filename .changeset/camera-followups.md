---
"@shumoku/renderer": minor
---

The camera no longer guesses whether a wheel event comes from a mouse or a touchpad (browsers cannot tell, and on X11 Chrome or legacy Windows touchpads they do not know either): a plain wheel does what `wheelBehavior` says, `pan` (the default, as Figma, tldraw, Visio and draw.io), `zoom`, or `cooperative` (left to the page, for a diagram embedded in a page that scrolls; `onPageWheel` lets the host show a hint). Ctrl/⌘ + wheel and a pinch always zoom; Alt + wheel swaps scroll and zoom. `WheelBehavior` loses `auto`.

A pan drag ends when its release is lost (the window loses focus, the capture goes, or a move arrives with the button up), and a pan released off the diagram no longer swallows the next click.

The camera takes continuous inputs: `camera.addMotion(sample)` reads a velocity (`{ vx, vy, vz }`, CSS px/s and ln-zoom/s) once a frame while it moves the view, zooming about the pointer.

`CameraOptions` loses `scaleExtent`, `panFilter`, `wheelZoomSensitivity` and `pinchZoomSensitivity`, and the camera loses `zoomTo` and `panTo`: nothing used them. The middle button and Alt + left always pan; `setTransform` sets a view.
