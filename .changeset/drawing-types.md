---
"@shumoku/core": patch
---

Refactor the drawing engine so its types say more and its stages hand on values. Composite keys are branded, lookups that cannot miss fail loudly, drawing items and lines are unions, tracks and routes are built as values, and the coordinate stages now return their separations as values with every unknown numbered before any of them runs. The route search compares frames, corners and steps in that order instead of adding them, and the two `simplify` helpers are named for what each drops. A developer guide is added in `src/drawing/README.md`. There is no change to the drawings.
