---
'@shumoku/core': patch
---

Brand `entityId` fields on Node, NodePort, and Link as `EntityId` (a string nominal type). Add `asEntityId` trust-boundary cast. Server-only writers; plugins never set entityId — no external callers affected.
