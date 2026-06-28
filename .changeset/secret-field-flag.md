---
'@shumoku/core': minor
'shumoku-plugin-netbox': patch
'shumoku-plugin-grafana': patch
'shumoku-plugin-prometheus': patch
'shumoku-plugin-zabbix': patch
'shumoku-plugin-aruba-instant-on': patch
---

Add a first-class `secret` flag to plugin config schemas.

`PluginConfigProperty` gains `secret?: boolean`, and `@shumoku/core/plugin-kit`
exports `isSecretProp`. Secret-ness is declared once on the schema
(`secret: true`; `format: 'password'` is still honoured for back-compat), so the
host can render token/password fields masked with a show/hide reveal toggle and
suppress password-manager autofill from a single definition — no per-plugin
branches, no hard-coded field-name lists.

Bundled plugins mark their token/password/webhook-secret fields with
`secret: true`.
