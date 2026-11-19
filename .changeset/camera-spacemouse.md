---
"@shumoku/renderer": minor
---

A 3Dconnexion SpaceMouse drives the camera through WebHID (Chrome / Edge), as a continuous input (`camera.addMotion`): `openSpaceMouse()` opens a granted or picked device and reports its state and its model's buttons, `motionOf()` turns that state into a motion (deadzone, squared response, the stronger of pan and zoom), and `spaceMouseButtons()` names the buttons of the models it knows (the Pro family and the two-button models; others get none).

`attachSpaceMouse(camera)` / `connectSpaceMouse()` connect it for a whole page: the cap drives the diagram under the pointer (a dashboard has several), a granted device is opened again when re-plugged, one open runs at a time, the multi-axis interface is chosen by its usage, and `spaceMouseOffer()` tells a page over plain HTTP (where browsers turn WebHID off) to say that HTTPS is needed. The response is linear-ish (exponent 1.5, deadzone 4 %) and faster (2500 px/s); `SPACEEXPLORER_BUTTONS` and more models are known.
