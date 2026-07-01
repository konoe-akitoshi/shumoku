# shumoku-plugin-zabbix

## 0.2.26

### Patch Changes

- 38b4086: Add a first-class `secret` flag to plugin config schemas.

  `PluginConfigProperty` gains `secret?: boolean`, and `@shumoku/core/plugin-kit`
  exports `isSecretProp`. Secret-ness is declared once on the schema
  (`secret: true`; `format: 'password'` is still honoured for back-compat), so the
  host can render token/password fields masked with a show/hide reveal toggle and
  suppress password-manager autofill from a single definition — no per-plugin
  branches, no hard-coded field-name lists.

  Bundled plugins mark their token/password/webhook-secret fields with
  `secret: true`.

- 22b660b: Fix the Zabbix alerts widget showing already-resolved problems when
  `activeOnly` is requested.

  `event.get` was filtered with a top-level `value` parameter, which Zabbix
  ignores (value filtering must go through `filter`), so recovery events leaked
  through. Even with that fixed, a problem that has since recovered still carries
  its original `value=1` event, so active-only queries now also drop events whose
  `r_eventid` points at a recovery event. The mapped `status` uses the same
  recovery check, so resolved-but-recent problems are no longer reported as
  active.

- Updated dependencies [b19c2ec]
- Updated dependencies [3764162]
- Updated dependencies [38b4086]
  - @shumoku/core@0.3.0
