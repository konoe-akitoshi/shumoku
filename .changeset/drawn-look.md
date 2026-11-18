---
"@shumoku/core": patch
"@shumoku/renderer": patch
---

A node's and a link's look follows from what it is, not from shapes or colours written on it. Every card is one rounded rectangle in the theme's colours, sized by its content: `NodeShape`, `NodeDrawing`, `NodeStyle` and `nodeContentScale` are gone, and the renderer drops its shape catalogue (`node-shape`), so `CardLook.frame` is one rectangle. A wire's colour is its VLAN's or the theme's, its width its speed's, its dash its kind's (virtual, assumed): `LinkStyle` is gone, `minLength` with it (nothing read it). The drawing layer keeps a node's icon, a link's label and type, a group's spec and padding, the settings and the order. `currentDrawing(drawing)` reads a drawing layer an older store kept as the drawing holds one today, dropping node shapes and styles, link styles and group colours; the storage codecs accept and drop the same.
