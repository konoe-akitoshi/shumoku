---
"@shumoku/renderer": minor
---

A 3Dconnexion SpaceMouse drives the camera through WebHID (Chrome / Edge), as a continuous input (`camera.addMotion`): `openSpaceMouse()` opens a granted or picked device and reports its state and its model's buttons, `motionOf()` turns that state into a motion (deadzone, squared response, the stronger of pan and zoom), and `spaceMouseButtons()` names the buttons of the models it knows (the Pro family and the two-button models; others get none).
