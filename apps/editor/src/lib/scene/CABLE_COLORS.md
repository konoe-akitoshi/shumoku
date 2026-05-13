# Cable jacket colors in Scene mode

Scene mode colors each wire by `link.cable.category` so a floor-plan view matches the physical jackets an installer is holding. This document explains the standards (or absence thereof) the palette draws from. Implementation lives in `cable-colors.ts` next to this file.

The Diagram view uses a different axis — VLAN color (`getVlanStroke` in `libs/@shumoku/renderer`). Both stay in their respective lanes: **logical → VLAN, physical → cable jacket**.

---

## What is standardized

### TIA-598-C — fiber jacket color (firm)

The international standard for optical fiber cable jackets. We follow it exactly for the OM / OS grades:

| Grade | TIA-598-C jacket | Our hex |
|---|---|---|
| **OM1 / OM2** (62.5 / 50 µm MMF, legacy) | Orange | _not represented — covered as `om3+`_ |
| **OM3** (laser-optimized 50 µm) | **Aqua** | `#06B6D4` (cyan-500) |
| **OM4** (bend-insensitive 50 µm) | **Aqua** (some vendors: erika violet) | `#0EA5E9` (sky-500) |
| **OM5** (wideband 50 µm, TIA-598-C 2016) | **Lime green** | `#84CC16` (lime-500) |
| **OS1 / OS2** (single-mode) | **Yellow** | `#EAB308` (yellow-500) |

Aqua-for-MMF and yellow-for-SMF are universal — every fiber installer reads them instantly. We keep them.

### TIA/EIA-606 — administration labels (not used)

TIA/EIA-606 governs the **labeling of telecom records** (demarc, backbone, horizontal, emergency) with colors like orange / green / purple / red. These are **administrative metadata colors**, not cable jacket colors, and don't map cleanly to per-link visualization. We do not use TIA-606 here.

---

## What is industry custom (not standardized)

### Copper Cat grades

TIA/EIA does **not** specify Cat-cable jacket color. Vendors and installers have converged on the following — strong enough to be a working convention, but unenforceable:

| Grade | Common jacket | Our hex | Rationale |
|---|---|---|---|
| **Cat 5e** | Gray (or blue, varies) | `#94A3B8` (slate-400) | Gray reads as "legacy" without clashing |
| **Cat 6** | **Blue** | `#2563EB` (blue-600) | The single most-followed copper convention |
| **Cat 6a** | White / green / violet | `#10B981` (emerald-500) | Green for "10G access" — clearer than violet at small sizes |
| **Cat 7** | Gray / black (shielded) | `#52525B` (zinc-700) | Matches the heavier shielded look |
| **Cat 8** | Often green | `#16A34A` (green-600) | DC-grade copper — same family as Cat 6a but darker |

### DAC / AOC

Direct Attach Copper and Active Optical Cable are rack-internal interconnects without color standards. We pick:

| Grade | Our hex | Rationale |
|---|---|---|
| **DAC** | `#1F2937` (gray-800) | Near-black matches typical passive-copper jackets |
| **AOC** | `#F472B6` (pink-400) | Pink stands out in rack-dense scenes so DAC and AOC don't blur together |

---

## Default (no category set)

When `link.cable.category` is undefined we keep the pre-color-code era stroke: **`#475569` (slate-600)**. This matters because most existing scenes were authored before color-by-category — they should not suddenly look broken.

Selection state still overrides every grade with **`#3B82F6` (blue-500)** so the wire-edit affordance reads regardless of color.

---

## Why not VLAN color in Scene mode?

VLANs are **logical** — a single Cat 6 cable carries N VLANs as a trunk. The Diagram view (which is about logical adjacency) shows that. Scene mode is the **physical floor-plan** view; a cable installer picking the right reel cares about jacket grade, not what 802.1Q tags traverse it. Two different views, two different color axes — each consistent inside its own context.

A user-toggleable color mode (slate / by-category / by-VLAN) is a possible future extension, but only worth adding if the two-context split turns out to be confusing in practice.

---

## Reference

- TIA-598-C: ANSI/TIA-598-C-2014 (with 2016 OM5 amendment). _Optical Fiber Cable Color Coding_.
- TIA/EIA-606-B: _Administration Standard for Telecommunications Infrastructure_. (Not used here — administrative records only.)
- Copper Cat conventions: aggregated from major vendors (CommScope, Panduit, Belden, Hitachi Cable) — no single standard.
