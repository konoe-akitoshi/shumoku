# Sample data source plugin (`sample-hosts`)

A minimal, complete **external** plugin — the worked example referenced by
[`docs/plugin-authoring.md`](../../docs/plugin-authoring.md). It implements
`HostsCapable` and returns a canned host list, so you can watch a plugin show up
in the UI — config form, capability dispatch, validation — **without editing
`@shumoku/core` or the web app**.

## What it demonstrates

- **Self-description.** `plugin.json` (and `register()` in `index.mjs`) carries a
  `configSchema`. The host's generic `SchemaForm` renders it: a required text
  field, a bounded number, a labelled `oneOf` dropdown, a free-entry tag array,
  and a checkbox — no per-plugin form code.
- **Zero host edits.** `index.mjs` imports nothing from the host. The plugin
  reaches the UI entirely through its descriptor + capabilities.
- **Capability verification.** It advertises `hosts` and implements `getHosts`;
  the registry asserts that at first instantiation.

## Install (no rebuild of the host required)

1. Copy this folder somewhere the server can read, e.g. `./plugins/sample-hosts/`.
2. Point your `plugins.yaml` at it:

   ```yaml
   plugins:
     - id: sample-hosts
       path: ./plugins/sample-hosts
       enabled: true
   ```

3. Restart the API (or use the Plugins page → Add Plugin). It appears in
   **Data Sources → Add** with the form rendered from `configSchema`.

## Files

| File          | Role                                                              |
|---------------|-------------------------------------------------------------------|
| `plugin.json` | Manifest: id / name / version / capabilities / **configSchema**.  |
| `index.mjs`   | The plugin class + `register(registry)` via `registerDescriptor`. |

A real plugin would talk to an upstream via `@shumoku/plugin-sdk`'s `httpClient`
and translate its vocabulary into core's shapes (`Host`, `Alert`, …) at the
boundary. See the bundled plugins in `libs/plugins/` for fuller examples.
