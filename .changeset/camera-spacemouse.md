---
"@shumoku/renderer": minor
---

A 3Dconnexion SpaceMouse drives every diagram on the page, alongside the mouse, through WebHID (Chrome / Edge, HTTPS or localhost): the cap pans and zooms the diagram under the pointer, Fit fits, Shift (held) slows it down. `connectSpaceMouse()` opens the browser's picker from a click; `attachSpaceMouse(camera)` lets the device drive a camera and opens a granted device again (also when re-plugged); `spaceMouseOffer()`, `spaceMouseConnected()` and `onSpaceMouseChange()` let a page show a Connect button, which over plain HTTP says that HTTPS is needed. Buttons are known for the SpaceMouse Pro family, the SpaceExplorer and the two-button models; others move with the cap only. The camera gains `isPointerOver()`.
