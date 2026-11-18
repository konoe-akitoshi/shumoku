---
"@shumoku/renderer": minor
---

The camera tells a mouse wheel from a trackpad by MapLibre's rule (a multiple of 4.000244140625 is a wheel, a delta under 4 px a trackpad, else the first event after a 400 ms pause waits 40 ms: alone it is a wheel, followed it is a trackpad when `|dt · d| < 200`), in place of matching notch values. A pan drag ends when its release is lost (the window loses focus, the capture goes, or a move arrives with the button up), and a pan released off the diagram no longer swallows the next click.

The camera takes continuous inputs: `camera.addMotion(sample)` reads a velocity (`{ vx, vy, vz }`, CSS px/s and ln-zoom/s) once a frame while it moves the view, zooming about the pointer.

`CameraOptions` loses `scaleExtent`, `panFilter`, `wheelZoomSensitivity` and `pinchZoomSensitivity`, and the camera loses `zoomTo` and `panTo`: nothing used them. The middle button and Alt + left always pan; `setTransform` sets a view.
