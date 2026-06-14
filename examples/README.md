# examples/

Sample `NetworkGraph` YAML files and a sample plugin. Render any of them with the CLI:

```bash
npx shumoku render examples/full-featured.yaml -o diagram.svg
```

| File | Shows |
|------|-------|
| [`full-featured.yaml`](full-featured.yaml) | A broad feature showcase |
| [`device-status.yaml`](device-status.yaml) | Per-device status visualization |
| [`enterprise-ogp.yaml`](enterprise-ogp.yaml) | A realistic enterprise network |
| [`location-based.yaml`](location-based.yaml) | Grouping nodes by location |
| [`prefix-subgraph.yaml`](prefix-subgraph.yaml) | Grouping by IP prefix / subnet |
| [`netbox-enhanced.yaml`](netbox-enhanced.yaml) | A NetBox-derived topology |

[`sample-plugin/`](sample-plugin) is a minimal external data-source plugin (`sample-hosts`) — see its [README](sample-plugin/README.md).

See the [YAML Reference](https://www.shumoku.dev/docs/npm/yaml-reference) for the full format.
