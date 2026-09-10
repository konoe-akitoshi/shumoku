---
'@shumoku/core': patch
---

Parser: an unread YAML key is now an error, never silence.

The parser builds the graph by copying an enumerated set of keys, so anything outside that set used to vanish without a trace — a typo (`lable:`), a whole API envelope pasted into the editor (`{graph: ..., capturedAt: ...}` parsed "successfully" into an EMPTY graph), or observation-layer fields (`rateBps`, `presence`, …) that YAML deliberately does not carry. All three now come back as severity-`error` warnings: `UNKNOWN_KEY` for typos/envelopes, `NOT_AUTHORABLE` (with a use-the-JSON-editor hint) for real model fields outside the authoring schema.

`link.metadata` becomes authorable — nodes could always author metadata; links losing theirs was the same one-sided gap as subgraph identity, not a decision.

The fixed-point test now builds its fixture from the model side instead of feeding the parser its own output (which structurally could not detect dropped fields), and asserts that `dumpGraph` output never yields `UNKNOWN_KEY` — the tripwire for the next schema drift.

The server Manual editor preserves the original graph when saving an untouched YAML preview, as well as when switching tabs. Edited YAML is validated again, and pasted JSON API envelopes are rejected before conversion or saving.
